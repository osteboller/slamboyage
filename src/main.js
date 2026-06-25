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
const factory   = new EntityFactory(physics, render, texCache);
const throwCtrl = new ThrowController({ physics, render, cam, collisions, factory, ui });
const roundMgr  = new RoundManager({ physics, render, cam, collisions, throwCtrl, factory, ui, powerBar, gameState });

loadingScreen.style.opacity = '0';
setTimeout(() => { loadingScreen.style.display = 'none'; }, 400);

// ─── SCREEN ROUTER ───────────────────────────────────────────────────────────
let currentScreen = null;
const deps = { physics, render, cam, collisions, input, ui, powerBar, throwCtrl, roundMgr, gameState };

const startScreen  = new StartScreen(deps);
const mapScreen    = new MapScreen(deps);
const shopScreen   = new ShopScreen(deps);
const battleScreen = new BattleScreen(deps);
const rewardScreen = new RewardScreen(deps);
const runEndScreen = new RunEndScreen(deps);

function showScreen(name, context = null) {
    currentScreen?.exit();
    // pointerdown on canvas fires onShot → new screen mounts → pointerup+click
    // land on the new overlay (common ancestor of down/up targets).
    // Block all pointer input briefly so the triggering event can't ghost-tap
    // into the newly mounted screen. One place, covers every transition.
    document.body.style.pointerEvents = 'none';
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 320);

    if (name === 'start') {
        currentScreen = startScreen;
        startScreen.onNewRun      = () => { gameState.startRun(); showScreen('map'); };
        startScreen.onContinueRun = () => showScreen('map');
        startScreen.onFreeMode    = () => showScreen('battle', null);
        startScreen.enter();

    } else if (name === 'map') {
        currentScreen = mapScreen;
        mapScreen.onBack       = () => showScreen('start');
        mapScreen.onNodeSelect = (node) => {
            if (node.type === 'relic') showScreen('relic-choice', node);
            else                       showScreen('battle', node);
        };
        mapScreen.enter();

    } else if (name === 'battle') {
        currentScreen = battleScreen;
        battleScreen.onBattleEnd = ({ won, totalScore }) => {
            const nodePlayed = gameState.currentNode;
            const loop       = gameState.loop;
            const ownedCaps  = [...gameState.ownedCaps]; // snapshot before any reset
            const { won: w } = gameState.completeNode(totalScore);
            if (w) {
                showScreen('reward', nodePlayed);
            } else {
                showScreen('run-end', { node: nodePlayed, totalScore, loop, ownedCaps });
            }
        };
        battleScreen.enter(context); // context = node or null

    } else if (name === 'reward') {
        currentScreen = rewardScreen;
        rewardScreen.onContinue = () => showScreen('shop');
        rewardScreen.enter(context); // context = node that was just beaten

    } else if (name === 'relic-choice') {
        // Standalone relic-event node — no battle, pick relic → back to map
        currentScreen = rewardScreen;
        rewardScreen.onContinue = () => {
            gameState.completeNode(0); // relic nodes always advance
            showScreen('map');
        };
        rewardScreen.enter(context); // context = the relic node (type:'relic')

    } else if (name === 'run-end') {
        currentScreen = runEndScreen;
        runEndScreen.onTryAgain = () => { gameState.startRun(); showScreen('map'); };
        runEndScreen.onMainMenu = () => showScreen('start');
        runEndScreen.enter(context);

    } else if (name === 'shop') {
        currentScreen = shopScreen;
        shopScreen.onContinue = () => {
            if (gameState.isRunComplete) gameState.nextLoop();
            showScreen('map');
        };
        shopScreen.enter();
    }
}

showScreen('start');
