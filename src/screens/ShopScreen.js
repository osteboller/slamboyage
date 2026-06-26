import { CAP_DEFS } from '../config/constants.js';
import { CAP_PRICE } from '../config/mapData.js';
import { EFFECT_LABELS } from '../game/effects/labels.js';
import { RELIC_DEFS } from '../config/relicDefs.js';

const BAND_SIZE   = 5;
const PACK_PRICES = [8, 10];

export class ShopScreen {
    constructor({ gameState, ui }) {
        this._gs           = gameState;
        this._ui           = ui;
        this._el           = null;
        this._band         = [];
        this._packs        = [];
        this._pendingPack  = null;
        this._justRerolled = false; // triggers staggered band animation
        this.onContinue    = null;
    }

    enter() {
        this._band        = this._genBand();
        this._packs       = this._genPacks();
        this._pendingPack = null;

        this._el    = document.createElement('div');
        this._el.id = 'shop-screen';
        document.body.appendChild(this._el);
        this._justRerolled = true;
        this._render();
        this._justRerolled = false;
        this._el.addEventListener('click', e => this._onClick(e));
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    // ─── CLICK HANDLER ────────────────────────────────────────────────────────

    _onClick(e) {
        // Continue
        if (e.target.closest('#shop-continue-btn')) {
            if (this.onContinue) this.onContinue();
            return;
        }

        // Reroll band
        if (e.target.closest('#shop-reroll-btn')) {
            const cost = this._gs.rerollCost;
            if (!this._gs.canAfford(cost)) return;
            this._gs.useReroll();
            this._band         = this._genBand();
            this._justRerolled = true;
            this._render();
            this._justRerolled = false;
            return;
        }

        // Open discard overlay
        if (e.target.closest('#shop-discard-btn')) {
            this._el.querySelector('#shop-discard-overlay').style.display = '';
            return;
        }
        if (e.target.closest('#shop-discard-close')) {
            this._el.querySelector('#shop-discard-overlay').style.display = 'none';
            return;
        }

        // Discard a cap
        const discardCap = e.target.closest('.discard-cap[data-cap-name]');
        if (discardCap) {
            const name = discardCap.dataset.capName;
            const def  = CAP_DEFS.find(c => c.name === name);
            if (def && this._gs.canAfford(this._gs.discardCost)) {
                this._gs.useDiscard(def);
                this._render();
                // Keep overlay open and refreshed
                const overlay = this._el.querySelector('#shop-discard-overlay');
                if (overlay) {
                    overlay.style.display = '';
                    overlay.querySelector('.discard-grid').innerHTML = this._buildDiscardGrid();
                    overlay.querySelector('.discard-cost-label').textContent =
                        `Costs ${this._gs.discardCost}★ · doubles each use`;
                }
            }
            return;
        }

        // Close pack popup without choosing
        if (e.target.closest('#pack-popup-close')) {
            this._pendingPack = null;
            this._render();
            return;
        }

        // Pick a cap from pack popup
        const packChoice = e.target.closest('.pack-choice[data-cap-name]');
        if (packChoice && this._pendingPack !== null) {
            const name = packChoice.dataset.capName;
            const def  = CAP_DEFS.find(c => c.name === name);
            if (def) {
                this._gs.ownedCaps.push({ def, enchant: null });
                this._packs[this._pendingPack].bought = true;
                this._pendingPack = null;
                this._render();
            }
            return;
        }

        // Pick a relic from relic pack popup
        const relicChoice = e.target.closest('.pack-choice[data-relic-id]');
        if (relicChoice && this._pendingPack !== null) {
            const id  = relicChoice.dataset.relicId;
            const def = RELIC_DEFS.find(r => r.id === id);
            if (def) {
                this._gs.addRelic(def);
                this._packs[this._pendingPack].bought = true;
                this._pendingPack = null;
                this._render();
            }
            return;
        }

        // Open a pack
        const packEl = e.target.closest('.shop-pack[data-pack-idx]');
        if (packEl) {
            const idx  = parseInt(packEl.dataset.packIdx, 10);
            const pack = this._packs[idx];
            if (pack.bought || pack.choices.length === 0) return;
            if (!this._gs.canAfford(pack.price)) return;
            this._gs.score -= pack.price;
            this._pendingPack = idx;
            this._render();
            return;
        }

        // Open cap detail on image click
        const capImg = e.target.closest('.band-cap-img[data-cap-name]');
        if (capImg) {
            const def = CAP_DEFS.find(c => c.name === capImg.dataset.capName);
            if (def) this._ui.showCapDetail(def);
            return;
        }

        // Buy a band item (price-tag button is the buy CTA)
        const bandBuy = e.target.closest('button.band-price-tag[data-band-idx]');
        if (bandBuy && !bandBuy.disabled && !bandBuy.classList.contains('cant-afford')) {
            const idx  = parseInt(bandBuy.dataset.bandIdx, 10);
            const item = this._band[idx];
            if (!item || item.bought) return;
            if (this._gs.buyCap(item.def, item.price)) {
                item.bought = true;
                this._render();
            }
            return;
        }
    }

    // ─── GENERATORS ───────────────────────────────────────────────────────────

    _genBand() {
        const unowned  = CAP_DEFS.filter(c => !this._gs.hasCapDef(c));
        const shuffled = [...unowned].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, BAND_SIZE).map(def => ({
            type: 'cap', def, price: CAP_PRICE, bought: false,
        }));
    }

    _genPacks() {
        // Cap pack
        const bandNames  = new Set(this._band.map(b => b.def.name));
        const capPool    = CAP_DEFS
            .filter(c => !this._gs.hasCapDef(c) && !bandNames.has(c.name))
            .sort(() => Math.random() - 0.5);

        // Relic pack — unowned preferred, fall back to any
        const relicPool  = RELIC_DEFS
            .filter(r => !this._gs.hasRelic(r.id))
            .sort(() => Math.random() - 0.5);
        const relicChoices = (relicPool.length > 0 ? relicPool : [...RELIC_DEFS].sort(() => Math.random() - 0.5))
            .slice(0, 3);

        return [
            { type: 'cap',   price: PACK_PRICES[0], choices: capPool.slice(0, 3),  bought: false },
            { type: 'relic', price: PACK_PRICES[1], choices: relicChoices,          bought: false },
        ];
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────

    _render() {
        this._el.innerHTML = this._buildHTML();
        this._ui.setScore(this._gs.score);
    }

    _buildHTML() {
        const gs        = this._gs;
        const nextNode  = gs.currentNode;
        const clearScore = nextNode?.clearScore ?? nextNode?.score;
        const nextBadge  = clearScore != null ? `${clearScore}★` : '→';
        const nextLabel  = gs.isRunComplete ? 'NEXT LOOP' : 'NEXT ROUND';

        const canReroll  = gs.canAfford(gs.rerollCost);
        const canDiscard = gs.ownedCaps.length > 0;

        return `
<div class="shop-inner">

  <!-- ── Title ───────────────────────────────────────────────────────── -->
  <div class="shop-title-sticker">SHOP</div>

  <!-- ── 2-kolonne: venstre (band+packs) | højre (actions) ───────────── -->
  <div class="shop-main">

    <!-- Venstre: reroll+band øverst, pack-kort nedenunder -->
    <div class="shop-left">
      <div class="shop-band-row">
        <button id="shop-reroll-btn" class="${canReroll ? '' : 'cant-afford'}" title="Reroll">
          <span class="reroll-icon">↺</span>
          <span class="reroll-cost">${gs.rerollCost}★</span>
        </button>
        <div class="shop-band">
          <div class="shop-band-items">
            ${this._buildBandHTML()}
          </div>
        </div>
      </div>
      <div class="shop-packs">
        ${this._packs.map((pack, i) => this._buildPackCardHTML(pack, i)).join('')}
      </div>
    </div>

    <!-- Højre: actions -->
    <div class="shop-actions">
      <button id="shop-discard-btn" class="shop-remove-btn ${canDiscard ? '' : 'cant-afford'}">
        <div class="shop-skull-box">💀</div>
        <span>REMOVE CAPS</span>
      </button>
      <button id="shop-continue-btn" class="shop-next-btn">
        <span>${nextLabel}</span>
        <div class="shop-next-price">${nextBadge}</div>
      </button>
    </div>

  </div>

</div>

<!-- ── Pack popup ──────────────────────────────────────────────────── -->
${this._pendingPack !== null ? this._buildPackPopupHTML(this._packs[this._pendingPack]) : ''}

<!-- ── Discard overlay ─────────────────────────────────────────────── -->
<div id="shop-discard-overlay" style="display:none">
  <div class="discard-panel">
    <div class="discard-header">
      <span class="discard-title">Discard a cap</span>
      <button id="shop-discard-close" class="discard-close-btn">✕</button>
    </div>
    <p class="discard-cost-label">Costs ${gs.discardCost}★ · doubles each use</p>
    <div class="discard-grid">${this._buildDiscardGrid()}</div>
  </div>
</div>`;
    }

    _buildBandHTML() {
        const gs      = this._gs;
        const animate = this._justRerolled;
        return this._band.map((item, i) => {
            if (item.bought) {
                return `<div class="band-item sold">
                    <div class="band-slot-box"></div>
                    <div class="band-price-tag band-sold-label">SOLD</div>
                </div>`;
            }
            const canBuy    = gs.canAfford(item.price);
            const animStyle = animate ? `style="animation-delay:${i * 90}ms"` : '';
            const animClass = animate ? 'band-item--entering' : '';
            return `<div class="band-item ${animClass}" ${animStyle}>
                <div class="band-slot-box">
                    <img class="band-cap-img" src="${item.def.texFront}" alt="${item.def.name}"
                         data-cap-name="${item.def.name}">
                </div>
                <button class="band-price-tag ${canBuy ? '' : 'cant-afford'}"
                        data-band-idx="${i}" ${canBuy ? '' : 'disabled'}>
                    ${item.price}★
                </button>
            </div>`;
        }).join('');
    }

    _buildPackCardHTML(pack, i) {
        const isRelic   = pack.type === 'relic';
        const typeLabel = isRelic ? 'Relic Pack' : 'Collector Pack';
        const icon      = isRelic ? '🔮' : '🛍';
        const relicCls  = isRelic ? ' pack--relic' : '';
        if (pack.bought) {
            return `<div class="shop-pack bought${relicCls}" data-pack-idx="${i}">
                <div class="pack-icon-box"><span class="pack-icon-emoji">${icon}</span></div>
                <div class="pack-info">
                    <span class="pack-type">${typeLabel}</span>
                    <span class="pack-hint">Opened</span>
                </div>
            </div>`;
        }
        const canAfford = this._gs.canAfford(pack.price);
        const empty     = pack.choices.length === 0;
        const hint      = empty
            ? (isRelic ? 'No relics left' : 'No caps left')
            : (isRelic ? '3 relics · pick 1' : '3 caps · pick 1');
        return `<button class="shop-pack${relicCls} ${canAfford && !empty ? '' : 'cant-afford'}"
                     data-pack-idx="${i}">
            <div class="pack-icon-box"><span class="pack-icon-emoji">${icon}</span></div>
            <div class="pack-info">
                <span class="pack-type">${typeLabel}</span>
                <span class="pack-hint">${hint}</span>
                <div class="pack-price">${pack.price}★</div>
            </div>
        </button>`;
    }

    _buildPackPopupHTML(pack) {
        const isRelic = pack.type === 'relic';
        const title   = isRelic ? 'Relic Pack — Pick 1' : 'Cap Pack — Pick 1';

        const choicesHTML = pack.choices.length === 0
            ? `<p class="pack-empty">${isRelic ? 'No relics available.' : 'No caps available.'}</p>`
            : isRelic
                ? pack.choices.map(r => `
                    <button class="pack-choice pack-choice--relic" data-relic-id="${r.id}">
                        <div class="pack-relic-icon">${r.icon}</div>
                        <div class="pack-choice-name">${r.name}</div>
                        <div class="pack-choice-effect">${r.description}</div>
                    </button>`).join('')
                : pack.choices.map(def => {
                    const effectLabel = def.effect
                        ? (EFFECT_LABELS[def.effect] ?? def.effect)
                        : 'No effect';
                    return `<button class="pack-choice" data-cap-name="${def.name}">
                        <img class="pack-choice-img" src="${def.texFront}" alt="${def.name}">
                        <div class="pack-choice-name">${def.name}</div>
                        <div class="pack-choice-effect">${effectLabel}</div>
                    </button>`;
                }).join('');

        return `<div id="shop-pack-popup">
            <div class="pack-popup-panel">
                <div class="pack-popup-title">${title}</div>
                <div class="pack-choices-row">${choicesHTML}</div>
                <button id="pack-popup-close" class="pack-skip-btn">Skip</button>
            </div>
        </div>`;
    }

    _buildDiscardGrid() {
        const gs = this._gs;
        if (gs.ownedCaps.length === 0) {
            return `<p class="discard-empty">No caps to discard.</p>`;
        }
        const canAfford = gs.canAfford(gs.discardCost);
        return gs.ownedCaps.map(({ def }) =>
            `<button class="discard-cap ${canAfford ? '' : 'cant-afford'}"
                     data-cap-name="${def.name}" ${canAfford ? '' : 'disabled'}>
                <img class="discard-cap-img" src="${def.texFront}" alt="${def.name}">
                <div class="discard-cap-name">${def.name}</div>
            </button>`
        ).join('');
    }
}
