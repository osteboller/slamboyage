import { CAP_DEFS } from '../config/constants.js';
import { RELIC_DEFS } from '../config/relicDefs.js';
import { EFFECT_LABELS } from '../game/effects/labels.js';

const SKIP_BONUS = 5;

export class RewardScreen {
    constructor({ gameState, ui }) {
        this._gs         = gameState;
        this._ui         = ui;
        this._el         = null;
        this._node       = null;
        this._mode       = 'cap'; // 'cap' | 'relic'
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

        this._selected = null;
        this._render(choices);

        this._el.addEventListener('click', e => {
            // Klik på cap-billede → åbn viewer uden at vælge kortet
            const capImg = e.target.closest('.reward-cap-img');
            if (capImg && this._mode === 'cap') {
                const key = capImg.closest('.reward-card[data-key]')?.dataset.key;
                const def = choices.find(c => c.name === key);
                if (def) this._ui.showCapDetail(def, false);
                return;
            }
            const card = e.target.closest('.reward-card[data-key]');
            if (card) {
                const key = card.dataset.key;
                if (this._selected === key) this._confirm(key, choices);
                else                        this._select(key);
                return;
            }
            if (e.target.closest('#reward-skip-btn')) {
                this._doSkip();
            }
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    reroll() {
        if (!this._el) return;
        const choices = this._mode === 'relic' ? this._pickRelics() : this._pickCaps();
        if (choices.length === 0) return;
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

    _select(key) {
        this._selected = key;
        this._el.querySelectorAll('.reward-card[data-key]').forEach(c => {
            const sel = c.dataset.key === key;
            c.classList.toggle('selected', sel);
            const lbl = c.querySelector('.reward-pick-label');
            if (lbl) lbl.textContent = sel ? 'Tap again ✓' : 'Pick';
        });
    }

    _confirm(key, choices) {
        if (this._mode === 'relic') {
            const def = choices.find(r => r.id === key);
            if (def) this._gs.addRelic(def);
        } else {
            const def = choices.find(c => c.name === key);
            if (def) this._gs.ownedCaps.push({ def, enchant: null });
        }
        if (this.onContinue) this.onContinue();
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
        const nodeLabel = this._node?.type === 'relic'
            ? 'Relic Event'
            : (this._node ? `Node ${this._node.name} cleared!` : 'Node cleared!');
        const sub       = this._mode === 'relic'
            ? 'Choose a relic — permanent passive bonus'
            : 'Choose a cap for your collection';

        const cardsHTML = this._mode === 'relic'
            ? this._relicCards(choices)
            : this._capCards(choices);

        this._el.innerHTML = `
            <div class="reward-inner">
                <h2 class="reward-title">${nodeLabel}</h2>
                <p class="reward-sub">${sub}</p>
                <div class="reward-cards">${cardsHTML}</div>
                <button id="reward-skip-btn" class="reward-skip">
                    Skip &nbsp;<span class="reward-skip-bonus">+${SKIP_BONUS}★</span>
                </button>
            </div>`;

        this._el.querySelectorAll('.reward-card').forEach((card, i) => {
            card.classList.add('band-item--entering');
            card.style.animationDelay = `${i * 80}ms`;
        });
    }

    _capCards(caps) {
        const seriesLabel = s => s.replaceAll('_', ' ');
        return caps.map(cap => {
            const effectLabel = cap.effect ? EFFECT_LABELS[cap.effect] ?? cap.effect : '';
            const effectBadge = effectLabel
                ? `<div class="reward-effect">${effectLabel}</div>` : '';
            return `<button class="reward-card" data-key="${cap.name}">
                <img class="reward-cap-img" src="${cap.texFront}" alt="${cap.name}">
                <div class="reward-cap-name">${cap.name}</div>
                <div class="reward-cap-series">${seriesLabel(cap.series)}</div>
                ${effectBadge}
                <div class="reward-pick-label">Pick</div>
            </button>`;
        }).join('');
    }

    _relicCards(relics) {
        return relics.map(r => `
            <button class="reward-card reward-card--relic" data-key="${r.id}">
                <div class="reward-relic-icon">${r.icon}</div>
                <div class="reward-cap-name">${r.name}</div>
                <div class="reward-relic-desc">${r.description}</div>
                <div class="reward-pick-label">Pick</div>
            </button>`
        ).join('');
    }
}
