export class StartScreen {
    constructor({ gameState, ui }) {
        this._gameState    = gameState;
        this._ui           = ui;
        this._el           = null;
        this.onNewRun      = null; // () => {}
        this.onContinueRun = null; // () => {}
        this.onFreeMode    = null; // () => {}
    }

    enter() {
        this._el = document.createElement('div');
        this._el.id = 'start-screen';
        document.body.appendChild(this._el);
        this._render();

        this._el.addEventListener('click', (e) => {
            if (e.target.closest('#start-new-btn')      && this.onNewRun)      this.onNewRun();
            if (e.target.closest('#start-continue-btn') && this.onContinueRun) this.onContinueRun();
            if (e.target.closest('#start-free-btn')     && this.onFreeMode)    this.onFreeMode();
            if (e.target.closest('#dev-add-score-btn')) {
                this._gameState.score += 100;
                this._ui.setScore(this._gameState.score);
            }
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _render() {
        const gs = this._gameState;
        const hasRun = gs.runNodes.length > 0 && !gs.isRunComplete;

        const continueBtn = hasRun ? `
            <button id="start-continue-btn" class="start-btn primary">
                Continue Run
                <span class="start-btn-sub">Node ${gs.runNodes[gs.nodeIndex]?.name} · ${gs.ownedCaps.length} caps</span>
            </button>` : '';

        this._el.innerHTML = `
            <div class="start-inner">
                <h1 class="start-title">SLAMBERZ</h1>
                <p class="start-sub">Flip caps · Build your collection</p>
                <div class="start-btns">
                    <button id="start-new-btn" class="start-btn ${hasRun ? 'secondary' : 'primary'}">New Run</button>
                    ${continueBtn}
                    <button id="start-free-btn" class="start-btn secondary">Free Play</button>
                </div>
            </div>
            <button id="dev-add-score-btn">DEV +100★</button>`;
    }
}
