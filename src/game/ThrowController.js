import { audio } from '../audio/AudioManager.js';
import { Vec3, BODY_TYPES } from '../../lib/cannon.js';
import { POG_H, POG_R, SLAM_H, SHOT_DELAY,
         POWER_SPEED_MIN, POWER_SPEED_MAX, SETTLE } from '../config/constants.js';

export class ThrowController {
    constructor({ physics, render, cam, collisions, factory, ui }) {
        this._physics    = physics;
        this._render     = render;
        this._cam        = cam;
        this._collisions = collisions;
        this._factory    = factory;
        this._ui         = ui;

        // Læsbar udefra — bruges af main.js til powerBar, zoom og render.sync
        this.phase   = 'idle';
        this.slammer = null;

        // Intern kast-state
        this._aimingStart  = 0;
        this._fallingStart = 0;
        this._blastTime    = 0;
        this._settleStart  = 0;
        this._prevSlammerY = null;
        this._shotSpeed    = 0;
        this._shotMass     = 0;
        this._pendingX     = 0;
        this._pendingZ     = 0;
        this._slammerDef   = null;
        this._caps         = [];

        // Sættes af RoundManager — kaldes når kast er afgjort
        // signatur: ({ wonNow, faceDown, miss }) => {}
        this.onThrowEnd = null;
    }

    // RoundManager opdaterer referencen ved hver ny stak
    setCaps(caps) { this._caps = caps; }

    // Kaldes fra input.onShot når brugeren klikker
    beginShot(speed, mass, x, z, slammerDef) {
        this._shotSpeed   = speed;
        this._shotMass    = mass;
        this._pendingX    = x;
        this._pendingZ    = z;
        this._slammerDef  = slammerDef;
        this._aimingStart = performance.now();
        this.phase        = 'aiming';
    }

    // Kaldes fra collisions.onBlast
    onBlastEvent() {
        if (this.phase !== 'falling') return;
        this._blast();
        this._blastTime = performance.now();
        this.phase      = 'blasted';
        this._ui.setStatus('BOOM!');
    }

    // Kaldes fra collisions.onMiss
    forceEnd(miss = false) {
        if (this.phase !== 'falling') return;
        this._collisions.reset();
        this._endThrow(miss);
    }

    // Nulstil til idle uden at røre slammer — RoundManager rydder den op
    reset() {
        this.phase         = 'idle';
        this._prevSlammerY = null;
    }

    // Kaldes hvert frame fra animate() — returnerer ingenting
    update(now, dt) {
        const caps = this._caps;

        if (this.phase === 'aiming' && now - this._aimingStart >= SHOT_DELAY) {
            this._render.setReticleVisible(false);
            this.slammer = this._factory.spawnSlammer(
                this._slammerDef, this._pendingX, this._pendingZ,
                this._shotSpeed, this._shotMass, caps.length
            );
            this._collisions.activate();
            this.phase         = 'falling';
            this._fallingStart = now;
            this._ui.setStatus('Slammer falling...');

            // Swoosh-lyd valgt efter power-bar-styrke (1=svagest, 5=kraftigst) —
            // samme powerRatio-formel som _blast() bruger til kamera-shake.
            // rate:1 (ingen tilfældig pitch-variation her) — de 5 filer ER
            // allerede variationen, og tilfældig pitch oveni ville kunne gøre
            // en svag swoosh_2 lyde kraftigere end en kraftig swoosh_4.
            const powerRatio  = (this._shotSpeed - POWER_SPEED_MIN) / (POWER_SPEED_MAX - POWER_SPEED_MIN);
            const swooshIndex = Math.min(5, Math.max(1, Math.ceil(powerRatio * 5)));
            audio.play(`swoosh_${swooshIndex}`, { rate: 1 });
        }

        if (this.phase === 'falling' && now - this._fallingStart > 5000) {
            this.forceEnd(true);
        }

        // CCD safety net — broadphase-uafhængig pass-through-detektion
        if (this.phase === 'falling' && this.slammer) {
            const sp      = this.slammer.body.position;
            const prev    = this._prevSlammerY ?? sp.y;
            const halfSum = (SLAM_H + POG_H) / 2;
            for (const { body } of caps) {
                const cp  = body.position;
                const dxz = Math.sqrt((sp.x - cp.x) ** 2 + (sp.z - cp.z) ** 2);
                if (dxz < POG_R * 2 && sp.y < cp.y + halfSum && prev > cp.y - halfSum) {
                    this._collisions.forceBlast();
                    break;
                }
            }
            this._prevSlammerY = sp.y;
        } else {
            this._prevSlammerY = null;
        }

        if (this.phase === 'blasted' && this.slammer && now - this._blastTime > 400) {
            this.slammer.body.linearDamping  = 0.95;
            this.slammer.body.angularDamping = 0.95;
            this.phase        = 'settling';
            this._settleStart = now;
            this._ui.setStatus('Caps settling...');
        }

        if (this.phase === 'settling') {
            const el = now - this._settleStart;
            if (el > SETTLE.RAMP_DELAY_MS) {
                const tl = Math.min((el - SETTLE.RAMP_DELAY_MS) / SETTLE.LINEAR_RAMP_MS,  1);
                const ta = Math.min((el - SETTLE.RAMP_DELAY_MS) / SETTLE.ANGULAR_RAMP_MS, 1);
                caps.forEach(({ body }) => {
                    body.linearDamping  = SETTLE.AIR_LINEAR  + tl * (SETTLE.LINEAR_MAX  - SETTLE.AIR_LINEAR);
                    body.angularDamping = SETTLE.AIR_ANGULAR + ta * (SETTLE.ANGULAR_MAX - SETTLE.AIR_ANGULAR);
                });
            }
            if (el > SETTLE.MAX_MS || (el > SETTLE.MIN_MS && this._allStill())) {
                this._endThrow();
            }
        }
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _blast() {
        // sqrt(3.5) ≈ 1.87 — matcher original force-niveau (mass var altid 3.5 før stats)
        const force = Math.sqrt(3.5) * this._shotSpeed * (this._slammerDef?.power ?? 0.55);
        const powerRatio = (this._shotSpeed - POWER_SPEED_MIN) / (POWER_SPEED_MAX - POWER_SPEED_MIN);

        // Selve brag-lyden, i fem styrker (samme bucketing som swoosh_1..5) —
        // adskilt fra swoosh, som allerede spillede ved selve kastet. rate:1 af
        // samme grund som swoosh: de 5 filer ER variationen, tilfældig pitch
        // oveni ville sløre rækkefølgen.
        const hitTiers = ['slammer_hit_weak', 'slammer_hit_low_mid', 'slammer_hit_mid', 'slammer_hit_high_mid', 'slammer_hit_big'];
        const hitIdx   = Math.min(5, Math.max(1, Math.ceil(powerRatio * 5))) - 1;
        audio.play(hitTiers[hitIdx], { rate: 1 });

        const shakeFloor = 0.90;
        if (powerRatio >= shakeFloor) {
            const t = (powerRatio - shakeFloor) / (1 - shakeFloor);
            this._cam.triggerShake(0.5 + t * 2.0, 250 + t * 400);
        }

        // Caps med en usædvanligt høj r (kastet usædvanligt "vildt" afsted) samles
        // op undervejs, så vi bagefter kan lade et par stykker af dem (ikke alle —
        // ville blive en lydvæg ved store stacks) spille en ambient swoosh-lyd,
        // se afspilningen efter løkken nedenfor.
        const wildIndices = [];

        this._caps.forEach(({ body }, i) => {
            body.type           = BODY_TYPES.DYNAMIC;
            body.linearDamping  = SETTLE.AIR_LINEAR;
            body.angularDamping = SETTLE.AIR_ANGULAR;
            body.wakeUp();
            // Nulstiller "har allerede spillet sin landingslyd"-flaget for DETTE
            // kast — se CollisionManager.js's beginContact-udvidelse.
            body.userData.hasLanded = false;

            const angle = (i / this._caps.length) * Math.PI * 2 + (Math.random() - 0.5) * 1.5;
            const r     = 0.6 + Math.random() * 0.9;
            if (r > 1.2) wildIndices.push(i);

            body.velocity.x = Math.cos(angle) * force * r;
            body.velocity.z = Math.sin(angle) * force * r;
            body.velocity.y = force * (0.3 + Math.random() * 0.5);

            body.angularVelocity.x = (Math.random() - 0.5) * force * 1.8;
            body.angularVelocity.z = (Math.random() - 0.5) * force * 1.8;
            body.angularVelocity.y = (Math.random() - 0.5) * force * 0.4;
        });

        // Maks 3 swoosh'er pr. blast, uanset hvor mange caps der kvalificerer —
        // ren atmosfære, ikke en 1:1 fysik-event pr. cap (se AudioManager.playCapSwoosh()).
        const MAX_SWOOSH_PER_BLAST = 3;
        for (let n = wildIndices.length - 1; n > 0; n--) {
            const j = Math.floor(Math.random() * (n + 1));
            [wildIndices[n], wildIndices[j]] = [wildIndices[j], wildIndices[n]];
        }
        wildIndices.slice(0, MAX_SWOOSH_PER_BLAST).forEach(() => {
            setTimeout(() => audio.playCapSwoosh(), Math.random() * 150);
        });
    }

    _allStill() {
        return this._caps.every(({ body }) =>
            body.sleepState === 2 ||
            (body.velocity.length()        < SETTLE.STILL_LINEAR &&
             body.angularVelocity.length() < SETTLE.STILL_ANGULAR)
        );
    }

    _endThrow(miss = false) {
        // Frys caps
        this._caps.forEach(({ body }) => {
            body.type = BODY_TYPES.STATIC;
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
        });
        // Frys og snap slammer
        if (this.slammer) {
            this.slammer.body.type = BODY_TYPES.STATIC;
            this.slammer.body.velocity.set(0, 0, 0);
            this.slammer.body.angularVelocity.set(0, 0, 0);
            if (this.slammer.body.position.y < SLAM_H / 2 + 0.05) {
                this.slammer.body.position.y = SLAM_H / 2 + 0.05;
            }
        }

        // Face-up / face-down sortering
        const wonNow   = [];
        const faceDown = [];
        this._caps.forEach(cap => {
            const up = new Vec3(0, 1, 0);
            cap.body.quaternion.vmult(up, up);
            (up.y > 0 ? wonNow : faceDown).push(cap);
        });

        this.phase = 'idle';
        if (this.onThrowEnd) this.onThrowEnd({ wonNow, faceDown, miss });
    }
}
