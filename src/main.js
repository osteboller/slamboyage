import { PhysicsEngine }    from './physics/PhysicsEngine.js';
import { CollisionManager } from './physics/CollisionManager.js';
import { RenderEngine }     from './render/RenderEngine.js';
import { CameraController } from './render/CameraController.js';
import { loadTextures }     from './render/TextureLoader.js';
import { InputManager }     from './input/InputManager.js';
import { UIManager }        from './ui/UIManager.js';
import { PowerBar }         from './ui/PowerBar.js';
import { ConsumableSlots }  from './ui/ConsumableSlots.js';
import { EntityFactory }    from './game/EntityFactory.js';
import { ThrowController }  from './game/ThrowController.js';
import { RoundManager }     from './game/RoundManager.js';
import { GameState }        from './game/GameState.js';
import { StartScreen }      from './screens/StartScreen.js';
import { MapScreen }        from './screens/MapScreen.js';
import { ShopScreen }       from './screens/ShopScreen.js';
import { BattleScreen }     from './screens/BattleScreen.js';
import { TrickShotScreen }  from './screens/TrickShotScreen.js';
import { RewardScreen }     from './screens/RewardScreen.js';
import { BossShopScreen }   from './screens/BossShopScreen.js';
import { RunEndScreen }    from './screens/RunEndScreen.js';
import { ENCHANT_DEFS }   from './config/enchantDefs.js';
import { CAP_DEFS }       from './config/constants.js';

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

const gameState    = new GameState();
ui.setGameState(gameState);
const consumables  = new ConsumableSlots({ gameState, ui });
consumables.onUse = (def) => {
    if (def.id === 'extra_throw') roundMgr.addThrow();
    if (def.id === 'power_up')   roundMgr.addVoltage(8);
    if (def.id === 'double_next') { gameState.activeDouble++; ui.showDoubleBadge(2 ** gameState.activeDouble); }
    if (def.id === 'double_relic') { gameState.amplifyStacks++; ui.showAmplifyBadge(gameState.amplifyStacks); roundMgr.refreshAmplifyBadges(); }
    if (def.id === 'refresh') {
        if (currentScreenName === 'shop')                                   shopScreen.refreshCurrentView();
        if (currentScreenName === 'boss-shop')                               bossShopScreen.reroll();
        const rerollableRewardScreens = new Set(['reward', 'slammer-choice', 'enchant-reward', 'chest-reward', 'mystery-reward']);
        if (rerollableRewardScreens.has(currentScreenName)) rewardScreen.reroll?.();
    }
    if (def.id === 'clone') {
        const remaining = roundMgr.remainingCaps;
        if (remaining.length > 0) {
            ui.showCapPicker('Pick a cap to clone', remaining, entry => {
                roundMgr.addGhostCap(entry.def, entry.enchant);
            });
        }
    }
    if (def.id === 'white_card') {
        const caps = gameState.ownedCaps;
        if (caps.length > 0) {
            caps.forEach(entry => {
                const pool = CAP_DEFS.filter(d => d.name !== entry.def.name);
                entry.def  = pool[Math.floor(Math.random() * pool.length)];
            });
            ui.showBlancoResult(caps.length, () => ui.openCollection('caps'));
        }
    }
    if (def.id === 'transform') {
        const caps = gameState.ownedCaps;
        if (caps.length > 0) {
            ui.showCapPicker('Pick a cap to transform', caps, entry => {
                const oldDef = entry.def;
                const pool   = CAP_DEFS.filter(d => d.name !== oldDef.name);
                const newDef = pool[Math.floor(Math.random() * pool.length)];
                const live   = gameState.ownedCaps.find(c => c.id === entry.id);
                if (live) live.def = newDef;
                ui.showTransformResult(oldDef, newDef);
            });
        }
    }
    if (def.id === 'enchant') {
        const caps = gameState.ownedCaps;
        if (caps.length > 0) {
            ui.showCapPicker('Pick a cap to enchant', caps, entry => {
                const pool = ENCHANT_DEFS.filter(e => e.id !== entry.enchant);
                const enchantDef = pool[Math.floor(Math.random() * pool.length)];
                gameState.applyEnchant(entry.id, enchantDef.id);
                if (currentScreenName === 'battle') {
                    roundMgr.updateLiveCapEnchant(entry.id, enchantDef.id);
                    // No Glam Fam-straffen afhænger af enchant-antallet — genopfrisk
                    // boss-info-headeren så den viste procent ikke går forældet hvis
                    // man enchanter en cap midt i selve boss-kampen.
                    if (gameState.currentNode?.boss) ui.setBossInfo(gameState.currentNode.boss);
                }
                ui.showEnchantResult(enchantDef, entry);
            });
        }
    }
    if (def.id === 'skip_trickshot') {
        const node = gameState.currentNode;
        if (node?.trickShot && !node.rewardUpgrade) {
            gameState.markRewardUpgraded(node.id, node.trickShot.rewardType);
            mapScreen.refresh();
        }
    }
};
consumables.onSell = (def) => {
    if (currentScreenName === 'battle') {
        roundMgr.addToBase(def.sellPrice); // keeps _scoreBase + _totalScore intact
    } else {
        ui.setScore(gameState.score);
        if (currentScreenName === 'shop') shopScreen.refresh();
    }
};
const factory      = new EntityFactory(physics, render, texCache);
const throwCtrl = new ThrowController({ physics, render, cam, collisions, factory, ui });
const roundMgr  = new RoundManager({ physics, render, cam, collisions, throwCtrl, factory, ui, powerBar, gameState });
// Square/Illusionist (slammer-passiver) — giver et gratis kort passivt, uafhængigt
// af hvilken run-skærm der er aktiv lige nu, så wires globalt ligesom throwCtrl.onThrowEnd.
roundMgr.onFreeCardGranted = (idx) => consumables.flashSlot(idx);

loadingScreen.style.opacity = '0';
setTimeout(() => { loadingScreen.style.display = 'none'; }, 400);

// ─── SCREEN ROUTER ───────────────────────────────────────────────────────────
let currentScreen     = null;
let currentScreenName = 'start';
let returnToAfterMap  = 'start'; // hvor MAP-back-knappen sender brugeren hen
const deps = { physics, render, cam, collisions, input, ui, powerBar, throwCtrl, roundMgr, gameState };

const startScreen     = new StartScreen(deps);
const mapScreen       = new MapScreen(deps);
const shopScreen      = new ShopScreen(deps);
const battleScreen    = new BattleScreen(deps);
const trickShotScreen = new TrickShotScreen(deps);
const rewardScreen    = new RewardScreen(deps);
const bossShopScreen  = new BossShopScreen(deps);
const runEndScreen    = new RunEndScreen(deps);

const RUN_SCREENS = new Set(['map', 'battle', 'trickshot', 'reward', 'shop', 'slammer-choice', 'enchant-reward', 'chest-reward', 'mystery-reward', 'boss-reward', 'boss-shop']);

// Pause-menu callbacks — globale, virker fra alle run-screens
let battleSaveState = null;
let resumeScreen    = null;
const closePeekIfOpen = () => {
    if (currentScreenName !== 'map' && document.getElementById('map-screen')) mapScreen.exit();
};

ui.onPauseRetry    = () => { closePeekIfOpen(); battleSaveState = null; resumeScreen = null; gameState.startRun(); goToNode(gameState.currentNode); };
ui.onPauseMainMenu = () => {
    closePeekIfOpen();
    battleSaveState = null;
    resumeScreen    = null;
    if (currentScreenName === 'battle')                          battleSaveState = battleScreen.captureState();
    else if (['shop', 'map'].includes(currentScreenName))        resumeScreen = currentScreenName;
    showScreen('start');
};

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
    mapScreen.onTrickShot  = null;
    mapScreen.enter();
    mapScreen.setPeekMode(true);
    if (mapScreen._el) mapScreen._el.style.animation = 'screen-fade-in 0.18s ease-out forwards';
});

// ─── TRANSITION COVER ────────────────────────────────────────────────────────
// Styling er i base.css (#screen-transition-cover) — var() virker ikke i inline styles
const transitionCover = document.createElement('div');
transitionCover.id = 'screen-transition-cover';
document.body.appendChild(transitionCover);

// ─── SCREEN ROUTER ───────────────────────────────────────────────────────────
// Delt af mapScreen.onNodeSelect og de to "start en frisk run MIDT i noget"-
// indgange (Pause-Retry, Try Again) — sender direkte til node 1-1 uden at mounte
// map-screen. New Run bruger den BEVIDST IKKE (se startScreen.onNewRun) — den
// skal lande i map-screen, så der er tid til dev-knapperne før første kast.
function goToNode(node) {
    returnToAfterMap = 'start';
    if (node.type === 'slammer') showScreen('slammer-choice', node);
    else                         showScreen('battle', node);
}

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

        const CONSUMABLE_SCREENS = new Set(['map', 'battle', 'reward', 'shop', 'boss-shop', 'slammer-choice', 'enchant-reward', 'chest-reward', 'mystery-reward']);
        const rewardLikeScreens = new Set(['slammer-choice', 'enchant-reward', 'chest-reward', 'mystery-reward']);
        const contextName = rewardLikeScreens.has(name) ? 'reward' : name;
        if (CONSUMABLE_SCREENS.has(name)) { consumables.setContext(contextName); consumables.show(); }
        else                              consumables.hide();

        if (name === 'start') {
            currentScreen = startScreen;
            // New Run går IKKE via goToNode (i modsætning til Pause-Retry/Try Again) —
            // lander i map-screen med Next som eneste vej ind i 1-1, så der er tid til
            // at bruge dev-knapperne (fx tilføje caps til collection) FØR første kast.
            // Bevidst forskel fra de to andre "start frisk run"-indgange.
            startScreen.onNewRun      = () => { battleSaveState = null; resumeScreen = null; gameState.startRun(); returnToAfterMap = 'start'; showScreen('map'); };
            startScreen.onContinueRun = () => {
                if (battleSaveState) {
                    const saved = battleSaveState;
                    battleSaveState = null;
                    showScreen('battle', { __resume: true, node: saved.node, saveState: saved });
                } else if (resumeScreen) {
                    const dest = resumeScreen;
                    resumeScreen = null;
                    returnToAfterMap = 'start';
                    showScreen(dest);
                } else {
                    returnToAfterMap = 'start';
                    showScreen('map');
                }
            };
            startScreen.onFreeMode    = () => showScreen('battle', null);
            // Dev-genvej: gameState.startRun() + nodeIndex/score er allerede sat af
            // knappen selv — kald IKKE startRun() igen her, det ville nulstille nodeIndex.
            startScreen.onDevSkipToBoss = () => { battleSaveState = null; resumeScreen = null; returnToAfterMap = 'start'; showScreen('map'); };
            startScreen.enter();

        } else if (name === 'map') {
            currentScreen = mapScreen;
            mapScreen.onBack = () => {
                const dest = returnToAfterMap;
                returnToAfterMap = 'start';
                showScreen(dest);
            };
            mapScreen.onNodeSelect = goToNode;
            mapScreen.onTrickShot = (trickShotDef, parentNode) => {
                showScreen('trickshot', { trickShotDef, parentNode });
            };
            mapScreen.setPeekMode(false);
            mapScreen.enter();

        } else if (name === 'battle') {
            currentScreen = battleScreen;
            battleScreen.onBattleEnd = ({ won, totalScore }) => {
                const nodePlayed = gameState.currentNode;
                const loop       = gameState.loop;
                const ownedCaps  = [...gameState.ownedCaps];
                const result     = gameState.completeNode(totalScore);
                if (result.won) {
                    if (result.isBoss) { showScreen('boss-reward', { bossShards: result.bossShards, parentNode: nodePlayed }); return; }
                    // Cap-valget (3 stk) er en fast, garanteret reward efter HVER node —
                    // den ekstra kiste/enchant/mystery-reward (hvis noden har en) følger
                    // bagefter, se 'reward'-routen nedenfor.
                    showScreen('reward', nodePlayed);
                } else {
                    showScreen('run-end', { node: nodePlayed, totalScore, loop, ownedCaps });
                }
            };
            battleScreen.onExitFreeMode = () => showScreen('start');
            battleScreen.enter(context);

        } else if (name === 'trickshot') {
            currentScreen = trickShotScreen;
            trickShotScreen.onBack = () => { returnToAfterMap = 'start'; showScreen('map'); };
            trickShotScreen.enter(context);

        } else if (name === 'reward') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => {
                // Efter det garanterede cap-valg: nodens EGEN ekstra reward-type følger
                // (hvis den har en) — Trick Shot-opgraderingen erstatter baseline, den
                // stabler ikke (reward-chests-draft.md "Besluttet" #7).
                const effectiveReward = gameState.effectiveReward(context);
                if      (effectiveReward === 'enchant') showScreen('enchant-reward', context);
                else if (effectiveReward === 'mystery') showScreen('mystery-reward', context);
                else if (effectiveReward === 'gold')    showScreen('chest-reward', { node: context, tier: 'gold' });
                else if (effectiveReward === 'silver')  showScreen('chest-reward', { node: context, tier: 'silver' });
                else showScreen('shop'); // ingen ekstra reward — direkte til shop
            };
            rewardScreen.enter(context);

        } else if (name === 'enchant-reward') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => showScreen('shop');
            rewardScreen.enterEnchant(context);

        } else if (name === 'chest-reward') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => showScreen('shop');
            rewardScreen.enterChest(context);

        } else if (name === 'mystery-reward') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => showScreen('shop');
            rewardScreen.enterMystery(context);

        } else if (name === 'boss-reward') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => showScreen('boss-shop');
            rewardScreen.enterBoss(context);

        } else if (name === 'boss-shop') {
            currentScreen = bossShopScreen;
            bossShopScreen.onContinue = () => {
                // Sharden (Sub-Terra King) — no-op (returnerer null) uden slammeren.
                const shardenGain = gameState.convertUnusedShards();
                if (shardenGain) {
                    const label = `unused Shard${shardenGain.unspent === 1 ? '' : 's'}`;
                    ui.showRelicGain(shardenGain.icon, shardenGain.oldValue, shardenGain.newValue, shardenGain.unspent, label);
                }
                returnToAfterMap = 'start';
                if (gameState.isRunComplete) gameState.nextLoop();
                showScreen('map');
            };
            bossShopScreen.enter();

        } else if (name === 'slammer-choice') {
            currentScreen = rewardScreen;
            rewardScreen.onContinue = () => {
                gameState.completeNode(0);
                returnToAfterMap = 'start';
                showScreen('map');
            };
            rewardScreen.enter(context);

        } else if (name === 'run-end') {
            currentScreen = runEndScreen;
            runEndScreen.onTryAgain = () => { gameState.startRun(); goToNode(gameState.currentNode); };
            runEndScreen.onMainMenu = () => showScreen('start');
            runEndScreen.enter(context);

        } else if (name === 'shop') {
            currentScreen = shopScreen;
            shopScreen.onContinue = () => {
                returnToAfterMap = 'start';
                if (gameState.isRunComplete) gameState.nextLoop();
                showScreen('map');
            };
            shopScreen.onConsumableAdded = (slotIdx) => consumables.flashSlot(slotIdx);
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
