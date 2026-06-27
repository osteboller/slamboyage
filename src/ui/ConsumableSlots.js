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
            el.innerHTML = def
                ? `<div style="text-align:center">
                     <span class="consumable-slot-icon">${def.icon}</span>
                     <div class="consumable-slot-name">${def.name}</div>
                   </div>`
                : '';
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

        document.getElementById('consumable-popup-icon').textContent = def.icon;
        document.getElementById('consumable-popup-name').textContent = def.name;
        document.getElementById('consumable-popup-desc').textContent = def.description;
        document.getElementById('consumable-sell-btn').textContent   = `SELL ${def.sellPrice}★`;

        const useBtn = document.getElementById('consumable-use-btn');
        useBtn.disabled = !canUse;
        useBtn.title    = canUse ? '' : `Only usable in: ${def.usableIn.join(', ')}`;

        this._popupEl.style.display = '';
        this._popupEl.classList.add('open');
        // re-trigger animation
        const inner = document.getElementById('consumable-popup-inner');
        inner.style.animation = 'none';
        void inner.offsetWidth;
        inner.style.animation = '';
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
