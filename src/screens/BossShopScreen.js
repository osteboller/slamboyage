import { audio } from '../audio/AudioManager.js';
import { CAP_DEFS, SLAMMER_DEFS } from '../config/constants.js';
import { capThumbnailHTML } from '../ui/capThumbnail.js';
import { pickWeightedItems } from '../config/rarityWeights.js';
import { effectName } from '../game/effects/labels.js';
import { pulseIconRotate } from '../ui/domUtils.js';

// Dedikeret shop der kun vises efter en clearet boss-node. Bruger Shards (run-
// scoped valuta, kun tjent ved bosses), ikke ★ — den almindelige ShopScreen er
// bevidst IKKE genbrugt som JS (hele dens økonomi er bygget omkring ★), men
// BÅNDETS udseende genbruges 1:1 via shop.css' band-klasser (.shop-band,
// .band-item, .band-price-tag osv.) så de to shops deler visuelt sprog.
//
// Prissætning: alt koster 1 Shard som udgangspunkt — undtagen rare/legendary
// SLAMMERE som koster 2. Hvert køb hæver STRAKS prisen på alt resterende med
// +1 Shard (_priceBump), så man ikke bare kan støvsuge hele udbuddet.
export class BossShopScreen {
    constructor({ gameState, ui }) {
        this._gs        = gameState;
        this._ui        = ui;
        this._el        = null;
        this._offer     = [];
        this._priceBump = 0;
        this.onContinue = null;
    }

    enter() {
        this._el    = document.createElement('div');
        this._el.id = 'boss-shop-screen';
        document.body.appendChild(this._el);

        // Score-stickeren (nederst til højre) er meningsløs her — scoren er
        // allerede nulstillet af selve boss-kampen — så pladsen bruges i
        // stedet til Continue-knappen (se boss-shop.css). Undtagelse fra den
        // ellers globale showRunOverlay()-adfærd, kun mens denne skærm er aktiv.
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) scoreDisplay.style.display = 'none';

        this._offer     = this._buildOffer();
        this._priceBump = 0;
        this._render();

        // Samme ikon-vs-knap-opdeling som resten af spillet: pris-tag = direkte
        // køb, ikon-klik = inspektion med en BUY-handling indeni, resten dødt.
        this._el.addEventListener('click', e => {
            if (e.target.closest('#boss-shop-continue-btn')) {
                if (this.onContinue) this.onContinue();
                return;
            }
            const priceBtn = e.target.closest('button.band-price-tag[data-idx]');
            if (priceBtn && !priceBtn.disabled) {
                this._buy(parseInt(priceBtn.dataset.idx, 10));
                return;
            }
            const icon = e.target.closest('.cap-enchant-wrap, .band-cap-img');
            if (icon) {
                pulseIconRotate(icon);
                const wrap = icon.closest('.band-item[data-idx]');
                const idx  = wrap ? parseInt(wrap.dataset.idx, 10) : NaN;
                const item = this._offer[idx];
                if (!item || item.bought) return;
                const price     = this._price(item);
                const full      = item.kind === 'cap' ? !this._gs.canAddCap() : !this._gs.canAddSlammer();
                const canAfford = !full && this._gs.shards >= price;
                const action = canAfford ? {
                    label:    'BUY',
                    price:    `${price}🔶`,
                    color:    '#2a9d5c',
                    callback: () => this._buy(idx),
                } : {
                    label:    full ? 'FULL' : "CAN'T AFFORD",
                    color:    '#888',
                    callback: () => {},
                };
                if (item.kind === 'cap') this._ui.showCapDetail(item.def, false, action);
                else                     this._ui.showSlammerDetail(item.def, false, action);
            }
        });
    }

    exit() {
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) scoreDisplay.style.display = '';
        this._el?.remove();
        this._el = null;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _buildOffer() {
        // Owned caps sorteres ikke fra — duplikater er fair spil. Rarity vægtes
        // efter gs.loop ligesom resten af shoppen (rarityWeights.js).
        const rareCaps    = CAP_DEFS.filter(c => (c.rarity ?? 1) >= 3);
        const slammerPool = SLAMMER_DEFS.filter(s => !this._gs.hasSlammer(s.name)).sort(() => Math.random() - 0.5);

        const capItems = pickWeightedItems(rareCaps, this._gs.loop, 5)
            .map(def => ({ kind: 'cap', def, baseCost: 1, bought: false }));
        const slammerItems = slammerPool.slice(0, 3)
            .map(def => ({ kind: 'slammer', def, baseCost: (def.rarity ?? 1) >= 3 ? 2 : 1, bought: false }));

        return [...capItems, ...slammerItems];
    }

    // Live-pris: basispris + den globale eskalering fra tidligere køb — beregnes
    // frisk ved hvert render/køb, samme mønster som ShopScreens basePrice/_price.
    _price(item) {
        return item.baseCost + this._priceBump;
    }

    _buy(idx) {
        const item = this._offer[idx];
        if (!item || item.bought) return;
        const price = this._price(item);
        if (this._gs.shards < price) return;
        // Betalt køb — samme "blokér, kompensér ikke"-mønster som shoppens
        // buyCap() for caps. Slammere blokerer OGSÅ, men viser i stedet Max
        // Slammers-stickeren med sælg-genvej.
        if (item.kind === 'cap' && !this._gs.canAddCap()) return;
        if (item.kind === 'slammer' && !this._gs.canAddSlammer()) { this._ui.showMaxSlammersMessage(); return; }
        audio.play('purchase');
        this._gs.shards -= price;
        if (item.kind === 'cap') this._gs.gainCap(item.def);
        else                     this._gs.addSlammer(item.def);
        item.bought = true;
        this._priceBump += 1; // alle resterende priser stiger straks med +1
        this._render();
    }

    // Band-item — genbruger shop.css' band-klasser (band-item/band-slot-box/
    // band-cap-img/band-price-tag/band-effect-sticker) så boss-shoppen ser ud
    // som den almindelige shops skrå bånd. Info-stickeren under prisen viser
    // ability-navn for caps / passiv-navn for slammere.
    _bandItemHTML(item, idx) {
        if (item.bought) {
            return `<div class="band-item sold">
                <div class="band-slot-box"></div>
                <div class="band-price-tag band-sold-label">SOLD</div>
            </div>`;
        }
        const price     = this._price(item);
        const full      = item.kind === 'cap' ? !this._gs.canAddCap() : !this._gs.canAddSlammer();
        const canBuy    = !full && this._gs.shards >= price;
        const thumbHTML = item.kind === 'cap'
            ? capThumbnailHTML(item.def, { imgClass: 'band-cap-img' })
            : `<img class="band-cap-img" src="${item.def.texFront}" alt="${item.def.name}">`;
        const infoLabel = item.kind === 'cap'
            ? (item.def.effect ? effectName(item.def.effect) : '')
            : (item.def.passive ? `${item.def.passive.icon} ${item.def.passive.name}` : '');
        // Passiv (slammer) skal visuelt skelnes fra ability (cap) — teal i
        // stedet for guld, samme princip som reward-effect--passive/col-badge.passive.
        const infoClass = item.kind === 'cap' ? 'band-effect-sticker' : 'band-effect-sticker band-effect-sticker--passive';
        return `<div class="band-item" data-idx="${idx}">
            <div class="band-slot-box">${thumbHTML}</div>
            <button class="band-price-tag ${canBuy ? '' : 'cant-afford'}"
                    data-idx="${idx}" ${canBuy ? '' : 'disabled'}>
                ${full ? 'FULL' : `${price}🔶`}
            </button>
            ${infoLabel ? `<div class="${infoClass}">${infoLabel}</div>` : ''}
        </div>`;
    }

    _render() {
        const indexed  = this._offer.map((item, idx) => ({ item, idx }));
        const capsHTML = indexed.filter(x => x.item.kind === 'cap')
            .map(x => this._bandItemHTML(x.item, x.idx)).join('');
        const slamHTML = indexed.filter(x => x.item.kind === 'slammer')
            .map(x => this._bandItemHTML(x.item, x.idx)).join('');

        this._el.innerHTML = `
            <div class="boss-shop-inner">
                <div class="boss-shop-title-sticker">👑 BOSS SHOP</div>
                <div class="boss-shop-balance">🔶 <span>${this._gs.shards}</span> Shards</div>
                <div class="boss-shop-band-row">
                    <div class="shop-band boss-shop-band">
                        <div class="shop-band-items">${capsHTML}</div>
                    </div>
                </div>
                <div class="boss-shop-band-row boss-shop-band-row--slammers">
                    <div class="shop-band boss-shop-band">
                        <div class="shop-band-items">${slamHTML}</div>
                    </div>
                </div>
                <button id="boss-shop-continue-btn" class="boss-shop-continue-btn">Next ▶</button>
            </div>`;
    }

    // FRESHIE-consumablen ("Shop: re-roll items free") kalder denne — helt
    // nyt udbud via samme _buildOffer() som enter() selv bruger. Rører IKKE
    // _priceBump, som afspejler antal KØB denne visit, ikke antal rerolls.
    reroll() {
        this._offer = this._buildOffer();
        this._render();
    }
}
