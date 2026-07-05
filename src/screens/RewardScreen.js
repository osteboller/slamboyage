import { CAP_DEFS, SLAMMER_DEFS } from '../config/constants.js';
import { ENCHANT_DEFS } from '../config/enchantDefs.js';
import { CONSUMABLE_DEFS } from '../config/consumableDefs.js';
import { effectName } from '../game/effects/labels.js';
import { capThumbnailHTML } from '../ui/capThumbnail.js';
import { pickWeightedItem, pickWeightedItems } from '../config/rarityWeights.js';

const SKIP_BONUS = 5;

export class RewardScreen {
    constructor({ gameState, ui }) {
        this._gs         = gameState;
        this._ui         = ui;
        this._el         = null;
        this._node       = null;
        this._mode       = 'cap'; // 'cap' | 'slammer' | 'enchant' | 'boss' | 'chest' | 'mystery'
        this._selected   = null;  // name or slammer name
        this._bossShards = 0;
        this._chestTier  = 'silver';
        this._chestItem     = null;
        this._mysteryAction = null;
        this.onContinue  = null;
    }

    enter(node = null) {
        this._node = node;
        this._mode = (node?.type === 'slammer') ? 'slammer' : 'cap';

        this._el    = document.createElement('div');
        this._el.id = 'reward-screen';
        document.body.appendChild(this._el);

        // Sæt score-display til den rigtige carry-forward score (ikke battle-totalen)
        this._ui.setScore(this._gs.score);

        const choices = this._mode === 'slammer' ? this._pickSlammers() : this._pickCaps();

        if (choices.length === 0) {
            this._doSkip();
            return;
        }

        this._choices  = choices;
        this._selected = null;
        this._render(choices);

        this._el.addEventListener('click', e => {
            // Quick-pick sticker → direkte valg
            const quickPick = e.target.closest('.reward-quick-pick[data-key]');
            if (quickPick) {
                this._confirm(quickPick.dataset.key);
                return;
            }
            // Klik på kort → åbn detail viewer med PICK-sticker
            const card = e.target.closest('.reward-card[data-key]');
            if (card) {
                const key = card.dataset.key;
                if (this._mode === 'cap') {
                    const def = this._choices.find(c => c.name === key);
                    if (def) this._ui.showCapDetail(def, false, {
                        label:    'PICK',
                        color:    '#000',
                        callback: () => this._confirm(key),
                    });
                } else {
                    this._confirm(key);
                }
                return;
            }
            if (e.target.closest('#reward-skip-btn')) {
                this._doSkip();
            }
        });
    }

    // Afstikker-belønning: enchant valg for caps i samlingen
    enterEnchant(node = null) {
        this._node = node;
        this._mode = 'enchant';

        this._el    = document.createElement('div');
        this._el.id = 'reward-screen';
        document.body.appendChild(this._el);

        this._ui.setScore(this._gs.score);

        const choices = this._pickEnchantChoices();

        if (choices.length === 0) {
            this._doSkip();
            return;
        }

        this._choices  = choices;
        this._selected = null;
        this._render(choices);

        this._el.addEventListener('click', e => {
            const quickPick = e.target.closest('.reward-quick-pick[data-key]');
            if (quickPick) { this._confirmEnchant(parseInt(quickPick.dataset.key)); return; }
            const card = e.target.closest('.reward-card[data-key]');
            if (card) { this._confirmEnchant(parseInt(card.dataset.key)); return; }
            if (e.target.closest('#reward-skip-btn')) this._doSkip();
        });
    }

    // Boss-belønning: vælg mellem 3 rare/legendary caps. Skip giver Shards i
    // stedet for ★ — den normale ★-reward-økonomi er jo lukket ved en boss.
    // context: { bossShards, parentNode }
    enterBoss(context = null) {
        this._node       = context?.parentNode ?? null;
        this._mode       = 'boss';
        this._bossShards = context?.bossShards ?? 0;

        // Threshold-Shards er garanteret uanset cap-valg — tildel dem med det samme
        if (this._bossShards > 0) this._gs.addShards(this._bossShards);

        this._el    = document.createElement('div');
        this._el.id = 'reward-screen';
        document.body.appendChild(this._el);

        this._ui.setScore(this._gs.score);

        const choices = this._pickBossCaps();

        if (choices.length === 0) {
            this._doBossSkip();
            return;
        }

        this._choices  = choices;
        this._selected = null;
        this._render(choices);

        this._el.addEventListener('click', e => {
            const quickPick = e.target.closest('.reward-quick-pick[data-key]');
            if (quickPick) { this._confirm(quickPick.dataset.key); return; }
            const card = e.target.closest('.reward-card[data-key]');
            if (card) {
                const key = card.dataset.key;
                const def = this._choices.find(c => c.name === key);
                if (def) this._ui.showCapDetail(def, false, {
                    label:    'PICK',
                    color:    '#000',
                    callback: () => this._confirm(key),
                });
                return;
            }
            if (e.target.closest('#reward-skip-btn')) this._doBossSkip();
        });
    }

    // Sølv/guld-kiste — ÉT konkret udfald (cap/slammer/kort/point), aldrig et
    // valg mellem 3 (reward-chests-draft.md "Besluttet" #1). context: { node, tier }
    enterChest(context = null) {
        this._node      = context?.node ?? null;
        this._mode      = 'chest';
        this._chestTier = context?.tier ?? 'silver';

        this._el    = document.createElement('div');
        this._el.id = 'reward-screen';
        document.body.appendChild(this._el);
        this._ui.setScore(this._gs.score);

        this._chestItem = this._pickChestItem(this._chestTier);
        this._choices    = [this._chestItem];
        this._render(this._choices);

        this._el.addEventListener('click', e => {
            if (e.target.closest('.reward-quick-pick[data-key]') || e.target.closest('.reward-card[data-key]')) {
                this._confirmChest();
                return;
            }
            if (e.target.closest('#reward-skip-btn')) this._doSkip();
        });
    }

    // Mystery — ét tilfældigt "specielt" udfald (bytte, opgradering, kort, ny
    // cap/slammer). Ikke en kiste — se reward-chests-draft.md "Mystery-node".
    enterMystery(node = null) {
        this._node = node;
        this._mode = 'mystery';

        this._el    = document.createElement('div');
        this._el.id = 'reward-screen';
        document.body.appendChild(this._el);
        this._ui.setScore(this._gs.score);

        this._mysteryAction = this._pickMysteryAction();
        this._choices        = [this._mysteryAction];
        this._render(this._choices);

        this._el.addEventListener('click', e => {
            if (e.target.closest('.reward-quick-pick[data-key]') || e.target.closest('.reward-card[data-key]')) {
                this._confirmMystery();
                return;
            }
            if (e.target.closest('#reward-skip-btn')) this._doSkip();
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    reroll() {
        if (!this._el) return;
        if (this._mode === 'chest')   { this._chestItem     = this._pickChestItem(this._chestTier); }
        if (this._mode === 'mystery') { this._mysteryAction = this._pickMysteryAction(); }
        const choices = this._mode === 'enchant' ? this._pickEnchantChoices()
                      : this._mode === 'slammer' ? this._pickSlammers()
                      : this._mode === 'boss'    ? this._pickBossCaps()
                      : this._mode === 'chest'   ? [this._chestItem]
                      : this._mode === 'mystery' ? [this._mysteryAction]
                      : this._pickCaps();
        if (choices.length === 0) return;
        this._choices  = choices;
        this._selected = null;
        this._render(choices);
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _doSkip() {
        this._gs.score += SKIP_BONUS;
        this._ui.setScore(this._gs.score);
        this._ui.showScoreGain(SKIP_BONUS);
        if (this.onContinue) this.onContinue();
    }

    // Boss-skip giver Shards, ikke ★ — den normale reward-økonomi gælder ikke her
    _doBossSkip() {
        this._gs.addShards(1);
        if (this.onContinue) this.onContinue();
    }

    _confirm(key) {
        if (this._mode === 'slammer') {
            const def = this._choices.find(s => s.name === key);
            if (def) this._gs.addSlammer(def);
        } else {
            const def = this._choices.find(c => c.name === key);
            if (def) this._gs.gainCap(def);
        }
        if (this.onContinue) this.onContinue();
    }

    _confirmEnchant(idx) {
        const choice = this._choices[idx];
        if (!choice) return;
        this._gs.applyEnchant(choice.entry.id, choice.enchantDef.id);
        this._ui.showEnchantResult(choice.enchantDef, choice.entry);
        if (this.onContinue) this.onContinue();
    }

    _confirmChest() {
        const item = this._chestItem;
        if (item) {
            if      (item.kind === 'cap')     this._gs.gainCap(item.def);
            else if (item.kind === 'slammer') this._gs.addSlammer(item.def);
            else if (item.kind === 'card') {
                const slot = this._gs.addConsumable(item.def);
                // Intet ledigt slot — sælg automatisk i stedet for at tabe rewarden helt
                if (slot === false) this._gs.score += item.def.sellPrice ?? 0;
            } else if (item.kind === 'points') {
                this._gs.score += item.amount;
            }
        }
        if (this.onContinue) this.onContinue();
    }

    _confirmMystery() {
        const a = this._mysteryAction;
        if (!a) { if (this.onContinue) this.onContinue(); return; }

        // Bytte-handlinger viser en transform-sticker (samme som MUTTZ-consumablen)
        // og venter med at gå videre til den er set/afvist, i stedet for at
        // springe direkte til shoppen midt i animationen.
        if (a.kind === 'swap_cap') {
            const oldDef = a.entry.def;
            const live   = this._gs.ownedCaps.find(c => c.id === a.entry.id);
            if (live) live.def = a.newDef;
            this._ui.showTransformResult(oldDef, a.newDef, () => { if (this.onContinue) this.onContinue(); });
            return;
        }
        if (a.kind === 'swap_slammer') {
            const oldDef = a.entry;
            // Rent bytte — ingen sælg-refusion, jf. sellSlammer ville give score oveni
            this._gs.ownedSlammers = this._gs.ownedSlammers.filter(s => s.name !== a.entry.name);
            this._gs.addSlammer(a.newDef);
            this._ui.showTransformResult(oldDef, a.newDef, () => { if (this.onContinue) this.onContinue(); });
            return;
        }

        if (a.kind === 'transform_tier') {
            const upgradePool = CAP_DEFS.filter(c => (c.rarity ?? 1) === 2);
            this._gs.ownedCaps.forEach(entry => {
                if ((entry.def.rarity ?? 1) === 1 && upgradePool.length > 0) {
                    entry.def = upgradePool[Math.floor(Math.random() * upgradePool.length)];
                }
            });
        } else if (a.kind === 'card') {
            const slot = this._gs.addConsumable(a.def);
            if (slot === false) this._gs.score += a.def.sellPrice ?? 0;
        } else if (a.kind === 'new_slammer') {
            this._gs.addSlammer(a.def);
        } else if (a.kind === 'new_cap') {
            this._gs.gainCap(a.def);
        }
        if (this.onContinue) this.onContinue();
    }

    _pickEnchantChoices() {
        const caps = this._gs.ownedCaps;
        if (caps.length === 0) return [];
        return [0, 1, 2].map(() => {
            const entry = caps[Math.floor(Math.random() * caps.length)];
            // Udeluk capens nuværende enchant — at "vinde" det den allerede har er ingen reward
            const pool  = ENCHANT_DEFS.filter(e => e.id !== entry.enchant);
            const enchantDef = pool[Math.floor(Math.random() * pool.length)];
            return { entry, enchantDef };
        });
    }

    // Owned caps sorteres IKKE fra — man kan sagtens vinde/genvinde en cap man
    // allerede har (fx for at stakke effekter som crew/surge). Vægtet efter
    // gs.loop (se rarityWeights.js) så man ikke ser en bunke legendaries lige
    // efter node 1-1.
    _pickCaps() {
        return pickWeightedItems(CAP_DEFS, this._gs.loop, 3);
    }

    // Boss-reward: kun rare/legendary, stadig vægtet (loop 1 giver kun rare, ikke legendary)
    _pickBossCaps() {
        const pool = CAP_DEFS.filter(c => (c.rarity ?? 1) >= 3);
        return pickWeightedItems(pool, this._gs.loop, 3);
    }

    _pickSlammers() {
        const unowned = SLAMMER_DEFS.filter(s => !this._gs.hasSlammer(s.name));
        // If fewer than 3 unowned, allow duplicates as fallback
        if (unowned.length === 0) return SLAMMER_DEFS.sort(() => Math.random() - 0.5).slice(0, 3);
        return unowned.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    // Sølv/guld-kiste — ét udfald: cap, slammer, kort, eller point. Guld har
    // bedre odds for sjældne caps/nye slammere. Placeholder-vægte, tunes senere.
    _pickChestItem(tier) {
        const isGold = tier === 'gold';
        const roll = Math.random();
        if (roll < (isGold ? 0.40 : 0.45)) {
            // Owned caps sorteres IKKE fra — duplikater er fair spil.
            const source = isGold ? CAP_DEFS.filter(c => (c.rarity ?? 1) >= 2) : CAP_DEFS;
            return { kind: 'cap', def: pickWeightedItem(source, this._gs.loop) };
        }
        if (roll < 0.65) {
            const pool   = SLAMMER_DEFS.filter(s => !this._gs.hasSlammer(s.name));
            const source = pool.length > 0 ? pool : SLAMMER_DEFS;
            return { kind: 'slammer', def: source[Math.floor(Math.random() * source.length)] };
        }
        if (roll < 0.85) {
            return { kind: 'card', def: CONSUMABLE_DEFS[Math.floor(Math.random() * CONSUMABLE_DEFS.length)] };
        }
        const amount = isGold ? (20 + Math.floor(Math.random() * 30)) : (5 + Math.floor(Math.random() * 15));
        return { kind: 'points', amount };
    }

    // Mystery — ét tilfældigt "specielt" udfald, filtreret til kun det der
    // rent faktisk er muligt lige nu (fx ingen cap-swap uden ejede caps).
    _pickMysteryAction() {
        const owned         = this._gs.ownedCaps;
        const ownedSlammers = this._gs.ownedSlammers;
        const commons       = owned.filter(c => (c.def.rarity ?? 1) === 1);
        const candidates    = ['card', 'new_cap'];

        if (commons.length > 0)       candidates.push('transform_tier');
        if (owned.length > 0)         candidates.push('swap_cap');
        if (ownedSlammers.length > 0) candidates.push('swap_slammer');
        if (SLAMMER_DEFS.some(s => !this._gs.hasSlammer(s.name))) candidates.push('new_slammer');

        const kind = candidates[Math.floor(Math.random() * candidates.length)];

        if (kind === 'transform_tier') {
            return { kind, title: 'Upgrade All Commons', desc: `Transform all ${commons.length} Common cap(s) into random Uncommons.` };
        }
        if (kind === 'swap_cap') {
            const entry = owned[Math.floor(Math.random() * owned.length)];
            const pool  = CAP_DEFS.filter(c => c.name !== entry.def.name);
            const newDef = pickWeightedItem(pool, this._gs.loop);
            return { kind, entry, newDef, title: 'Cap Swap', desc: `Swap ${entry.def.name} for ${newDef.name}.` };
        }
        if (kind === 'swap_slammer') {
            const entry = ownedSlammers[Math.floor(Math.random() * ownedSlammers.length)];
            const pool  = SLAMMER_DEFS.filter(s => s.name !== entry.name);
            const newDef = pool[Math.floor(Math.random() * pool.length)];
            return { kind, entry, newDef, title: 'Slammer Swap', desc: `Swap ${entry.name} for ${newDef.name}.` };
        }
        if (kind === 'new_slammer') {
            const pool = SLAMMER_DEFS.filter(s => !this._gs.hasSlammer(s.name));
            const def  = pool[Math.floor(Math.random() * pool.length)];
            return { kind, def, title: 'New Slammer', desc: `Gain ${def.name}.` };
        }
        if (kind === 'card') {
            const def = CONSUMABLE_DEFS[Math.floor(Math.random() * CONSUMABLE_DEFS.length)];
            return { kind, def, title: def.name, desc: def.description };
        }
        // new_cap — altid mulig, fallback hvis intet andet kunne vælges. Owned
        // caps sorteres ikke fra — duplikater er fair spil.
        const def = pickWeightedItem(CAP_DEFS, this._gs.loop);
        return { kind: 'new_cap', def, title: 'New Cap', desc: `Gain ${def.name}.` };
    }

    _render(choices) {
        const nodeLabel = this._mode === 'enchant' ? 'Enchant Reward'
            : this._mode === 'boss'    ? `Boss Defeated! +${this._bossShards}🔶`
            : this._mode === 'chest'   ? (this._chestTier === 'gold' ? '✪ Gold Chest' : '◎ Silver Chest')
            : this._mode === 'mystery' ? '❔ Mystery'
            : (this._node?.type === 'slammer' ? 'Slammer Event' : (this._node ? `Node ${this._node.name} cleared!` : 'Node cleared!'));
        const sub = this._mode === 'enchant' ? 'Choose a cap from your collection to enchant'
            : this._mode === 'boss'    ? 'Choose a rare cap — or skip for +1 more Shard'
            : this._mode === 'chest'   ? 'Take it, or skip for ★ instead'
            : this._mode === 'mystery' ? 'A special one-off effect — take it, or skip for ★ instead'
            : (this._mode === 'slammer'
                ? 'Choose a slammer — permanent passive bonus'
                : 'Choose a cap for your collection');

        const cardsHTML = this._mode === 'enchant' ? this._enchantCards(choices)
            : this._mode === 'slammer' ? this._slammerCards(choices)
            : this._mode === 'chest'   ? this._chestCard(choices[0])
            : this._mode === 'mystery' ? this._mysteryCard(choices[0])
            : this._capCards(choices);

        const skipLabel = this._mode === 'boss' ? '+1🔶' : `+${SKIP_BONUS}★`;

        this._el.innerHTML = `
            <button id="reward-skip-btn">
                SKIP &nbsp;<span class="reward-skip-bonus">${skipLabel}</span>
            </button>
            <div class="reward-title-box">
                <h2 class="reward-title">${nodeLabel}</h2>
                <p class="reward-sub">${sub}</p>
            </div>
            <div class="reward-cards ${(this._mode === 'chest' || this._mode === 'mystery') ? 'reward-cards--single' : ''}">${cardsHTML}</div>`;

        this._el.querySelectorAll('.reward-card').forEach((card, i) => {
            const delay = i * 90;
            card.classList.add('reward-card--entering');
            card.style.animationDelay = `${delay}ms`;
            setTimeout(() => card.classList.remove('reward-card--entering'), delay + 420);
        });
    }

    _rarityInfo(rarity) {
        switch (rarity) {
            case 4:  return { label: 'LEGENDARY', cls: 'legendary' };
            case 3:  return { label: 'RARE',      cls: 'rare'      };
            case 2:  return { label: 'UNCOMMON',  cls: 'uncommon'  };
            default: return { label: 'COMMON',    cls: 'common'    };
        }
    }

    _capCards(caps) {
        const seriesLabel = s => s.replaceAll('_', ' ');
        return caps.map(cap => {
            const r           = this._rarityInfo(cap.rarity ?? 1);
            const effectLabel = cap.effect ? effectName(cap.effect) : '';
            const effectBadge = effectLabel
                ? `<div class="reward-effect">${effectLabel}</div>` : '';
            return `<div class="reward-card" data-key="${cap.name}">
                <div class="reward-rarity reward-rarity--${r.cls}">${r.label}</div>
                ${capThumbnailHTML(cap, { imgClass: 'reward-cap-img' })}
                <div class="reward-cap-name">${cap.name}</div>
                <div class="reward-cap-series">${seriesLabel(cap.series)}</div>
                ${effectBadge}
                <button class="reward-quick-pick" data-key="${cap.name}">▶ PICK</button>
            </div>`;
        }).join('');
    }

    _enchantCards(choices) {
        const seriesLabel = s => (s ?? '').replaceAll('_', ' ');
        return choices.map((choice, i) => {
            const { entry, enchantDef } = choice;
            const oldEnchant = entry.enchant ? ENCHANT_DEFS.find(e => e.id === entry.enchant) : null;
            const replaceHTML = oldEnchant
                ? `<div class="reward-enchant-replace">${oldEnchant.icon} ${oldEnchant.name} → replaced</div>`
                : '';
            return `<div class="reward-card" data-key="${i}">
                <div class="reward-rarity reward-rarity--uncommon">ENCHANT</div>
                ${capThumbnailHTML(entry, { imgClass: 'reward-cap-img' })}
                <div class="reward-cap-name">${entry.def.name}</div>
                <div class="reward-cap-series">${seriesLabel(entry.def.series)}</div>
                <div class="reward-enchant-name" style="color:${enchantDef.color}">${enchantDef.icon} ${enchantDef.name}</div>
                <div class="reward-enchant-desc">${enchantDef.description}</div>
                ${replaceHTML}
                <button class="reward-quick-pick" data-key="${i}">▶ PICK</button>
            </div>`;
        }).join('');
    }

    _slammerCards(slammers) {
        return slammers.map(s => `
            <div class="reward-card reward-card--relic" data-key="${s.name}">
                <img class="reward-cap-img" src="${s.texFront}" alt="${s.name}">
                <div class="reward-cap-name">${s.name}</div>
                <div class="reward-relic-desc">${s.passive ? `${s.passive.icon} ${s.passive.name} — ${s.passive.description}` : 'No passive'}</div>
                <button class="reward-quick-pick" data-key="${s.name}">▶ PICK</button>
            </div>`
        ).join('');
    }

    _headerTextColor(hex) {
        if (!hex) return '#fff';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000' : '#fff';
    }

    // Sølv/guld-kiste — ÉT kort, ikke 3 (reward-chests-draft.md). Udseendet
    // afhænger af hvad kisten reelt indeholder (cap/slammer/kort/point).
    _chestCard(item) {
        const tierLabel = this._chestTier === 'gold' ? 'GOLD CHEST' : 'SILVER CHEST';
        const tierCls   = this._chestTier === 'gold' ? 'legendary' : 'common';

        if (item.kind === 'cap') {
            const r    = this._rarityInfo(item.def.rarity ?? 1);
            const effL = item.def.effect ? effectName(item.def.effect) : '';
            return `<div class="reward-card" data-key="chest">
                <div class="reward-rarity reward-rarity--${r.cls}">${tierLabel}</div>
                ${capThumbnailHTML(item.def, { imgClass: 'reward-cap-img' })}
                <div class="reward-cap-name">${item.def.name}</div>
                <div class="reward-cap-series">${item.def.series.replaceAll('_', ' ')}</div>
                ${effL ? `<div class="reward-effect">${effL}</div>` : ''}
                <button class="reward-quick-pick" data-key="chest">▶ TAKE</button>
            </div>`;
        }
        if (item.kind === 'slammer') {
            const s = item.def;
            return `<div class="reward-card reward-card--relic" data-key="chest">
                <div class="reward-rarity reward-rarity--${tierCls}">${tierLabel}</div>
                <img class="reward-cap-img" src="${s.texFront}" alt="${s.name}">
                <div class="reward-cap-name">${s.name}</div>
                <div class="reward-relic-desc">${s.passive ? `${s.passive.icon} ${s.passive.name} — ${s.passive.description}` : 'No passive'}</div>
                <button class="reward-quick-pick" data-key="chest">▶ TAKE</button>
            </div>`;
        }
        if (item.kind === 'card') {
            const c      = item.def;
            const stripe = `repeating-linear-gradient(-45deg, ${c.bg} 0px, ${c.bg} 2px, #fff 2px, #fff 4px)`;
            const tCol   = this._headerTextColor(c.color);
            return `<div class="reward-card reward-card--gumcard" data-key="chest">
                <div class="gum-pack-top" style="background:${stripe};">
                    <div class="gum-pack-header" style="background:${c.color}; color:${tCol};">${c.name}</div>
                    <div class="gum-pack-icon">${c.icon}</div>
                </div>
                <div class="gum-pack-bottom">
                    <div class="gum-pack-flavor">${c.flavor}</div>
                    <div class="gum-pack-desc">${c.description}</div>
                </div>
                <div class="gum-pack-footer" style="background:${stripe};">
                    <button class="reward-quick-pick" data-key="chest">▶ TAKE</button>
                </div>
            </div>`;
        }
        // points
        return `<div class="reward-card" data-key="chest">
            <div class="reward-rarity reward-rarity--${tierCls}">${tierLabel}</div>
            <div class="reward-points-display">★${item.amount}</div>
            <div class="reward-cap-name">Bonus Score</div>
            <button class="reward-quick-pick" data-key="chest">▶ TAKE</button>
        </div>`;
    }

    // Mystery — ét kort. Man ser allerede det faktiske udfald her (det er jo
    // afsløret, ikke skjult mere), så kortet viser en visning der passer til
    // HVAD det er — ikke et generisk "?" (det hører kun til på kortet, før man
    // ved hvad det bliver).
    _mysteryCard(action) {
        const wrap = bodyHTML => `<div class="reward-card reward-card--relic" data-key="mystery">
            <div class="reward-rarity reward-rarity--rare">MYSTERY</div>
            ${bodyHTML}
            <div class="reward-cap-name">${action.title}</div>
            <div class="reward-relic-desc">${action.desc}</div>
            <button class="reward-quick-pick" data-key="mystery">▶ TAKE</button>
        </div>`;

        if (action.kind === 'swap_cap') {
            return wrap(`<div class="reward-swap-row">
                ${capThumbnailHTML({ def: action.entry.def, enchant: action.entry.enchant }, { imgClass: 'transform-result-img transform-result-img--old' })}
                <span class="reward-swap-arrow">→</span>
                ${capThumbnailHTML({ def: action.newDef }, { imgClass: 'transform-result-img' })}
            </div>`);
        }
        if (action.kind === 'swap_slammer') {
            return wrap(`<div class="reward-swap-row">
                <img src="${action.entry.texFront}" class="transform-result-img transform-result-img--old" alt="${action.entry.name}">
                <span class="reward-swap-arrow">→</span>
                <img src="${action.newDef.texFront}" class="transform-result-img" alt="${action.newDef.name}">
            </div>`);
        }
        if (action.kind === 'transform_tier') {
            return wrap(`<div class="reward-swap-row">
                <span class="reward-rarity-pill reward-rarity-pill--common">COMMON</span>
                <span class="reward-swap-arrow">→</span>
                <span class="reward-rarity-pill reward-rarity-pill--uncommon">UNCOMMON</span>
            </div>`);
        }
        if (action.kind === 'card') {
            const c = action.def;
            return wrap(`<div class="reward-mystery-card-icon" style="background:${c.color};">${c.icon}</div>`);
        }
        if (action.kind === 'new_slammer') {
            return wrap(`<img class="reward-cap-img" src="${action.def.texFront}" alt="${action.def.name}">`);
        }
        // new_cap
        return wrap(capThumbnailHTML(action.def, { imgClass: 'reward-cap-img' }));
    }
}
