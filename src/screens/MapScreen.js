import { THROWS_PER_ROUND, SLAMMER_DEFS } from '../config/constants.js';
import { effectName } from '../game/effects/labels.js';
import { RELIC_DEFS } from '../config/relicDefs.js';
import { REWARD_UPGRADE_ICONS } from '../config/trickShotDefs.js';

export class MapScreen {
    constructor({ gameState, ui }) {
        this._gameState   = gameState;
        this._ui          = ui;
        this._el          = null;
        this.onNodeSelect = null;
        this.onBack       = null;
        this.onTrickShot  = null;
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
            if (e.target.closest('#map-next-btn')) {
                const nodeDef = this._gameState.currentNode;
                if (nodeDef && this.onNodeSelect) this.onNodeSelect(nodeDef);
                return;
            }
            if (e.target.closest('#map-trickshot-btn')) {
                const nodeDef = this._gameState.currentNode;
                if (nodeDef?.trickShot && this.onTrickShot) this.onTrickShot(nodeDef.trickShot, nodeDef);
                return;
            }
            // Boss-node: klik viser/skjuler info-sticker (samme mekanik som
            // enchant/transform-resultater) — går ALDRIG direkte i kamp herfra,
            // "Next"-knappen er den eneste vej ind, så info kan læses uden risiko.
            const bossNode = e.target.closest('.map-node--boss');
            if (bossNode) {
                const idx     = parseInt(bossNode.dataset.idx, 10);
                const nodeDef = this._gameState.runNodes[idx];
                if (nodeDef?.boss) this._ui.showBossInfoSticker(nodeDef.boss);
                return;
            }
            // Trick Shot-gren: klik viser/skjuler info-sticker (samme mekanik som
            // boss-noden) — går ALDRIG direkte ind i udfordringen herfra,
            // "⚡"-knappen i action-baren er den eneste vej ind.
            const branchNode = e.target.closest('.map-branch-node');
            if (branchNode) {
                const idx     = parseInt(branchNode.dataset.tsIdx, 10);
                const nodeDef = this._gameState.runNodes[idx];
                if (nodeDef?.trickShot) this._ui.showTrickShotInfoSticker(nodeDef.trickShot);
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
            const effectLabel = def.effect ? effectName(def.effect) : null;
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
            const isBoss  = !!node.boss;
            let cls = 'map-node' + (isRelic ? ' map-node--relic' : '') + (isBoss ? ' map-node--boss' : '');
            let icon = '';
            if      (i < gs.nodeIndex)  { cls += ' done';    icon = '✓'; }
            else if (i === gs.nodeIndex) { cls += ' current'; icon = isRelic ? '◎' : (isBoss ? node.boss.icon : '▶'); }
            else                         { cls += ' locked';  icon = isRelic ? '◎' : (isBoss ? node.boss.icon : '?'); }

            const line = i < gs.runNodes.length - 1
                ? `<div class="map-line ${i < gs.nodeIndex ? 'done' : ''}"></div>`
                : '';

            // Bossens identitet + gimmick vises fra start (ikke skjult som Trick Shot) —
            // spilleren skal kunne indrette sin cap-samling efter det på forhånd.
            const nameHTML = isRelic
                ? `<div class="map-node-name map-node-relic-label">Relic</div>`
                : isBoss
                    ? `<div class="map-node-name" title="${node.boss.description}">${node.boss.name}</div>`
                    : `<div class="map-node-name">${node.name}</div>`;

            const scoreHTML = isRelic ? '' :
                `<div class="map-node-score">Goal<span class="map-node-score-val">${node.clearScore}★</span></div>`;

            // Reward-upgrade-badge: vises på HOVEDNODEN når en Trick Shot er clearet,
            // og viser hvilken opgraderings-type der er vundet (ikke et generisk ✓ —
            // det ville forveksles med node-cirklens egen "done"-tilstand).
            const rewardIcon  = node.rewardUpgrade ? (REWARD_UPGRADE_ICONS[node.rewardUpgrade] ?? '✦') : null;
            const tsBadgeHTML = (!isRelic && rewardIcon)
                ? `<div class="map-node-ts-badge" title="Reward upgraded: ${node.rewardUpgrade}">${rewardIcon}</div>`
                : '';

            // Trick Shot-gren: kun synlig på noder der ikke er passeret endnu.
            // Viser ALTID reward-ikonet (hvad du får) + et lille badge for selve
            // udfordringen (hvad du skal gøre) — begge dele kendes på forhånd,
            // ligesom hovednoden viser sin clearScore på forhånd. Først når den
            // er clearet skifter den til et almindeligt flueben (som andre done-noder).
            let branchHTML = '';
            if (!isRelic && node.trickShot && i >= gs.nodeIndex) {
                const isCurrent = i === gs.nodeIndex;
                const cleared   = !!node.rewardUpgrade;
                const canAfford = gs.canAfford(node.trickShot.cost);
                let branchCls   = 'map-branch-node';
                let branchInner;
                let branchTitle;
                if (cleared) {
                    branchCls  += ' cleared';
                    branchInner = '✓';
                    branchTitle = `${node.trickShot.name} — cleared`;
                } else {
                    const branchRewardIcon = REWARD_UPGRADE_ICONS[node.trickShot.rewardType] ?? '✦';
                    branchInner = `${branchRewardIcon}<div class="map-branch-challenge-badge">${node.trickShot.icon}</div>`;
                    if (isCurrent && canAfford) {
                        branchCls  += ' available';
                        branchTitle = `${node.trickShot.name} (−${node.trickShot.cost}★)`;
                    } else if (isCurrent) {
                        branchCls  += ' locked';
                        branchTitle = `${node.trickShot.name} — need ${node.trickShot.cost}★`;
                    } else {
                        branchCls  += ' locked';
                        branchTitle = node.trickShot.name;
                    }
                }
                branchHTML = `
                    <div class="map-branch">
                        <div class="map-branch-connector"></div>
                        <div class="${branchCls}" data-ts-idx="${i}" title="${branchTitle}">${branchInner}</div>
                    </div>`;
            }

            return `<div class="map-node-wrap">
                <div class="${cls}" data-idx="${i}">
                    ${nameHTML}
                    <div class="map-node-circle">${icon}${tsBadgeHTML}</div>
                    ${scoreHTML}
                    ${branchHTML}
                </div>
                ${line}
            </div>`;
        }).join('');

        // Action-bar for den aktuelle node: "Next" er altid der, "Trick Shot"
        // dukker op ved siden af hvis noden har en og den ikke er clearet endnu.
        const current = gs.currentNode;
        const currentTS = (current && !current.rewardUpgrade && current.trickShot)
            ? current.trickShot : null;
        const actionBarHTML = current ? `
            <div class="map-action-bar">
                <button id="map-next-btn" class="map-action-btn map-action-btn--next">Next ▶</button>
                ${currentTS ? `
                <button id="map-trickshot-btn" class="map-action-btn map-action-btn--trickshot"
                        ${gs.canAfford(currentTS.cost) ? '' : 'disabled'}>
                    🎲 ${currentTS.name} <span class="map-trickshot-cost">−${currentTS.cost}★</span>
                </button>` : ''}
            </div>` : '';

        return `<div class="map-inner">
            <div class="map-hint">Tap a node to play</div>
            <div class="map-path">${nodesHTML}</div>
            ${actionBarHTML}
        </div>`;
    }
}
