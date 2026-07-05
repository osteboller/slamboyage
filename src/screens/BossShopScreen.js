import { CAP_DEFS, SLAMMER_DEFS } from '../config/constants.js';
import { capThumbnailHTML } from '../ui/capThumbnail.js';
import { pickWeightedItems } from '../config/rarityWeights.js';

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
        // Owned caps sorteres ikke fra — duplikater er fair spil. Rarity vægtes
        // efter gs.loop ligesom resten af shoppen (rarityWeights.js).
        const rareCaps = CAP_DEFS.filter(c => (c.rarity ?? 1) >= 3);
        const slammers = SLAMMER_DEFS.filter(s => !this._gs.hasSlammer(s.name));

        const capItems = pickWeightedItems(rareCaps, this._gs.loop, 3)
            .map(def => ({ kind: 'cap', def, cost: (def.rarity ?? 1) >= 4 ? 3 : 2, bought: false }));
        const slammerItems = [...slammers].sort(() => Math.random() - 0.5).slice(0, 2)
            .map(def => ({ kind: 'slammer', def, cost: 3, bought: false }));

        return [...capItems, ...slammerItems];
    }

    _buy(idx) {
        const item = this._offer[idx];
        if (!item || item.bought || this._gs.shards < item.cost) return;
        this._gs.shards -= item.cost;
        if (item.kind === 'cap') this._gs.gainCap(item.def);
        else                     this._gs.addSlammer(item.def);
        item.bought = true;
        this._render();
    }

    _render() {
        const itemsHTML = this._offer.map((item, i) => {
            const canAfford = !item.bought && this._gs.shards >= item.cost;
            const thumbHTML = item.kind === 'cap'
                ? capThumbnailHTML(item.def, { imgClass: 'boss-shop-cap-img' })
                : `<img class="boss-shop-cap-img" src="${item.def.texFront}" alt="${item.def.name}">`;
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
