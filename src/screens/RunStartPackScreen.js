import { audio } from '../audio/AudioManager.js';
import { pulseIconRotate, startTitleWobble } from '../ui/domUtils.js';

// Bevidst IKKE samme PACK_WEIGHTS som ShopScreen (den dækker 8 typer til det
// almindelige shop-udtræk) — denne skærm har sin egen, mindre pulje: binder/
// uncommon/card er de typiske (høj og nogenlunde lige vægt), mystery næsten
// lige så hyppig, slammer meget sjælden (matcher Dice 'n Million's åbnings-
// valg, hvor en "die"/relic-agtig pack sjældent er blandt de 3 tilbudte).
const RUN_START_PACK_WEIGHTS = { card: 25, cap_uncommon: 25, binder: 25, mystery: 20, slammer: 3 };

// Vises ÉN gang, ved den allerførste "New Run" (se main.js's startScreen.
// onNewRun) — gratis valg mellem 3 forskellige packs, der åbner direkte ind i
// samme "3 valg, vælg 1"-visning packs allerede har i shoppen. Genbruger
// bevidst ShopScreen's eksisterende choice-generatorer og kort-renderere
// (rene funktioner af deres input, ingen skjult _band/_packs-afhængighed) i
// stedet for at duplikere legacy_discs-værn/rarity-vægtning et andet sted.
export class RunStartPackScreen {
    constructor({ gameState, ui, shop, consumables }) {
        this._gs          = gameState;
        this._ui           = ui;
        this._shop          = shop;
        this._consumables = consumables;
        this._el   = null;
        this._packs = [];
        this._pendingPack = null;
        this.onContinue = null; // () => {}
    }

    enter() {
        this._packs = this._rollPacks();
        this._el = document.createElement('div');
        this._el.id = 'run-start-packs-screen';
        document.body.appendChild(this._el);
        this._renderPackChoice();

        this._el.addEventListener('click', e => {
            const packCard = e.target.closest('.rsp-pack-card[data-idx]');
            if (packCard) { this._openPack(parseInt(packCard.dataset.idx, 10)); return; }

            const quickPick = e.target.closest('.reward-quick-pick[data-key]');
            if (quickPick) { this._commit(quickPick.dataset.key); return; }

            // Ikon-klik → inspektion (CapViewer/SlammerViewer/consumable-popup)
            // med PICK-handling indeni, FØR commit — samme mønster som
            // ShopScreen._showPackScreen(). Manglede oprindeligt her (ren
            // mangel fra første version af denne skærm, ikke noget senere
            // arbejde fjernede).
            const pack = this._pendingPack;
            if (!pack) return;
            const gumCard = e.target.closest('.reward-card--gumcard[data-key]');
            const icon    = gumCard ?? e.target.closest('.cap-enchant-wrap, .reward-cap-img');
            if (!icon) return;
            pulseIconRotate(gumCard ? (gumCard.querySelector('.gum-pack-icon') ?? gumCard) : icon);
            const card = icon.closest('.reward-card[data-key]');
            const key  = card?.dataset.key;
            if (key == null) return;

            if (pack.type === 'cap_uncommon') {
                const def = pack.choices.find(c => c.name === key);
                if (def) this._ui.showCapDetail(def, false, {
                    label: 'PICK', color: '#000', callback: () => this._commit(key),
                });
            } else if (pack.type === 'slammer') {
                const def = pack.choices.find(s => s.name === key);
                if (def) this._ui.showSlammerDetail(def, false, {
                    label: 'PICK', color: '#000', callback: () => this._commit(key),
                });
            } else if (pack.type === 'card') {
                const def = pack.choices.find(c => c.id === key);
                if (def) this._consumables.showPickPopup(def, {
                    label: 'PICK', callback: () => this._commit(key),
                });
            } else if (pack.type === 'mystery') {
                const item = pack.choices[parseInt(key, 10)];
                if (!item) return;
                if (item.itemType === 'slammer') {
                    this._ui.showSlammerDetail(item.def, false, {
                        label: 'PICK', color: '#000', callback: () => this._commit(key),
                    });
                } else if (item.itemType === 'cap') {
                    this._ui.showCapDetail({ def: item.def, enchant: item.enchant ?? null }, false, {
                        label: 'PICK', color: '#000', callback: () => this._commit(key),
                    });
                } else if (item.itemType === 'card') {
                    this._consumables.showPickPopup(item.def, {
                        label: 'PICK', callback: () => this._commit(key),
                    });
                }
                // binder-undervalg: ingen detail-viewer (ingen 3D-mønt at vise) —
                // quick-pick er eneste commit-vej, samme etablerede beslutning
                // som ShopScreen bruger for binder-kort generelt.
            }
            // 'binder' pack-type i sig selv: samme grund, ingen gren her.
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    // 3 forskellige pack-typer, vægtet, UDEN tilbagelægning — samme algoritme
    // som ShopScreen._genPacks(), bare med RUN_START_PACK_WEIGHTS og 3 valgt
    // i stedet for 2, så de 3 tilbudte aldrig kan blive ens.
    _rollPacks() {
        const generators = {
            card:         () => this._shop._cardChoices(),
            cap_uncommon: () => this._shop._capChoicesMinRarity(2, new Set()),
            binder:       () => this._shop._binderChoices(),
            mystery:      () => this._shop._mysteryChoices(),
            slammer:      () => this._shop._slammerChoicesAny(),
        };
        const pool   = Object.keys(RUN_START_PACK_WEIGHTS);
        const picked = [];
        for (let i = 0; i < 3 && pool.length > 0; i++) {
            const total = pool.reduce((sum, t) => sum + RUN_START_PACK_WEIGHTS[t], 0);
            let r = Math.random() * total, idx = pool.length - 1;
            for (let j = 0; j < pool.length; j++) {
                r -= RUN_START_PACK_WEIGHTS[pool[j]];
                if (r <= 0) { idx = j; break; }
            }
            const type = pool[idx];
            pool.splice(idx, 1);
            picked.push({ type, choices: generators[type]() });
        }
        return picked;
    }

    // Fælles label/farve-map pr. pack-type — genbruges af BÅDE trin 1 (kort-
    // farve) og trin 2 (titel + titel-farve), samme klassekonvention som
    // ShopScreen's titleMap/titleModClassMap.
    _packLabel(type) {
        return { card: 'Card Pack', cap_uncommon: 'Uncommon Pack', binder: 'Binder Pack',
                  mystery: 'Mystery Pack', slammer: 'Slammer Pack' }[type];
    }
    _packCls(type) {
        return { card: 'pack--card', cap_uncommon: 'pack--uncommon', binder: 'pack--binder',
                  mystery: 'pack--mystery', slammer: 'pack--relic' }[type];
    }
    _titleCls(type) {
        return { card: 'reward-title-box--card', cap_uncommon: 'reward-title-box--uncommon',
                  binder: 'reward-title-box--binder', mystery: 'reward-title-box--mystery',
                  slammer: 'reward-title-box--relic' }[type];
    }

    // Trin 1: 3 kompakte pack-kort (ikon+navn, INGEN pris — dette er gratis)
    // — genbruger _shop._packIconHTML() for selve ikon-grafikken, og samme
    // pack--X-farvekonvention som shoppens egne pack-kort (shop.css).
    _renderPackChoice() {
        this._el.innerHTML = `
            <h2 class="rsp-title">Pick a Starter Pack</h2>
            <div class="rsp-pack-row">
                ${this._packs.map((p, i) => `
                    <div class="rsp-pack-card ${this._packCls(p.type)}" data-idx="${i}">
                        ${this._shop._packIconHTML(p)}
                        <div class="rsp-pack-label">${this._packLabel(p.type)}</div>
                    </div>`).join('')}
            </div>`;
        this._packs.forEach((_, i) => setTimeout(() => audio.playChoiceReveal(), i * 90));
        startTitleWobble(this._el.querySelector('.rsp-title'));
    }

    // Trin 2: åbner det valgte pack — genbruger _shop's kort-renderere til at
    // vise dets 3 indhold, PLUS samme titel + entrance-mønster som normal
    // pack-opening i shoppen (ShopScreen._showPackScreen()) — begge dele
    // manglede oprindeligt her (ren mangel fra første version af denne skærm,
    // ikke noget senere juice-arbejde ødelagde): .reward-card poppper KUN ind
    // hvis .reward-card--entering-klassen rent faktisk tilføjes (ren
    // animation-delay uden klassen gør ingenting, se reward.css).
    _openPack(idx) {
        this._pendingPack = this._packs[idx];
        const shop = this._shop;
        const pack = this._pendingPack;
        let cardsHTML;
        if      (pack.type === 'slammer') cardsHTML = shop._packSlammerCards(pack.choices);
        else if (pack.type === 'card')    cardsHTML = shop._packCardCards(pack.choices);
        else if (pack.type === 'mystery') cardsHTML = shop._packMysteryCards(pack.choices);
        else if (pack.type === 'binder')  cardsHTML = shop._packBinderCards(pack.choices);
        else                               cardsHTML = shop._packCapCards(pack.choices); // cap_uncommon

        this._el.innerHTML = `
            <div class="reward-title-anchor">
                <div class="reward-title-box ${this._titleCls(pack.type)}">
                    <h2 class="reward-title">${this._packLabel(pack.type)}</h2>
                </div>
            </div>
            <div class="reward-cards">${cardsHTML}</div>`;

        this._el.querySelectorAll('.reward-card').forEach((card, i) => {
            const delay = i * 90;
            card.classList.add('reward-card--entering');
            card.style.animationDelay = `${delay}ms`;
            setTimeout(() => card.classList.remove('reward-card--entering'), delay + 420);
            setTimeout(() => audio.playChoiceReveal(), delay);
        });
        startTitleWobble(this._el.querySelector('.reward-title-box'));
    }

    // Samme dispatch som ShopScreen._pickFromPack() (cap/slammer/card/binder/
    // mystery) — men uden dens shop-specifikke this._packs/this._render()-hale,
    // som ikke giver mening her. Ingen "fuld/no room"-håndtering nødvendig —
    // en frisk startRun() garanterer ledig plads overalt (tom consumables,
    // MAX_OWNED_CAPS/SLAMMERS langt fra nået).
    _commit(key) {
        const pack = this._pendingPack;
        if (!pack) return;
        if (pack.type === 'slammer') {
            const def = pack.choices.find(s => s.name === key);
            if (def) this._gs.addSlammer(def);
        } else if (pack.type === 'card') {
            const def = pack.choices.find(c => c.id === key);
            if (def) this._gs.addConsumable(def);
        } else if (pack.type === 'binder') {
            const item = pack.choices[parseInt(key, 10)];
            if (item) this._gs.addBinder(item.series, item.tier);
        } else if (pack.type === 'mystery') {
            const item = pack.choices[parseInt(key, 10)];
            if (!item) return;
            if (item.itemType === 'slammer')     this._gs.addSlammer(item.def);
            else if (item.itemType === 'card')   this._gs.addConsumable(item.def);
            else if (item.itemType === 'binder') this._gs.addBinder(item.series, item.tier);
            else                                  this._gs.gainEnchantedCap(item.def, item.enchant ?? null);
        } else {
            const def = pack.choices.find(c => c.name === key);
            if (def) this._gs.gainCap(def);
        }
        audio.play('pick_gain');
        if (this.onContinue) this.onContinue();
    }
}
