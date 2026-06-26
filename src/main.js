import { PhysicsEngine }    from './physics/PhysicsEngine.js';
import { CollisionManager } from './physics/CollisionManager.js';
import { RenderEngine }     from './render/RenderEngine.js';
import { CameraController } from './render/CameraController.js';
import { loadTextures }     from './render/TextureLoader.js';
import { InputManager }     from './input/InputManager.js';
import { UIManager }        from './ui/UIManager.js';
import { PowerBar }         from './ui/PowerBar.js';
import { EntityFactory }    from './game/EntityFactory.js';
import { ThrowController }  from './game/ThrowController.js';
import { RoundManager }     from './game/RoundManager.js';
import { GameState }        from './game/GameState.js';
import { StartScreen }      from './screens/StartScreen.js';
import { MapScreen }        from './screens/MapScreen.js';
import { ShopScreen }       from './screens/ShopScreen.js';
import { BattleScreen }     from './screens/BattleScreen.js';
import { RewardScreen }     from './screens/RewardScreen.js';
import { RunEndScreen }    from './screens/RunEndScreen.js';

// ─── ENGINES ─────────────────────────────────────────────────────────────────
const physics    = new PhysicsEngine();
const render     = new RenderEngine();
const cam        = new CameraController(render.camera);
const collisions = new CollisionManager(physics.world);
const input      = new InputManager(render.getDomElement(), render.camera);
const ui         = new UIManager();
const powerBar   = new PowerBar();

powerBar.enable();
ui.onGravityChange = (g) => { physics.world.gravity.y = g; };
collisions.onBlast = () => throwCtrl.onBlastEvent();
collisions.onMiss  = () => throwCtrl.forceEnd(true);

// ─── INIT ─────────────────────────────────────────────────────────────────────
const loadingFill   = document.getElementById('loading-fill');
const loadingScreen = document.getElementById('loading-screen');

const texCache = await loadTextures(p => {
    if (loadingFill) loadingFill.style.width = (p * 100) + '%';
});

const gameState = new GameState();
ui.setGameState(gameState);
const factory   = new EntityFactory(physics, render, texCache);
const throwCtrl = new ThrowController({ physics, render, cam, collisions, factory, ui });
const roundMgr  = new RoundManager({ physics, render, cam, collisions, throwCtrl, factory, ui, powerBar, gameState });

loadingScreen.style.opacity = '0';
setTimeout(() => { loadingScreen.style.display = 'none'; }, 400);

// ─── SCREEN ROUTER ───────────────────────────────────────────────────────────
let currentScreen     = null;
let currentScreenName = 'start';
let returnToAfterMap  = 'start'; // hvor MAP-back-knappen sender brugeren hen
const deps = { physics, render, cam, collisions, input, ui, powerBar, throwCtrl, roundMgr, gameState };

const startScreen  = new StartScreen(deps);
const mapScreen    = new MapScreen(deps);
const shopScreen   = new ShopScreen(deps);
const battleScreen = new BattleScreen(deps);
const rewardScreen = new RewardScreen(deps);
const runEndScreen = new RunEndScreen(deps);

const RUN_SCREENS = new Set(['map', 'battle', 'reward', 'shop', 'relic-choice']);

// ─── MAP PEEK ────────────────────────────────────────────────────────────────
function closePeekMap() {
    const el = document.getElementById('map-screen');
    if (!el) return;
    el.style.pointerEvents = 'none';
    el.style.animation = 'screen-fade-out 0.18s ease-in forwards';
    setTimeout(() => mapScreen.exit(), 180);
}

document.getElementById('map-btn')?.addEventListener('click', () => {
    if (currentScreenName === 'map') return;
    if (document.getElementById('map-screen')) { closePeekMap(); return; }
    mapScreen.onBack       = closePeekMap;
    mapScreen.onNodeSelect = null;
    mapScreen.enter();
    if (mapScreen._el) mapScreen._el.style.animation = 'screen-fade-in 0.18s ease-out forwards';
});

// ─── TRANSITION COVER ────────────────────────────────────────────────────────
// Styling er i base.css (#screen-transition-cover) — var() virker ikke i inline styles
const transitionCover = document.createElement('div');
transitionCover.id = 'screen-transition-cover';
document.body.appendChild(transitionCover);

// ─── SCREEN ROUTER ───────────────────────────────────────────────────────────
function showScreen(name, context = null) {
    const prev = currentScreen;

    // Blokér ghost-taps
    document.body.style.pointerEvents = 'none';
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 380);

    function _mount(fadeInNew) {
        prev?.exit();
        currentScreenName = name;

        if (RUN_SCREENS.has(name)) ui.showRunOverlay();
        else                       ui.hideRunOverlay();

        if (name === 'start') {
            currentScreen = startScreen;
            startScreen.onNewRun      = () => { returnToAfterMap = 'start'; gameState.startRun(); showScreen('map'); };
            startScreen.onContinueRun = () => { returnToAfterMap = 'start'; showScreen('map'); };
            startScreen.onFreeMode    = () => showScreen('battle', null);
            startScreen.enter();

        } else if (name === 'map') {
            currentScreen = mapScreen;
            mapScreen.onBack = () => {
                const dest = returnToAfterMap;
                returnToAfterMap = 'start';
                showScreen(dest);
            };
            mapScreen.onNodeSelect = (node) => {
                returnToAfterMap = 'start';
                if (node.type === 'relic') showScreen('relic-choice', node);
                else                       showScreen('battle', node);
            };
            mapScreen.enter();

        } else if (name === 'battle') {
            currentScreen = battleScreen;
            battleScreen.onBattleEnd = ({ won, totalScore }) => {
                const nodePlayed = gameState.currentNode;
                const loop       = gameState.loop;
                const ownedCaps  = [...gameState.ownedCaps];
                const { won: w } = gameState.completeNode(totalScore);
                if (w) showScreen('reward', nodePlayed);
                else   showScreen('run-end', { node: nodePlayed, totalScore, loop, ownedCaps });
            };
            battleScreen.enter(context);

        } else if (name === 'reward') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => showScreen('shop');
            rewardScreen.enter(context);

        } else if (name === 'relic-choice') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => {
                gameState.completeNode(0);
                returnToAfterMap = 'start';
                showScreen('map');
            };
            rewardScreen.enter(context);

        } else if (name === 'run-end') {
            currentScreen = runEndScreen;
            runEndScreen.onTryAgain = () => { returnToAfterMap = 'start'; gameState.startRun(); showScreen('map'); };
            runEndScreen.onMainMenu = () => showScreen('start');
            runEndScreen.enter(context);

        } else if (name === 'shop') {
            currentScreen = shopScreen;
            shopScreen.onContinue = () => {
                returnToAfterMap = 'start';
                if (gameState.isRunComplete) gameState.nextLoop();
                showScreen('map');
            };
            shopScreen.enter();
        }

        if (fadeInNew) {
            // Ny skærm fader ind direkte — ingen cover
            if (currentScreen?._el) {
                currentScreen._el.style.animation = 'screen-fade-in 0.3s ease-out forwards';
            }
        } else {
            // Cover fader ud og afslører ny skærm
            transitionCover.style.opacity = '0';
        }
    }

    if (prev === battleScreen) {
        // Fra battle: ingen cover — reward/run-end fader ind oven på canvas
        _mount(true);
    } else {
        // Alle andre overgange: cover skjuler swappen
        transitionCover.style.opacity = '1';
        setTimeout(() => _mount(false), 160);
    }
}

showScreen('start');
