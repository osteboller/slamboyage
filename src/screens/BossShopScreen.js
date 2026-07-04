import { CAP_DEFS } from '../config/constants.js';
import { RELIC_DEFS } from '../config/relicDefs.js';
import { capThumbnailHTML } from '../ui/capThumbnail.js';

// Dedikeret shop der kun vises efter en clearet boss-node. Bruger Shards (run-
// scoped valuta, kun tjent ved bosses), ikke ★ — den almindelige ShopScreen er
// bevidst IKKE genbrugt her, da hele dens økonomi er bygget omkring ★.
export class BossShopScreen {
    constructor({ gameState, ui }) {
        this._gs        = gameState;
        this._ui        = ui;
        this._el        = null;
        this._offer     = [];
        this.onContinue = null;
    }

    enter() {
        this._el    = document.createElement('div');
        this._el.id = 'boss-shop-screen';
        document.body.appendChild(this._el);

        this._offer = this._buildOffer();
        this._render();

        this._el.addEventListener('click', e => {
            if (e.target.closest('#boss-shop-continue-btn')) {
                if (this.onContinue) this.onContinue();
                return;
            }
            const item = e.target.closest('.boss-shop-item[data-idx]');
            if (item) { this._buy(parseInt(item.dataset.idx, 10)); return; }
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _buildOffer() {
        const rareCaps = CAP_DEFS.filter(c =>
            (c.rarity ?? 1) >= 3 && !this._gs.ownedCaps.some(o => o.def.name === c.name));
        const relics = RELIC_DEFS.filter(r => !this._gs.hasRelic(r.id));

        const capItems = [...rareCaps].sort(() => Math.random() - 0.5).slice(0, 3)
            .map(def => ({ kind: 'cap', def, cost: (def.rarity ?? 1) >= 4 ? 3 : 2, bought: false }));
        const relicItems = [...relics].sort(() => Math.random() - 0.5).slice(0, 2)
            .map(def => ({ kind: 'relic', def, cost: 3, bought: false }));

        return [...capItems, ...relicItems];
    }

    _buy(idx) {
        const item = this._offer[idx];
        if (!item || item.bought || this._gs.shards < item.cost) return;
        this._gs.shards -= item.cost;
        if (item.kind === 'cap') this._gs.gainCap(item.def);
        else                     this._gs.addRelic(item.def);
        item.bought = true;
        this._render();
    }

    _render() {
        const itemsHTML = this._offer.map((item, i) => {
            const canAfford = !item.bought && this._gs.shards >= item.cost;
            const thumbHTML = item.kind === 'cap'
                ? capThumbnailHTML(item.def, { imgClass: 'boss-shop-cap-img' })
                : `<div class="boss-shop-relic-icon">${item.def.icon}</div>`;
            const costHTML = item.bought ? 'SOLD' : `${item.cost}🔶`;
            return `<div class="boss-shop-item ${item.bought ? 'bought' : ''} ${canAfford ? '' : 'cant-afford'}" data-idx="${i}">
                ${thumbHTML}
                <div class="boss-shop-item-name">${item.def.name}</div>
                <div class="boss-shop-item-cost">${costHTML}</div>
            </div>`;
        }).join('');

        this._el.innerHTML = `
            <div class="boss-shop-inner">
                <div class="boss-shop-title-sticker">👑 BOSS SHOP</div>
                <div class="boss-shop-balance">🔶 <span>${this._gs.shards}</span> Shards</div>
                <div class="boss-shop-grid">${itemsHTML}</div>
                <button id="boss-shop-continue-btn" class="boss-shop-continue-btn">Continue ▶</button>
            </div>`;
    }
}
