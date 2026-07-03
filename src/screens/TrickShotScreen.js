// Egen screen for Trick Shot-forsøg — genbruger den delte 3D-infrastruktur
// (physics/render/cam/collisions/input/throwCtrl/roundMgr) men holder sin egen
// enter()/exit()/loop, helt adskilt fra BattleScreens node/free-mode dispatch.
export class TrickShotScreen {
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

        this._animId     = null;
        this._settleMaxR = 0;
        this._last       = 0;

        this._trickShotDef = null;
        this._parentNode   = null;

        // Set by main.js — called when the player taps "Back to map"
        this.onBack = null;
    }

    // context: { trickShotDef, parentNode }
    enter(context) {
        this._trickShotDef = context.trickShotDef;
        this._parentNode   = context.parentNode;

        this._ui.setTrickShotInfo(this._trickShotDef);
        document.getElementById('corner-btns').style.display = 'none';
        document.getElementById('trickshot-result').classList.remove('open');

        this._roundMgr.onNewStack          = () => { this._settleMaxR = 0; };
        this._roundMgr.onTrickShotResolved = (success) => this._onResolved(success);

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
            this._ui.setTrickShotActive(true); // dæmp/puls kriterie-headeren mens kastet spiller ud
            this._roundMgr.beginThrow(x, y, z);
        };

        this._input.onTap = () => {
            if (this._roundMgr.phase === 'idle') {
                this._powerBar.reset();
                this._render.setReticleVisible(false);
                this._ui.setActionPrompt('Hold to aim');
            }
        };

        document.getElementById('trickshot-result').addEventListener('click', this._onResultClick);

        this._startAttempt();

        this._last = performance.now();
        this._loop();
    }

    exit() {
        cancelAnimationFrame(this._animId);
        this._input.onAimStart = null;
        this._input.onAimMove  = null;
        this._input.onRelease  = null;
        this._input.onTap      = null;
        this._roundMgr.onTrickShotResolved = null;
        this._ui.setTrickShotActive(false);
        this._ui.clearTrickShotInfo();
        document.getElementById('trickshot-result').classList.remove('open');
        document.getElementById('trickshot-result').removeEventListener('click', this._onResultClick);
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _startAttempt() {
        this._gameState.attemptTrickShot(this._trickShotDef.cost);
        this._ui.showScoreDeduct(this._trickShotDef.cost);
        this._ui.setTrickShotActive(false);
        document.getElementById('trickshot-result').classList.remove('open');
        // buildTrickShotStack passer scoreBase = gameState.score videre til UI internt
        this._roundMgr.buildTrickShotStack(this._trickShotDef);
    }

    _onResolved(success) {
        this._ui.setTrickShotActive(false); // resultatet er kendt — vis headeren fuldt igen
        if (success && this._parentNode) {
            this._gameState.markRewardUpgraded(this._parentNode.id, this._trickShotDef.rewardType);
        }
        this._showResult(success);
    }

    _showResult(success) {
        const panel = document.getElementById('trickshot-result');
        panel.classList.toggle('trickshot-result--success', success);
        panel.classList.toggle('trickshot-result--fail', !success);
        document.getElementById('trickshot-result-title').textContent = success ? '✓ Cleared!' : '✗ Missed';

        // Efter succes er der intet at vinde ved at prøve igen — kun "Tilbage til kort"
        const retryBtn = document.getElementById('trickshot-retry-btn');
        if (success) {
            retryBtn.style.display = 'none';
        } else {
            const canRetry = this._gameState.canAfford(this._trickShotDef.cost);
            retryBtn.style.display = '';
            retryBtn.disabled      = !canRetry;
            retryBtn.textContent   = `↺ Try Again (−${this._trickShotDef.cost}★)`;
        }
        panel.classList.add('open');
    }

    _onResultClick = (e) => {
        if (e.target.closest('#trickshot-retry-btn')) { this._startAttempt(); return; }
        if (e.target.closest('#trickshot-back-btn'))  { if (this.onBack) this.onBack(); return; }
    };

    _loop = () => {
        this._animId = requestAnimationFrame(this._loop);
        const now = performance.now();
        const dt  = Math.min((now - this._last) / 1000, 1 / 30);
        this._last = now;

        if (this._roundMgr.phase === 'idle') this._powerBar.update(dt);

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
