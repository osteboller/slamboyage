import { BODY_TYPES } from '../../lib/cannon.js';
import { POG_H, POG_R, THROWS_PER_ROUND } from '../config/constants.js';
import { NEARBY_RADIUS, VERY_NEARBY_RADIUS } from './EffectResolver.js';
import { EffectResolver } from './EffectResolver.js';

export class RoundManager {
    constructor({ physics, render, cam, collisions, throwCtrl, factory, ui, powerBar, gameState }) {
        this._physics    = physics;
        this._render     = render;
        this._cam        = cam;
        this._collisions = collisions;
        this._throwCtrl  = throwCtrl;
        this._factory    = factory;
        this._ui         = ui;
        this._powerBar   = powerBar;
        this._gs         = gameState ?? null;

        // Runde-state
        this._phase             = 'idle'; // 'idle'|'throwing'|'ready'|'done'
        this._totalScore        = 0;
        this._throwsLeft        = 0;
        this._wonCapsAll        = [];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = 0;

        // Caps er ejet af RoundManager — main.js læser via this.caps
        this.caps = [];

        this._resolver   = new EffectResolver();
        this._throwIndex = 0; // 1-based, passed to effect context

        // Timer-registry — ensures no delayed logic survives a reset
        this._timers = new Set();

        // Callback: called after buildStack/applyRestack — BattleScreen resets settleMaxR
        this.onNewStack = null;

        // Callback: fired when round ends — signature: ({ totalScore, capsFlipped }) => {}
        this.onRoundEnd = null;

        // Wire throwCtrl — sættes her så main.js ikke behøver kende til den
        this._throwCtrl.onThrowEnd = ({ wonNow, faceDown, miss }) =>
            this._handleThrowEnd(wonNow, faceDown, miss);
    }

    get phase()      { return this._phase; }
    get totalScore() { return this._totalScore; }

    // ─── TIMER REGISTRY ────────────────────────────────────────────────────────

    delay(fn, ms) {
        const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
        this._timers.add(id);
        return id;
    }

    cancelAllTimers() {
        this._timers.forEach(clearTimeout);
        this._timers.clear();
    }

    // ─── SESSION ───────────────────────────────────────────────────────────────

    newSession() {
        this.buildStack();
    }

    // ─── RUNDE-LIVSCYKLUS ──────────────────────────────────────────────────────

    // overrideSize / overrideCaps: bruges af BattleScreen i run-mode
    // scoreBase: persistent wallet score shown as starting value in the UI
    buildStack(overrideSize = null, overrideCaps = null, scoreBase = 0) {
        this.cancelAllTimers();

        this.caps.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });
        this.caps = [];

        if (this._throwCtrl.slammer) {
            this._render.removeMesh(this._throwCtrl.slammer.mesh);
            this._physics.world.removeBody(this._throwCtrl.slammer.body);
            this._throwCtrl.slammer = null;
        }

        const rawSource = overrideCaps ?? [...this._ui.getActiveCaps()];
        const count     = overrideSize ?? (overrideCaps ? rawSource.length : this._ui.getStackCount());

        // Normalize: free mode gives def[], run mode gives {def,enchant}[]
        const source = rawSource.map(item =>
            item?.def ? item : { def: item, enchant: null }
        );
        const shuffled = [...source].sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
            const { def, enchant } = shuffled[i % shuffled.length];
            this.caps.push(this._factory.spawnCap(
                def,
                POG_H * 0.5 + i * (POG_H + 0.01),
                enchant
            ));
        }

        this._throwIndex = 0;
        this._scoreBase         = scoreBase;

        this._phase             = 'idle';
        this._totalScore        = 0; // reset per node/session
        this._throwsLeft        = THROWS_PER_ROUND;
        this._wonCapsAll        = [];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = 0;

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();
        this._render.setReticleVisible(false);

        if (this.onNewStack) this.onNewStack();

        this._ui.setScore(this._scoreBase);
        this._ui.hideResults();
        this._ui.updateThrowPips(THROWS_PER_ROUND, THROWS_PER_ROUND);
        this._ui.updatePileButtons(this.caps.map(c => c.def), []);
        this._ui.setStatus('Building stack...');
        this._ui.setActionPrompt(null);
        this.delay(() => {
            if (this._phase === 'idle') this._ui.setActionPrompt('Tap the field to throw!');
        }, 300);
    }

    beginThrow(x, y, z) {
        const slammerDef = this._ui.getSlammerDef();
        this._powerBar.freeze();
        this._render.setReticlePosition(x, y, z);
        this._render.setReticleVisible(true);
        this._cam.zoomOut();
        this._ui.setActionPrompt(null);
        this._ui.setStatus('Aiming...');
        this._throwCtrl.beginShot(
            this._powerBar.getMappedSpeed(),
            slammerDef.mass,
            x, z,
            slammerDef
        );
        this._phase = 'throwing';
    }

    applyRestack() {
        this._pendingWon.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });

        if (this._throwCtrl.slammer) {
            this._render.removeMesh(this._throwCtrl.slammer.mesh);
            this._physics.world.removeBody(this._throwCtrl.slammer.body);
            this._throwCtrl.slammer = null;
        }

        for (let i = this._pendingFaceDown.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._pendingFaceDown[i], this._pendingFaceDown[j]] = [this._pendingFaceDown[j], this._pendingFaceDown[i]];
        }

        this._pendingFaceDown.forEach(({ body }, i) => {
            this._physics.world.removeBody(body);
            body.type = BODY_TYPES.STATIC;
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.position.set(0, POG_H * 0.5 + i * (POG_H + 0.01), 0);
            body.previousPosition.copy(body.position);
            body.quaternion.setFromEuler(Math.PI + (Math.random() - 0.5) * 0.04, Math.random() * Math.PI * 2, 0);
            this._physics.world.addBody(body);
        });

        this.caps = this._pendingFaceDown;
        this._ui.updatePileButtons(this.caps.map(c => c.def), this._wonCapsAll);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();

        if (this.onNewStack) this.onNewStack();

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);

        this._ui.setStatus(`Throw ${this._pendingThrowsDone + 1}/${THROWS_PER_ROUND}`);
        this._ui.setActionPrompt('Tap to throw!');
        this._phase = 'idle';
    }

    // ─── INTERN KAST-AFSLUTNING ────────────────────────────────────────────────

    _handleThrowEnd(wonNow, faceDown, miss) {
        this._render.setReticleVisible(false);
        this._throwIndex++;

        // ── Phase 1: resolve effects for all flipped caps ──────────────────────
        const allCaps = [...wonNow, ...faceDown];
        const resolved = wonNow.map(cap => {
            const ctx    = this._resolver.buildContext(cap, allCaps, this._throwIndex, wonNow.length);
            const result = this._resolver.resolve(cap, ctx);
            return { cap, ...result };
        });

        // ── Phase 2: partition returnToStack vs scored ─────────────────────────
        const actualWon  = resolved.filter(r => !r.returnToStack);
        const returnCaps = resolved.filter(r =>  r.returnToStack).map(r => r.cap);

        returnCaps.forEach(cap => {
            cap.body.quaternion.setFromEuler(
                Math.PI + (Math.random() - 0.5) * 0.04,
                Math.random() * Math.PI * 2,
                0
            );
            cap.body.previousPosition.copy(cap.body.position);
        });

        const updatedFaceDown = [...faceDown, ...returnCaps];

        // ── Phase 3+4: per-cap score with flat bonus, then chained global multipliers ──
        const flatRelicBonus  = this._gs?.flatRelicBonus   ?? 0;
        const multChain       = this._gs?.multiplierChain  ?? [];
        const globalMult      = multChain.reduce((m, v) => m * v, 1);

        // Pre-compute per-cap scores so floats and total stay consistent
        const scoredCaps = actualWon.map(({ cap, bonus, localMultiplier, effectMeta }) => {
            const capScore   = Math.floor((1 + (bonus ?? 0) + flatRelicBonus) * (localMultiplier ?? 1));
            const finalScore = Math.floor(capScore * globalMult);
            return { cap, capScore, finalScore, effectMeta: effectMeta ?? null };
        });
        const scoreGained = scoredCaps.reduce((sum, { finalScore }) => sum + finalScore, 0);

        this._wonCapsAll.push(...actualWon.map(({ cap }) => cap.def));
        this._totalScore += scoreGained;
        this._throwsLeft--;

        // ── Pop animations + per-cap score floats ────────────────────────────
        const popDelay = Math.max(80, 500 / Math.max(actualWon.length, 1));

        scoredCaps.forEach(({ cap, capScore, effectMeta }, i) => {
            this.delay(() => {
                const { x, y } = this._projectToScreen(cap.body.position);
                if (effectMeta) this._spawnEffectFeedback(cap.body.position, x, y, effectMeta);
                this._ui.showScoreFloat(x, y, capScore, multChain, () => {
                    this._popCapMesh(cap.mesh);
                    this._ui.popCollectIcon(cap.def);
                });
            }, i * popDelay);
        });

        this._ui.updatePileButtons(updatedFaceDown.map(c => c.def), this._wonCapsAll);
        this._ui.setScore(this._scoreBase + this._totalScore);
        this._ui.updateThrowPips(this._throwsLeft, THROWS_PER_ROUND);

        if (this._throwsLeft > 0 && updatedFaceDown.length > 0) {
            this._pendingWon         = actualWon.map(({ cap }) => cap);
            this._pendingFaceDown    = updatedFaceDown;
            this._pendingThrowsDone  = THROWS_PER_ROUND - this._throwsLeft;

            const flippedMsg = actualWon.length > 0
                ? `${actualWon.length} flipped · ${updatedFaceDown.length} left`
                : `Miss! · ${updatedFaceDown.length} left`;
            this._ui.setStatus(miss && actualWon.length === 0
                ? `Miss! · ${updatedFaceDown.length} left`
                : flippedMsg);
            this._ui.setActionPrompt('Tap to continue');
            this._phase = 'ready';
        } else {
            this._phase = 'done';
            this._ui.showResults(
                this._wonCapsAll.length, this._totalScore,
                this._wonCapsAll, updatedFaceDown.length === 0
            );
            this._ui.setStatus('Round over!');
            this._ui.setActionPrompt('Tap to continue');
            if (this.onRoundEnd) this.onRoundEnd({
                totalScore:  this._scoreBase + this._totalScore,
                capsFlipped: this._wonCapsAll.length,
            });
        }
    }

    _spawnEffectFeedback(worldPos, screenX, screenY, meta) {
        if (meta.type === 'solo') {
            const color  = meta.qualifies ? 0x4cff88 : 0xff5555;
            const holdMs = meta.qualifies ? 700 : 500;
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, color, holdMs, 350);
        } else if (meta.type === 'neighbours') {
            const holdMs = 180 + meta.count * 200 + 300;
            this._render.spawnEffectRing(worldPos, VERY_NEARBY_RADIUS, 0xffd700, holdMs, 350);
        }
        this._ui.showEffectIndicator(screenX, screenY, meta);
    }

    _projectToScreen(worldPos, worldRadius = 0) {
        const cam = this._cam.camera;
        const c   = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z).project(cam);
        const cx  = Math.round((c.x *  0.5 + 0.5) * window.innerWidth);
        const cy  = Math.round((c.y * -0.5 + 0.5) * window.innerHeight);
        if (!worldRadius) return { x: cx, y: cy };
        // Project a point offset by worldRadius to get perspective-correct screen size
        const e  = new THREE.Vector3(worldPos.x + worldRadius, worldPos.y, worldPos.z).project(cam);
        const ex = Math.round((e.x * 0.5 + 0.5) * window.innerWidth);
        return { x: cx, y: cy, r: Math.abs(ex - cx) };
    }

    _popCapMesh(mesh) {
        const start = performance.now();
        const dur   = 300;
        (function tick() {
            const t = Math.min((performance.now() - start) / dur, 1);
            const s = t < 0.40
                ? 1 + (t / 0.40) * 0.50
                : 1.50 * (1 - (t - 0.40) / 0.60);
            mesh.scale.set(s, s, s);
            if (t < 1) requestAnimationFrame(tick);
        })();
    }
}
