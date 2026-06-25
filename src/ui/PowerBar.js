import { POWER_SPEED_MIN, POWER_SPEED_MAX } from '../config/constants.js';

const BASE_OSC_SPEED = 7.0; // rad/s ved precision 1.0 — én fuld svingning ≈ 0.9 sek
const CURVE_EXP      = 3;   // kurve-eksponent: højere = kortere grønt vindue

export class PowerBar {
    constructor() {
        this._enabled   = false;
        this._frozen    = false;
        this._phase     = 0;
        this._level     = 0; // 0–1
        this._oscSpeed  = BASE_OSC_SPEED;

        this._container = document.getElementById('power-container');
        this._mask      = document.getElementById('power-mask');
    }

    isEnabled() { return this._enabled; }

    getMappedSpeed() {
        return POWER_SPEED_MIN + this._level * (POWER_SPEED_MAX - POWER_SPEED_MIN);
    }

    enable() {
        this._enabled = true;
        this._container.style.display = 'block';
        this.reset();
    }

    disable() {
        this._enabled = false;
        this._container.style.display = 'none';
        this.reset();
    }

    // precision > 1 = langsommere bar (nemmere), < 1 = hurtigere (sværere)
    setOscSpeed(precision) {
        this._oscSpeed = BASE_OSC_SPEED / Math.max(0.1, precision);
    }

    freeze() { this._frozen = true; }

    reset() {
        this._phase  = 0;
        this._level  = 0;
        this._frozen = false;
        this._updateDOM();
    }

    update(dt) {
        if (!this._enabled || this._frozen) return;
        this._phase = (this._phase + this._oscSpeed * dt) % (Math.PI * 2);

        // t: 0→1 position i cyklus
        const t = this._phase / (Math.PI * 2);

        if (t < 0.5) {
            // Første halvdel: stiger fra 0 til 1 med ease-in
            // — bar starter langsomt og accelererer mod toppen
            this._level = Math.pow(t * 2, CURVE_EXP);
        } else {
            // Anden halvdel: falder fra 1 til 0 med ease-out
            // — bar starter hurtigt fra toppen og bremser mod bunden
            this._level = Math.pow((1 - t) * 2, CURVE_EXP);
        }

        this._updateDOM();
    }

    _updateDOM() {
        if (this._mask) this._mask.style.height = `${(1 - this._level) * 100}%`;
    }
}
