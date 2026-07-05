import { BODY_TYPES, Vec3 } from '../../lib/cannon.js';
import { POG_H, POG_R, THROWS_PER_ROUND } from '../config/constants.js';
import { NEARBY_RADIUS, VERY_NEARBY_RADIUS } from './EffectResolver.js';
import { EffectResolver } from './EffectResolver.js';
import { isFaceUp } from './capUtils.js';
import { resolveTrickShot } from './trickshots/index.js';
import { getBossThrowMultiplier } from './bossModifiers/index.js';

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
        this._magnetCancels = [];

        // Callback: called after buildStack/applyRestack — BattleScreen resets settleMaxR
        this.onNewStack = null;

        // Callback: fired when round ends — signature: ({ totalScore, capsFlipped }) => {}
        this.onRoundEnd = null;

        // Callback: fired when the last score float's final number is shown — score display is now settled
        this.onScoreSettled = null;

        // Trick Shot state — set by buildTrickShotStack(), cleared by buildStack()
        this._activeTrickShot = null;
        // Callback: fired when a Trick Shot's single throw has settled — signature: (success) => {}
        this.onTrickShotResolved = null;

        // Boss-node state — set via setActiveBoss(), cleared by buildStack()
        this._activeBoss = null;

        // Wire throwCtrl — sættes her så main.js ikke behøver kende til den
        this._throwCtrl.onThrowEnd = ({ wonNow, faceDown, miss }) =>
            this._handleThrowEnd(wonNow, faceDown, miss);
    }

    get phase()      { return this._phase; }
    get totalScore() { return this._totalScore; }

    addThrow() {
        if (this._phase === 'idle' || this._phase === 'ready') {
            this._throwsLeft++;
            this._ui.updateThrowPips(this._throwsLeft, this._throwsLeft + this._throwIndex);
            if (this._throwsLeft > 1) this._ui.hideLastStandBadge();
        }
    }

    // Aktiverer en boss-gimmick for den kommende runde — kaldes af BattleScreen
    // EFTER buildStack(), da buildStack() selv nulstiller _activeBoss til null.
    setActiveBoss(bossDef) {
        this._activeBoss = bossDef ?? null;
    }

    get _geb() {
        return (id) => (this._voltageBonus ?? 0) + (this._roundCapBonuses?.get(id) ?? 0);
    }

    addVoltage(amount) {
        this._voltageBonus = (this._voltageBonus ?? 0) + amount;
        this._ui.updatePileButtons(this.caps, this._wonCapsAll, this._geb);
    }

    addToBase(amount) {
        this._scoreBase += amount;
        this._ui.setScore(this._scoreBase + this._totalScore);
    }

    // ─── TIMER REGISTRY ────────────────────────────────────────────────────────

    delay(fn, ms) {
        const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
        this._timers.add(id);
        return id;
    }

    cancelAllTimers() {
        this._timers.forEach(clearTimeout);
        this._timers.clear();
        this._magnetCancels.forEach(fn => fn());
        this._magnetCancels = [];
    }

    // Updates enchant on a live cap in the current stack — no-op if cap not in play
    // Returnerer remaining face-down caps som picker-kompatible entries { id, def, enchant }
    // _pendingFaceDown er kun populeret mellem kast — under første kast bruges this.caps
    get remainingCaps() {
        const pool = this._pendingFaceDown.length > 0 ? this._pendingFaceDown : this.caps;
        return pool.map((cap, i) => ({ id: i, def: cap.def, enchant: cap.enchant }));
    }

    // Spawner en ghost-kopi af en cap, shuffler den ind i stacken på en tilfældig position
    addGhostCap(def, enchant = null) {
        // Unikt (negativt) id pr. ghost — IKKE null. Ellers kolliderer flere
        // ghosts på samme _roundCapBonuses-nøgle, og guards som `entryId != null`
        // forhindrer helt at en ghosts egen effekt-bonus (fx absorb) bliver
        // gemt/vist som badge, selvom den stadig tæller korrekt med i scoren.
        const ghostEntryId = this._nextGhostId--;
        const ghost = this._factory.spawnCap(def, POG_H * 0.5, enchant, ghostEntryId, true);
        const pool  = this._pendingFaceDown.length > 0 ? this._pendingFaceDown : this.caps;
        pool.push(ghost);

        // Shuffle ghost ind på tilfældig position og repositioner alle bodies
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        pool.forEach((cap, i) => {
            cap.body.position.set(0, POG_H * 0.5 + i * (POG_H + 0.01), 0);
            cap.body.previousPosition.copy(cap.body.position);
        });

        if (this._pendingFaceDown.length === 0) this._throwCtrl.setCaps(this.caps);
        this._ui.updatePileButtons(pool, this._wonCapsAll, this._geb);
        this._spawnGhostFeedback(ghost);
    }

    _spawnGhostFeedback(ghost) {
        // Bounce-in på mesh: skala 0 → 1.25 → 1
        ghost.mesh.scale.setScalar(0);
        const start = performance.now();
        const tick = () => {
            const t    = Math.min((performance.now() - start) / 380, 1);
            const ease = t < 0.65
                ? (t / 0.65) ** 2
                : 1 + Math.sin((t - 0.65) / 0.35 * Math.PI) * 0.25;
            ghost.mesh.scale.setScalar(ease);
            if (t < 1) requestAnimationFrame(tick);
            else ghost.mesh.scale.setScalar(1);
        };
        requestAnimationFrame(tick);

        // Blå ring i 3D + 👻 indikator
        const pos = ghost.body.position;
        this._render.spawnEffectRing(pos, 1.8, 0x88aaff, 500, 400);
        const { x, y } = this._projectToScreen(pos);
        this._ui.showEffectIndicator(x, y, { type: 'clone' });
    }

    updateLiveCapEnchant(entryId, enchantId) {
        const cap = this.caps.find(c => c.entryId === entryId);
        if (!cap) return;
        cap.enchant = enchantId;
        this._factory.updateCapEnchant(cap.mesh, enchantId);
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
            const entry = shuffled[i % shuffled.length];
            this.caps.push(this._factory.spawnCap(
                entry.def,
                POG_H * 0.5 + i * (POG_H + 0.01),
                entry.enchant,
                entry.id ?? null
            ));
        }

        this._throwIndex = 0;
        this._scoreBase         = scoreBase;

        this._phase             = 'idle';
        this._totalScore        = 0; // reset per node/session
        this._throwsTotal       = THROWS_PER_ROUND + (this._gs?.throwBonus ?? 0);
        this._throwsLeft        = this._throwsTotal;
        this._wonCapsAll        = [];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = 0;
        this._pendingSpawnDefs  = [];
        this._halflifeEarned    = new Map(); // entryId → bonus earned this session
        this._voltageBonus      = 0;
        this._roundCapBonuses   = new Map(); // entryId → accumulated round bonus (crew/rally)
        this._activeTrickShot   = null; // any normal buildStack() call exits Trick Shot mode
        this._nextGhostId       = -1; // unikke negative ids til Twinsies-ghosts denne runde
        this._activeBoss        = null; // sættes eksplicit af BattleScreen EFTER dette kald

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();
        this._render.setReticleVisible(false);

        if (this.onNewStack) this.onNewStack();

        this._ui.setScore(this._scoreBase);
        this._ui.hideResults();
        this._ui.updateThrowPips(this._throwsTotal, this._throwsTotal);

        const slammers = this._gs?.ownedSlammers ?? [];
        const firstStrikeSlammer = slammers.find(s => s.passive?.type === 'firstThrow');
        if (firstStrikeSlammer) this._ui.showFirstStrikeBadge(firstStrikeSlammer);
        else                    this._ui.hideFirstStrikeBadge();
        // Last Stand only visible on the last throw — hide at start unless round is 1 throw
        const lastStandSlammer = slammers.find(s => s.passive?.type === 'lastThrow');
        if (lastStandSlammer && this._throwsTotal === 1) this._ui.showLastStandBadge(lastStandSlammer);
        else                                              this._ui.hideLastStandBadge();
        this._ui.updatePileButtons(this.caps, [], this._geb);
        this._ui.setStatus('Building stack...');
        this._ui.setActionPrompt(null);
        this.delay(() => {
            if (this._phase === 'idle') this._ui.setActionPrompt('Hold to aim');
        }, 300);
    }

    // Bygger en stak til et Trick Shot-forsøg: hele owned-caps-puljen, kun 1 kast.
    // buildStack() nulstiller _activeTrickShot, så vi sætter den EFTER kaldet.
    buildTrickShotStack(trickShotDef) {
        const ownedCaps = this._gs?.ownedCaps ?? [];
        // scoreBase = nuværende wallet-score (efter cost-fradrag) — der scores intet
        // under et forsøg, så buildStack's interne setScore skal ramme det rigtige tal.
        this.buildStack(null, ownedCaps, this._gs?.score ?? 0);
        this._activeTrickShot = trickShotDef;
        this._throwsTotal     = 1;
        this._throwsLeft      = 1;
        this._ui.updateThrowPips(1, 1);
    }

    beginThrow(x, y, z) {
        const slammerDef = this._ui.getSlammerDef();
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

        // Inject spawned caps before reshuffling
        if (this._pendingSpawnDefs.length > 0) {
            this._pendingSpawnDefs.forEach(entry => {
                const def     = entry.def ?? entry;
                const enchant = entry.enchant ?? null;
                this._pendingFaceDown.push(this._factory.spawnCap(def, 100, enchant));
            });
            this._pendingSpawnDefs = [];
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
        this._ui.updatePileButtons(this.caps, this._wonCapsAll, this._geb);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();

        if (this.onNewStack) this.onNewStack();

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);

        this._ui.setStatus(`Throw ${this._pendingThrowsDone + 1}/${this._throwsTotal}`);
        this._ui.setActionPrompt('Hold to aim');
        this._phase = 'idle';

        if (this._throwsLeft === 1) {
            const lastStandSlammer = (this._gs?.ownedSlammers ?? []).find(s => s.passive?.type === 'lastThrow');
            if (lastStandSlammer) this._ui.showLastStandBadge(lastStandSlammer);
        }
    }

    // ─── RESUME FRA GEMT TILSTAND ─────────────────────────────────────────────

    resumeFrom(state) {
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

        this.caps = state.remainingItems.map(({ def, enchant }, i) =>
            this._factory.spawnCap(def, POG_H * 0.5 + i * (POG_H + 0.01), enchant)
        );

        this._throwIndex        = 0;
        this._scoreBase         = state.scoreBase;
        this._phase             = 'idle';
        this._totalScore        = state.totalScore;
        this._throwsTotal       = THROWS_PER_ROUND + (this._gs?.throwBonus ?? 0);
        this._throwsLeft        = state.throwsLeft;
        this._wonCapsAll        = [...state.wonCapDefs];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = this._throwsTotal - state.throwsLeft;
        this._pendingSpawnDefs  = [];

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();
        this._render.setReticleVisible(false);

        if (this.onNewStack) this.onNewStack();

        this._ui.setScore(state.scoreBase + state.totalScore);
        this._ui.hideResults();
        this._ui.updateThrowPips(state.throwsLeft, this._throwsTotal);
        this._ui.updatePileButtons(this.caps, this._wonCapsAll, this._geb);
        this._ui.setStatus(`Throw ${this._pendingThrowsDone + 1}/${this._throwsTotal}`);
        this._ui.setActionPrompt('Hold to aim');
    }

    // ─── INTERN KAST-AFSLUTNING ────────────────────────────────────────────────

    _handleThrowEnd(wonNow, faceDown, miss) {
        this._render.setReticleVisible(false);
        this._throwIndex++;

        // ── Fase A: area-effekter (magnet) — kør FØR scoring ─────────────────
        const MAGNET_RADIUS   = 10;
        const AREA_DURATION   = 700;
        const magnetCaps      = wonNow.filter(c => c.def?.effect === 'magnet');

        magnetCaps.forEach(magCap => {
            const allForMagnet = [...wonNow, ...faceDown];
            const count = this._startMagnetPull(magCap, allForMagnet, MAGNET_RADIUS, AREA_DURATION);
            if (count > 0) {
                const { x, y } = this._projectToScreen(magCap.body.position);
                this._spawnEffectFeedback(magCap.body.position, x, y, { type: 'magnet', count });
            }
        });

        // ── Fase B: individuelle effekter + scoring (efter area-animation) ────
        const areaDelay = magnetCaps.length > 0 ? AREA_DURATION : 0;
        this.delay(() => this._resolveAndScore(wonNow, faceDown, miss), areaDelay);
    }

    _startMagnetPull(magCap, allCaps, radius, duration) {
        const target     = { x: magCap.body.position.x, z: magCap.body.position.z };
        const nearbyCaps = allCaps.filter(c => {
            if (c === magCap) return false;
            const op = c.body.position;
            const dx = target.x - op.x, dz = target.z - op.z;
            return Math.sqrt(dx * dx + dz * dz) < radius;
        });
        if (!nearbyCaps.length) return 0;
        nearbyCaps.splice(5); // max 5 caps påvirket

        nearbyCaps.forEach(other => {
            if (other.body.type === BODY_TYPES.STATIC) other.body.type = BODY_TYPES.DYNAMIC;
            other.body.wakeUp();
            other.body.position.y      += 0.05;
            other.body.previousPosition.y += 0.05;
        });

        const t0 = performance.now();
        let cancelled = false;
        this._magnetCancels.push(() => {
            cancelled = true;
            nearbyCaps.forEach(other => other.body.velocity.set(0, 0, 0));
        });

        const tick = () => {
            if (cancelled) return;
            if (performance.now() - t0 > duration) {
                nearbyCaps.forEach(other => {
                    other.body.velocity.set(0, 0, 0);
                    other.body.angularVelocity.set(0, 0, 0);
                    other.body.type = BODY_TYPES.STATIC;
                });
                return;
            }
            nearbyCaps.forEach(other => {
                const op   = other.body.position;
                const dx   = target.x - op.x, dz = target.z - op.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 0.4) { other.body.velocity.set(0, 0, 0); return; }
                other.body.velocity.set(dx / dist * 20, 0, dz / dist * 20);
            });
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return nearbyCaps.length;
    }

    _resolveAndScore(wonNow, faceDown, miss) {
        // ── Detect caps flipped by magnet animation ────────────────────────────
        const magnetWon = faceDown.filter(c => isFaceUp(c.body));
        const stillDown = faceDown.filter(c => !isFaceUp(c.body));
        const allWon    = [...wonNow, ...magnetWon];

        // ── Phase 1: resolve effects — positions opdateret af magnet ──────────
        const allCaps     = [...allWon, ...stillDown];
        const roundExtras = {
            allRoundCaps:   [...this._wonCapsAll, ...this.caps],
            getStoredBonus: (c) => c.entryId != null && this._gs
                ? (this._gs.ownedCaps.find(e => e.id === c.entryId)?.storedBonus ?? 0) : 0,
            voltageBonus:   this._voltageBonus ?? 0,
            getRoundBonus:  (c) => this._roundCapBonuses?.get(c.entryId) ?? 0,
        };
        const resolved = allWon.map(cap => {
            const ctx    = this._resolver.buildContext(cap, allCaps, this._throwIndex, allWon.length, roundExtras);
            const result = this._resolver.resolve(cap, ctx);
            return { cap, ...result };
        });

        // ── Phase 2: partition returnToStack vs scored ────────────────────────
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

        // ── Phase 2.5: surge chain — resolve synkront, animer bagefter ────────
        // faceDownPool: mutable pool af caps surge kan flippe (kun stillDown, ikke returnCaps)
        const faceDownPool     = [...stillDown];
        const surgeAnimTargets = []; // { cap, step } — til staggered animation
        const surgeAttempts    = []; // { pos, success, step } — til radius-ring feedback (også ved miss)
        const surgeQueue       = actualWon.filter(r => (r.flipNearby ?? 0) > 0);
        const MAX_CHAIN        = 8;
        let   chainStep        = 0;

        while (surgeQueue.length > 0 && chainStep < MAX_CHAIN) {
            const surger    = surgeQueue.shift();
            const sp        = surger.cap.body.position;

            // Find nærmeste face-down cap inden for NEARBY_RADIUS
            let nearestIdx  = -1;
            let nearestDist = Infinity;
            faceDownPool.forEach((cap, idx) => {
                const p    = cap.body.position;
                const dist = Math.sqrt((sp.x - p.x) ** 2 + (sp.z - p.z) ** 2);
                if (dist < NEARBY_RADIUS && dist < nearestDist) {
                    nearestDist = dist; nearestIdx = idx;
                }
            });

            chainStep++;
            if (nearestIdx === -1) {
                surgeAttempts.push({ pos: sp, success: false, step: chainStep });
                continue;
            }

            const target = faceDownPool.splice(nearestIdx, 1)[0];
            surgeAnimTargets.push({ cap: target, step: chainStep });
            surgeAttempts.push({ pos: sp, success: true, step: chainStep, targetPos: target.body.position });

            // Resolve target's effects (inkl. evt. chain-surge)
            const newAllCaps = [...actualWon.map(r => r.cap), ...faceDownPool, target];
            const ctx        = this._resolver.buildContext(target, newAllCaps, this._throwIndex, actualWon.length + surgeAnimTargets.length, roundExtras);
            const result     = this._resolver.resolve(target, ctx);
            const resolved   = { cap: target, ...result };
            actualWon.push(resolved);

            if ((result.flipNearby ?? 0) > 0) surgeQueue.push(resolved);
        }

        // spawnDefs collected AFTER surge so surge-flipped caps' spawn effects are included
        const spawnDefs = actualWon.flatMap(r => r.spawnCaps ?? []);

        const updatedFaceDown = [...faceDownPool, ...returnCaps];

        // ── Surge-flip animationer — rene visuel/fysik-effekter, ingen scoring ──
        // Flyttet hertil (før Trick Shot-forket) så surge stadig SES under et forsøg,
        // ikke kun tælles med usynligt. Viser altid en radius-ring ved surgeren
        // (grøn = fandt mål, rød = ingen face-down cap i NEARBY_RADIUS).
        surgeAttempts.forEach(({ pos, success, step, targetPos }) => {
            this.delay(() => {
                const { x, y } = this._projectToScreen(pos);
                this._spawnEffectFeedback(pos, x, y, { type: 'surge', success, targetPos });
            }, (step - 1) * 220);
        });
        const SURGE_SPIN_MS  = 850;
        const surgeLandDelay = new Map(); // cap → earliest ms score/pop/verdict må fyre, så det ikke forsvinder midt i hoppet
        surgeAnimTargets.forEach(({ cap, step }) => {
            const startAt = (step - 1) * 220;
            surgeLandDelay.set(cap, startAt + SURGE_SPIN_MS + 120);
            this.delay(() => {
                this._render.animateCapFlipSpin(cap.mesh, 3, SURGE_SPIN_MS, () => {
                    const euler = new Vec3();
                    cap.body.quaternion.toEuler(euler);
                    cap.body.quaternion.setFromEuler(0, euler.y, 0);
                });
            }, startAt);
        });

        // ── Trick Shot fork: springer scoring/GameState-persistence helt over ──
        // Effekter + magnet + surge-kæde er allerede kørt ovenfor, så abilities
        // tæller stadig med i checket. Ingen scoring, ingen halflife/relic-writes.
        // Ventes med verdikten til sidste surge-spin er landet (eller en minimums-
        // pause), så spilleren altid når at se cappene ligge stille på bordet først.
        if (this._activeTrickShot) {
            const MIN_VERDICT_DELAY = 700;
            const surgeDelay   = surgeLandDelay.size > 0 ? Math.max(...surgeLandDelay.values()) : 0;
            const verdictDelay = Math.max(MIN_VERDICT_DELAY, surgeDelay);
            const wonCaps      = actualWon.map(r => r.cap);
            this.delay(() => this._resolveTrickShotAttempt(wonCaps, updatedFaceDown), verdictDelay);
            return;
        }

        // ── Phase 2b: crew/rally tilføjer rundevis bonus til _roundCapBonuses ──
        // Bonus persisterer resten af runden og vises i pile-overlay badges.
        const auraFeedback = new Map(); // donor cap → { type, targets } — kun til visuel feedback
        actualWon.forEach(({ cap: donor, auraBonus, auraFilter }) => {
            if (!auraBonus || !auraFilter) return;
            const pd = donor.body.position;
            const targets = [];
            // crew: alle caps i runden; rally: same-throw won + face-down (positionsbaseret)
            const candidateCaps = auraFilter === 'series'
                ? [...actualWon.map(r => r.cap), ...updatedFaceDown, ...this._wonCapsAll]
                : [...actualWon.map(r => r.cap), ...updatedFaceDown];
            candidateCaps.forEach(target => {
                if (target === donor || target.entryId == null) return;
                const pt         = target.body.position;
                const dx         = pd.x - pt.x, dz = pd.z - pt.z;
                const nearby     = Math.sqrt(dx * dx + dz * dz) < NEARBY_RADIUS;
                const sameSeries = donor.def?.series && donor.def.series === target.def?.series;
                const matches    = auraFilter === 'nearby'  ? nearby
                                 : auraFilter === 'series'  ? sameSeries
                                 : nearby || sameSeries;
                if (matches) {
                    this._roundCapBonuses.set(target.entryId,
                        (this._roundCapBonuses.get(target.entryId) ?? 0) + auraBonus);
                    targets.push({ x: pt.x, y: pt.y, z: pt.z });
                }
            });
            if (targets.length > 0) {
                const feedType = auraFilter === 'nearby' ? 'rally' : 'crew';
                auraFeedback.set(donor, { type: feedType, targets, count: targets.length });
            }
        });

        // ── Phase 3+4: per-cap score med flat bonus + global multiplier-kæde ──
        const flatSlammerBonus = this._gs?.flatSlammerBonus ?? 0;
        const multChain       = this._gs?.multiplierChain  ?? [];
        const doubleStacks    = this._gs?.activeDouble ?? 0;
        if (doubleStacks > 0 && this._gs) { this._gs.activeDouble = 0; this._ui.hideDoubleBadge(); }
        const doubleChain     = doubleStacks > 0 ? [...multChain, 2 ** doubleStacks] : multChain;

        const isFirstThrow    = this._pendingThrowsDone === 0;
        const isLastThrow     = this._throwsLeft === 1;
        const slammers        = this._gs?.ownedSlammers ?? [];
        const firstMult       = isFirstThrow ? slammers.filter(s => s.passive?.type === 'firstThrow').reduce((m, s) => m * s.passive.value, 1) : 1;
        const lastMult        = isLastThrow  ? slammers.filter(s => s.passive?.type === 'lastThrow' ).reduce((m, s) => m * s.passive.value, 1) : 1;
        if (isFirstThrow) this._ui.hideFirstStrikeBadge();
        if (isLastThrow)  this._ui.hideLastStandBadge();
        // Parity-slammere (Even Steven/Odd Todd) — hele kastets antal flips afgør
        // om de matcher, ligesom boss-gimmicken, men her som en ren bonus (ikke veto).
        const flipCount       = actualWon.length;
        const parityMult      = slammers.filter(s => s.passive?.type === 'parityMultiplier')
            .reduce((m, s) => (flipCount % 2 === (s.passive.parity === 'even' ? 0 : 1) ? m * s.passive.value : m), 1);
        const positionChain   = [...doubleChain, ...(firstMult > 1 ? [firstMult] : []), ...(lastMult > 1 ? [lastMult] : []), ...(parityMult > 1 ? [parityMult] : [])];
        const globalMult      = positionChain.reduce((m, v) => m * v, 1);

        // Boss-gimmick multiplier (Even Steven/Odd Todd/No Glam Fam) — holdes UDENFOR
        // positionChain, så den ikke optræder i score-floatens visuelle multiplier-kæde
        // (der kun viser tal > 1 — boss-effekten kan jo netop være 0).
        const bossMult = this._activeBoss
            ? getBossThrowMultiplier(this._activeBoss.gimmick, {
                actualWonCount: actualWon.length,
                ownedCaps:      this._gs?.ownedCaps ?? [],
            })
            : 1;
        const finalGlobalMult = globalMult * bossMult;

        // Parity-boss feedback (Even Steven/Odd Todd) — et grønt flueben/rødt kryds
        // pr. kast så spilleren straks kan se OM og HVORFOR kastet scorer 0, i
        // stedet for bare at se en score-float på +0 uden forklaring.
        if (this._activeBoss && actualWon.length > 0 &&
            (this._activeBoss.gimmick === 'even_steven' || this._activeBoss.gimmick === 'odd_todd')) {
            this._ui.showBossThrowFeedback(bossMult > 0);
        }

        const voltage    = this._voltageBonus ?? 0;
        const scoredCaps = actualWon.map(({ cap, bonus, localMultiplier, baseValue, effectMeta }) => {
            const roundBonus = this._roundCapBonuses.get(cap.entryId) ?? 0;
            const gsEntry  = cap.entryId != null && this._gs ? this._gs.ownedCaps.find(c => c.id === cap.entryId) : null;
            const carry    = gsEntry?.enchant === 'halflife' ? (gsEntry?.storedBonus ?? 0) : 0;
            if (gsEntry?.enchant === 'halflife' && cap.entryId != null) {
                this._halflifeEarned.set(cap.entryId, (bonus ?? 0) + roundBonus + voltage);
            }
            // Gem effect-bonus i roundCapBonuses så badge viser total ekstra grundværdi
            if ((bonus ?? 0) > 0 && cap.entryId != null) {
                this._roundCapBonuses.set(cap.entryId, roundBonus + (bonus ?? 0));
            }
            // Rarity-slammere (Common/Uncommon/Rare/Legendary-fokus) — kun caps af den
            // matchende rarity ganges, så det vises i DENNE caps egen chain, ikke i
            // den delte positionChain (som gælder alle caps i kastet).
            const rarityMult = slammers.filter(s => s.passive?.type === 'rarityMultiplier' && s.passive.rarity === (cap.def?.rarity ?? 1))
                .reduce((m, s) => m * s.passive.value, 1);
            const capChain   = rarityMult > 1 ? [...positionChain, rarityMult] : positionChain;
            const capScore   = Math.floor(((baseValue ?? 1) + (bonus ?? 0) + roundBonus + carry + flatSlammerBonus + voltage) * (localMultiplier ?? 1));
            const finalScore = Math.floor(capScore * finalGlobalMult * rarityMult);
            return { cap, capScore, finalScore, effectMeta: effectMeta ?? null, chain: capChain, carry };
        });
        const scoreGained = scoredCaps.reduce((sum, { finalScore }) => sum + finalScore, 0);

        this._wonCapsAll.push(...actualWon.map(({ cap }) => cap));
        this._totalScore += scoreGained;
        this._throwsLeft--;

        const hasNextThrow = this._throwsLeft > 0 && updatedFaceDown.length > 0;

        // ── Pop animations + per-cap score floats ────────────────────────────
        const popDelay   = Math.max(80, 500 / Math.max(actualWon.length, 1));
        const finalScore = this._scoreBase + this._totalScore;

        // Runde-ende resultat-overlay må ikke poppe op før sidste score-float er
        // landet — ellers dækker den skærmen mens spilleren stadig burde se
        // sidste kasts effekter/scores rulle ud. Kaldes derfor herfra, ikke
        // synkront længere nede, og kun hvis runden faktisk er slut.
        const showRoundResults = () => this._ui.showResults(
            this._wonCapsAll.length, this._totalScore,
            this._wonCapsAll, updatedFaceDown.length === 0
        );

        const scoreDelays = scoredCaps.map(({ cap }, i) => Math.max(i * popDelay, surgeLandDelay.get(cap) ?? 0));
        const lastIdx      = scoreDelays.reduce((best, d, i) => d > scoreDelays[best] ? i : best, 0);

        scoredCaps.forEach(({ cap, capScore, effectMeta, chain, carry }, i) => {
            const isLast = i === lastIdx;
            this.delay(() => {
                const { x, y } = this._projectToScreen(cap.body.position);
                if (effectMeta) this._spawnEffectFeedback(cap.body.position, x, y, effectMeta);
                const auraMeta = auraFeedback.get(cap);
                if (auraMeta)  this._spawnEffectFeedback(cap.body.position, x, y, auraMeta);
                this._ui.showScoreFloat(x, y, capScore, chain, () => {
                    this._popCapMesh(cap.mesh);
                    this._ui.popCollectIcon(cap.def);
                    if (isLast) {
                        this._ui.setScore(finalScore);
                        if (scoreGained > 0) this._ui.showScoreGain(scoreGained);
                        if (!hasNextThrow) showRoundResults();
                        if (this.onScoreSettled) this.onScoreSettled(finalScore);
                    }
                }, carry);
            }, scoreDelays[i]);
        });
        if (scoredCaps.length === 0) {
            this._ui.setScore(finalScore);
            if (!hasNextThrow) showRoundResults();
            if (this.onScoreSettled) setTimeout(() => this.onScoreSettled(finalScore), 0);
        }

        const displayRemaining = hasNextThrow
            ? [...updatedFaceDown, ...spawnDefs]
            : updatedFaceDown;
        this._ui.updatePileButtons(displayRemaining, this._wonCapsAll, this._geb);
        this._ui.updateThrowPips(this._throwsLeft, this._throwsTotal);

        if (hasNextThrow) {
            this._pendingWon         = actualWon.map(({ cap }) => cap);
            this._pendingFaceDown    = updatedFaceDown;
            this._pendingThrowsDone  = this._throwsTotal - this._throwsLeft;
            this._pendingSpawnDefs   = spawnDefs;

            // Animate stack button for each spawn cap, after score floats finish
            if (spawnDefs.length > 0) {
                const spawnAnimDelay = scoredCaps.length > 0
                    ? scoredCaps.length * popDelay + 350
                    : 350;
                spawnDefs.forEach((entry, i) => {
                    this.delay(() => this._ui.popStackIcon(entry.def ?? entry), spawnAnimDelay + i * 200);
                });
            }

            const bossVetoMsg = bossMult === 0 && actualWon.length > 0 ? ` · ${this._activeBoss.name}: 0pts!` : '';
            const flippedMsg = actualWon.length > 0
                ? `${actualWon.length} flipped · ${updatedFaceDown.length} left${bossVetoMsg}`
                : `Miss! · ${updatedFaceDown.length} left`;
            this._ui.setStatus(miss && actualWon.length === 0
                ? `Miss! · ${updatedFaceDown.length} left`
                : flippedMsg);
            this._ui.setActionPrompt('Tap to continue');
            this._phase = 'ready';
        } else {
            // Unused throws → grow throwSaver multiplier
            if (this._throwsLeft > 0 && this._gs) {
                this._gs.ownedSlammers
                    .filter(s => s.passive?.type === 'throwSaver')
                    .forEach(s => {
                        const p = s.passive;
                        const oldValue = p.currentValue ?? 1.0;
                        p.currentValue = oldValue + this._throwsLeft * p.value;
                        p.description  = `Each unused throw adds ×${p.value} · Current: ×${p.currentValue.toFixed(1)}`;
                        this._ui.showRelicGain(p.icon, oldValue, p.currentValue, this._throwsLeft);
                    });
            }
            // HALFLIFE: persist earned bonuses for flipped caps, decay unflipped
            if (this._gs) {
                this._halflifeEarned.forEach((earned, capId) => {
                    this._gs.saveHalflifeBonus(capId, earned);
                });
                updatedFaceDown.forEach(cap => {
                    const gsEntry = cap.entryId != null
                        ? this._gs.ownedCaps.find(c => c.id === cap.entryId) : null;
                    if (gsEntry?.enchant !== 'halflife') return;
                    // Consolation: score ½ of stored value, then decay it
                    if (gsEntry.storedBonus > 0) {
                        const consolation = Math.ceil(gsEntry.storedBonus / 2);
                        this._totalScore += consolation;
                        const { x, y } = this._projectToScreen(cap.body.position);
                        this._ui.showScoreFloat(x, y, consolation, [], null);
                    }
                    this._gs.decayHalflifeBonus(cap.entryId);
                });
            }

            this._voltageBonus    = 0;
            this._roundCapBonuses = new Map();
            this._ui.updatePileButtons(updatedFaceDown, this._wonCapsAll, this._geb);

            this._phase = 'done';
            this._ui.setStatus('Round over!');
            this._ui.setActionPrompt('Tap to continue');
            if (this.onRoundEnd) this.onRoundEnd({
                totalScore:  this._scoreBase + this._totalScore,
                capsFlipped: this._wonCapsAll.length,
            });
        }
    }

    // Afgør et Trick Shot-forsøg — kaldes fra _resolveAndScore's fork, aldrig
    // fra normal scoring. Rører aldrig this._gs, this._totalScore eller this._wonCapsAll.
    _resolveTrickShotAttempt(wonCaps, faceDownCaps) {
        const success = resolveTrickShot(this._activeTrickShot.check, wonCaps, faceDownCaps);

        this._throwsLeft = 0;
        this._phase      = 'done';
        this._render.setReticleVisible(false);
        this._ui.setActionPrompt(null);
        this._ui.setStatus(success ? 'Trick Shot cleared!' : 'Trick Shot missed');

        if (this.onTrickShotResolved) this.onTrickShotResolved(success);
    }

    _spawnEffectFeedback(worldPos, screenX, screenY, meta) {
        if (meta.type === 'solo') {
            const color  = meta.qualifies ? 0x4cff88 : 0xff5555;
            const holdMs = meta.qualifies ? 700 : 500;
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, color, holdMs, 350);
        } else if (meta.type === 'neighbours') {
            const holdMs = 180 + meta.count * 200 + 300;
            this._render.spawnEffectRing(worldPos, VERY_NEARBY_RADIUS, 0xffd700, holdMs, 350);
        } else if (meta.type === 'magnet') {
            this._render.spawnEffectRing(worldPos, 10, 0xffaa00, 1400, 500);
        } else if (meta.type === 'rally') {
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, 0x44ffcc, 700, 400);
            (meta.targets ?? []).forEach(pos =>
                this._render.spawnEffectRing(pos, 0.7, 0x44ffcc, 400, 250));
        } else if (meta.type === 'crew') {
            (meta.targets ?? []).forEach(pos =>
                this._render.spawnEffectRing(pos, 0.7, 0xaaffaa, 400, 250));
        } else if (meta.type === 'absorb') {
            if ((meta.bonus ?? 0) > 0) {
                this._render.spawnEffectRing(worldPos, 14, 0xffdd44, 900, 600);
                this._render.spawnEffectRing(worldPos,  7, 0xffffff, 500, 350);
            }
        } else if (meta.type === 'surge') {
            const color  = meta.success ? 0x4cff88 : 0xff5555;
            const holdMs = meta.success ? 600 : 450;
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, color, holdMs, 350);
            if (meta.success && meta.targetPos) {
                this._render.spawnEffectRing(meta.targetPos, 1.4, 0xff6622, 300, 200);
            }
        }
        this._ui.showEffectIndicator(screenX, screenY, meta);
    }

    _projectToScreen(worldPos, worldRadius = 0) {
        const cam = this._cam.camera;
        const vv  = window.visualViewport;
        const vw  = vv ? vv.width  : window.innerWidth;
        const vh  = vv ? vv.height : window.innerHeight;
        const c   = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z).project(cam);
        const cx  = Math.round((c.x *  0.5 + 0.5) * vw);
        const cy  = Math.round((c.y * -0.5 + 0.5) * vh);
        if (!worldRadius) return { x: cx, y: cy };
        // Project a point offset by worldRadius to get perspective-correct screen size
        const e  = new THREE.Vector3(worldPos.x + worldRadius, worldPos.y, worldPos.z).project(cam);
        const ex = Math.round((e.x * 0.5 + 0.5) * vw);
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
