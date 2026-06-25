import { CAM_BASE } from '../config/constants.js';

export class CameraShake {
    constructor(camera) {
        this.camera        = camera;
        this.intensity     = 0;
        this.duration      = 0;
        this.startDuration = 0;
    }

    trigger(intensity, duration) {
        this.intensity     = intensity;
        this.duration      = duration;
        this.startDuration = duration;
    }

    update(dt) {
        if (this.intensity <= 0) return;
        this.duration -= dt * 1000;
        const t = Math.max(0, this.duration / this.startDuration); // 1 → 0
        const s = this.intensity * t * t;                          // ease-out
        this.camera.position.set(
            CAM_BASE.x + (Math.random() - 0.5) * s * 2,
            CAM_BASE.y + (Math.random() - 0.5) * s,
            CAM_BASE.z + (Math.random() - 0.5) * s
        );
        if (this.duration <= 0) {
            this.intensity = 0;
            this.camera.position.set(CAM_BASE.x, CAM_BASE.y, CAM_BASE.z);
        }
    }
}
