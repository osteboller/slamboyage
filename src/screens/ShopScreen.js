import { CAP_DEFS } from '../config/constants.js';
import { CAP_PRICE } from '../config/mapData.js';
import { EFFECT_LABELS } from '../game/effects/labels.js';
import { RELIC_DEFS } from '../config/relicDefs.js';
import { CONSUMABLE_DEFS } from '../config/consumableDefs.js';

const BAND_SIZE       = 5;
const PACK_PRICES     = { cap: 8, relic: 10, card: 6 };
const CARD_IN_BAND_CHANCE = 0.3; // 30% chance one band slot is a card instead of a cap

export class ShopScreen {
    constructor({ gameState, ui }) {
        this._gs           = gameState;
        this._ui           = ui;
        this._el              = null;
        this._band            = [];
        this._packs           = [];
        this._pendingPack     = null;
        this._justRerolled    = false; // triggers staggered band animation
        this.onContinue       = null;
        this.onConsumableAdded = null; // (slotIdx) => void — called after card pick
    }

    enter() {
        this._pendingPack = null;

        if (this._gs.shopOffer) {
            this._band  = this._gs.shopOffer.band;
            this._packs = this._gs.shopOffer.packs;
        } else {
            this._band  = this._genBand();
            this._packs = this._genPacks();
            this._gs.shopOffer = { band: this._band, packs: this._packs };
        }

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
            this._gs.shopOffer = null;
            if (this.onContinue) this.onContinue();
            return;
        }

        // Reroll band
        if (e.target.closest('#shop-reroll-btn')) {
            const cost = this._gs.rerollCost;
            if (!this._gs.canAfford(cost)) return;
            this._gs.useReroll();
            this._band                 = this._genBand();
            this._gs.shopOffer.band    = this._band;
            this._justRerolled = true;
            this._render();
            this._justRerolled = false;
            return;
        }

        // Open discard overlay
        if (e.target.closest('#shop-discard-btn')) {
            const ov = this._el.querySelector('#shop-discard-overlay');
            ov.style.display = '';
            ov.style.animation = 'screen-fade-in 0.18s ease-out forwards';
            return;
        }
        if (e.target.closest('#shop-discard-close')) {
            const ov = this._el.querySelector('#shop-discard-overlay');
            ov.style.animation = 'screen-fade-out 0.15s ease-in forwards';
            ov.style.pointerEvents = 'none';
            setTimeout(() => { ov.style.display = 'none'; ov.style.pointerEvents = ''; }, 150);
            return;
        }

        // Discard a cap
        const discardCap = e.target.closest('.discard-cap[data-cap-name]');
        if (discardCap) {
            const name = discardCap.dataset.capName;
            const def  = CAP_DEFS.find(c => c.name === name);
            if (def && this._gs.canAfford(this._gs.discardCost)) {
                this._gs.useDiscard(def);
                // Fade selve overlay'et (det er IKKE inde i .shop-inner)
                const overlay = this._el.querySelector('#shop-discard-overlay');
                if (overlay) {
                    overlay.style.animation = 'screen-fade-out 0.15s ease-in forwards';
                    overlay.style.pointerEvents = 'none';
                }
                setTimeout(() => {
                    this._render();
                    const fresh = this._el.querySelector('#shop-discard-overlay');
                    if (fresh) {
                        fresh.style.display = '';
                        fresh.style.animation = 'screen-fade-in 0.15s ease-out forwards';
                    }
                }, 150);
            }
            return;
        }

        // Close pack popup without choosing
        if (e.target.closest('#pack-popup-close')) {
            this._pendingPack = null;
            this._fadePopupOut(() => this._render());
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
                this._ui.flashBagBtn();
                this._fadePopupOut(() => this._render());
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
                this._ui.flashBagBtn();
                this._fadePopupOut(() => this._render());
            }
            return;
        }

        // Pick a consumable from card pack popup
        const cardChoice = e.target.closest('.pack-choice[data-card-id]');
        if (cardChoice && this._pendingPack !== null) {
            const id  = cardChoice.dataset.cardId;
            const def = CONSUMABLE_DEFS.find(c => c.id === id);
            if (def) {
                const slotIdx = this._gs.addConsumable(def);
                if (slotIdx === false) {
                    this._flashNoRoom(cardChoice);
                    return;
                }
                this._packs[this._pendingPack].bought = true;
                this._pendingPack = null;
                if (this.onConsumableAdded) this.onConsumableAdded(slotIdx);
                this._fadePopupOut(() => this._render());
            }
            return;
        }

        // Open a pack — render popup dan fade het in
        const packEl = e.target.closest('.shop-pack[data-pack-idx]');
        if (packEl) {
            const idx  = parseInt(packEl.dataset.packIdx, 10);
            const pack = this._packs[idx];
            if (pack.bought || pack.choices.length === 0) return;
            if (!this._gs.canAfford(pack.price)) return;
            this._gs.score -= pack.price;
            this._ui.showScoreDeduct(pack.price);
            this._pendingPack = idx;
            this._render();
            const popup = this._el.querySelector('#shop-pack-popup');
            if (popup) popup.style.animation = 'screen-fade-in 0.18s ease-out forwards';
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

            // Card slot in band
            if (item.type === 'card') {
                if (!this._gs.canAfford(item.price)) return;
                const bandItem = bandBuy.closest('.band-item');
                const slotIdx  = this._gs.addConsumable(item.def);
                if (slotIdx === false) {
                    // No room — flash red and show brief label
                    this._flashNoRoom(bandItem);
                    return;
                }
                this._gs.score -= item.price;
                this._ui.showScoreDeduct(item.price);
                item.bought = true;
                if (this.onConsumableAdded) this.onConsumableAdded(slotIdx);
                if (bandItem) {
                    bandItem.classList.add('band-item--buying');
                    setTimeout(() => this._render(), 380);
                } else {
                    this._render();
                }
                return;
            }

            if (this._gs.buyCap(item.def, item.price)) {
                this._ui.showScoreDeduct(item.price);
                this._ui.flashBagBtn();
                item.bought = true;
                const bandItem = bandBuy.closest('.band-item');
                if (bandItem) {
                    bandItem.classList.remove('band-item--entering');
                    bandItem.style.animationDelay = '0ms';
                    bandItem.classList.add('band-item--buying');
                    setTimeout(() => this._render(), 380);
                } else {
                    this._render();
                }
            }
            return;
        }
    }

    // ─── GENERATORS ───────────────────────────────────────────────────────────

    _genBand() {
        const unowned  = CAP_DEFS.filter(c => !this._gs.hasCapDef(c));
        const caps     = [...unowned].sort(() => Math.random() - 0.5)
            .slice(0, BAND_SIZE)
            .map(def => ({ type: 'cap', def, price: CAP_PRICE, bought: false }));

        // Occasionally replace one random slot with a card
        if (Math.random() < CARD_IN_BAND_CHANCE) {
            const cardDef  = CONSUMABLE_DEFS[Math.floor(Math.random() * CONSUMABLE_DEFS.length)];
            const slotIdx  = Math.floor(Math.random() * caps.length);
            caps[slotIdx]  = { type: 'card', def: cardDef, price: PACK_PRICES.card, bought: false };
        }
        return caps;
    }

    _genPacks() {
        const bandNames = new Set(this._band.map(b => b.def.name));

        // Helpers
        const relicChoices = () => {
            const pool = RELIC_DEFS.filter(r => !this._gs.hasRelic(r.id)).sort(() => Math.random() - 0.5);
            return (pool.length > 0 ? pool : [...RELIC_DEFS].sort(() => Math.random() - 0.5)).slice(0, 3);
        };

        const cardChoices = () => [...CONSUMABLE_DEFS].sort(() => Math.random() - 0.5).slice(0, 3);

        // TEST: slot 1 = card, slot 2 = relic
        return [
            { type: 'card',  price: PACK_PRICES.card,  choices: cardChoices(),  bought: false },
            { type: 'relic', price: PACK_PRICES.relic, choices: relicChoices(), bought: false },
        ];

        // PRODUCTION (swap in when ready):
        // const types = ['cap', 'relic', 'card'];
        // return [0, 1].map(() => {
        //     const type = types[Math.floor(Math.random() * types.length)];
        //     return {
        //         type,
        //         price: PACK_PRICES[type],
        //         choices: type === 'cap' ? capChoices() : type === 'relic' ? relicChoices() : cardChoices(),
        //         bought: false,
        //     };
        // });
    }

    _flashNoRoom(el) {
        if (!el) return;
        // Works on both the band-item (finds child box) and a pack-choice element directly
        const box = el.querySelector('.band-slot-box--card') ?? el;
        box.classList.remove('band-slot-box--no-room');
        void box.offsetWidth;
        box.classList.add('band-slot-box--no-room');

        const label = document.createElement('div');
        label.className = 'band-no-room-label';
        label.textContent = 'NO ROOM';
        box.style.position = 'relative'; // ensure overlay works on pack-choice too
        box.appendChild(label);
        label.addEventListener('animationend', () => label.remove(), { once: true });
        box.addEventListener('animationend', () => box.classList.remove('band-slot-box--no-room'), { once: true });
    }

    // Called by consumable 'refresh' card — free reroll with no cost/price increase
    refreshCurrentView() {
        if (this._pendingPack !== null) {
            // Pack popup is open — re-roll that pack's choices
            const pack = this._packs[this._pendingPack];
            if (pack.type === 'relic') {
                const pool = RELIC_DEFS.filter(r => !this._gs.hasRelic(r.id)).sort(() => Math.random() - 0.5);
                pack.choices = (pool.length > 0 ? pool : [...RELIC_DEFS].sort(() => Math.random() - 0.5)).slice(0, 3);
            } else if (pack.type === 'card') {
                pack.choices = [...CONSUMABLE_DEFS].sort(() => Math.random() - 0.5).slice(0, 3);
            } else {
                const bandNames = new Set(this._band.map(b => b.def.name));
                pack.choices = CAP_DEFS
                    .filter(c => !this._gs.hasCapDef(c) && !bandNames.has(c.name))
                    .sort(() => Math.random() - 0.5).slice(0, 3);
            }
            this._render();
            const popup = this._el?.querySelector('#shop-pack-popup');
            if (popup) popup.style.animation = 'screen-fade-in 0.18s ease-out forwards';
        } else {
            // No popup — free band reroll (no cost, no rerollCost increase)
            this._band = this._genBand();
            this._gs.shopOffer.band = this._band;
            this._justRerolled = true;
            this._render();
            this._justRerolled = false;
        }
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────

    _render() {
        this._el.innerHTML = this._buildHTML();
        this._ui.setScore(this._gs.score);
    }

    _fadePopupOut(after) {
        const popup = this._el?.querySelector('#shop-pack-popup');
        if (popup) {
            popup.style.animation = 'screen-fade-out 0.15s ease-in forwards';
            popup.style.pointerEvents = 'none';
            setTimeout(() => after?.(), 150);
        } else {
            after?.();
        }
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
      <div class="shop-score-ghost" aria-hidden="true"></div>
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

            if (item.type === 'card') {
                return `<div class="band-item band-item--card ${animClass}" ${animStyle}>
                    <div class="band-slot-box band-slot-box--card">
                        <span class="band-card-icon">${item.def.icon}</span>
                        <span class="band-card-name">${item.def.name}</span>
                    </div>
                    <button class="band-price-tag ${canBuy ? '' : 'cant-afford'}"
                            data-band-idx="${i}" ${canBuy ? '' : 'disabled'}>
                        ${item.price}★
                    </button>
                </div>`;
            }

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
        const isRelic = pack.type === 'relic';
        const isCard  = pack.type === 'card';
        const typeLabel = isRelic ? 'Relic Pack' : isCard ? 'Card Pack' : 'Collector Pack';
        const icon      = isRelic ? '🔮' : isCard ? '🃏' : '🛍';
        const extraCls  = isRelic ? ' pack--relic' : isCard ? ' pack--card' : '';
        if (pack.bought) {
            return `<div class="shop-pack bought${extraCls}" data-pack-idx="${i}">
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
            ? (isRelic ? 'No relics left' : isCard ? 'No cards left' : 'No caps left')
            : (isRelic ? '3 relics · pick 1' : isCard ? '3 cards · pick 1' : '3 caps · pick 1');
        return `<button class="shop-pack${extraCls} ${canAfford && !empty ? '' : 'cant-afford'}"
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
        const isCard  = pack.type === 'card';
        const title   = isRelic ? 'Relic Pack — Pick 1' : isCard ? 'Card Pack — Pick 1' : 'Cap Pack — Pick 1';

        let choicesHTML;
        if (pack.choices.length === 0) {
            choicesHTML = `<p class="pack-empty">Nothing available.</p>`;
        } else if (isRelic) {
            choicesHTML = pack.choices.map(r => `
                <button class="pack-choice pack-choice--relic" data-relic-id="${r.id}">
                    <div class="pack-relic-icon">${r.icon}</div>
                    <div class="pack-choice-name">${r.name}</div>
                    <div class="pack-choice-effect">${r.description}</div>
                </button>`).join('');
        } else if (isCard) {
            choicesHTML = pack.choices.map(c => `
                <button class="pack-choice pack-choice--card" data-card-id="${c.id}">
                    <div class="pack-relic-icon">${c.icon}</div>
                    <div class="pack-choice-name">${c.name}</div>
                    <div class="pack-choice-effect">${c.description}</div>
                </button>`).join('');
        } else {
            choicesHTML = pack.choices.map(def => {
                const effectLabel = def.effect
                    ? (EFFECT_LABELS[def.effect] ?? def.effect)
                    : 'No effect';
                return `<button class="pack-choice" data-cap-name="${def.name}">
                    <img class="pack-choice-img" src="${def.texFront}" alt="${def.name}">
                    <div class="pack-choice-name">${def.name}</div>
                    <div class="pack-choice-effect">${effectLabel}</div>
                </button>`;
            }).join('');
        }

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
