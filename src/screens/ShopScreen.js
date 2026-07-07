import { CAP_DEFS, SLAMMER_DEFS } from '../config/constants.js';
import { CAP_PRICE } from '../config/mapData.js';
import { effectName } from '../game/effects/labels.js';
import { CONSUMABLE_DEFS } from '../config/consumableDefs.js';
import { capThumbnailHTML } from '../ui/capThumbnail.js';
import { ENCHANT_DEFS } from '../config/enchantDefs.js';
import { pickWeightedItem, pickWeightedItems } from '../config/rarityWeights.js';
import { pulseIconRotate } from '../ui/domUtils.js';
import { formatScore } from '../ui/formatScore.js';

const BAND_SIZE       = 5;
const PACK_PRICES     = { cap: 8, slammer: 10, slammer_rare: 16, card: 6, cap_holo: 12, cap_uncommon: 12, cap_rare: 18, mystery: 10 };
const ENCHANT_IDS     = ['gilded', 'reverb', 'boomerang', 'halflife'];
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
        this._packEl      = null;

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

        // Boss-nodens ★ nulstilles helt ved kampens start — sidste chance for
        // at bruge det hele her. Dismissable overlay (samme mekanik som boss/
        // Trick Shot-info-stickeren), ikke et permanent inline-element i
        // layoutet — vises kun ÉN gang ved ankomst, ikke ved hvert re-render.
        const nextNode = this._gs.currentNode;
        if (nextNode?.boss) this._ui.showBossShopWarning(nextNode.boss);
    }

    exit() {
        this._packEl?.remove();
        this._packEl = null;
        this._el?.remove();
        this._el = null;
    }

    refresh() {
        if (this._el && !this._packEl) this._render();
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
        if (e.target.closest('#shop-discard-close') || e.target.id === 'shop-discard-overlay') {
            const ov = this._el.querySelector('#shop-discard-overlay');
            ov.style.animation = 'screen-fade-out 0.15s ease-in forwards';
            ov.style.pointerEvents = 'none';
            setTimeout(() => {
                ov.style.display = 'none';
                ov.style.pointerEvents = '';
                this._render();
            }, 150);
            return;
        }

        // Quick discard via price tag — no viewer
        const quickDiscard = e.target.closest('.discard-price-tag[data-cap-id]');
        if (quickDiscard) {
            const entry = this._gs.ownedCaps.find(c => c.id === +quickDiscard.dataset.capId);
            if (entry) this._doDiscard(entry);
            return;
        }

        // Cap image clicked → show 3D cap viewer with DISCARD action sticker
        const discardImg = e.target.closest('.cap-enchant-wrap[data-cap-id]');
        if (discardImg) {
            const entry = this._gs.ownedCaps.find(c => c.id === +discardImg.dataset.capId);
            if (entry) {
                const canAfford = this._gs.canAfford(this._gs.discardCost);
                this._ui.showCapDetail(entry, true, canAfford ? {
                    label:    'DISCARD',
                    price:    `${this._gs.discardCost}★`,
                    color:    'var(--clr-red)',
                    callback: () => this._doDiscard(entry),
                } : {
                    label:    "CAN'T AFFORD",
                    color:    '#888',
                    callback: () => {},
                });
            }
            return;
        }

        // Open a pack — fullscreen picker
        const packEl = e.target.closest('.shop-pack[data-pack-idx]');
        if (packEl) {
            const idx  = parseInt(packEl.dataset.packIdx, 10);
            const pack = this._packs[idx];
            if (pack.bought || pack.choices.length === 0) return;
            const cost = this._price(pack.basePrice, 'pack');
            if (!this._gs.canAfford(cost)) return;
            this._gs.score -= cost;
            this._ui.showScoreDeduct(cost);
            this._ui.setScore(this._gs.score);
            this._pendingPack = idx;
            this._showPackScreen(pack, idx);
            return;
        }

        // Open cap detail on image click — with BUY sticker if purchasable
        const capImg = e.target.closest('.cap-enchant-wrap[data-cap-name]');
        if (capImg) {
            pulseIconRotate(capImg);
            const def = CAP_DEFS.find(c => c.name === capImg.dataset.capName);
            if (def) {
                const priceTag = capImg.closest('.band-item')?.querySelector('[data-band-idx]');
                const bandIdx  = priceTag ? parseInt(priceTag.dataset.bandIdx, 10) : NaN;
                const item     = !isNaN(bandIdx) ? this._band[bandIdx] : null;

                let action = null;
                if (item && !item.bought) {
                    const price  = this._price(item.basePrice, 'cap');
                    const full   = !this._gs.canAddCap();
                    const canBuy = !full && this._gs.canAfford(price);
                    action = canBuy ? {
                        label:    'BUY',
                        price:    `${price}★`,
                        color:    '#2a9d5c',
                        callback: () => this._doBuy(bandIdx),
                    } : {
                        label:    full ? 'COLLECTION FULL' : "CAN'T AFFORD",
                        color:    '#888',
                        callback: () => {},
                    };
                }
                this._ui.showCapDetail(def, false, action);
            }
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
                const bandItem = bandBuy.closest('.band-item');
                const result   = this._gs.buyConsumableCard(item.def, item.basePrice);
                if (!result.ok) {
                    // No room — flash red and show brief label (afford-guard er allerede
                    // dækket af .cant-afford-klassen på selve knappen)
                    if (result.reason === 'no_room') this._flashNoRoom(bandItem);
                    return;
                }
                this._ui.showScoreDeduct(result.price);
                item.bought = true;
                if (this.onConsumableAdded) this.onConsumableAdded(result.slot);
                if (bandItem) {
                    bandItem.classList.add('band-item--buying');
                    setTimeout(() => this._render(), 380);
                } else {
                    this._render();
                }
                return;
            }

            const capPrice = this._price(item.basePrice, 'cap');
            if (this._gs.buyCap(item.def, capPrice)) {
                this._ui.showScoreDeduct(capPrice);
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

    // Discount-slammer (Bargain Bin, shopDiscount) halverer alle priser her —
    // afrundes op så intet nogensinde bliver gratis (0★). kind ('cap'|'pack')
    // bruger begge gs.capPriceMultiplier lige nu — parameteren gør det eksplicit
    // og nemt at splitte senere hvis de skal stige forskelligt (kort-priser går
    // gennem GameState.buyConsumableCard()/_cardPrice() i stedet og rammer ikke her).
    _price(base, kind = 'cap') {
        const growth = kind === 'pack' ? this._gs.capPriceMultiplier : this._gs.capPriceMultiplier;
        return Math.max(1, Math.ceil(base * this._gs.shopDiscountMult * growth));
    }

    // Kort i båndet vokser i pris pr. kort købt (CARD_PRICE_GROWTH) OVENI shop-
    // rabatten — samme formel som GameState.buyConsumableCard() bruger ved selve
    // købet, så den viste pris aldrig kan drifte fra hvad der rent faktisk trækkes.
    _cardPrice(basePrice) {
        return Math.max(1, Math.ceil(basePrice * this._gs.shopDiscountMult * this._gs.cardPriceMultiplier));
    }

    _genBand() {
        // Owned caps sorteres IKKE fra — duplikater er fair spil (fx for at stakke effekter).
        // Priser gemmes som `basePrice` (u-rabatteret) og omregnes til den aktuelle
        // rabat (fx Bargain Bin) live ved hvert render/køb — se `_price()`.
        // Rarity vægtes efter gs.loop (rarityWeights.js) — commons dominerer tidligt.
        const caps = pickWeightedItems(CAP_DEFS, this._gs.loop, BAND_SIZE)
            .map(def => ({ type: 'cap', def, basePrice: CAP_PRICE, bought: false }));

        // Occasionally replace one random slot with a card
        if (Math.random() < CARD_IN_BAND_CHANCE) {
            const cardDef  = CONSUMABLE_DEFS[Math.floor(Math.random() * CONSUMABLE_DEFS.length)];
            const slotIdx  = Math.floor(Math.random() * caps.length);
            caps[slotIdx]  = { type: 'card', def: cardDef, basePrice: PACK_PRICES.card, bought: false };
        }
        return caps;
    }

    // ── Delte choice-generatorer — brugt af BÅDE _genPacks() (første udbud) og
    // refreshCurrentView() (gratis re-roll via 'refresh'-kortet), så en re-roll
    // aldrig kan miste en pakkes rarity/type-garanti (tidligere bug: refresh
    // faldt tilbage til en helt ufiltreret cap-liste).
    _slammerChoicesAny() {
        const pool = SLAMMER_DEFS.filter(s => !this._gs.hasSlammer(s.name)).sort(() => Math.random() - 0.5);
        return (pool.length > 0 ? pool : [...SLAMMER_DEFS].sort(() => Math.random() - 0.5)).slice(0, 3);
    }

    // Garanteret rare+ slammer — falder kun tilbage til EJEDE rare+ slammere hvis
    // alle unikke rare+ slammere allerede er ejet (garantien om rarity vejer
    // tungere end unikhed-inden-for-samme-besøg her).
    _slammerChoicesRare() {
        const rarePool = SLAMMER_DEFS.filter(s => (s.rarity ?? 1) >= 3);
        const pool     = rarePool.filter(s => !this._gs.hasSlammer(s.name)).sort(() => Math.random() - 0.5);
        return (pool.length > 0 ? pool : [...rarePool].sort(() => Math.random() - 0.5)).slice(0, 3);
    }

    _cardChoices() {
        return [...CONSUMABLE_DEFS].sort(() => Math.random() - 0.5).slice(0, 3);
    }

    // Owned caps sorteres IKKE fra — duplikater er fair spil. `excludeNames`
    // undgår kun at samme cap optræder to gange i SAMME shop-besøg (band).
    // Vægtet efter gs.loop, også inden for et rarity-gulv (fx Rare Pack giver
    // kun rare, ikke legendary, i loop 1 — se rarityWeights.js).
    _capChoicesMinRarity(minRarity, excludeNames = new Set()) {
        const pool = CAP_DEFS.filter(c => (c.rarity ?? 1) >= minRarity && !excludeNames.has(c.name));
        return pickWeightedItems(pool, this._gs.loop, 3);
    }

    // Holo Pack — alle 3 valg er garanteret enchantede caps, rarity stadig vægtet.
    _capChoicesHolo() {
        const randomEnchant = () => ENCHANT_IDS[Math.floor(Math.random() * ENCHANT_IDS.length)];
        return pickWeightedItems(CAP_DEFS, this._gs.loop, 3)
            .map(def => ({ def, enchant: randomEnchant() }));
    }

    _mysteryChoices() {
        const randomEnchant = () => ENCHANT_IDS[Math.floor(Math.random() * ENCHANT_IDS.length)];
        // Always one of each type — shuffled so order is random
        const slammer = this._slammerChoicesAny()[0];
        const cap     = pickWeightedItem(CAP_DEFS.filter(c => c.rarity >= 2), this._gs.loop)
            ?? CAP_DEFS[Math.floor(Math.random() * CAP_DEFS.length)];
        const card    = this._cardChoices()[0];
        return [
            { itemType: 'slammer', def: slammer },
            { itemType: 'cap',     def: cap, enchant: randomEnchant() },
            { itemType: 'card',    def: card },
        ].sort(() => Math.random() - 0.5);
    }

    _genPacks() {
        const bandNames = new Set(this._band.map(b => b.def.name));

        const all = [
            { type: 'slammer',      basePrice: PACK_PRICES.slammer,      choices: this._slammerChoicesAny()               },
            { type: 'slammer_rare', basePrice: PACK_PRICES.slammer_rare, choices: this._slammerChoicesRare()              },
            { type: 'card',         basePrice: PACK_PRICES.card,         choices: this._cardChoices()                     },
            { type: 'cap_holo',     basePrice: PACK_PRICES.cap_holo,     choices: this._capChoicesHolo()                  },
            { type: 'cap_uncommon', basePrice: PACK_PRICES.cap_uncommon, choices: this._capChoicesMinRarity(2, bandNames) },
            { type: 'cap_rare',     basePrice: PACK_PRICES.cap_rare,     choices: this._capChoicesMinRarity(3, bandNames) },
            { type: 'mystery',      basePrice: PACK_PRICES.mystery,      choices: this._mysteryChoices()                  },
        ];
        return all.sort(() => Math.random() - 0.5).slice(0, 2).map(p => ({ ...p, bought: false }));
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
        if (this._pendingPack !== null && this._packEl) {
            // Pack screen is open — re-roll its choices via samme generatorer som
            // _genPacks(), så en gratis reroll aldrig mister pakkens rarity/type-garanti.
            const pack      = this._packs[this._pendingPack];
            const bandNames = new Set(this._band.map(b => b.def.name));
            if      (pack.type === 'slammer')      pack.choices = this._slammerChoicesAny();
            else if (pack.type === 'slammer_rare') pack.choices = this._slammerChoicesRare();
            else if (pack.type === 'card')         pack.choices = this._cardChoices();
            else if (pack.type === 'mystery')      pack.choices = this._mysteryChoices();
            else if (pack.type === 'cap_holo')     pack.choices = this._capChoicesHolo();
            else if (pack.type === 'cap_uncommon') pack.choices = this._capChoicesMinRarity(2, bandNames);
            else if (pack.type === 'cap_rare')     pack.choices = this._capChoicesMinRarity(3, bandNames);
            else                                    pack.choices = this._capChoicesMinRarity(1, bandNames);
            this._renderPackScreen(pack, this._pendingPack);
        } else {
            // No pack screen — free band reroll
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

    // ─── PACK SCREEN ──────────────────────────────────────────────────────────

    // En pakkes choices bliver genereret ÉN gang når shoppen åbnes (_genPacks),
    // men et andet — allerede købt — tilbud i SAMME besøg (fx mystery-pakkens
    // slammer-gren, eller en anden slammer-pakke) kan i mellemtiden have givet
    // spilleren en slammer der stadig står som "ledigt" valg her. Sanerer derfor
    // choices mod NUVÆRENDE ejerskab lige når pakken åbnes, så man aldrig kan
    // vælge en duplikat — falder tilbage til samme rarity-garanterede pool som
    // pakken blev genereret med.
    _sanitizePackChoices(pack) {
        if (pack.type === 'slammer' || pack.type === 'slammer_rare') {
            const stillValid = pack.choices.filter(s => !this._gs.hasSlammer(s.name));
            if (stillValid.length < pack.choices.length) {
                const names    = new Set(stillValid.map(s => s.name));
                const regen    = pack.type === 'slammer_rare' ? this._slammerChoicesRare() : this._slammerChoicesAny();
                const backfill = regen.filter(s => !names.has(s.name));
                pack.choices   = [...stillValid, ...backfill].slice(0, 3);
            }
        } else if (pack.type === 'mystery') {
            const idx = pack.choices.findIndex(it => it.itemType === 'slammer');
            if (idx !== -1 && this._gs.hasSlammer(pack.choices[idx].def.name)) {
                const fresh = this._slammerChoicesAny().find(s => s.name !== pack.choices[idx].def.name)
                    ?? this._slammerChoicesAny()[0];
                if (fresh) pack.choices[idx] = { ...pack.choices[idx], def: fresh };
            }
        }
    }

    _showPackScreen(pack, idx) {
        this._sanitizePackChoices(pack);
        this._packEl = document.createElement('div');
        this._packEl.id = 'reward-screen';
        document.body.appendChild(this._packEl);
        this._renderPackScreen(pack, idx);

        this._packEl.addEventListener('click', e => {
            if (e.target.closest('#pack-skip-btn')) {
                this._packs[idx].bought = true;
                this._pendingPack = null;
                this._packEl?.remove();
                this._packEl = null;
                this._render();
                return;
            }
            const quickPick = e.target.closest('.reward-quick-pick[data-key]');
            if (quickPick) { this._pickFromPack(quickPick.dataset.key, pack, idx); return; }

            // Ikon-klik → inspektion med PICK-handling indeni, for ALLE pakke-
            // typer (tidligere kun cap/cap_uncommon/cap_rare — resten committede
            // med det samme ved klik hvor som helst på kortet). Samme mønster
            // som RewardScreen (reward-and-shop-card-consistency-prompten).
            const icon = e.target.closest('.cap-enchant-wrap, .reward-cap-img');
            if (!icon) return;
            pulseIconRotate(icon);
            const card = icon.closest('.reward-card[data-key]');
            const key  = card?.dataset.key;
            if (key == null) return;

            if (pack.type === 'cap' || pack.type === 'cap_uncommon' || pack.type === 'cap_rare') {
                const def = pack.choices.find(c => c.name === key);
                if (def) this._ui.showCapDetail(def, false, {
                    label: 'PICK', color: '#000',
                    callback: () => this._pickFromPack(key, pack, idx),
                });
            } else if (pack.type === 'cap_holo') {
                const item = pack.choices[parseInt(key, 10)];
                if (item) this._ui.showCapDetail({ def: item.def, enchant: item.enchant }, false, {
                    label: 'PICK', color: '#000',
                    callback: () => this._pickFromPack(key, pack, idx),
                });
            } else if (pack.type === 'slammer' || pack.type === 'slammer_rare') {
                const def = pack.choices.find(s => s.name === key);
                if (def) this._ui.showSlammerDetail(def, false, {
                    label: 'PICK', color: '#000',
                    callback: () => this._pickFromPack(key, pack, idx),
                });
            } else if (pack.type === 'mystery') {
                const item = pack.choices[parseInt(key, 10)];
                if (!item) return;
                if (item.itemType === 'slammer') {
                    this._ui.showSlammerDetail(item.def, false, {
                        label: 'PICK', color: '#000',
                        callback: () => this._pickFromPack(key, pack, idx),
                    });
                } else if (item.itemType === 'cap') {
                    this._ui.showCapDetail({ def: item.def, enchant: item.enchant ?? null }, false, {
                        label: 'PICK', color: '#000',
                        callback: () => this._pickFromPack(key, pack, idx),
                    });
                }
                // item.itemType === 'card' — intet ikon at inspicere (gum-pack-icon er kun et emoji)
            }
            // pack.type === 'card' — intet ikon at inspicere
        });
    }

    _renderPackScreen(pack, idx) {
        const titleMap = {
            cap: 'CAP PACK', slammer: 'SLAMMER PACK', slammer_rare: 'RARE SLAMMER PACK',
            card: 'CARD PACK', cap_holo: 'HOLO PACK', cap_uncommon: 'UNCOMMON PACK',
            cap_rare: 'RARE PACK', mystery: 'MYSTERY PACK',
        };
        let cardsHTML;
        if      (pack.type === 'slammer' || pack.type === 'slammer_rare') cardsHTML = this._packSlammerCards(pack.choices);
        else if (pack.type === 'card')      cardsHTML = this._packCardCards(pack.choices);
        else if (pack.type === 'mystery')   cardsHTML = this._packMysteryCards(pack.choices);
        else if (pack.type === 'cap_holo')  cardsHTML = this._packHoloCards(pack.choices);
        else                                cardsHTML = this._packCapCards(pack.choices);

        this._packEl.innerHTML = `
            <button id="pack-skip-btn">SKIP</button>
            <div class="reward-title-box">
                <h2 class="reward-title">${titleMap[pack.type] ?? 'PACK'} — PICK 1</h2>
                <p class="reward-sub">You paid ${this._price(pack.basePrice, 'pack')}★ · choose one to keep</p>
            </div>
            <div class="reward-cards">${cardsHTML}</div>`;

        this._packEl.querySelectorAll('.reward-card').forEach((card, i) => {
            const delay = i * 90;
            card.classList.add('reward-card--entering');
            card.style.animationDelay = `${delay}ms`;
            setTimeout(() => card.classList.remove('reward-card--entering'), delay + 420);
        });
        this._packEl.style.animation = 'screen-fade-in 0.2s ease-out forwards';
    }

    _pickFromPack(key, pack, idx) {
        if (pack.type === 'slammer' || pack.type === 'slammer_rare') {
            const def = pack.choices.find(s => s.name === key);
            // Slammer-loft: blokér commit, lad pakke-skærmen (allerede betalt) stå
            // urørt så spilleren kan sælge en slammer og klikke samme valg igen.
            if (def && !this._gs.addSlammer(def)) { this._ui.showMaxSlammersMessage(); return; }
        } else if (pack.type === 'cap_holo') {
            const item = pack.choices[parseInt(key, 10)];
            if (item) {
                const result = this._gs.gainEnchantedCap(item.def, item.enchant ?? null);
                if (!result.ok) this._ui.showCollectionFullMessage(result.compensated);
            }
        } else if (pack.type === 'card') {
            const def = pack.choices.find(c => c.id === key);
            if (def) {
                const slotIdx = this._gs.addConsumable(def);
                if (slotIdx === false) {
                    this._flashNoRoom(this._packEl?.querySelector(`[data-key="${key}"]`));
                    return;
                }
                if (this.onConsumableAdded) this.onConsumableAdded(slotIdx);
            }
        } else if (pack.type === 'mystery') {
            const item = pack.choices[parseInt(key, 10)];
            if (!item) return;
            if (item.itemType === 'slammer') {
                if (!this._gs.addSlammer(item.def)) { this._ui.showMaxSlammersMessage(); return; }
            } else if (item.itemType === 'card') {
                const slotIdx = this._gs.addConsumable(item.def);
                if (slotIdx === false) {
                    this._flashNoRoom(this._packEl?.querySelector(`[data-key="${key}"]`));
                    return;
                }
                if (this.onConsumableAdded) this.onConsumableAdded(slotIdx);
            } else {
                const result = this._gs.gainEnchantedCap(item.def, item.enchant ?? null);
                if (!result.ok) this._ui.showCollectionFullMessage(result.compensated);
                this._ui.flashBagBtn();
            }
        } else {
            const def = pack.choices.find(c => c.name === key);
            if (def) {
                const result = this._gs.gainCap(def);
                if (!result.ok) this._ui.showCollectionFullMessage(result.compensated);
            }
        }
        this._packs[idx].bought = true;
        this._pendingPack = null;
        this._ui.flashBagBtn();
        this._packEl?.remove();
        this._packEl = null;
        this._render();
    }

    _rarityInfo(rarity) {
        switch (rarity) {
            case 4:  return { label: 'LEGENDARY', cls: 'legendary' };
            case 3:  return { label: 'RARE',      cls: 'rare'      };
            case 2:  return { label: 'UNCOMMON',  cls: 'uncommon'  };
            default: return { label: 'COMMON',    cls: 'common'    };
        }
    }

    _packCapCards(caps) {
        return caps.map(cap => {
            const r     = this._rarityInfo(cap.rarity ?? 1);
            const effL  = cap.effect ? effectName(cap.effect) : '';
            const badge = effL ? `<div class="reward-effect">${effL}</div>` : '';
            return `<div class="reward-card" data-key="${cap.name}">
                <div class="reward-rarity reward-rarity--${r.cls}">${r.label}</div>
                ${capThumbnailHTML(cap, { imgClass: 'reward-cap-img' })}
                <div class="reward-cap-name">${cap.name}</div>
                <div class="reward-cap-series">${cap.series.replaceAll('_', ' ')}</div>
                ${badge}
                <button class="reward-quick-pick" data-key="${cap.name}">▶ PICK</button>
            </div>`;
        }).join('');
    }

    _packMysteryCards(items) {
        return items.map((item, i) => {
            if (item.itemType === 'slammer') {
                const s = item.def;
                return `<div class="reward-card reward-card--relic" data-key="${i}">
                    <div class="reward-rarity reward-rarity--rare">SLAMMER</div>
                    <img class="reward-cap-img" src="${s.texFront}" alt="${s.name}">
                    <div class="reward-cap-name">${s.name}</div>
                    ${s.passive ? `<div class="reward-effect reward-effect--passive">${s.passive.icon} ${s.passive.name}</div>` : ''}
                    <button class="reward-quick-pick" data-key="${i}">▶ PICK</button>
                </div>`;
            }
            if (item.itemType === 'card') {
                const c      = item.def;
                const stripe = `repeating-linear-gradient(-45deg, ${c.bg} 0px, ${c.bg} 2px, #fff 2px, #fff 4px)`;
                const tCol   = this._headerTextColor(c.color);
                return `<div class="reward-card reward-card--gumcard" data-key="${i}">
                    <div class="gum-pack-top" style="background:${stripe};">
                        <div class="gum-pack-header" style="background:${c.color}; color:${tCol};">${c.name}</div>
                        <div class="gum-pack-icon">${c.icon}</div>
                    </div>
                    <div class="gum-pack-bottom">
                        <div class="gum-pack-flavor">${c.flavor}</div>
                        <div class="gum-pack-desc">${c.description}</div>
                    </div>
                    <div class="gum-pack-footer" style="background:${stripe};">
                        <button class="reward-quick-pick" data-key="${i}">▶ PICK</button>
                    </div>
                </div>`;
            }
            const entry  = { def: item.def, enchant: item.enchant ?? null };
            const r      = this._rarityInfo(item.def.rarity ?? 1);
            const effL   = item.def.effect ? effectName(item.def.effect) : '';
            const eDef   = item.enchant ? ENCHANT_DEFS.find(e => e.id === item.enchant) : null;
            return `<div class="reward-card" data-key="${i}">
                <div class="reward-rarity reward-rarity--${r.cls}">CAP · ${r.label}</div>
                ${capThumbnailHTML(entry, { imgClass: 'reward-cap-img' })}
                <div class="reward-cap-name">${item.def.name}</div>
                <div class="reward-cap-series">${item.def.series.replaceAll('_', ' ')}</div>
                ${effL  ? `<div class="reward-effect">${effL}</div>` : ''}
                ${eDef  ? `<div class="reward-effect" style="color:${eDef.color}">${eDef.icon} ${eDef.name}</div>` : ''}
                <button class="reward-quick-pick" data-key="${i}">▶ PICK</button>
            </div>`;
        }).join('');
    }

    // Holo Pack — alle 3 er garanteret enchantede caps (samme kort-stil som
    // mystery-pakkens enchantede cap-gren, blot for alle 3 valg på én gang).
    _packHoloCards(items) {
        return items.map((item, i) => {
            const entry = { def: item.def, enchant: item.enchant };
            const r     = this._rarityInfo(item.def.rarity ?? 1);
            const effL  = item.def.effect ? effectName(item.def.effect) : '';
            const eDef  = ENCHANT_DEFS.find(e => e.id === item.enchant);
            return `<div class="reward-card" data-key="${i}">
                <div class="reward-rarity reward-rarity--${r.cls}">${r.label}</div>
                ${capThumbnailHTML(entry, { imgClass: 'reward-cap-img' })}
                <div class="reward-cap-name">${item.def.name}</div>
                <div class="reward-cap-series">${item.def.series.replaceAll('_', ' ')}</div>
                ${effL ? `<div class="reward-effect">${effL}</div>` : ''}
                ${eDef ? `<div class="reward-effect" style="color:${eDef.color}">${eDef.icon} ${eDef.name}</div>` : ''}
                <button class="reward-quick-pick" data-key="${i}">▶ PICK</button>
            </div>`;
        }).join('');
    }

    _packSlammerCards(slammers) {
        return slammers.map(s => `
            <div class="reward-card reward-card--relic" data-key="${s.name}">
                <img class="reward-cap-img" src="${s.texFront}" alt="${s.name}">
                <div class="reward-cap-name">${s.name}</div>
                ${s.passive ? `<div class="reward-effect reward-effect--passive">${s.passive.icon} ${s.passive.name}</div>` : ''}
                <button class="reward-quick-pick" data-key="${s.name}">▶ PICK</button>
            </div>`).join('');
    }

    _packCardCards(cards) {
        return cards.map(c => {
            const stripe  = `repeating-linear-gradient(-45deg, ${c.bg} 0px, ${c.bg} 2px, #fff 2px, #fff 4px)`;
            const textCol = this._headerTextColor(c.color);
            return `
                <div class="reward-card reward-card--gumcard" data-key="${c.id}">
                    <div class="gum-pack-top" style="background:${stripe};">
                        <div class="gum-pack-header" style="background:${c.color}; color:${textCol};">${c.name}</div>
                        <div class="gum-pack-icon">${c.icon}</div>
                    </div>
                    <div class="gum-pack-bottom">
                        <div class="gum-pack-flavor">${c.flavor}</div>
                        <div class="gum-pack-desc">${c.description}</div>
                    </div>
                    <div class="gum-pack-footer" style="background:${stripe};">
                        <button class="reward-quick-pick" data-key="${c.id}">▶ PICK</button>
                    </div>
                </div>`;
        }).join('');
    }

    _headerTextColor(hex) {
        if (!hex) return '#fff';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000' : '#fff';
    }

    _buildHTML() {
        const gs        = this._gs;
        const nextNode  = gs.currentNode;
        const clearScore = nextNode?.clearScore ?? nextNode?.score;
        const nextBadge  = clearScore != null ? `GOAL: ${formatScore(clearScore)}★` : '→';
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
        <div class="shop-remove-top">
          <div class="shop-skull-box">💀</div>
          <span>REMOVE CAPS</span>
        </div>
        <div class="shop-discard-price">${gs.discardCost}★</div>
      </button>
      <button id="shop-continue-btn" class="shop-next-btn">
        <span>${nextLabel}</span>
        <div class="shop-next-price">${nextBadge}</div>
      </button>
      <div class="shop-score-ghost" aria-hidden="true"></div>
    </div>

  </div>

</div>

<!-- ── Discard overlay ─────────────────────────────────────────────── -->
<div id="shop-discard-overlay" style="display:none">
  <div class="discard-panel">
    <div class="discard-header">
      <span class="discard-title">Remove a cap</span>
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
            const isCard    = item.type === 'card';
            const price     = isCard ? this._cardPrice(item.basePrice) : this._price(item.basePrice, 'cap');
            const full      = !isCard && !gs.canAddCap();
            const canBuy    = !full && gs.canAfford(price);
            const animStyle = animate ? `style="animation-delay:${i * 90}ms"` : '';
            const animClass = animate ? 'band-item--entering' : '';

            if (isCard) {
                const d = item.def;
                const stripe = `repeating-linear-gradient(-45deg, ${d.bg} 0px, ${d.bg} 2px, #fff 2px, #fff 4px)`;
                return `<div class="band-item band-item--card ${animClass}" ${animStyle}>
                    <div class="band-slot-box band-slot-box--card" style="background:${stripe}; border:3px solid #000; box-shadow:3px 3px 0 #000; padding:0;">
                        <div class="gum-slot-inner">
                            <div class="gum-slot-header" style="background:${d.color};">
                                <span class="gum-slot-name">${d.name}</span>
                            </div>
                            <div class="gum-slot-body">
                                <span class="gum-slot-icon">${d.icon}</span>
                            </div>
                        </div>
                    </div>
                    <button class="band-price-tag ${canBuy ? '' : 'cant-afford'}"
                            data-band-idx="${i}" ${canBuy ? '' : 'disabled'}>
                        ${price}★
                    </button>
                </div>`;
            }

            const bandEffL = item.def.effect ? effectName(item.def.effect) : '';
            return `<div class="band-item ${animClass}" ${animStyle}>
                <div class="band-slot-box">
                    ${capThumbnailHTML({ def: item.def, enchant: item.enchant, id: item.def.name }, { imgClass: 'band-cap-img', idAttr: 'data-cap-name' })}
                </div>
                <button class="band-price-tag ${canBuy ? '' : 'cant-afford'}"
                        data-band-idx="${i}" ${canBuy ? '' : 'disabled'}>
                    ${full ? 'FULL' : price + '★'}
                </button>
                ${bandEffL ? `<div class="band-effect-sticker">${bandEffL}</div>` : ''}
            </div>`;
        }).join('');
    }

    _buildPackCardHTML(pack, i) {
        const META = {
            slammer:      { label: 'Slammer Pack',      cls: ' pack--relic',    hint: '3 slammers · pick 1',        emptyHint: 'No slammers left' },
            slammer_rare: { label: 'Rare Slammer Pack', cls: ' pack--rare',     hint: '3 rare+ slammers · pick 1',  emptyHint: 'No rare+ slammers left' },
            card:         { label: 'Card Pack',         cls: ' pack--card',     hint: '3 cards · pick 1',           emptyHint: 'No cards left'   },
            cap:          { label: 'Collector Pack',    cls: '',                hint: '3 caps · pick 1',            emptyHint: 'No caps left'    },
            cap_holo:     { label: 'Holo Pack',         cls: ' pack--holo',     hint: '3 holo caps · pick 1',       emptyHint: 'No caps left' },
            cap_uncommon: { label: 'Uncommon Pack',     cls: ' pack--uncommon', hint: '3 uncommon+ caps · pick 1',  emptyHint: 'No uncommon+ caps left' },
            cap_rare:     { label: 'Rare Pack',         cls: ' pack--rare',     hint: '3 rare+ caps · pick 1',      emptyHint: 'No rare+ caps left' },
            mystery:      { label: 'Mystery Pack',      cls: ' pack--mystery',  hint: 'mixed rewards · pick 1',     emptyHint: '—'                      },
        };
        const m         = META[pack.type] ?? META.cap;
        const iconHTML  = this._packIconHTML(pack);
        if (pack.bought) {
            return `<div class="shop-pack bought${m.cls}" data-pack-idx="${i}">
                ${iconHTML}
                <div class="pack-info">
                    <span class="pack-type">${m.label}</span>
                    <span class="pack-hint">Opened</span>
                </div>
            </div>`;
        }
        const price     = this._price(pack.basePrice, 'pack');
        const canAfford = this._gs.canAfford(price);
        const empty     = pack.choices.length === 0;
        return `<button class="shop-pack${m.cls} ${canAfford && !empty ? '' : 'cant-afford'}"
                     data-pack-idx="${i}">
            ${iconHTML}
            <div class="pack-info">
                <span class="pack-type">${m.label}</span>
                <span class="pack-hint">${empty ? m.emptyHint : m.hint}</span>
                <div class="pack-price">${price}★</div>
            </div>
        </button>`;
    }

    _packIconHTML(pack) {
        if (pack.type === 'card') {
            const cards = [
                { bg: '#ffe0e0', color: '#cc2200' },
                { bg: '#ede0ff', color: '#7722cc' },
                { bg: '#d6f5f5', color: '#00a0a0' },
            ];
            const miniCards = cards.map(({ bg, color }, idx) => {
                const stripe = `repeating-linear-gradient(-45deg, ${bg} 0px, ${bg} 2px, #fff 2px, #fff 4px)`;
                const offsets = [
                    'translate(calc(-50% - 5px), calc(-50% + 2px)) rotate(-9deg)',
                    'translate(calc(-50% + 4px), calc(-50% + 1px)) rotate(6deg)',
                    'translate(-50%, -50%) rotate(-1deg)',
                ];
                return `<div class="mini-gum-card" style="background:${stripe}; transform:${offsets[idx]}; z-index:${idx + 1};">
                    <div style="background:${color}; height:9px; flex-shrink:0;"></div>
                </div>`;
            }).join('');
            return `<div class="pack-icon-box pack-icon-box--gumstack">${miniCards}</div>`;
        }
        const icons = { slammer: '🔨', slammer_rare: '🔨', cap: '🛍', cap_holo: '✨', cap_uncommon: '🛍', cap_rare: '⭐', mystery: '🎲' };
        const icon  = icons[pack.type] ?? '🛍';
        return `<div class="pack-icon-box"><span class="pack-icon-emoji">${icon}</span></div>`;
    }

    _doBuy(bandIdx) {
        const item = this._band[bandIdx];
        if (!item || item.bought) return;
        const price = this._price(item.basePrice, 'cap');
        if (this._gs.buyCap(item.def, price)) {
            this._ui.showScoreDeduct(price);
            this._ui.flashBagBtn();
            item.bought = true;
            const bandItem = this._el
                ?.querySelector(`[data-band-idx="${bandIdx}"]`)
                ?.closest('.band-item');
            if (bandItem) {
                bandItem.classList.remove('band-item--entering');
                bandItem.style.animationDelay = '0ms';
                bandItem.classList.add('band-item--buying');
                setTimeout(() => this._render(), 380);
            } else {
                this._render();
            }
        }
    }

    _doDiscard(entry) {
        if (!this._gs.canAfford(this._gs.discardCost)) return;

        const overlay = this._el?.querySelector('#shop-discard-overlay');
        const capEl   = overlay?.querySelector(`[data-cap-id="${entry.id}"]`)
                                ?.closest('.discard-cap');

        const apply = () => {
            this._gs.useDiscard(entry.id);
            this._ui.setScore(this._gs.score);

            if (!overlay) return;
            const grid = overlay.querySelector('.discard-grid');
            if (grid) grid.innerHTML = this._buildDiscardGrid();
            const label = overlay.querySelector('.discard-cost-label');
            if (label) label.textContent = `Costs ${this._gs.discardCost}★ · doubles each use`;

            if (this._gs.ownedCaps.length === 0) {
                overlay.style.animation = 'screen-fade-out 0.15s ease-in forwards';
                overlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.style.pointerEvents = '';
                    this._render();
                }, 150);
            }
        };

        if (capEl) {
            capEl.classList.add('discard-cap--discarding');
            setTimeout(apply, 400);
        } else {
            apply();
        }
    }

    _buildDiscardGrid() {
        const gs = this._gs;
        if (gs.ownedCaps.length === 0) {
            return `<p class="discard-empty">No caps to discard.</p>`;
        }
        const canAfford = gs.canAfford(gs.discardCost);
        return gs.ownedCaps.map(({ id, def, enchant }) =>
            `<div class="discard-cap ${canAfford ? '' : 'cant-afford'}">
                ${capThumbnailHTML({ id, def, enchant }, { imgClass: 'discard-cap-img' })}
                <div class="discard-cap-name">${def.name}</div>
                <button class="discard-price-tag ${canAfford ? '' : 'cant-afford'}"
                        data-cap-id="${id}" ${canAfford ? '' : 'disabled'}>
                    💀 ${gs.discardCost}★
                </button>
            </div>`
        ).join('');
    }
}
