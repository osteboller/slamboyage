import { CAP_DEFS } from '../config/constants.js';
import { RELIC_DEFS } from '../config/relicDefs.js';
import { ENCHANT_DEFS } from '../config/enchantDefs.js';
import { EFFECT_LABELS } from '../game/effects/labels.js';
import { capThumbnailHTML } from '../ui/capThumbnail.js';

const SKIP_BONUS = 5;

export class RewardScreen {
    constructor({ gameState, ui }) {
        this._gs         = gameState;
        this._ui         = ui;
        this._el         = null;
        this._node       = null;
        this._mode       = 'cap'; // 'cap' | 'relic' | 'enchant'
        this._selected   = null;  // name or relic id
        this.onContinue  = null;
    }

    enter(node = null) {
        this._node = node;
        this._mode = (node?.type === 'relic') ? 'relic' : 'cap';

        this._el    = document.createElement('div');
        this._el.id = 'reward-screen';
        document.body.appendChild(this._el);

        // Sæt score-display til den rigtige carry-forward score (ikke battle-totalen)
        this._ui.setScore(this._gs.score);

        const choices = this._mode === 'relic' ? this._pickRelics() : this._pickCaps();

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

    exit() {
        this._el?.remove();
        this._el = null;
    }

    reroll() {
        if (!this._el) return;
        const choices = this._mode === 'enchant' ? this._pickEnchantChoices()
                      : this._mode === 'relic'   ? this._pickRelics()
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

    _confirm(key) {
        if (this._mode === 'relic') {
            const def = this._choices.find(r => r.id === key);
            if (def) this._gs.addRelic(def);
        } else {
            const def = this._choices.find(c => c.name === key);
            if (def) this._gs.gainCap(def);
        }
        if (this.onContinue) this.onContinue();
    }

    _confirmEnchant(idx) {
        const choice = this._choices[idx];
        if (choice) this._gs.applyEnchant(choice.entry.id, choice.enchantDef.id);
        if (this.onContinue) this.onContinue();
    }

    _pickEnchantChoices() {
        const caps = this._gs.ownedCaps;
        if (caps.length === 0) return [];
        return [0, 1, 2].map(() => ({
            entry:      caps[Math.floor(Math.random() * caps.length)],
            enchantDef: ENCHANT_DEFS[Math.floor(Math.random() * ENCHANT_DEFS.length)],
        }));
    }

    _pickCaps() {
        const unowned = CAP_DEFS.filter(c => !this._gs.ownedCaps.some(o => o.def.name === c.name));
        return unowned.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    _pickRelics() {
        const unowned = RELIC_DEFS.filter(r => !this._gs.hasRelic(r.id));
        // If fewer than 3 unowned, allow duplicates as fallback
        if (unowned.length === 0) return RELIC_DEFS.sort(() => Math.random() - 0.5).slice(0, 3);
        return unowned.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    _render(choices) {
        const nodeLabel = this._mode === 'enchant'
            ? 'Afstikker Cleared!'
            : (this._node?.type === 'relic' ? 'Relic Event' : (this._node ? `Node ${this._node.name} cleared!` : 'Node cleared!'));
        const sub = this._mode === 'enchant'
            ? 'Choose a cap from your collection to enchant'
            : (this._mode === 'relic'
                ? 'Choose a relic — permanent passive bonus'
                : 'Choose a cap for your collection');

        const cardsHTML = this._mode === 'enchant'
            ? this._enchantCards(choices)
            : (this._mode === 'relic'
                ? this._relicCards(choices)
                : this._capCards(choices));

        this._el.innerHTML = `
            <button id="reward-skip-btn">
                SKIP &nbsp;<span class="reward-skip-bonus">+${SKIP_BONUS}★</span>
            </button>
            <div class="reward-title-box">
                <h2 class="reward-title">${nodeLabel}</h2>
                <p class="reward-sub">${sub}</p>
            </div>
            <div class="reward-cards">${cardsHTML}</div>`;

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
            const effectLabel = cap.effect ? EFFECT_LABELS[cap.effect] ?? cap.effect : '';
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

    _relicCards(relics) {
        return relics.map(r => `
            <div class="reward-card reward-card--relic" data-key="${r.id}">
                <div class="reward-relic-icon">${r.icon}</div>
                <div class="reward-cap-name">${r.name}</div>
                <div class="reward-relic-desc">${r.description}</div>
                <button class="reward-quick-pick" data-key="${r.id}">▶ PICK</button>
            </div>`
        ).join('');
    }
}
