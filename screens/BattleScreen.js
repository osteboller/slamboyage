export class BattleScreen {
    // gameState tilføjet — bruges til owned caps i run-mode
    constructor({ physics, render, cam, collisions, input, ui, powerBar, throwCtrl, roundMgr, gameState }) {
        this._physics    = physics;
        this._render     = render;
        this._cam        = cam;
        this._collisions = collisions;
        this._input      = input;
        this._ui         = ui;
        this._powerBar   = powerBar;
        this._throwCtrl  = throwCtrl;
        this._roundMgr   = roundMgr;
        this._gameState  = gameState;

        this._animId             = null;
        this._settleMaxR         = 0;
        this._last               = 0;
        this._node               = null;   // aktuel run-node (null = fri mode)
        this._pendingBattleResult = null;  // { won, totalScore, capsFlipped }

        // Set by main.js — called when the battle ends and we need to change screen
        // signature: ({ won, totalScore, capsFlipped }) => {}
        this.onBattleEnd     = null;
        this.onExitFreeMode  = null;
    }

    // Gem runde-tilstand til pause/resume. Returnerer null hvis free mode eller runde er slut.
    captureState() {
        if (!this._node) return null;
        const rm = this._roundMgr;
        if (rm.phase === 'done') return null;
        const remainingCaps = rm.phase === 'ready' ? rm._pendingFaceDown : rm.caps;
        return {
            node:          this._node,
            throwsLeft:    rm._throwsLeft,
            remainingItems: remainingCaps.map(c => ({ def: c.def, enchant: c.enchant })),
            wonCapDefs:    [...rm._wonCapsAll],
            totalScore:    rm._totalScore,
            scoreBase:     rm._scoreBase,
        };
    }

    // node = null → free mode (endless, no win condition)
    // node = { name, clearScore, ... } → run battle
    // { __resume: true, node, saveState } → genoptag gemt battle
    enter(context = null) {
        let node      = context;
        let saveState = null;
        if (context && context.__resume) {
            node      = context.node;
            saveState = context.saveState;
        }
        this._node               = node;
        this._pendingBattleResult = null;

        if (node) {
            this._ui.setRunInfo(node.name, node.clearScore);
        } else {
            this._ui.clearRunInfo();
        }

        this._roundMgr.onNewStack = () => { this._settleMaxR = 0; };

        this._roundMgr.onRoundEnd = ({ totalScore, capsFlipped }) => {
            if (!this._node) return; // free mode: no transition
            const won = totalScore >= this._node.clearScore;
            this._pendingBattleResult = { won, totalScore, capsFlipped };
            this._ui.setActionPrompt(won ? 'Tap to visit the shop' : 'Run over — tap to continue');
        };

        this._roundMgr.onScoreSettled = (totalScore) => {
            if (!this._node || !this._pendingBattleResult) return;
            const { won } = this._pendingBattleResult;
            // Short pause so the gain float is visible before the goal starts counting down
            setTimeout(() => this._ui.showThresholdResult(this._node.clearScore, totalScore, won), 300);
        };

        this._ui.onSlammerChange = (def) => { this._powerBar.setOscSpeed(def.precision); };
        this._powerBar.setOscSpeed(this._ui.getSlammerDef().precision);

        this._input.getHittableObjects = () => this._roundMgr.caps.map(c => c.mesh);

        this._input.onAimStart = (x, y, z) => {
            if (this._ui.isOverlayOpen()) return;
            if (this._roundMgr.phase !== 'idle') return;
            this._powerBar.start();
            this._render.setReticlePosition(x, y, z);
            this._render.setReticleVisible(true);
            this._ui.setActionPrompt('Release to throw!');
        };

        this._input.onAimMove = (x, y, z) => {
            if (this._roundMgr.phase !== 'idle') return;
            this._render.setReticlePosition(x, y, z);
        };

        this._input.onRelease = (x, y, z) => {
            if (this._ui.isOverlayOpen()) return;
            if (this._roundMgr.phase !== 'idle') return;
            this._roundMgr.beginThrow(x, y, z);
        };

        this._input.onTap = () => {
            if (this._ui.isOverlayOpen()) return;
            if (this._roundMgr.phase === 'idle')  { this._powerBar.reset(); this._render.setReticleVisible(false); this._ui.setActionPrompt('Hold to aim'); return; }
            if (this._roundMgr.phase === 'ready')  { this._roundMgr.applyRestack(); return; }
            if (this._roundMgr.phase === 'done') {
                if (this._pendingBattleResult && this.onBattleEnd) {
                    this.onBattleEnd(this._pendingBattleResult);
                } else {
                    this._roundMgr.buildStack();
                }
            }
        };

        document.getElementById('corner-btns').style.display = '';

        if (node) {
            // Run mode: skjul de 3 fri-play knapper
            ['help-btn', 'resetBtn', 'slammer-btn'].forEach(id => {
                document.getElementById(id).style.display = 'none';
            });
        } else {
            // Free mode: pause-knap hører ikke til, home-knap gør
            document.getElementById('pause-btn').style.display = 'none';
            document.getElementById('home-btn').style.display  = '';
            document.getElementById('home-btn').addEventListener('pointerdown', this._onHomeBtn);
            document.getElementById('slammer-btn').addEventListener('pointerdown', this._onSlammerBtn);
            document.getElementById('resetBtn').addEventListener('click', this._onReset);
        }

        // Byg stak: resume fra gemt tilstand, run-mode fra owned caps, eller fri mode
        if (saveState) {
            this._roundMgr.resumeFrom(saveState);
        } else if (this._node && this._gameState) {
            const ownedCaps = this._gameState.ownedCaps;
            const drawCount = Math.min(ownedCaps.length, this._gameState.stackSizeLimit);
            this._roundMgr.buildStack(drawCount, ownedCaps, this._gameState.score);
        } else {
            this._roundMgr.buildStack();
        }

        this._last = performance.now();
        this._loop();
    }

    exit() {
        cancelAnimationFrame(this._animId);
        this._input.onAimStart = null;
        this._input.onAimMove  = null;
        this._input.onRelease  = null;
        this._input.onTap      = null;
        this._roundMgr.onRoundEnd    = null;
        this._roundMgr.onScoreSettled = null;
        this._ui.clearRunInfo();
        this._ui.hidePauseOverlay();
        document.getElementById('corner-btns').style.display = 'none';

        if (this._node) {
            // Gendan de 3 fri-play knapper
            ['help-btn', 'resetBtn', 'slammer-btn'].forEach(id => {
                document.getElementById(id).style.display = '';
            });
        } else {
            document.getElementById('home-btn').style.display = 'none';
            document.getElementById('home-btn').removeEventListener('pointerdown', this._onHomeBtn);
            document.getElementById('slammer-btn').removeEventListener('pointerdown', this._onSlammerBtn);
            document.getElementById('resetBtn').removeEventListener('click', this._onReset);
        }
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _onSlammerBtn = (e) => { e.stopPropagation(); this._ui.toggleSlammerPanel(); };
    _onReset      = (e) => { e.stopPropagation(); this._roundMgr.newSession(); };
    _onHomeBtn    = (e) => { e.stopPropagation(); if (this.onExitFreeMode) this.onExitFreeMode(); };

    _loop = () => {
        this._animId = requestAnimationFrame(this._loop);
        const now = performance.now();
        const dt  = Math.min((now - this._last) / 1000, 1 / 30);
        this._last = now;

        if (this._roundMgr.phase === 'idle') this._powerBar.update(dt);

        // physics FØR throwCtrl: CCD bruger post-step position og fanger
        // pass-through i samme frame som gulv-kontakten → blast vinder over miss
        this._physics.step(dt, this._roundMgr.caps.length);
        this._throwCtrl.update(now, dt);
        this._collisions.checkPending();
        this._render.sync(this._roundMgr.caps, this._throwCtrl.slammer);

        if (this._throwCtrl.phase === 'settling' && !this._cam.isShaking()) {
            this._roundMgr.caps.forEach(({ body }) => {
                if (body.velocity.length() < 12) {
                    const p = body.position;
                    this._settleMaxR = Math.max(this._settleMaxR, Math.sqrt(p.x * p.x + p.z * p.z));
                }
            });
            if (this._settleMaxR > 0) {
                this._cam.setZoomScale(Math.max(1, Math.min(this._settleMaxR / 22, 1.5)));
            }
        }

        this._cam.update(dt);
        this._render.render();
    };
}
