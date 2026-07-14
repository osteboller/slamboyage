import { audio } from '../audio/AudioManager.js';

export class ConsumableSlots {
    constructor({ gameState, ui }) {
        this._gs         = gameState;
        this._ui         = ui;
        this._context    = null; // current screen name
        this._openSlot   = null; // index of slot whose popup is open
        this._slotsEl    = document.getElementById('consumable-slots');
        this._popupEl    = document.getElementById('consumable-popup');

        // Callbacks wired by main.js
        this.onUse  = null; // (def, idx) => void
        this.onSell = null; // (def) => void — caller handles score display per context

        this._slotsEl.addEventListener('click', e => this._onSlotClick(e));
        document.getElementById('consumable-close-btn').addEventListener('click', () => this._closePopup());
        document.getElementById('consumable-use-btn').addEventListener('click',   () => this._doUse());
        document.getElementById('consumable-sell-btn').addEventListener('click',  () => this._doSell());
        this._popupEl.addEventListener('click', e => { if (e.target === this._popupEl) this._closePopup(); });
        // Samme mønster som UIManager's cap/slammer/relic-detail (_buildPileOverlay) —
        // uden denne ville ethvert klik inde i popup'en boble op til UIManager's
        // globale document-pointerdown-lytter, som blindt kalder setDetailBackdrop(false)
        // og slukker dæmpningen selvom popup'en (nu centreret, delende samme
        // backdrop) stadig er åben.
        this._popupEl.addEventListener('pointerdown', e => e.stopPropagation());
    }

    setContext(screenName) {
        this._context = screenName;
        this._closePopup();
        this.refresh();
    }

    show() { this._slotsEl.style.display = ''; this.refresh(); }
    hide() { this._slotsEl.style.display = 'none'; this._closePopup(); }

    flashSlot(idx) {
        this.refresh();
        const slot = this._slotsEl.querySelectorAll('.consumable-slot')[idx];
        if (!slot) return;
        slot.classList.remove('consumable-slot--flash');
        void slot.offsetWidth; // reflow to restart animation
        slot.classList.add('consumable-slot--flash');
        slot.addEventListener('animationend', () => slot.classList.remove('consumable-slot--flash'), { once: true });
    }

    refresh() {
        const slots = this._slotsEl.querySelectorAll('.consumable-slot');
        slots.forEach((el, i) => {
            const def = this._gs.consumables[i];
            el.classList.toggle('filled', !!def);

            if (def) {
                const stripe = `repeating-linear-gradient(-45deg, ${def.bg} 0px, ${def.bg} 5px, #fff 5px, #fff 10px)`;
                el.style.background = stripe;
                el.innerHTML = `
                    <div class="gum-slot-inner">
                        <div class="gum-slot-header" style="background:${def.color};">
                            <span class="gum-slot-name">${def.name}</span>
                        </div>
                        <div class="gum-slot-body">
                            <span class="gum-slot-icon">${def.icon}</span>
                            <div class="gum-slot-flavor">${def.flavor}</div>
                        </div>
                    </div>`;
            } else {
                el.style.background = '';
                el.innerHTML = '';
            }
        });
    }

    // ─── PRIVATE ─────────────────────────────────────────────────────────────

    _onSlotClick(e) {
        const slotEl = e.target.closest('.consumable-slot.filled');
        if (!slotEl) return;
        const idx = parseInt(slotEl.dataset.slot, 10);
        if (this._openSlot === idx) { this._closePopup(); return; }
        this._openSlot = idx;
        audio.playCardPlace();
        this._showPopup(idx);
    }

    _showPopup(idx) {
        const def = this._gs.consumables[idx];
        if (!def) return;

        const canUse = this._context && def.usableIn.includes(this._context);
        this._populatePopupChrome(def);
        document.getElementById('consumable-popup-desc').textContent = def.description;
        document.getElementById('consumable-sell-btn').textContent   = `SELL ${def.sellPrice}★`;

        const useBtn  = document.getElementById('consumable-use-btn');
        const sellBtn = document.getElementById('consumable-sell-btn');
        useBtn.style.display  = '';
        sellBtn.style.display = '';
        useBtn.disabled = !canUse;
        useBtn.title    = canUse ? '' : `Only usable in: ${def.usableIn.join(', ')}`;
        this._hidePickBtn();

        this._openPopup();
    }

    // Viser SAMME popup som _showPopup(idx), men for et endnu IKKE-ejet
    // valg (reward/pack-pick i RewardScreen.js/ShopScreen.js, ELLER et
    // købbart bånd-kort i shoppen) — én fri action-knap (PICK/TAKE/BUY) i
    // stedet for USE/SELL. Bruges ALDRIG fra battle-slots, derfor
    // this._openSlot = null (forhindrer at _doUse()/_doSell() ved en fejl
    // kan ramme et forkert ejet slot-index, selvom de knapper er skjulte
    // her). action = { label, price, color, callback } — samme form som
    // cap/slammer-detailens action, for konsekvent BUY/CAN'T AFFORD-stil.
    showPickPopup(def, action) {
        this._openSlot = null;
        this._populatePopupChrome(def);
        document.getElementById('consumable-popup-desc').textContent = def.description;

        document.getElementById('consumable-use-btn').style.display  = 'none';
        document.getElementById('consumable-sell-btn').style.display = 'none';

        let pickBtn = document.getElementById('consumable-pick-btn');
        if (!pickBtn) {
            pickBtn = document.createElement('button');
            pickBtn.id = 'consumable-pick-btn';
            document.getElementById('consumable-popup-btns').appendChild(pickBtn);
        }
        pickBtn.innerHTML     = `${action.label}${action.price ? `<br>${action.price}` : ''}`;
        pickBtn.style.background = action.color ?? '#000';
        pickBtn.style.display = '';
        // Erstat node — undgår at lyttere hobes op på tværs af flere åbninger
        // (samme mønster som cap/slammer-detailens action-knap).
        const fresh = pickBtn.cloneNode(true);
        pickBtn.parentNode.replaceChild(fresh, pickBtn);
        fresh.addEventListener('click', () => {
            this._closePopup();
            action.callback();
        });

        this._openPopup();
    }

    _hidePickBtn() {
        const pickBtn = document.getElementById('consumable-pick-btn');
        if (pickBtn) pickBtn.style.display = 'none';
    }

    // Fælles "chrome" (stribet baggrund, header-farve, ikon, navn, flavor) —
    // delt mellem _showPopup (ejet slot) og showPickPopup (endnu ikke ejet).
    _populatePopupChrome(def) {
        const textCol = this._headerTextColor(def.color);
        const stripe  = `repeating-linear-gradient(-45deg, ${def.bg} 0px, ${def.bg} 2px, #fff 2px, #fff 4px)`;
        document.getElementById('consumable-popup-top').style.background    = stripe;
        document.getElementById('consumable-popup-footer').style.background = stripe;

        const headerEl = document.getElementById('consumable-popup-header');
        headerEl.style.background = def.color || '#000';
        headerEl.style.color      = textCol;

        const closeBtn = document.getElementById('consumable-close-btn');
        closeBtn.style.color = textCol === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)';

        document.getElementById('consumable-popup-icon').textContent   = def.icon;
        document.getElementById('consumable-popup-name').textContent   = def.name;
        document.getElementById('consumable-popup-flavor').textContent = def.flavor || '';
    }

    _openPopup() {
        this._popupEl.style.display = '';
        this._popupEl.classList.add('open');
        // Samme dæmpnings-lag som cap/slammer/relic-detail — nu hvor popup'en
        // er centreret ligesom dem, skal den også dæmpe baggrunden ligesom dem.
        this._ui.setDetailBackdrop(true);
        const inner = document.getElementById('consumable-popup-inner');
        // Ny tilfældig skæv vinkel hver gang (2-3° til en tilfældig side) —
        // læses af @keyframes consumable-popup-in (consumables.css) via
        // var(--popup-rot). Sat FØR animationen genstartes nedenfor.
        const deg = (2 + Math.random()) * (Math.random() < 0.5 ? -1 : 1);
        inner.style.setProperty('--popup-rot', `${deg.toFixed(2)}deg`);
        inner.style.animation = 'none';
        void inner.offsetWidth;
        inner.style.animation = '';
    }

    _headerTextColor(hex) {
        if (!hex) return '#fff';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000' : '#fff';
    }

    _closePopup() {
        this._openSlot = null;
        this._popupEl.style.display = 'none';
        this._popupEl.classList.remove('open');
        this._ui.setDetailBackdrop(false);
    }

    // Fjerner IKKE længere kortet fra slottet her — nogle konsumables (clone/
    // transform/enchant) beder om et ekstra valg via ui.showCapPicker() FØR deres
    // egentlige effekt sker. Blev kortet konsumeret med det samme (som før), gik
    // det tabt uden effekt hvis man lukkede den picker eller navigerede væk mens
    // den stod åben. main.js's onUse-håndtering kalder nu selv gameState.
    // useConsumable(idx) + refresh() PRÆCIS når effekten reelt udføres — se
    // 'consume()'-hjælperen der.
    _doUse() {
        if (this._openSlot === null) return;
        const idx = this._openSlot;
        const def = this._gs.consumables[idx];
        if (!def) return;
        this._closePopup();
        if (this.onUse) this.onUse(def, idx);
    }

    _doSell() {
        if (this._openSlot === null) return;
        const def = this._gs.consumables[this._openSlot];
        if (!def) return;
        this._gs.sellConsumable(this._openSlot);
        this._closePopup();
        this.refresh();
        this._ui.showScoreGain(def.sellPrice);
        if (this.onSell) this.onSell(def);
    }
}
