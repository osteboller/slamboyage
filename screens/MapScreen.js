import { THROWS_PER_ROUND, SLAMMER_DEFS } from '../config/constants.js';
import { EFFECT_LABELS } from '../game/effects/labels.js';
import { RELIC_DEFS } from '../config/relicDefs.js';

export class MapScreen {
    constructor({ gameState }) {
        this._gameState   = gameState;
        this._el          = null;
        this.onNodeSelect = null;
        this.onBack       = null;
    }

    enter() {
        this._el = document.createElement('div');
        this._el.id = 'map-screen';
        document.body.appendChild(this._el);
        this._render();

        this._el.addEventListener('click', (e) => {
            if (e.target.closest('#map-collection-close')) {
                this._closeCollection();
                return;
            }
            if (e.target.closest('.col-tab')) {
                this._switchTab(e.target.closest('.col-tab').dataset.target);
                return;
            }
            if (e.target.closest('#map-collection-overlay')) {
                if (!e.target.closest('.map-collection-panel')) this._closeCollection();
                return;
            }
            if (e.target.closest('#map-back-btn') && this.onBack) {
                this.onBack();
                return;
            }
            const node = e.target.closest('.map-node.current');
            if (node) {
                const idx     = parseInt(node.dataset.idx, 10);
                const nodeDef = this._gameState.runNodes[idx];
                if (nodeDef && this.onNodeSelect) this.onNodeSelect(nodeDef);
            }
        });
    }

    exit() {
        this._el?.remove();
        this._el = null;
    }

    refresh() { this._render(); }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _toggleCollection() {
        document.getElementById('map-collection-overlay')
            ? this._closeCollection()
            : this._openCollection('caps');
    }

    _closeCollection() {
        document.getElementById('map-collection-overlay')?.remove();
    }

    _switchTab(tab) {
        const panel = this._el.querySelector('.map-collection-panel');
        if (!panel) return;
        panel.dataset.tab = tab;
        panel.querySelectorAll('.col-tab').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.target === tab)
        );
    }

    _openCollection(activeTab = 'caps') {
        const gs      = this._gameState;
        const overlay = document.createElement('div');
        overlay.id    = 'map-collection-overlay';

        // Caps
        const capsHTML = gs.ownedCaps.map(({ def, enchant }) => {
            const effectLabel = def.effect ? (EFFECT_LABELS[def.effect] ?? def.effect) : null;
            const badges = [
                effectLabel ? `<span class="col-badge effect">${effectLabel}</span>`  : '',
                enchant     ? `<span class="col-badge enchant">${enchant}</span>`     : '',
            ].join('');
            return `<div class="col-cap">
                <img class="col-cap-img" src="${def.texFront}" alt="${def.name}">
                <div class="col-cap-name">${def.name}</div>
                ${badges}
            </div>`;
        }).join('');

        // Slammers — all available (owned concept not yet tracked)
        const slammersHTML = SLAMMER_DEFS.map(s => `
            <div class="col-cap">
                <img class="col-cap-img" src="${s.texFront}" alt="${s.name}">
                <div class="col-cap-name">${s.name}</div>
            </div>`).join('');

        // Relics — show owned ones, or empty state
        const relicsHTML = gs.ownedRelics.length > 0
            ? gs.ownedRelics.map(r => `
                <div class="col-relic">
                    <div class="col-relic-icon">${r.icon}</div>
                    <div class="col-relic-name">${r.name}</div>
                    <div class="col-relic-desc">${r.description}</div>
                </div>`).join('')
            : `<div class="col-relics-empty">
                <span class="col-relics-icon">⬡</span>
                <p>No relics yet.<br>Win the final node of each loop to find one.</p>
               </div>`;

        // Throw pips
        const pips = Array.from({ length: THROWS_PER_ROUND },
            () => `<span class="col-pip">●</span>`).join('');

        overlay.innerHTML = `
            <div class="map-collection-panel" data-tab="${activeTab}">

                <div class="col-tabbar">
                    <button class="col-tab ${activeTab === 'caps'     ? 'active' : ''}" data-target="caps">
                        Caps <span class="col-tab-count">${gs.ownedCaps.length}</span>
                    </button>
                    <button class="col-tab ${activeTab === 'slammers' ? 'active' : ''}" data-target="slammers">
                        Slammers
                    </button>
                    <button class="col-tab ${activeTab === 'relics'   ? 'active' : ''}" data-target="relics">
                        Relics
                    </button>
                    <button id="map-collection-close" class="col-close">✕</button>
                </div>

                <div class="col-content" data-content="caps">
                    <div class="col-grid">${capsHTML}</div>
                </div>
                <div class="col-content" data-content="slammers">
                    <div class="col-grid">${slammersHTML}</div>
                </div>
                <div class="col-content" data-content="relics">
                    <div class="col-relic-grid">${relicsHTML}</div>
                </div>

                <div class="col-footer">
                    <span class="col-footer-stat">Throws: ${pips}</span>
                    <span class="col-footer-stat">Max stack: <b>${gs.stackSizeLimit}</b></span>
                </div>

            </div>`;

        this._el.appendChild(overlay);
    }

    _render() { this._el.innerHTML = this._buildHTML(); }

    _buildHTML() {
        const gs = this._gameState;

        const nodesHTML = gs.runNodes.map((node, i) => {
            const isRelic = node.type === 'relic';
            let cls = 'map-node' + (isRelic ? ' map-node--relic' : '');
            let icon = '';
            if      (i < gs.nodeIndex)  { cls += ' done';    icon = '✓'; }
            else if (i === gs.nodeIndex) { cls += ' current'; icon = isRelic ? '◎' : '▶'; }
            else                         { cls += ' locked';  icon = isRelic ? '◎' : '?'; }

            const line = i < gs.runNodes.length - 1
                ? `<div class="map-line ${i < gs.nodeIndex ? 'done' : ''}"></div>`
                : '';

            const nameHTML = isRelic
                ? `<div class="map-node-name map-node-relic-label">Relic</div>`
                : `<div class="map-node-name">${node.name}</div>`;

            const scoreHTML = isRelic ? '' :
                `<div class="map-node-score">Goal<span class="map-node-score-val">${node.clearScore}★</span></div>`;

            return `<div class="map-node-wrap">
                <div class="${cls}" data-idx="${i}">
                    ${nameHTML}
                    <div class="map-node-circle">${icon}</div>
                    ${scoreHTML}
                </div>
                ${line}
            </div>`;
        }).join('');

        return `<div class="map-inner">
            <div class="map-topbar">
                <h1 class="map-title">SLAMBERZ</h1>
            </div>
            <div class="map-hint">Tap a node to play</div>
            <div class="map-path">${nodesHTML}</div>
        </div>`;
    }
}
