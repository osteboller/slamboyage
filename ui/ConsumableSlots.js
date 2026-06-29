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
                const stripe = `repeating-linear-gradient(-45deg, ${def.bg} 0px, ${def.bg} 5px, rgba(255,255,255,0.55) 5px, rgba(255,255,255,0.55) 10px)`;
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
        this._showPopup(idx);
    }

    _showPopup(idx) {
        const def = this._gs.consumables[idx];
        if (!def) return;

        const canUse = this._context && def.usableIn.includes(this._context);
        const textCol = this._headerTextColor(def.color);

        const stripe = `repeating-linear-gradient(-45deg, ${def.bg} 0px, ${def.bg} 2px, #fff 2px, #fff 4px)`;
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
        document.getElementById('consumable-popup-desc').textContent   = def.description;
        document.getElementById('consumable-sell-btn').textContent     = `SELL ${def.sellPrice}★`;

        const useBtn = document.getElementById('consumable-use-btn');
        useBtn.disabled = !canUse;
        useBtn.title    = canUse ? '' : `Only usable in: ${def.usableIn.join(', ')}`;

        this._popupEl.style.display = '';
        this._popupEl.classList.add('open');
        const inner = document.getElementById('consumable-popup-inner');
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
    }

    _doUse() {
        if (this._openSlot === null) return;
        const idx = this._openSlot;
        const def = this._gs.consumables[idx];
        if (!def) return;
        this._gs.useConsumable(idx);
        this._closePopup();
        this.refresh();
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
