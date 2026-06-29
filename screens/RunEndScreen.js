export class RunEndScreen {
    constructor({ gameState }) {
        this._gs  = gameState;
        this._el  = null;
        this.onTryAgain  = null; // () => {}
        this.onMainMenu  = null; // () => {}
    }

    // context: { node, totalScore, loop, ownedCaps }
    enter(context = {}) {
        const { node, totalScore, loop, ownedCaps = [] } = context;

        this._el    = document.createElement('div');
        this._el.id = 'run-end-screen';
        document.body.appendChild(this._el);
        this._el.innerHTML = this._buildHTML(node, totalScore, loop, ownedCaps);

        this._el.addEventListener('click', e => {
            if (e.target.closest('#run-end-try-again') && this.onTryAgain) {
                this.onTryAgain();
            }
            if (e.target.closest('#run-end-menu') && this.onMainMenu) {
                this.onMainMenu();
            }
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _buildHTML(node, totalScore, loop, ownedCaps) {
        const nodeLabel  = node ? `Failed at ${node.name}` : 'Run over';
        const loopLabel  = loop > 1 ? `Loop ${loop}` : null;
        const capCount   = ownedCaps.length;

        const capPreviews = ownedCaps.slice(0, 12).map(({ def }) =>
            `<img class="run-end-cap-img" src="${def.texFront}" alt="${def.name}" title="${def.name}">`
        ).join('');

        return `
            <div class="run-end-inner">
                <div class="run-end-topline">RUN OVER</div>

                <div class="run-end-node-label">
                    ✗ ${nodeLabel}${loopLabel ? `  ·  ${loopLabel}` : ''}
                </div>

                <div class="run-end-stats">
                    <div class="run-end-stat">
                        <span class="run-end-stat-val">${totalScore}</span>
                        <span class="run-end-stat-key">★ score</span>
                    </div>
                    <div class="run-end-stat-sep">·</div>
                    <div class="run-end-stat">
                        <span class="run-end-stat-val">${capCount}</span>
                        <span class="run-end-stat-key">caps</span>
                    </div>
                </div>

                ${capCount > 0 ? `<div class="run-end-caps">${capPreviews}</div>` : ''}

                <div class="run-end-actions">
                    <button id="run-end-try-again" class="run-end-btn primary">Try Again</button>
                    <button id="run-end-menu"      class="run-end-btn secondary">Main Menu</button>
                </div>
            </div>`;
    }
}
