import { CAM_BASE, CAM_CLOSE } from '../config/constants.js';

// Håndterer kamera-zoom (idle ↔ post-blast) og kamera-shake i ét modul.
// Shake appliceres som offset oven på den lerpede base-position.
export class CameraController {
    constructor(camera) {
        this.camera = camera;

        // Start zoomed ind på stakken
        this._base   = { ...CAM_CLOSE };
        this._target = { ...CAM_CLOSE };
        this._lerpSpeed = 3.5; // eksponentiel lerp — ca. 97% fremme efter 1 sek ved 60fps

        // Shake-state
        this._shakeIntensity = 0;
        this._shakeDuration  = 0;
        this._shakeStartDur  = 0;
    }

    // Zoomer ind på stakken — kald ved buildStack()
    zoomIn()  { this._target = { ...CAM_CLOSE }; }

    // Zoomer ud til basispositionen
    zoomOut() { this._target = { ...CAM_BASE }; }

    // Dynamisk zoom: skalerer CAM_BASE op når caps spreder sig
    // scale 1.0 = normal, 2.0 = dobbelt afstand
    setZoomScale(scale) {
        this._target = {
            x: CAM_BASE.x,
            y: CAM_BASE.y * scale,
            z: CAM_BASE.z * scale,
        };
    }

    triggerShake(intensity, duration) {
        this._shakeIntensity = intensity;
        this._shakeDuration  = duration;
        this._shakeStartDur  = duration;
    }

    isShaking() { return this._shakeIntensity > 0; }

    // Kaldes hvert frame i animate-loopet
    update(dt) {
        // Lerp base mod target
        const f = Math.min(1, this._lerpSpeed * dt);
        this._base.x += (this._target.x - this._base.x) * f;
        this._base.y += (this._target.y - this._base.y) * f;
        this._base.z += (this._target.z - this._base.z) * f;

        // Shake-offset ovenpå
        let ox = 0, oy = 0, oz = 0;
        if (this._shakeIntensity > 0) {
            this._shakeDuration -= dt * 1000;
            const t = Math.max(0, this._shakeDuration / this._shakeStartDur);
            const s = this._shakeIntensity * t * t;
            ox = (Math.random() - 0.5) * s * 2;
            oy = (Math.random() - 0.5) * s;
            oz = (Math.random() - 0.5) * s;
            if (this._shakeDuration <= 0) this._shakeIntensity = 0;
        }

        this.camera.position.set(this._base.x + ox, this._base.y + oy, this._base.z + oz);
        this.camera.lookAt(0, 1, 0);
    }
}
