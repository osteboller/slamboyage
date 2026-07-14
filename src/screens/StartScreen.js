import { ENCHANT_DEFS } from '../config/enchantDefs.js';
import { CAP_DEFS }    from '../config/constants.js';
import { CONSUMABLE_DEFS } from '../config/consumableDefs.js';

export class StartScreen {
    constructor({ gameState, ui, menuBackground }) {
        this._gameState     = gameState;
        this._ui            = ui;
        this._menuBackground = menuBackground;
        this._el            = null;
        this.onNewRun      = null; // () => {}
        this.onContinueRun = null; // () => {}
        this.onFreeMode    = null; // () => {}
        this.onDevSkipToBoss = null; // () => {}
    }

    enter() {
        this._el = document.createElement('div');
        this._el.id = 'start-screen';
        document.body.appendChild(this._el);
        this._render();
        this._menuBackground?.start();

        this._el.addEventListener('click', (e) => {
            if (e.target.closest('#start-new-btn')      && this.onNewRun)      this.onNewRun();
            if (e.target.closest('#start-continue-btn') && this.onContinueRun) this.onContinueRun();
            if (e.target.closest('#start-free-btn')     && this.onFreeMode)    this.onFreeMode();
            if (e.target.closest('#dev-add-score-btn')) {
                this._gameState.score += 100;
                this._ui.setScore(this._gameState.score);
            }
            if (e.target.closest('#dev-enchant-caps-btn')) {
                const caps = [...this._gameState.ownedCaps];
                for (let i = caps.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [caps[i], caps[j]] = [caps[j], caps[i]];
                }
                caps.slice(0, ENCHANT_DEFS.length).forEach((entry, i) => {
                    this._gameState.applyEnchant(entry.id, ENCHANT_DEFS[i].id);
                });
            }
            const seriesBtn = e.target.closest('[data-dev-series]');
            if (seriesBtn) {
                const series = seriesBtn.dataset.devSeries;
                const caps   = CAP_DEFS.filter(d => d.series === series);
                this._gameState.ownedCaps = [];
                caps.forEach(def => this._gameState.gainCap(def));
            }
            // Tilføjer via samme addConsumable() som resten af spillet bruger —
            // fyldt op (3 slots) betyder simpelthen at klikket ikke gør noget,
            // addConsumable() guarder allerede selv mod det.
            const cardBtn = e.target.closest('[data-dev-card]');
            if (cardBtn) {
                const def = CONSUMABLE_DEFS.find(c => c.id === cardBtn.dataset.devCard);
                if (def) this._gameState.addConsumable(def);
            }
            if (e.target.closest('#dev-skip-to-boss-btn')) {
                this._gameState.startRun();
                this._ui.resetSlammerToStarter();
                this._gameState.nodeIndex = this._gameState.runNodes.length - 1; // sidste node = boss
                this._gameState.score     = 999; // nok til at teste "sidste chance"-shop-advarslen med
                if (this.onDevSkipToBoss) this.onDevSkipToBoss();
            }
        });
    }

    exit() {
        this._menuBackground?.stop();
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
            <div id="dev-btns">
                <button id="dev-add-score-btn">DEV +100★</button>
                <button id="dev-enchant-caps-btn">DEV ENCHANT CAPS</button>
                <button id="dev-skip-to-boss-btn">DEV SKIP TO BOSS</button>
                <div id="dev-series-btns" class="dev-mini-btn-group">
                    <div class="dev-btn-row">
                        <button class="dev-mini-btn" data-dev-series="pewl_ballz">PEWLS</button>
                        <button class="dev-mini-btn" data-dev-series="raptor_strike">RAPTORS</button>
                        <button class="dev-mini-btn" data-dev-series="scary_skullz">SKULLZ</button>
                        <button class="dev-mini-btn" data-dev-series="cosmic_caps">COSMIC</button>
                    </div>
                    <div class="dev-btn-row">
                        <button class="dev-mini-btn" data-dev-series="dawgz">DAWGZ</button>
                        <button class="dev-mini-btn" data-dev-series="zupers">ZUPERS</button>
                        <button class="dev-mini-btn" data-dev-series="zrees">ZREES</button>
                        <button class="dev-mini-btn" data-dev-series="legacy_discs">LEGAZ</button>
                    </div>
                </div>
                <div id="dev-card-btns" class="dev-mini-btn-group">
                    <div class="dev-btn-row">
                        <button class="dev-mini-btn" data-dev-card="extra_throw">CHOMP</button>
                        <button class="dev-mini-btn" data-dev-card="double_next">DUBBL</button>
                        <button class="dev-mini-btn" data-dev-card="refresh">FRESH</button>
                        <button class="dev-mini-btn" data-dev-card="enchant">MYSTI</button>
                    </div>
                    <div class="dev-btn-row">
                        <button class="dev-mini-btn" data-dev-card="white_card">BLANC</button>
                        <button class="dev-mini-btn" data-dev-card="clone">TWINS</button>
                        <button class="dev-mini-btn" data-dev-card="transform">MUTTZ</button>
                        <button class="dev-mini-btn" data-dev-card="power_up">VOLT</button>
                    </div>
                    <div class="dev-btn-row">
                        <button class="dev-mini-btn" data-dev-card="double_relic">AMPLI</button>
                        <button class="dev-mini-btn" data-dev-card="skip_trickshot">SKIPP</button>
                    </div>
                </div>
            </div>`;
    }
}
