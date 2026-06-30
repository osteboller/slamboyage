import { CAP_DEFS } from '../config/constants.js';
import { BASE_NODES } from '../config/mapData.js';
import { CONSUMABLE_DEFS } from '../config/consumableDefs.js';

const _commonCaps = CAP_DEFS.filter(c => c.rarity === 1);

export class GameState {
    constructor() {
        this.score          = 0;
        this.runNodes       = [];
        this.nodeIndex      = 0;
        this.stackSizeLimit = 10;
        this.ownedCaps      = [];
        this.ownedRelics    = [];
        this._loop          = 1;
        this._nextCapId     = 0; // monotonically increasing — unique per owned cap instance
        this.rerollCost     = 1;
        this.discardCost    = 2;
        this.shopOffer      = null;
        this.consumables    = [null, null, null];
        this.activeDouble   = 0; // stacks: 0=none, 1=×2, 2=×4, 3=×8 …
    }

    _mkCapEntry(def, enchant = null) {
        return { id: this._nextCapId++, def, enchant };
    }

    // ─── RUN ──────────────────────────────────────────────────────────────────
    get loop()           { return this._loop; }
    get currentNode()    { return this.runNodes[this.nodeIndex] ?? null; }
    get isRunComplete()  { return this.nodeIndex >= this.runNodes.length; }

    startRun() {
        this._loop          = 1;
        this.nodeIndex      = 0;
        this.score          = 0;
        this.stackSizeLimit = 10;
        // Test-hånd: demonstrerer crew, rally, halflife og gilded+streak
        const byName = name => CAP_DEFS.find(d => d.name === name);
        this.ownedCaps = [
            this._mkCapEntry(byName('Martian Graffiti'), null),      // crew — giver +1 til alle cosmic_caps
            this._mkCapEntry(byName('Ollien'),           null),      // rally — giver +1 til alle i nærheden
            this._mkCapEntry(byName('Phone Homie'),      null),      // modtager fra begge
            this._mkCapEntry(byName("Surfin' Alien"),    null),      // modtager fra begge
            this._mkCapEntry(byName('Hang Light'),       'halflife'),// scorer 1★ selvom den ikke flippes
            this._mkCapEntry(byName('Space Rockera'),    'gilded'),  // streak + gilded
        ].filter(e => e.def);
        this.ownedRelics    = [];
        this.runNodes       = this._generateNodes(1);
        this.rerollCost     = 1;
        this.discardCost    = 2;
        this.shopOffer      = null;
        const mystixx = CONSUMABLE_DEFS.find(c => c.id === 'enchant');
        this.consumables    = [mystixx ?? null, mystixx ?? null, mystixx ?? null];
        this.activeDouble   = 0; // stacks: 0=none, 1=×2, 2=×4, 3=×8 …
    }

    // Call when all nodes cleared — bumps loop, resets progress, scales thresholds
    nextLoop() {
        this._loop++;
        this.nodeIndex   = 0;
        this.runNodes    = this._generateNodes(this._loop);
        this.rerollCost  = 1;
        this.discardCost = 2;
        this.shopOffer   = null;
    }

    // Called after a node battle with the player's full accumulated score.
    // If score >= clearScore, the node costs clearScore ★ and the rest carries forward.
    completeNode(totalScore) {
        const node = this.currentNode;
        if (!node) return { won: false };
        if (node.type === 'relic') {
            this.nodeIndex++;
            return { won: true };
        }
        const won = totalScore >= node.clearScore;
        if (won) this.score = totalScore - node.clearScore;
        this.nodeIndex++;
        return { won };
    }

    // ─── RELICS ───────────────────────────────────────────────────────────────
    // Individual multipliers in application order — lets the UI reveal them one by one
    get multiplierChain() {
        const global = this.ownedRelics
            .filter(r => r.type === 'globalMultiplier')
            .map(r => r.value);
        const saver = this.ownedRelics
            .filter(r => r.type === 'throwSaver' && (r.currentValue ?? 1.0) > 1.0)
            .map(r => r.currentValue);
        return [...global, ...saver];
    }

    get globalMultiplier() {
        return this.multiplierChain.reduce((m, v) => m * v, 1);
    }

    get flatRelicBonus() {
        return this.ownedRelics
            .filter(r => r.type === 'flatBonus')
            .reduce((sum, r) => sum + r.value, 0);
    }

    get throwBonus() {
        return this.ownedRelics
            .filter(r => r.type === 'extraThrow')
            .reduce((sum, r) => sum + r.value, 0);
    }

    hasRelic(relicId)  { return this.ownedRelics.some(r => r.id === relicId); }

    addRelic(relicDef) {
        const entry = { ...relicDef };
        if (entry.type === 'throwSaver') entry.currentValue = 1.0;
        this.ownedRelics.push(entry);
        if (entry.type === 'stackSize') this.stackSizeLimit += entry.value;
    }

    // ─── CONSUMABLES ──────────────────────────────────────────────────────────
    addConsumable(def) {
        const slot = this.consumables.findIndex(s => s === null);
        if (slot === -1) return false;
        this.consumables[slot] = def;
        return slot; // return index so callers can animate the correct slot
    }

    useConsumable(idx) {
        const def = this.consumables[idx];
        if (!def) return null;
        this.consumables[idx] = null;
        return def;
    }

    sellConsumable(idx) {
        const def = this.consumables[idx];
        if (!def) return;
        this.score += def.sellPrice;
        this.consumables[idx] = null;
    }

    // ─── SHOP ─────────────────────────────────────────────────────────────────
    canAfford(price)      { return this.score >= price; }
    hasCapDef(capDef)     { return this.ownedCaps.some(c => c.def.name === capDef.name); }

    gainCap(capDef) {
        this.ownedCaps.push(this._mkCapEntry(capDef));
    }

    gainEnchantedCap(capDef, enchant = null) {
        this.ownedCaps.push(this._mkCapEntry(capDef, enchant));
    }

    buyCap(capDef, price) {
        if (!this.canAfford(price)) return false;
        this.score -= price;
        this.gainCap(capDef);
        return true;
    }

    // Reroll top band — cost doubles each use per loop
    useReroll() {
        this.score      -= this.rerollCost;
        this.rerollCost *= 2;
    }

    // Discard a cap — costs the player ★, doubles each use per loop
    useDiscard(capId) {
        this.score       -= this.discardCost;
        this.discardCost *= 2;
        this.ownedCaps    = this.ownedCaps.filter(c => c.id !== capId);
    }

    applyEnchant(capId, enchantId) {
        const entry = this.ownedCaps.find(c => c.id === capId);
        if (entry) entry.enchant = enchantId;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────
    _generateNodes(loop) {
        const scale = 1 + (loop - 1) * 0.5; // loop 1: ×1.0 | loop 2: ×1.5 | loop 3: ×2.0
        const battles = BASE_NODES.map((n, i) => ({
            type:       'battle',
            id:         i + 1,
            name:       `${loop}-${i + 1}`,
            clearScore: Math.ceil(n.baseClear * scale),
        }));
        // Layout: 1-1, 1-2, [relic event], 1-3, 1-4, 1-5
        return [
            battles[0],
            battles[1],
            { type: 'relic', name: `${loop}-R` },
            battles[2],
            battles[3],
            battles[4],
        ];
    }
}
