import { CAP_DEFS, SLAMMER_DEFS, CARD_PRICE_GROWTH, MAX_OWNED_SLAMMERS, MAX_OWNED_CAPS, CAP_PRICE_GROWTH_PER_LOOP } from '../config/constants.js';
import { BASE_NODES } from '../config/mapData.js';
import { CONSUMABLE_DEFS } from '../config/consumableDefs.js';
import { TRICK_SHOTS } from '../config/trickShotDefs.js';
import { BOSS_DEFS } from '../config/bossDefs.js';

const _commonCaps = CAP_DEFS.filter(c => c.rarity === 1);

export class GameState {
    constructor() {
        this.score          = 0;
        this.runNodes       = [];
        this.nodeIndex      = 0;
        this.stackSizeLimit = 10;
        this.ownedCaps      = [];
        this.ownedSlammers  = [];
        this._loop          = 1;
        this._nextCapId     = 0; // monotonically increasing — unique per owned cap instance
        this._rerollCostBase  = 1;
        this._discardCostBase = 2;
        this._cardPriceMult   = 1;
        this.shopOffer      = null;
        this.consumables    = [null, null, null];
        this.activeDouble   = 0; // stacks: 0=none, 1=×2, 2=×4, 3=×8 …
        this.amplifyStacks  = 0; // AMPLIFYZ — stakker ligesom activeDouble: 0=none, 1=×1 ekstra trigger, 2=×2 ekstra …
        this.shards         = 0; // run-scoped valuta — kun til boss-shoppen
    }

    _mkCapEntry(def, enchant = null) {
        return { id: this._nextCapId++, def, enchant, storedBonus: 0 };
    }

    saveHalflifeBonus(capId, earnedBonus) {
        const entry = this.ownedCaps.find(c => c.id === capId);
        if (entry) entry.storedBonus = Math.floor((entry.storedBonus + earnedBonus) / 2);
    }

    decayHalflifeBonus(capId) {
        const entry = this.ownedCaps.find(c => c.id === capId);
        if (entry) entry.storedBonus = Math.floor(entry.storedBonus / 2);
    }

    // ─── RUN ──────────────────────────────────────────────────────────────────
    get loop()           { return this._loop; }
    get currentNode()    { return this.runNodes[this.nodeIndex] ?? null; }
    get isRunComplete()  { return this.nodeIndex >= this.runNodes.length; }

    startRun() {
        this._loop          = 1;
        this.nodeIndex      = 0;
        this.score          = 0;
        this.shards         = 0;
        this.stackSizeLimit = 10;
        // Test-hånd: demonstrerer crew, rally, halflife og gilded+streak
        const byName = name => CAP_DEFS.find(d => d.name === name);
        this.ownedCaps = [
            this._mkCapEntry(byName('Raptor Fusion'),    'halflife'),
            this._mkCapEntry(byName('Martian Graffiti'), null),
            this._mkCapEntry(byName('Ollien'),           null),
            this._mkCapEntry(byName('Phone Homie'),      null),
            this._mkCapEntry(byName("Surfin' Alien"),    null),
            this._mkCapEntry(byName('Space Rockera'),    'gilded'),
        ].filter(e => e.def);
        // Starter-slammer: altid Regal Pug — den er bevidst passiv-løs, hvilket
        // passer perfekt som en "neutral" starter. Fremtidig idé: karaktervalg
        // med egne startere — se docs/slammer-passives-draft.md.
        this.ownedSlammers  = [];
        const starterSlammer = SLAMMER_DEFS.find(s => s.name === 'Regal Pug');
        if (starterSlammer) this.addSlammer(starterSlammer);
        this.runNodes       = this._generateNodes(1);
        this._rerollCostBase  = 1;
        this._discardCostBase = 2;
        this._cardPriceMult   = 1;
        this.shopOffer      = null;
        const mystixx   = CONSUMABLE_DEFS.find(c => c.id === 'enchant');
        const twinsies  = CONSUMABLE_DEFS.find(c => c.id === 'clone');
        // Skippy (trick shot-skip) er allerede valideret fra en tidligere test-
        // runde — bytter den midlertidigt ud med Amplifyz, som mangler sin første
        // test. Byt tilbage når Amplifyz er bekræftet virkende.
        const amplifyz  = CONSUMABLE_DEFS.find(c => c.id === 'double_relic');
        this.consumables    = [mystixx ?? null, twinsies ?? null, amplifyz ?? null];
        this.activeDouble   = 0; // stacks: 0=none, 1=×2, 2=×4, 3=×8 …
        this.amplifyStacks  = 0;
    }

    // Call when all nodes cleared — bumps loop, resets progress, scales thresholds
    nextLoop() {
        this._loop++;
        this.nodeIndex   = 0;
        this.runNodes    = this._generateNodes(this._loop);
        this._rerollCostBase  = 1;
        // _discardCostBase nulstilles IKKE her — discard-prisen skal blive ved med
        // at eskalere gennem hele runnen, kun startRun() nulstiller den.
        this.shopOffer   = null;
        this.amplifyStacks  = 0;
    }

    // Called after a node battle with the player's full accumulated score.
    // If score >= clearScore, the node costs clearScore ★ and the rest carries forward.
    // Boss-noder er en undtagelse: ★ konverteres til Shards i stedet for at carry'e videre.
    completeNode(totalScore) {
        const node = this.currentNode;
        if (!node) return { won: false };
        if (node.type === 'slammer') {
            this.nodeIndex++;
            return { won: true };
        }
        const won = totalScore >= node.clearScore;
        if (node.boss) {
            this.score = 0; // boss-rundens ★ er kun til threshold-udregning, carry'er ikke
            this.nodeIndex++;
            return { won, isBoss: true, bossShards: won ? this.calculateBossShards(totalScore) : 0 };
        }
        if (won) this.score = totalScore - node.clearScore;
        this.nodeIndex++;
        return { won };
    }

    // ─── SLAMMER PASSIVES ─────────────────────────────────────────────────────
    // Erstatter det tidligere relic-system 1:1 — se docs/slammer-passives-draft.md.
    // Passiver virker for ALLE ejede slammere, uanset hvilken man rent faktisk
    // kaster med (jf. "Besluttet" #1 i draften).
    // Individual multipliers in application order — lets the UI reveal them one by one
    get multiplierChain() {
        const global = this.ownedSlammers
            .filter(s => s.passive?.type === 'globalMultiplier')
            .map(s => s.passive.value);
        const saver = this.ownedSlammers
            .filter(s => s.passive?.type === 'throwSaver' && (s.passive.currentValue ?? 1.0) > 1.0)
            .map(s => s.passive.currentValue);
        return [...global, ...saver];
    }

    get globalMultiplier() {
        return this.multiplierChain.reduce((m, v) => m * v, 1);
    }

    get flatSlammerBonus() {
        return this.ownedSlammers
            .filter(s => s.passive?.type === 'flatBonus')
            .reduce((sum, s) => sum + s.passive.value, 0);
    }

    get throwBonus() {
        return this.ownedSlammers
            .filter(s => s.passive?.type === 'extraThrow')
            .reduce((sum, s) => sum + s.passive.value, 0);
    }

    hasSlammer(name)  { return this.ownedSlammers.some(s => s.name === name); }

    canAddSlammer() { return this.ownedSlammers.length < MAX_OWNED_SLAMMERS; }

    // Returnerer false (uden at mutere ownedSlammers) hvis loftet er nået — kalderen
    // skal vise ui.showMaxSlammersMessage() og lade tilbuddet stå urørt til retry
    // (fx efter spilleren har solgt en slammer via Collection).
    addSlammer(slammerDef) {
        if (!this.canAddSlammer()) return false;
        const entry = { ...slammerDef, passive: slammerDef.passive ? { ...slammerDef.passive } : null };
        if (entry.passive?.type === 'throwSaver') entry.passive.currentValue = 1.0;
        this.ownedSlammers.push(entry);
        if (entry.passive?.type === 'stackSize') this.stackSizeLimit += entry.passive.value;
        return true;
    }

    sellSlammer(name) {
        const entry = this.ownedSlammers.find(s => s.name === name);
        if (!entry) return;
        this.score += entry.sellPrice ?? 0;
        if (entry.passive?.type === 'stackSize') this.stackSizeLimit -= entry.passive.value;
        this.ownedSlammers = this.ownedSlammers.filter(s => s.name !== name);
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

    // Discount-slammer (Bargain Bin) — halverer alle shop-priser (band, packs, reroll, discard).
    get shopDiscountMult() {
        return this.ownedSlammers.some(s => s.passive?.type === 'shopDiscount') ? 0.5 : 1;
    }
    // Underliggende "råt" beløb ganges med rabatten ved aflæsning — selve
    // fordoblingen (useReroll/useDiscard) sker på råt-feltet, så rabatten altid
    // regnes frisk og ikke driver skævt hvis slammeren hentes midt i et shop-besøg.
    get rerollCost()  { return Math.max(1, Math.ceil(this._rerollCostBase  * this.shopDiscountMult)); }
    get discardCost() { return Math.max(1, Math.ceil(this._discardCostBase * this.shopDiscountMult)); }
    // Kort-pris-inflationen (CARD_PRICE_GROWTH) er run-persistent ligesom reroll/discard.
    get cardPriceMultiplier() { return this._cardPriceMult; }
    // Cap-/pakke-priser vokser pr. loop (CAP_PRICE_GROWTH_PER_LOOP) — se ShopScreen._price().
    get capPriceMultiplier() { return 1 + (this._loop - 1) * CAP_PRICE_GROWTH_PER_LOOP; }

    hasConsumableRoom() { return this.consumables.some(s => s === null); }

    canAddCap() { return this.ownedCaps.length < MAX_OWNED_CAPS; }

    // Fallback når collection er fuld ved commit — konverterer den forspildte cap til ★
    // i stedet for at forsvinde stille. Kald i stedet for at pushe når canAddCap() === false.
    compensateFullCollection(capDef) {
        const fallback = Math.ceil(capDef?.sellPrice ?? 4);
        this.score += fallback;
        return fallback; // så UI kan vise "Collection full — +N★ i stedet"
    }

    // Gratis reward-lag (reward/kiste/mystery/pakke-pick) — blokerer ALDRIG flowet:
    // konverterer til ★ via compensateFullCollection() hvis collection er fuld.
    // Returnerer { ok, entry } eller { ok: false, compensated }.
    gainCap(capDef) {
        if (!this.canAddCap()) return { ok: false, compensated: this.compensateFullCollection(capDef) };
        const entry = this._mkCapEntry(capDef);
        this.ownedCaps.push(entry);
        return { ok: true, entry };
    }

    gainEnchantedCap(capDef, enchant = null) {
        if (!this.canAddCap()) return { ok: false, compensated: this.compensateFullCollection(capDef) };
        const entry = this._mkCapEntry(capDef, enchant);
        this.ownedCaps.push(entry);
        return { ok: true, entry };
    }

    // Betalt køb i shoppen — undtaget fra ★-kompensationen (shop-UI'et skal i
    // stedet aktivt disable/vise "FULL", så spilleren aldrig betaler ★ for en
    // cap der bare konverteres tilbage). Afviser derfor stille, ligesom canAfford.
    buyCap(capDef, price) {
        if (!this.canAfford(price)) return false;
        if (!this.canAddCap()) return false;
        this.score -= price;
        this.gainCap(capDef);
        return true;
    }

    // Køber et consumable-kort fra shop-båndet — prisen vokser ×CARD_PRICE_GROWTH
    // for hvert kort købt, resten af runnen (kun startRun() nulstiller den).
    // basePrice = u-rabatteret pris (fx PACK_PRICES.card), samme råt-felt-mønster
    // som rerollCost/discardCost.
    buyConsumableCard(def, basePrice) {
        const price = Math.max(1, Math.ceil(basePrice * this.shopDiscountMult * this._cardPriceMult));
        if (!this.canAfford(price)) return { ok: false, reason: 'afford' };
        const slot = this.addConsumable(def);
        if (slot === false) return { ok: false, reason: 'no_room' };
        this.score -= price;
        this._cardPriceMult *= CARD_PRICE_GROWTH;
        return { ok: true, slot, price };
    }

    // Reroll top band — cost doubles each use per loop
    useReroll() {
        this.score           -= this.rerollCost;
        this._rerollCostBase *= 2;
    }

    // Discard a cap — costs the player ★, doubles each use per loop
    useDiscard(capId) {
        this.score            -= this.discardCost;
        this._discardCostBase *= 2;
        this.ownedCaps    = this.ownedCaps.filter(c => c.id !== capId);
    }

    applyEnchant(capId, enchantId) {
        const entry = this.ownedCaps.find(c => c.id === capId);
        if (entry) entry.enchant = enchantId;
    }

    // ─── TRICK SHOT ───────────────────────────────────────────────────────────
    attemptTrickShot(cost) {
        if (!this.canAfford(cost)) return false;
        this.score -= cost;
        return true;
    }

    // Markerer at nodens reward-skærm skal opgraderes (fx til enchant-valg)
    markRewardUpgraded(nodeId, type = 'enchant') {
        const node = this.runNodes.find(n => n.id === nodeId);
        if (node) node.rewardUpgrade = type;
    }

    // Trick Shot-opgraderingen erstatter nodens baseline-reward, den lægger
    // ikke oveni (reward-chests-draft.md "Besluttet" #7). null/undefined = ingen reward.
    effectiveReward(node) {
        return node?.rewardUpgrade ?? node?.reward ?? null;
    }

    // ─── BOSS ─────────────────────────────────────────────────────────────────
    // Placeholder-thresholds — skal balanceres når vi har rigtige score-tal at teste imod.
    calculateBossShards(totalScore) {
        let shards = 1; // garanteret for at vinde
        if (totalScore > 500)   shards++;
        if (totalScore > 2000)  shards++;
        if (totalScore > 10000) shards++;
        return shards;
    }

    addShards(amount) {
        this.shards += amount;
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

        // Node 1 (battles[0]): altid helt tom — 0★ ved start, ingen baseline-
        // reward og aldrig noget Trick Shot (se også eligibleBattles nedenfor).
        battles[0].reward = null;

        // Baseline-reward-rulle pr. node (jf. reward-chests-draft.md "Besluttet"
        // #6) — knyttet til NODEN, ikke til om den har et Trick Shot. Placeholder-
        // vægte, tunes senere iterativt (ikke mere DaM-research, jf. draften).
        const eligibleBattles = battles.slice(1);
        const REWARD_ROLL = ['silver', 'silver', 'silver', 'enchant', 'mystery'];
        eligibleBattles.forEach(b => {
            b.reward = REWARD_ROLL[Math.floor(Math.random() * REWARD_ROLL.length)];
        });

        // "Pity"-loft (draftens punkt 12): mindst 1 (nogle gange 2) af de 4 noder
        // skal mangle baseline-reward, men højst 1 af dem må forblive HELT tom
        // (uden Trick Shot) — resten af de reward-løse noder SKAL kompenseres.
        const noRewardCount    = Math.random() < 0.5 ? 1 : 2;
        const shuffledForEmpty = [...eligibleBattles].sort(() => Math.random() - 0.5);
        const emptyNodes       = shuffledForEmpty.slice(0, noRewardCount);
        emptyNodes.forEach(b => { b.reward = null; });

        // Trick Shots: 2 pr. run (MAP_AND_SHOP_SPEC.md). Alle reward-løse noder
        // udover den ene "frikort"-tomme SKAL have et Trick Shot — resten af
        // pladserne fordeles tilfældigt mellem den valgfrie tomme node og de
        // almindelige noder, så det varierer om den ender helt tom eller ej.
        const shuffledShots = [...TRICK_SHOTS].sort(() => Math.random() - 0.5);
        const tsCount       = Math.min(2, TRICK_SHOTS.length);
        const mustGetTS     = Math.max(0, emptyNodes.length - 1);
        const emptyShuffled = [...emptyNodes].sort(() => Math.random() - 0.5);
        const restShuffled  = eligibleBattles.filter(b => !emptyNodes.includes(b)).sort(() => Math.random() - 0.5);
        const guaranteed    = emptyShuffled.slice(0, mustGetTS);
        const optionalPool  = [...emptyShuffled.slice(mustGetTS), ...restShuffled].sort(() => Math.random() - 0.5);
        const tsTargets     = [...guaranteed, ...optionalPool].slice(0, tsCount);

        // Trick Shot-reward-typen tildeles PR. NODE (ikke fast pr. trick-shot-
        // type) og må aldrig matche nodens egen baseline — ellers er clearing
        // meningsløst (draftens punkt 9). Inkluderer aldrig sølv (punkt 11).
        const TS_REWARD_ROLL = ['gold', 'gold', 'gold', 'enchant', 'mystery'];
        tsTargets.forEach((battle, i) => {
            const excluded = (battle.reward === 'enchant' || battle.reward === 'mystery') ? battle.reward : null;
            const pool     = TS_REWARD_ROLL.filter(t => t !== excluded);
            battle.trickShot = { ...shuffledShots[i], rewardType: pool[Math.floor(Math.random() * pool.length)] };
        });

        // Boss-node: en ekstra, sværere afsluttende node. Synlig fra start (samme
        // som Trick Shot) — se MapScreen for badge/preview.
        const bossDef  = BOSS_DEFS[Math.floor(Math.random() * BOSS_DEFS.length)];
        const bossNode = {
            type:       'battle',
            id:         6,
            name:       `${loop}-BOSS`,
            clearScore: Math.ceil(BASE_NODES[4].baseClear * scale * (bossDef.clearScoreMultiplier ?? 1.5)),
            boss:       bossDef,
        };

        // Layout: 1-1, 1-2, 1-3, [slammer event], 1-4, 1-5, [BOSS]
        return [
            battles[0],
            battles[1],
            battles[2],
            { type: 'slammer', name: `${loop}-R` },
            battles[3],
            battles[4],
            bossNode,
        ];
    }
}
