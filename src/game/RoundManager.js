import { audio } from '../audio/AudioManager.js';
import { BODY_TYPES, Vec3 } from '../../lib/cannon.js';
import { POG_H, POG_R, THROWS_PER_ROUND, HUSK_CAP_DEF } from '../config/constants.js';
import { NEARBY_RADIUS, VERY_NEARBY_RADIUS } from './EffectResolver.js';
import { EffectResolver } from './EffectResolver.js';
import { isFaceUp } from './capUtils.js';
import { resolveTrickShot } from './trickshots/index.js';
import { getBossThrowMultiplier } from './bossModifiers/index.js';
import { passiveMultiplier, passiveFlatBonus } from './passiveUtils.js';

export class RoundManager {
    constructor({ physics, render, cam, collisions, throwCtrl, factory, ui, powerBar, gameState }) {
        this._physics    = physics;
        this._render     = render;
        this._cam        = cam;
        this._collisions = collisions;
        this._throwCtrl  = throwCtrl;
        this._factory    = factory;
        this._ui         = ui;
        this._powerBar   = powerBar;
        this._gs         = gameState ?? null;

        // Runde-state
        this._phase             = 'idle'; // 'idle'|'throwing'|'ready'|'done'
        this._totalScore        = 0;
        this._throwsLeft        = 0;
        this._wonCapsAll        = [];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = 0;
        // ALLE instant-spawn-caps denne runde (hit og miss, se Phase 2.6) — de er
        // BEVIDST ikke en del af this.caps, så de skal ryddes op eksplicit et sted.
        // Tømmes af applyRestack() (mellem kast) OG buildStack() (runde-slut —
        // sikkerhedsnet for når applyRestack aldrig når at køre, fx sidste kast).
        this._extraSpawnedCaps = [];

        // Caps er ejet af RoundManager — main.js læser via this.caps
        this.caps = [];

        this._resolver   = new EffectResolver();
        this._throwIndex = 0; // 1-based, passed to effect context

        // Timer-registry — ensures no delayed logic survives a reset
        this._timers = new Set();
        this._magnetCancels = [];

        // Callback: called after buildStack/applyRestack — BattleScreen resets settleMaxR
        this.onNewStack = null;

        // Callback: fired when round ends — signature: ({ totalScore, capsFlipped }) => {}
        this.onRoundEnd = null;

        // Callback: fired when the last score float's final number is shown — score display is now settled
        this.onScoreSettled = null;

        // Callback: fired when Square/Illusionist grants a free consumable — signature: (slotIndex) => {}
        this.onFreeCardGranted = null;

        // Trick Shot state — set by buildTrickShotStack(), cleared by buildStack()
        this._activeTrickShot = null;
        // Callback: fired when a Trick Shot's single throw has settled — signature: (success) => {}
        this.onTrickShotResolved = null;

        // Boss-node state — set via setActiveBoss(), cleared by buildStack()
        this._activeBoss = null;

        // Wire throwCtrl — sættes her så main.js ikke behøver kende til den
        this._throwCtrl.onThrowEnd = ({ wonNow, faceDown, miss }) =>
            this._handleThrowEnd(wonNow, faceDown, miss);
    }

    get phase()      { return this._phase; }
    get totalScore() { return this._totalScore; }

    addThrow() {
        if (this._phase === 'idle' || this._phase === 'ready') {
            this._throwsLeft++;
            this._ui.updateThrowPips(this._throwsLeft, this._throwsLeft + this._throwIndex);
            if (this._throwsLeft > 1) this._ui.hideLastStandBadge();
        }
    }

    // Aktiverer en boss-gimmick for den kommende runde — kaldes af BattleScreen
    // EFTER buildStack(), da buildStack() selv nulstiller _activeBoss til null.
    setActiveBoss(bossDef) {
        this._activeBoss = bossDef ?? null;
    }

    get _geb() {
        return (id) => (this._voltageBonus ?? 0) + (this._roundCapBonuses?.get(id) ?? 0);
    }

    addVoltage(amount) {
        this._voltageBonus = (this._voltageBonus ?? 0) + amount;
        this._ui.updatePileButtons(this.caps, this._wonCapsAll, this._geb, this._exhaustedThisRound);
    }

    addToBase(amount) {
        this._scoreBase += amount;
        this._ui.setScore(this._scoreBase + this._totalScore);
    }

    // ─── TIMER REGISTRY ────────────────────────────────────────────────────────

    delay(fn, ms) {
        const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
        this._timers.add(id);
        return id;
    }

    cancelAllTimers() {
        this._timers.forEach(clearTimeout);
        this._timers.clear();
        this._magnetCancels.forEach(fn => fn());
        this._magnetCancels = [];
    }

    // Updates enchant on a live cap in the current stack — no-op if cap not in play
    // Returnerer remaining face-down caps som picker-kompatible entries { id, def, enchant }
    // _pendingFaceDown er kun populeret mellem kast — under første kast bruges this.caps
    get remainingCaps() {
        const pool = this._pendingFaceDown.length > 0 ? this._pendingFaceDown : this.caps;
        return pool.map((cap, i) => ({ id: i, def: cap.def, enchant: cap.enchant }));
    }

    // Bruges KUN til ghost-caps (Twinsies-klonen, "clone"-consumable) — en
    // spiller-trigget UI-handling mens runden er idle, hvor en øjeblikkelig
    // visuel reshuffle af stacken er forventet og korrekt. Husk fra Ballast
    // bruger IKKE denne vej (se _pendingHuskGrants i applyRestack()) — det
    // sker midt i selve kastets scoring, hvor en synkron reshuffle af hele
    // poolen ville se ud som om stacken "restackede" sig selv for tidligt.
    _addCapToStack(def, entryId, enchant, isGhost) {
        const cap  = this._factory.spawnCap(def, POG_H * 0.5, enchant, entryId, isGhost);
        const pool = this._pendingFaceDown.length > 0 ? this._pendingFaceDown : this.caps;
        pool.push(cap);

        // Shuffle ind på tilfældig position og repositioner alle bodies
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        pool.forEach((c, i) => {
            // remove/addBody (ikke bare position.set) — ellers kan Cannons broadphase
            // stadig have cappen registreret på dens GAMLE (spawn-)position, og en
            // efterfølgende slammer "faser igennem" den i stedet for at kollidere.
            // Samme mønster som applyRestack()'s egen reposition-loop bruger.
            this._physics.world.removeBody(c.body);
            c.body.position.set(0, POG_H * 0.5 + i * (POG_H + 0.01), 0);
            c.body.previousPosition.copy(c.body.position);
            this._physics.world.addBody(c.body);
            // Mesh følger ellers kun med via RenderEngine.sync(), som KUN rører caps
            // der allerede er i this.caps — en cap tilføjet midt i et kast (fx Husk
            // fra Ballast) er det ikke før applyRestack() senere forfremmer den, så
            // uden dette stod dens mesh og "svævede" ved sin oprindelige spawn-plads.
            c.mesh.position.copy(c.body.position);
            c.mesh.quaternion.copy(c.body.quaternion);
        });

        if (this._pendingFaceDown.length === 0) this._throwCtrl.setCaps(this.caps);
        this._ui.updatePileButtons(pool, this._wonCapsAll, this._geb, this._exhaustedThisRound);
        return cap;
    }

    // Spawner en ghost-kopi af en cap, shuffler den ind i stacken på en tilfældig position
    addGhostCap(def, enchant = null) {
        // Unikt (negativt) id pr. ghost — IKKE null. Ellers kolliderer flere
        // ghosts på samme _roundCapBonuses-nøgle, og guards som `entryId != null`
        // forhindrer helt at en ghosts egen effekt-bonus (fx absorb) bliver
        // gemt/vist som badge, selvom den stadig tæller korrekt med i scoren.
        const ghostEntryId = this._nextGhostId--;
        const ghost = this._addCapToStack(def, ghostEntryId, enchant, true);
        this._spawnGhostFeedback(ghost, 0x88aaff, 'clone');
    }

    _spawnGhostFeedback(ghost, ringColor = 0x88aaff, indicatorType = 'clone') {
        // Bounce-in på mesh: skala 0 → 1.25 → 1
        ghost.mesh.scale.setScalar(0);
        const start = performance.now();
        const tick = () => {
            const t    = Math.min((performance.now() - start) / 380, 1);
            const ease = t < 0.65
                ? (t / 0.65) ** 2
                : 1 + Math.sin((t - 0.65) / 0.35 * Math.PI) * 0.25;
            ghost.mesh.scale.setScalar(ease);
            if (t < 1) requestAnimationFrame(tick);
            else ghost.mesh.scale.setScalar(1);
        };
        requestAnimationFrame(tick);

        // Ring i 3D (farve varierer pr. kalder) + effekt-indikator
        const pos = ghost.body.position;
        this._render.spawnEffectRing(pos, 1.8, ringColor, 500, 400);
        const { x, y } = this._projectToScreen(pos);
        this._ui.showEffectIndicator(x, y, { type: indicatorType });
    }

    updateLiveCapEnchant(entryId, enchantId) {
        const cap = this.caps.find(c => c.entryId === entryId);
        if (!cap) return;
        cap.enchant = enchantId;
        this._factory.updateCapEnchant(cap.mesh, enchantId);
    }

    // ─── SESSION ───────────────────────────────────────────────────────────────

    newSession() {
        this.buildStack();
    }

    // ─── RUNDE-LIVSCYKLUS ──────────────────────────────────────────────────────

    // overrideSize / overrideCaps: bruges af BattleScreen i run-mode
    // scoreBase: persistent wallet score shown as starting value in the UI
    // isTrickShot: sat af buildTrickShotStack() — springer "runde-start"-bonusser
    // (Square/Balance) over. Uden dette kunne man cheese dem uendeligt ved at
    // fejle og "Try Again" et Trick Shot igen og igen — hvert forsøg kalder
    // buildStack() på ny, men er ikke reelt en ny runde/node.
    buildStack(overrideSize = null, overrideCaps = null, scoreBase = 0, isTrickShot = false) {
        this.cancelAllTimers();
        // Fjerner evt. transiente rarity/parity/flatbonus-badges fra forrige
        // rundes sidste kast — de er globale HUD-elementer, uafhængige af
        // hvilken skærm der vises, så deres 1.8s pop-animation kan ellers nå
        // at bløde ind i en helt ny (fx boss-)runde hvis spilleren navigerer
        // hurtigere end det.
        this._ui.clearTransientPassiveBadges();

        this.caps.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });
        this.caps = [];

        // Sikkerhedsnet: instant-spawn-caps (Phase 2.6) fra rundens SIDSTE kast når
        // aldrig applyRestack() (ingen "næste kast" i samme runde) og var bevidst
        // ikke en del af this.caps — uden dette lækkede de synligt ind i næste runde.
        this._extraSpawnedCaps.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });
        this._extraSpawnedCaps = [];

        if (this._throwCtrl.slammer) {
            this._render.removeMesh(this._throwCtrl.slammer.mesh);
            this._physics.world.removeBody(this._throwCtrl.slammer.body);
            this._throwCtrl.slammer = null;
        }

        const rawSource = overrideCaps ?? [...this._ui.getActiveCaps()];
        const count     = overrideSize ?? (overrideCaps ? rawSource.length : this._ui.getStackCount());

        // Normalize: free mode gives def[], run mode gives {def,enchant}[]
        const source = rawSource.map(item =>
            item?.def ? item : { def: item, enchant: null }
        );
        const shuffled = [...source].sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
            const entry = shuffled[i % shuffled.length];
            this.caps.push(this._factory.spawnCap(
                entry.def,
                POG_H * 0.5 + i * (POG_H + 0.01),
                entry.enchant,
                entry.id ?? null
            ));
        }

        this._throwIndex = 0;
        this._scoreBase         = scoreBase;

        this._phase             = 'idle';
        this._totalScore        = 0; // reset per node/session
        this._throwsTotal       = THROWS_PER_ROUND + (this._gs?.throwBonus ?? 0);
        this._throwsLeft        = this._throwsTotal;
        this._wonCapsAll        = [];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = 0;
        this._pendingSpawnDefs  = [];
        this._pendingHuskGrants = []; // entryIds fra Ballast — injiceres i applyRestack(), se dér
        this._halflifeEarned    = new Map(); // entryId → bonus earned this session
        this._voltageBonus      = 0;
        this._roundCapBonuses   = new Map(); // entryId → accumulated round bonus (crew/rally)
        this._roundCapMultipliers = new Map(); // entryId → accumulated round multiplier (fx martyr/Relic Hunter)
        this._exhaustedThisRound = []; // caps exhausted (territorial) denne runde — vises i stack-overlay med Zzz-badge, tæller ikke med i pile-rem-count
        this._activeTrickShot   = null; // any normal buildStack() call exits Trick Shot mode
        this._nextGhostId       = -1; // unikke negative ids til Twinsies-ghosts denne runde
        this._activeBoss        = null; // sættes eksplicit af BattleScreen EFTER dette kald

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();
        this._render.setReticleVisible(false);

        if (this.onNewStack) this.onNewStack();

        this._ui.setScore(this._scoreBase);
        this._ui.hideResults();
        this._ui.updateThrowPips(this._throwsTotal, this._throwsTotal);

        const slammers   = this._gs?.ownedSlammers ?? [];
        const amplifyNow = this._gs?.amplifyStacks ?? 0;
        const firstStrikeSlammer = slammers.find(s => s.passive?.type === 'firstThrow');
        if (firstStrikeSlammer) this._ui.showFirstStrikeBadge(firstStrikeSlammer, amplifyNow);
        else                    this._ui.hideFirstStrikeBadge();
        // Last Stand only visible on the last throw — hide at start unless round is 1 throw
        const lastStandSlammer = slammers.find(s => s.passive?.type === 'lastThrow');
        if (lastStandSlammer && this._throwsTotal === 1) this._ui.showLastStandBadge(lastStandSlammer, amplifyNow);
        else                                              this._ui.hideLastStandBadge();
        // Flat Bonus vises IKKE her — den er transient (poppes ind som bekræftelse
        // lige efter et kast, se phase 3+4), ikke en persistent pre-kast-badge.

        // SQUARE (Spellbound) — rundens start: hvis spilleren ingen kort har, giv ét gratis.
        // IKKE ved Trick Shot-forsøg (se isTrickShot-kommentaren ovenfor).
        if (!isTrickShot && this._gs && this._gs.consumables.every(c => c === null) &&
            slammers.some(s => s.passive?.type === 'squareCard')) {
            const slot = this._gs.grantRandomConsumable();
            if (slot !== false && this.onFreeCardGranted) this.onFreeCardGranted(slot);
        }

        // BALANCE (Neon Justice) — streak af på-hinanden-følgende runder hvor
        // collection'en præcis fylder max stack-antal. Tjekkes kun ved en NY
        // node/runde (buildStack), ikke ved applyRestack() mellem kast, og IKKE
        // ved Trick Shot-forsøg (samme cheese-risiko som Square — gentagne
        // "Try Again"-forsøg er ikke reelt nye runder).
        if (!isTrickShot && this._gs) {
            const atMaxStack = this._gs.ownedCaps.length === this._gs.stackSizeLimit;
            slammers.forEach(s => {
                if (s.passive?.type !== 'balance') return;
                const oldValue = s.passive.currentValue ?? 1.0;
                s.passive.currentValue = atMaxStack ? oldValue + s.passive.value : 1.0;
                s.passive.description  = `Each consecutive round your collection exactly fills max stack size: +${s.passive.value} permanently · Current: ×${s.passive.currentValue.toFixed(1)}`;
                if (atMaxStack) {
                    this._ui.showRelicGain(s.texFront, oldValue, s.passive.currentValue, 1, 'round at max stack');
                } else if (oldValue > 1.0) {
                    // Streaken blev brudt — vis samme slags sticker som ved en
                    // gevinst, bare tydeligt markeret som et reset, så spilleren
                    // faktisk kan se HVORFOR multiplikatoren pludselig er væk.
                    this._ui.showRelicReset(s.texFront, oldValue);
                }
            });
        }

        this._ui.updatePileButtons(this.caps, [], this._geb, this._exhaustedThisRound);
        this._ui.setStatus('Building stack...');
        this._ui.setActionPrompt(null);
        this.delay(() => {
            if (this._phase === 'idle') this._ui.setActionPrompt('Hold to aim');
        }, 300);
    }

    // Kaldes fra main.js lige når AMPLIFYZ spilles — de pre-kast-badges (First
    // Strike/Last Stand) blev evt. allerede vist FØR kortet blev brugt (fra
    // buildStack), og skal derfor opdateres med det samme til den forstærkede
    // værdi i stedet for at vente på næste stack.
    refreshAmplifyBadges() {
        const slammers      = this._gs?.ownedSlammers ?? [];
        const amplify       = this._gs?.amplifyStacks ?? 0;
        const isFirstThrow  = this._pendingThrowsDone === 0;
        const isLastThrow   = this._throwsLeft === 1;
        const firstStrikeSlammer = slammers.find(s => s.passive?.type === 'firstThrow');
        if (firstStrikeSlammer && isFirstThrow) this._ui.showFirstStrikeBadge(firstStrikeSlammer, amplify);
        const lastStandSlammer = slammers.find(s => s.passive?.type === 'lastThrow');
        if (lastStandSlammer && isLastThrow) this._ui.showLastStandBadge(lastStandSlammer, amplify);
        // Flat Bonus har ingen pre-kast-badge at opdatere — den er transient.
    }

    // Bygger en stak til et Trick Shot-forsøg: hele owned-caps-puljen, kun 1 kast.
    // buildStack() nulstiller _activeTrickShot, så vi sætter den EFTER kaldet.
    buildTrickShotStack(trickShotDef) {
        const ownedCaps = this._gs?.ownedCaps ?? [];
        // scoreBase = nuværende wallet-score (efter cost-fradrag) — der scores intet
        // under et forsøg, så buildStack's interne setScore skal ramme det rigtige tal.
        // isTrickShot=true — se buildStack()'s egen kommentar for hvorfor.
        this.buildStack(null, ownedCaps, this._gs?.score ?? 0, true);
        this._activeTrickShot = trickShotDef;
        this._throwsTotal     = 1;
        this._throwsLeft      = 1;
        this._ui.updateThrowPips(1, 1);
    }

    beginThrow(x, y, z) {
        const slammerDef = this._ui.getSlammerDef();
        this._render.setReticlePosition(x, y, z);
        this._render.setReticleVisible(true);
        this._cam.zoomOut();
        this._ui.setActionPrompt(null);
        this._ui.setStatus('Aiming...');
        this._throwCtrl.beginShot(
            this._powerBar.getMappedSpeed(),
            slammerDef.mass,
            x, z,
            slammerDef
        );
        this._phase = 'throwing';
    }

    applyRestack() {
        this._pendingWon.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });

        // Alle instant-spawn-caps denne kast (Phase 2.6 i _resolveAndScore) — både
        // dem der scorede (også med i _pendingWon, allerede fjernet lige ovenfor —
        // pendingWonSet undgår at fjerne dem to gange) og dem der landede forkert
        // (lå synligt fremme gennem sidste kast, ryddes stille væk nu).
        const pendingWonSet = new Set(this._pendingWon);
        this._extraSpawnedCaps.forEach(cap => {
            if (pendingWonSet.has(cap)) return;
            this._render.removeMesh(cap.mesh);
            this._physics.world.removeBody(cap.body);
        });
        this._extraSpawnedCaps = [];

        if (this._throwCtrl.slammer) {
            this._render.removeMesh(this._throwCtrl.slammer.mesh);
            this._physics.world.removeBody(this._throwCtrl.slammer.body);
            this._throwCtrl.slammer = null;
        }

        // Inject spawned caps before reshuffling
        if (this._pendingSpawnDefs.length > 0) {
            this._pendingSpawnDefs.forEach(entry => {
                const def     = entry.def ?? entry;
                const enchant = entry.enchant ?? null;
                this._pendingFaceDown.push(this._factory.spawnCap(def, 100, enchant));
            });
            this._pendingSpawnDefs = [];
        }

        // Samme princip for Husk-caps fra Ballast (se _pendingHuskGrants i
        // _resolveAndScore()) — bevidst injiceret HER, ikke straks når Ballast
        // udløses midt i kastet. Reshufflen/reposition-loopet lige nedenfor rører
        // hele poolen, så at kalde addLiveCapToStack() synkront under selve kastets
        // scoring fik hele resten af stacken til synligt at "restacke" for tidligt,
        // midt i score-floats — før spilleren overhovedet har trykket "continue".
        if (this._pendingHuskGrants.length > 0) {
            this._pendingHuskGrants.forEach(entryId => {
                this._pendingFaceDown.push(this._factory.spawnCap(HUSK_CAP_DEF, 100, null, entryId, false));
            });
            this._pendingHuskGrants = [];
        }

        for (let i = this._pendingFaceDown.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._pendingFaceDown[i], this._pendingFaceDown[j]] = [this._pendingFaceDown[j], this._pendingFaceDown[i]];
        }

        this._pendingFaceDown.forEach(({ body }, i) => {
            this._physics.world.removeBody(body);
            body.type = BODY_TYPES.STATIC;
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.position.set(0, POG_H * 0.5 + i * (POG_H + 0.01), 0);
            body.previousPosition.copy(body.position);
            body.quaternion.setFromEuler(Math.PI + (Math.random() - 0.5) * 0.04, Math.random() * Math.PI * 2, 0);
            this._physics.world.addBody(body);
        });

        this.caps = this._pendingFaceDown;
        this._ui.updatePileButtons(this.caps, this._wonCapsAll, this._geb, this._exhaustedThisRound);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();

        if (this.onNewStack) this.onNewStack();

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);

        this._ui.setStatus(`Throw ${this._pendingThrowsDone + 1}/${this._throwsTotal}`);
        this._ui.setActionPrompt('Hold to aim');
        this._phase = 'idle';

        if (this._throwsLeft === 1) {
            const lastStandSlammer = (this._gs?.ownedSlammers ?? []).find(s => s.passive?.type === 'lastThrow');
            if (lastStandSlammer) this._ui.showLastStandBadge(lastStandSlammer, this._gs?.amplifyStacks ?? 0);
        }
    }

    // ─── RESUME FRA GEMT TILSTAND ─────────────────────────────────────────────

    resumeFrom(state) {
        this.cancelAllTimers();

        this.caps.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });
        this.caps = [];

        this._extraSpawnedCaps.forEach(({ mesh, body }) => {
            this._render.removeMesh(mesh);
            this._physics.world.removeBody(body);
        });
        this._extraSpawnedCaps = [];

        if (this._throwCtrl.slammer) {
            this._render.removeMesh(this._throwCtrl.slammer.mesh);
            this._physics.world.removeBody(this._throwCtrl.slammer.body);
            this._throwCtrl.slammer = null;
        }

        this.caps = state.remainingItems.map(({ def, enchant }, i) =>
            this._factory.spawnCap(def, POG_H * 0.5 + i * (POG_H + 0.01), enchant)
        );

        this._throwIndex        = 0;
        this._scoreBase         = state.scoreBase;
        this._phase             = 'idle';
        this._totalScore        = state.totalScore;
        this._throwsTotal       = THROWS_PER_ROUND + (this._gs?.throwBonus ?? 0);
        this._throwsLeft        = state.throwsLeft;
        this._wonCapsAll        = [...state.wonCapDefs];
        this._pendingWon        = [];
        this._pendingFaceDown   = [];
        this._pendingThrowsDone = this._throwsTotal - state.throwsLeft;
        this._pendingSpawnDefs  = [];
        this._pendingHuskGrants = [];
        this._exhaustedThisRound = []; // ikke persisteret i captureState() endnu — nulstilles ved resume

        this._throwCtrl.reset();
        this._throwCtrl.setCaps(this.caps);
        this._collisions.reset();
        this._powerBar.reset();
        this._cam.zoomIn();
        this._render.setReticleVisible(false);

        if (this.onNewStack) this.onNewStack();

        this._ui.setScore(state.scoreBase + state.totalScore);
        this._ui.hideResults();
        this._ui.updateThrowPips(state.throwsLeft, this._throwsTotal);
        this._ui.updatePileButtons(this.caps, this._wonCapsAll, this._geb, this._exhaustedThisRound);
        this._ui.setStatus(`Throw ${this._pendingThrowsDone + 1}/${this._throwsTotal}`);
        this._ui.setActionPrompt('Hold to aim');
    }

    // ─── INTERN KAST-AFSLUTNING ────────────────────────────────────────────────

    _handleThrowEnd(wonNow, faceDown, miss) {
        this._render.setReticleVisible(false);
        this._throwIndex++;

        // ── Fase A: area-effekter (magnet) — kør FØR scoring ─────────────────
        const MAGNET_RADIUS   = 10;
        const AREA_DURATION   = 700;
        const magnetCaps      = wonNow.filter(c => c.def?.effect === 'magnet');

        magnetCaps.forEach(magCap => {
            const allForMagnet = [...wonNow, ...faceDown];
            const count = this._startMagnetPull(magCap, allForMagnet, MAGNET_RADIUS, AREA_DURATION);
            if (count > 0) {
                const { x, y } = this._projectToScreen(magCap.body.position);
                this._spawnEffectFeedback(magCap.body.position, x, y, { type: 'magnet', count });
            }
        });

        // ── Fase B: individuelle effekter + scoring (efter area-animation) ────
        const areaDelay = magnetCaps.length > 0 ? AREA_DURATION : 0;
        this.delay(() => this._resolveAndScore(wonNow, faceDown, miss), areaDelay);
    }

    _startMagnetPull(magCap, allCaps, radius, duration) {
        const target     = { x: magCap.body.position.x, z: magCap.body.position.z };
        const nearbyCaps = allCaps.filter(c => {
            if (c === magCap) return false;
            const op = c.body.position;
            const dx = target.x - op.x, dz = target.z - op.z;
            return Math.sqrt(dx * dx + dz * dz) < radius;
        });
        if (!nearbyCaps.length) return 0;
        nearbyCaps.splice(5); // max 5 caps påvirket

        nearbyCaps.forEach(other => {
            if (other.body.type === BODY_TYPES.STATIC) other.body.type = BODY_TYPES.DYNAMIC;
            other.body.wakeUp();
            other.body.position.y      += 0.05;
            other.body.previousPosition.y += 0.05;
        });

        const t0 = performance.now();
        let cancelled = false;
        this._magnetCancels.push(() => {
            cancelled = true;
            nearbyCaps.forEach(other => other.body.velocity.set(0, 0, 0));
        });

        const tick = () => {
            if (cancelled) return;
            if (performance.now() - t0 > duration) {
                nearbyCaps.forEach(other => {
                    other.body.velocity.set(0, 0, 0);
                    other.body.angularVelocity.set(0, 0, 0);
                    other.body.type = BODY_TYPES.STATIC;
                });
                return;
            }
            nearbyCaps.forEach(other => {
                const op   = other.body.position;
                const dx   = target.x - op.x, dz = target.z - op.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 0.4) { other.body.velocity.set(0, 0, 0); return; }
                other.body.velocity.set(dx / dist * 20, 0, dz / dist * 20);
            });
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return nearbyCaps.length;
    }

    _resolveAndScore(wonNow, faceDown, miss) {
        // Analog/Digital Timer tæller kast på tværs af HELE runnet — bump her,
        // én gang pr. faktisk kast, uanset hit/miss/Trick Shot.
        if (this._gs) this._gs.bumpRunThrowCount();

        // ── Detect caps flipped by magnet animation ────────────────────────────
        const magnetWon = faceDown.filter(c => isFaceUp(c.body));
        const stillDown = faceDown.filter(c => !isFaceUp(c.body));
        const allWon    = [...wonNow, ...magnetWon];

        // ── Phase 1: resolve effects — positions opdateret af magnet ──────────
        const allCaps     = [...allWon, ...stillDown];
        const roundExtras = {
            allRoundCaps:   [...this._wonCapsAll, ...this.caps],
            getStoredBonus: (c) => c.entryId != null && this._gs
                ? (this._gs.ownedCaps.find(e => e.id === c.entryId)?.storedBonus ?? 0) : 0,
            voltageBonus:   this._voltageBonus ?? 0,
            getRoundBonus:  (c) => this._roundCapBonuses?.get(c.entryId) ?? 0,
        };
        const resolved = allWon.map(cap => {
            const ctx    = this._resolver.buildContext(cap, allCaps, this._throwIndex, allWon.length, roundExtras);
            const result = this._resolver.resolve(cap, ctx);
            return { cap, ...result };
        });

        // ── Phase 1.5: exhaust — fjerner very-nearby caps fra ANDRE serier midlertidigt
        // (kun resten af DENNE runde — rører ALDRIG GameState.ownedCaps, så cappen er
        // tilbage helt normalt næste node). Rammer kun stadig-face-down caps (stillDown),
        // FØR surge-kæden (Phase 2.5) læser samme pulje — så en exhaustet cap heller
        // ikke kan blive surge-flippet af en tredje cap samme kast.
        // Løser "hvad hvis to exhaust-caps flipper very-near hinanden i samme kast"
        // helt uden særlig kode: en cap der selv er i wonNow/magnetWon er allerede
        // fjernet fra stillDown FØR denne fase kører, så den kan aldrig exhauste eller
        // blive exhaustet af en anden donor i SAMME kast — kun en cap der flippede i et
        // TIDLIGERE kast (og stadig ligger face-down nu) kan rammes. Donor'en der
        // flipper først får med andre ord altid "første ret".
        resolved.forEach(entry => {
            if (!entry.exhaustFilter) return;
            const donor = entry.cap;
            const dp    = donor.body.position;
            // isExhausted mærkes/target flyttes ud af stillDown MED DET SAMME (rører
            // score/pool-logik, som andre faser nedenfor er afhængige af) — men selve
            // den VISUELLE fjernelse (mesh/body + ikon-pop) er samlet i exhaustedTargets
            // og skydes drypvis nedenfor, i stedet for at forsvinde alle på én gang.
            const exhaustedTargets = [];
            for (let i = stillDown.length - 1; i >= 0; i--) {
                const target = stillDown[i];
                if (target.def?.series === donor.def?.series) continue; // kun ANDRE serier
                if (target.enchant === 'ironclad') continue;            // Ironclad beskytter mod exhaust
                const tp = target.body.position;
                const dx = dp.x - tp.x, dz = dp.z - tp.z;
                if (Math.sqrt(dx * dx + dz * dz) >= VERY_NEARBY_RADIUS) continue;
                stillDown.splice(i, 1);
                // isExhausted mærkes FØR mesh/body fjernes — cap-objektet lever videre
                // som ren data (def/entryId/enchant), så stack-overlayet stadig kan vise
                // den med et Zzz-badge resten af runden (se _exhaustedThisRound).
                target.isExhausted = true;
                this._exhaustedThisRound.push(target);
                exhaustedTargets.push(target);
            }
            if (exhaustedTargets.length > 0) {
                entry.bonus = (entry.bonus ?? 0) + entry.exhaustBonus * exhaustedTargets.length;
            }
            // Ringen vises ALTID (også ved 0 ramte), samme princip som martyr —
            // eneste måde spilleren kan se/bekræfte VERY_NEARBY_RADIUS-grænsen visuelt,
            // i stedet for at gætte om "relativt tæt" rent faktisk var tæt nok.
            const { x, y } = this._projectToScreen(dp);
            this._spawnEffectFeedback(dp, x, y, { type: 'exhaust', count: exhaustedTargets.length });

            // Drypvis fjernelse: hver ramt cap forsvinder ét ad gangen (i stedet for
            // alle samtidig) og popper sit eget ikon op ved stack-knappen undervejs,
            // i samme rækkefølge som de exhaustes — samme "flyv op til knappen"-
            // mønster som spawnDefs/Husk allerede bruger ved tilføjelser.
            const EXHAUST_DRIP_MS = 200;
            exhaustedTargets.forEach((target, i) => {
                this.delay(() => {
                    this._render.removeMesh(target.mesh);
                    this._physics.world.removeBody(target.body);
                    this._ui.popStackIcon(target.def);
                    audio.play('exhaust');
                }, i * EXHAUST_DRIP_MS);
            });
        });

        // ── Phase 2: partition returnToStack vs scored ────────────────────────
        const actualWon  = resolved.filter(r => !r.returnToStack);
        const returnCaps = resolved.filter(r =>  r.returnToStack).map(r => r.cap);

        // Miss-lyd (tilfældigt mellem 2 varianter) — KUN når slammeren ramte
        // gulvet uden at røre en eneste cap (miss-parameteren, sat af
        // CollisionManager's onMiss vs. onBlast — se ThrowController.forceEnd()).
        // BEVIDST ikke actualWon.length===0: ramte den rent faktisk en cap, men
        // fik bare 0 flippet, skal miss-lyden IKKE spille, kun stilheden/UI'ets
        // "Miss!"-tekst. areaDelay (se _handleThrowEnd) er altid 0 for et ægte
        // miss (wonNow er tomt, så magnetCaps kan ikke udløse forsinkelsen), så
        // dette kører allerede reelt med det samme, ingen ekstra timing nødvendig.
        if (miss) audio.play(Math.random() < 0.5 ? 'miss_1' : 'miss_2');

        returnCaps.forEach(cap => {
            cap.body.quaternion.setFromEuler(
                Math.PI + (Math.random() - 0.5) * 0.04,
                Math.random() * Math.PI * 2,
                0
            );
            cap.body.previousPosition.copy(cap.body.position);
        });

        // ── Phase 2.5: surge chain — resolve synkront, animer bagefter ────────
        // faceDownPool: mutable pool af caps surge kan flippe (kun stillDown, ikke returnCaps)
        const faceDownPool     = [...stillDown];
        const surgeAnimTargets = []; // { cap, step } — til staggered animation
        const surgeAttempts    = []; // { pos, success, step } — til radius-ring feedback (også ved miss)
        const surgeQueue       = actualWon.filter(r => (r.flipNearby ?? 0) > 0);
        const MAX_CHAIN        = 8;
        let   chainStep        = 0;

        while (surgeQueue.length > 0 && chainStep < MAX_CHAIN) {
            const surger    = surgeQueue.shift();
            const sp        = surger.cap.body.position;

            // Find nærmeste face-down cap inden for NEARBY_RADIUS
            let nearestIdx  = -1;
            let nearestDist = Infinity;
            faceDownPool.forEach((cap, idx) => {
                const p    = cap.body.position;
                const dist = Math.sqrt((sp.x - p.x) ** 2 + (sp.z - p.z) ** 2);
                if (dist < NEARBY_RADIUS && dist < nearestDist) {
                    nearestDist = dist; nearestIdx = idx;
                }
            });

            chainStep++;
            if (nearestIdx === -1) {
                surgeAttempts.push({ pos: sp, success: false, step: chainStep });
                continue;
            }

            const target = faceDownPool.splice(nearestIdx, 1)[0];
            surgeAnimTargets.push({ cap: target, step: chainStep });
            surgeAttempts.push({ pos: sp, success: true, step: chainStep, targetPos: target.body.position });

            // Resolve target's effects (inkl. evt. chain-surge)
            const newAllCaps = [...actualWon.map(r => r.cap), ...faceDownPool, target];
            const ctx        = this._resolver.buildContext(target, newAllCaps, this._throwIndex, actualWon.length + surgeAnimTargets.length, roundExtras);
            const result     = this._resolver.resolve(target, ctx);
            const resolved   = { cap: target, ...result };
            actualWon.push(resolved);

            if ((result.flipNearby ?? 0) > 0) surgeQueue.push(resolved);
        }

        // ── Surge-flip animationer — rene visuel/fysik-effekter, ingen scoring ──
        // Flyttet hertil (før Trick Shot-forket, OG før Phase 2.6 nedenfor som
        // genbruger surgeLandDelay) så surge stadig SES under et forsøg, ikke kun
        // tælles med usynligt. Viser altid en radius-ring ved surgeren (grøn =
        // fandt mål, rød = ingen face-down cap i NEARBY_RADIUS).
        surgeAttempts.forEach(({ pos, success, step, targetPos }) => {
            this.delay(() => {
                const { x, y } = this._projectToScreen(pos);
                this._spawnEffectFeedback(pos, x, y, { type: 'surge', success, targetPos });
            }, (step - 1) * 220);
        });
        const SURGE_SPIN_MS  = 850;
        const surgeLandDelay = new Map(); // cap → earliest ms score/pop/verdict må fyre, så det ikke forsvinder midt i hoppet
        surgeAnimTargets.forEach(({ cap, step }) => {
            const startAt = (step - 1) * 220;
            surgeLandDelay.set(cap, startAt + SURGE_SPIN_MS + 120);
            this.delay(() => {
                audio.playCapFlipper();
                this._render.animateCapFlipSpin(cap.mesh, 3, SURGE_SPIN_MS, () => {
                    const euler = new Vec3();
                    cap.body.quaternion.toEuler(euler);
                    cap.body.quaternion.setFromEuler(0, euler.y, 0);
                });
            }, startAt);
        });

        // ── Phase 2.6: instant-spawn ("Spawn"-effekten, fx Team Raptor) ──────────
        // Materialiserer HELT NYE caps midt i kastet (i modsætning til Flipper/surge
        // ovenfor, som flipper en cap der ALLEREDE lå på pladen). Landingsudfaldet
        // (face-up/face-down) rulles FØR animationen starter — samme "resultat kendt,
        // skjules af spin undervejs"-mønster som surge selv bruger. Face-up scorer
        // dette kast (pushes til actualWon, helt automatisk arvet ind i score/flip-
        // tæller/pile-overlay via samme mekanisme som surge). Face-down scorer IKKE
        // og bliver IKKE en rigtig (flippable) del af næste kasts stack — men den
        // fjernes heller ikke øjeblikkeligt idet den lander (så ud som om den
        // "forsvandt med det samme"). Den bliver liggende synligt, rent kosmetisk,
        // og ryddes stille væk når næste kast bygges (applyRestack — se _extraSpawnedCaps).
        const instantSpawnQueue = actualWon
            .filter(r => (r.instantSpawn?.length ?? 0) > 0)
            .flatMap(r => r.instantSpawn.map(def => ({ def, donor: r.cap })));
        const MAX_INSTANT_SPAWN  = 8;
        const SPAWN_FALL_MS      = 850;
        let   instantSpawnStep   = 0;

        while (instantSpawnQueue.length > 0 && instantSpawnStep < MAX_INSTANT_SPAWN) {
            const { def, donor } = instantSpawnQueue.shift();
            instantSpawnStep++;

            // Placering: tilfældig vinkel/afstand NÆR donor-cappen (ikke blindt
            // hen over hele pladen) — genbruger NEARBY_RADIUS, samme "hvad er tæt
            // på" som surge/aura allerede bruger andre steder i denne funktion.
            const dp    = donor.body.position;
            const angle = Math.random() * Math.PI * 2;
            const dist  = Math.random() * NEARBY_RADIUS;
            const x     = dp.x + Math.cos(angle) * dist;
            const z     = dp.z + Math.sin(angle) * dist;
            const restY = POG_H * 0.5;

            const newCap = this._factory.spawnCap(def, restY, null, this._nextGhostId--, true);
            // isGhost giver en blå gennemsigtig tint (Twinsies-look) — denne cap skal
            // se "rigtig" ud, den er ikke en midlertidig duplikat.
            newCap.mesh.material.forEach(m => { m.transparent = false; m.opacity = 1; m.emissiveIntensity = 0; });
            newCap.body.position.set(x, restY, z);
            newCap.body.previousPosition.copy(newCap.body.position);
            // newCap er BEVIDST ikke en del af this.caps (skal ikke tælles med i næste
            // kasts stack), men det betyder den aldrig rammes af RenderEngine.sync()'s
            // per-frame body→mesh-kopiering — uden dette ville mesh'et blive hængende
            // på Three.js' default (0,0,0), altså scenens centrum, uanset body-positionen.
            newCap.mesh.position.copy(newCap.body.position);
            newCap.mesh.quaternion.set(
                newCap.body.quaternion.x, newCap.body.quaternion.y,
                newCap.body.quaternion.z, newCap.body.quaternion.w
            );
            // Usynlig indtil selve faldet starter — undgår at den blitzer synligt i
            // hvilehøjde i det staggered delay-vindue før animateCapMaterialize kører.
            newCap.mesh.visible = false;
            // Sporet HER (ved oprettelse), ikke kun ved miss — så selv en cap der
            // scorer (og dermed også havner i _pendingWon) er dækket af sikkerhedsnettet
            // i buildStack(), hvis runden slutter FØR applyRestack() når at fjerne den
            // via _pendingWon (se pendingWonSet-guarden i applyRestack, undgår dobbelt-fjernelse).
            this._extraSpawnedCaps.push(newCap);

            const endFaceUp = Math.random() < 0.5;
            const step       = instantSpawnStep;
            const startAt    = (step - 1) * 220;
            surgeLandDelay.set(newCap, startAt + SPAWN_FALL_MS + 120);

            this.delay(() => {
                newCap.mesh.visible = true;
                audio.playCapFlipper();
                this._render.animateCapMaterialize(newCap.mesh, endFaceUp, 3, SPAWN_FALL_MS, () => {
                    // Snapper body-quaternion til den faktiske landing — IKKE fjernet her
                    // ved miss, den bliver liggende synligt til næste kast rydder den
                    // (allerede sporet i _extraSpawnedCaps ved oprettelse ovenfor).
                    newCap.body.quaternion.setFromEuler(endFaceUp ? 0 : Math.PI, newCap.mesh.rotation.y, 0);
                });
            }, startAt);

            if (endFaceUp) {
                const newAllCaps = [...actualWon.map(r => r.cap), ...faceDownPool, newCap];
                const ctx        = this._resolver.buildContext(
                    newCap, newAllCaps, this._throwIndex,
                    actualWon.length + instantSpawnStep, roundExtras
                );
                const result   = this._resolver.resolve(newCap, ctx);
                const resolved = { cap: newCap, ...result };
                actualWon.push(resolved);
                // v1-afgrænsning: en spawnet caps EGEN instantSpawn fodrer tilbage i
                // DENNE kø (samme MAX_INSTANT_SPAWN-loft) — men dens flipNearby fodrer
                // bevidst IKKE ind i surge-kæden ovenfor (den er allerede færdigkørt).
                if ((result.instantSpawn?.length ?? 0) > 0) {
                    instantSpawnQueue.push(...result.instantSpawn.map(d => ({ def: d, donor: newCap })));
                }
                // Cell (Osmosis) — slammer-passive: hver gang en SPAWNET cap selv
                // scorer (face-up), materialiser ÉN kopi mere af den. Bevidst kun
                // spawn-caps (denne løkke), IKKE Flipper/surge-flippede caps —
                // Flipper håndteres i et helt separat kodeafsnit ovenfor (Phase 2.5)
                // som Osmosis aldrig rører. Fødes ind i SAMME kø, begrænset af
                // samme MAX_INSTANT_SPAWN-loft — kan derfor i teorien selv duplikere
                // sig selv videre (osmose-agtig kædereaktion), ikke kun ét ekstra lag.
                const osmosisSlammer = (this._gs?.ownedSlammers ?? []).find(s => s.passive?.type === 'osmosis');
                if (osmosisSlammer) {
                    instantSpawnQueue.push({ def: newCap.def, donor: newCap });
                }
            }
        }

        // spawnDefs collected AFTER surge so surge-flipped caps' spawn effects are included
        const spawnDefs = actualWon.flatMap(r => r.spawnCaps ?? []);

        const updatedFaceDown = [...faceDownPool, ...returnCaps];

        // ── Trick Shot fork: springer scoring/GameState-persistence helt over ──
        // Effekter + magnet + surge-kæde er allerede kørt ovenfor, så abilities
        // tæller stadig med i checket. Ingen scoring, ingen halflife/relic-writes.
        // Ventes med verdikten til sidste surge-spin er landet (eller en minimums-
        // pause), så spilleren altid når at se cappene ligge stille på bordet først.
        if (this._activeTrickShot) {
            const MIN_VERDICT_DELAY = 700;
            const surgeDelay   = surgeLandDelay.size > 0 ? Math.max(...surgeLandDelay.values()) : 0;
            const verdictDelay = Math.max(MIN_VERDICT_DELAY, surgeDelay);
            const wonCaps      = actualWon.map(r => r.cap);
            this.delay(() => this._resolveTrickShotAttempt(wonCaps, updatedFaceDown), verdictDelay);
            return;
        }

        // ── Phase 2b: crew/rally/martyr tilføjer rundevis bonus/multiplier til
        // _roundCapBonuses/_roundCapMultipliers. Persisterer resten af runden og
        // vises i pile-overlay badges.
        const auraFeedback = new Map(); // donor cap → { type, targets } — kun til visuel feedback
        actualWon.forEach(({ cap: donor, auraBonus, auraMultiplier, auraFilter }) => {
            if ((!auraBonus && (auraMultiplier ?? 1) === 1) || !auraFilter) return;
            const pd = donor.body.position;
            const targets = [];
            // crew: alle caps i runden; rally/martyr: same-throw won + face-down (positionsbaseret)
            const candidateCaps = auraFilter === 'series'
                ? [...actualWon.map(r => r.cap), ...updatedFaceDown, ...this._wonCapsAll]
                : [...actualWon.map(r => r.cap), ...updatedFaceDown];
            candidateCaps.forEach(target => {
                if (target === donor || target.entryId == null) return;
                const pt         = target.body.position;
                const dx         = pd.x - pt.x, dz = pd.z - pt.z;
                const nearby     = Math.sqrt(dx * dx + dz * dz) < NEARBY_RADIUS;
                const sameSeries = donor.def?.series && donor.def.series === target.def?.series;
                const matches    = auraFilter === 'nearby'  ? nearby
                                 : auraFilter === 'series'  ? sameSeries
                                 : nearby || sameSeries;
                if (matches) {
                    if (auraBonus) {
                        this._roundCapBonuses.set(target.entryId,
                            (this._roundCapBonuses.get(target.entryId) ?? 0) + auraBonus);
                    }
                    if ((auraMultiplier ?? 1) !== 1) {
                        this._roundCapMultipliers.set(target.entryId,
                            (this._roundCapMultipliers.get(target.entryId) ?? 1) * auraMultiplier);
                    }
                    targets.push({ x: pt.x, y: pt.y, z: pt.z });
                }
            });
            const isMartyr = donor.def?.effect === 'martyr';
            // Martyr (Relic Hunter) viser sin radius-ring ALTID, selv ved 0 ramte —
            // det er den eneste måde at se/bekræfte om et cap rent faktisk lå
            // inden for NEARBY_RADIUS eller ej. Rally/crew beholder deres
            // eksisterende "kun ved mindst ét ramt"-adfærd uændret.
            if (targets.length > 0 || isMartyr) {
                // Martyr får sin egen ring-farve i stedet for at blive slugt af
                // rally's — samme auraFilter:'nearby', men et helt andet
                // effekt-id, og spilleren skal kunne se forskel på dem.
                const feedType = isMartyr ? 'martyr' : auraFilter === 'nearby' ? 'rally' : 'crew';
                auraFeedback.set(donor, { type: feedType, targets, count: targets.length });
            }
        });

        // ── Phase 3+4: per-cap score med flat bonus + global multiplier-kæde ──
        const multChain       = this._gs?.multiplierChain  ?? [];
        const doubleStacks    = this._gs?.activeDouble ?? 0;
        if (doubleStacks > 0 && this._gs) { this._gs.activeDouble = 0; this._ui.hideDoubleBadge(); }
        const doubleChain     = doubleStacks > 0 ? [...multChain, 2 ** doubleStacks] : multChain;

        // AMPLIFYZ — næste kast: alle slammer-passiver trigger N ekstra gange,
        // ét pr. kort brugt (stakker som doubleStacks — 2 kort = 2 ekstra triggers,
        // ikke bare "aktiv/ikke aktiv"). Forbruges/nulstilles HER, kun ét sted,
        // uanset om kastet rammer noget.
        const amplify = this._gs?.amplifyStacks ?? 0;
        if (amplify > 0 && this._gs) { this._gs.amplifyStacks = 0; this._ui.hideAmplifyBadge(); }

        const isFirstThrow    = this._pendingThrowsDone === 0;
        const isLastThrow     = this._throwsLeft === 1;
        const slammers        = this._gs?.ownedSlammers ?? [];
        // Digital Timer (Class of '96) lægges oveni den normale flatBonus — samme
        // felt, den er blot kun aktiv hvert N. kast på tværs af hele runnet.
        const runThrowCount   = this._gs?.runThrowCount ?? 0;
        const digitalSlammer  = slammers.find(s => s.passive?.type === 'digitalTimer');
        const digitalHit      = !!digitalSlammer && runThrowCount > 0 && runThrowCount % digitalSlammer.passive.interval === 0;
        const flatSlammerBonus = passiveFlatBonus(slammers, s => s.passive?.type === 'flatBonus', amplify)
            + (digitalHit ? passiveFlatBonus(slammers, s => s.passive?.type === 'digitalTimer', amplify) : 0);
        const firstMult       = isFirstThrow ? passiveMultiplier(slammers, s => s.passive?.type === 'firstThrow', amplify) : 1;
        const lastMult        = isLastThrow  ? passiveMultiplier(slammers, s => s.passive?.type === 'lastThrow',  amplify) : 1;
        if (isFirstThrow) this._ui.hideFirstStrikeBadge();
        if (isLastThrow)  this._ui.hideLastStandBadge();
        // Parity-slammere (Even Steven/Odd Todd) — hele kastets antal flips afgør
        // om de matcher, ligesom boss-gimmicken, men her som en ren bonus (ikke veto).
        // flipCount > 0 er bevidst — 0 er teknisk "lige", men et rent miss skal
        // ikke kunne trigge Even Steven (samme regel som Even Split-trickshottet,
        // se trickshots/evenFlipCount.js).
        const flipCount       = actualWon.length;
        const parityMult      = passiveMultiplier(
            slammers,
            s => flipCount > 0 && s.passive?.type === 'parityMultiplier' && flipCount % 2 === (s.passive.parity === 'even' ? 0 : 1),
            amplify
        );
        // Hero (Bloodlines) — præcis 1 cap flippet i DETTE kast (genbruger flipCount,
        // samme "flipCount > 0"-regel som parity, så et rent miss aldrig trigger den).
        const heroMult         = flipCount === 1
            ? passiveMultiplier(slammers, s => s.passive?.type === 'hero', amplify) : 1;
        // Analog Timer (Crescent Heights) — hvert N. kast på tværs af hele runnet.
        const analogSlammer   = slammers.find(s => s.passive?.type === 'analogTimer');
        const analogHit       = !!analogSlammer && runThrowCount > 0 && runThrowCount % analogSlammer.passive.interval === 0;
        const analogMult      = analogHit ? passiveMultiplier(slammers, s => s.passive?.type === 'analogTimer', amplify) : 1;
        const positionChain   = [...doubleChain, ...(firstMult > 1 ? [firstMult] : []), ...(lastMult > 1 ? [lastMult] : []), ...(parityMult > 1 ? [parityMult] : []), ...(heroMult > 1 ? [heroMult] : []), ...(analogMult > 1 ? [analogMult] : [])];
        const globalMult      = positionChain.reduce((m, v) => m * v, 1);
        // Overdrive (Quarterback Sis) — halverer ALT, holdt udenfor positionChain
        // (ligesom bossMult) så den ikke optræder som en "×N > 1"-chip i UI'et.
        // Bevidst UDEN amplify: det er en debuff, ikke en bonus — AMPLIFYZ skal
        // ikke gøre en værdi < 1 endnu stærkere (base^(1+stacks) ville gøre 0.5 til
        // 0.25 i stedet for at lade den stå urørt).
        const overdriveMult   = passiveMultiplier(slammers, s => s.passive?.type === 'overdrive');

        // Parity Multiplier-feedback (Even Steven/Odd Todd SLAMMERE — bonus, ikke
        // boss-veto'et). parityMult > 1 betyder kastets flip-paritet matchede en
        // ejet slammer denne gang — udled hvilken (even/odd) for at finde dens icon.
        if (parityMult > 1) {
            const parityType    = flipCount % 2 === 0 ? 'even' : 'odd';
            const paritySlammer = slammers.find(s => s.passive?.type === 'parityMultiplier' && s.passive.parity === parityType);
            if (paritySlammer) this._ui.showParityMultBadge(paritySlammer, parityType, parityMult);
        }

        // Hero-feedback (Bloodlines) — samme transiente stack-badge-mønster.
        if (heroMult > 1) {
            const heroSlammer = slammers.find(s => s.passive?.type === 'hero');
            if (heroSlammer) this._ui.showPassiveTriggerBadge(heroSlammer, `SOLO ×${heroMult}`, '#2a9d5c');
        }
        // Analog Timer-feedback (Crescent Heights).
        if (analogHit && analogMult > 1) {
            this._ui.showPassiveTriggerBadge(analogSlammer, `×${analogMult}`, '#445577');
        }
        // Digital Timer-feedback (Class of '96) — viser den U-forstærkede base-værdi,
        // samme mønster som Flat Bonus-badgen ovenfor.
        if (digitalHit) {
            this._ui.showPassiveTriggerBadge(digitalSlammer, `+${digitalSlammer.passive.value}★`, '#dd8800');
        }

        // Flat Bonus-feedback (Power Surge/Magnet) — kun hvis kastet rent faktisk
        // flippede noget (ellers er der intet at lægge bonussen oveni). Sender
        // den U-forstærkede base-værdi ind (showFlatBonusBadge amplificerer selv,
        // ligesom showFirstStrikeBadge/showLastStandBadge gør med passive.value).
        if (flatSlammerBonus > 0 && actualWon.length > 0) {
            const flatBonusSlammer = slammers.find(s => s.passive?.type === 'flatBonus');
            if (flatBonusSlammer) this._ui.showFlatBonusBadge(flatBonusSlammer, this._gs?.flatSlammerBonus ?? 0, amplify);
        }

        // Boss-gimmick multiplier (Even Steven/Odd Todd/No Glam Fam) — holdes UDENFOR
        // positionChain, så den ikke optræder i score-floatens visuelle multiplier-kæde
        // (der kun viser tal > 1 — boss-effekten kan jo netop være 0).
        const bossMult = this._activeBoss
            ? getBossThrowMultiplier(this._activeBoss.gimmick, {
                actualWonCount: actualWon.length,
                ownedCaps:      this._gs?.ownedCaps ?? [],
            })
            : 1;
        // Ballast — hver KAST den ligger uflippet i denne rundes stack giver 2×
        // til HELE kastets score (holdt udenfor positionChain ligesom bossMult
        // nedenfor — det er ikke en per-cap-effekt-kæde, det er en rundevis
        // tilstand). "Uflippet DENNE kast" = stadig tilbage i updatedFaceDown
        // EFTER kastets egne flips er fjernet fra poolen — det opfylder
        // automatisk "medmindre den er flippet", siden en Ballast-cap der
        // rent faktisk blev flippet i DETTE kast allerede er fjernet derfra.
        // Husk-cappen gives HVER GANG denne betingelse er sand (ikke kun én
        // gang når Ballast til sidst flippes) — samme trigger som 2×'en. UNDTAGEN
        // på et rent miss-kast (0 flips denne tur) — Husk skal belønne et kast
        // hvor SPILLEREN rent faktisk gjorde noget, ikke et bomkast.
        const ballastActive = updatedFaceDown.some(c => c.def?.effect === 'ballast');
        const ballastMult   = ballastActive ? 2 : 1;
        // huskGranted styrer popStackIcon-animationen nedenfor (samme "flyv op
        // til stack-knappen"-mønster som spawnDefs allerede bruger) — sat her,
        // men selve animationen skydes af LÆNGERE NEDE, EFTER scoredCaps/popDelay
        // er beregnet, så den kan vente pænt til score-floats er landet.
        let huskGranted = false;
        if (ballastActive && actualWon.length > 0 && this._gs) {
            // gainCap() først (permanent, rigtigt id) — derefter en LIVE fysisk
            // kopi med SAMME id ind i denne rundes stack, så den kan flippes med
            // det samme (og fjernes rigtigt fra ownedCaps hvis/når den flippes,
            // via huskEffect's destroySelf).
            const result = this._gs.gainCap(HUSK_CAP_DEF);
            if (result.ok) {
                // Ikke skabt/tilføjet til stacken synkront her — det ville reshuffle/
                // repositionere HELE poolen midt i kastets egen scoring (samme mønster
                // som backup/spawnDefs allerede undgår), og så ud som om stacken
                // "restackede" sig selv for tidligt, før spilleren nåede at trykke
                // "continue". I stedet lægges entryId på køen og injiceres atomisk i
                // applyRestack() — samme sted og samme øjeblik som _pendingSpawnDefs
                // (backup) allerede gør det.
                this._pendingHuskGrants.push(result.entry.id);
                huskGranted = true;

                // Rent visuelt feedback (ring + ikon) må gerne ske med det samme — det
                // rører ikke stack-poolen, kun en midlertidig effekt ved Ballast-cappens
                // egen position.
                const ballastCap = updatedFaceDown.find(c => c.def?.effect === 'ballast');
                if (ballastCap) {
                    const pos = ballastCap.body.position;
                    this._render.spawnEffectRing(pos, 1.8, 0x555555, 500, 400);
                    const { x, y } = this._projectToScreen(pos);
                    this._ui.showEffectIndicator(x, y, { type: 'husk' });
                }
            }
            this._ui.flashBagBtn();
        }
        // Overdrive holdes UDENFOR finalGlobalMult bevidst — den skal gange den
        // SAMLEDE kast-score ÉN gang (se scoreGained nedenfor), ikke hver enkelt
        // caps score for sig, som ville floor()'e 0.5 væk N gange i stedet for én.
        const finalGlobalMult = globalMult * bossMult * ballastMult;

        // Parity-boss feedback (Even Steven/Odd Todd) — et grønt flueben/rødt kryds
        // pr. kast så spilleren straks kan se OM og HVORFOR kastet scorer 0, i
        // stedet for bare at se en score-float på +0 uden forklaring.
        if (this._activeBoss && actualWon.length > 0 &&
            (this._activeBoss.gimmick === 'even_steven' || this._activeBoss.gimmick === 'odd_todd')) {
            this._ui.showBossThrowFeedback(bossMult > 0);
        }

        const voltage    = this._voltageBonus ?? 0;
        // Dedup af Rarity Multiplier-badges: flere caps af samme rarity i ét kast
        // skal kun give ÉN badge, ikke én pr. cap. Magic (holoMultiplier) genbruger
        // samme dedup-idé — kun ÉN badge pr. kast, uanset hvor mange enchantede caps.
        const triggeredRarities = new Set();
        let   holoTriggerValue  = 0;
        const scoredCaps = actualWon.map(({ cap, bonus, localMultiplier, baseValue, effectMeta, destroySelf, grantCaps }) => {
            const roundBonus = this._roundCapBonuses.get(cap.entryId) ?? 0;
            const gsEntry  = cap.entryId != null && this._gs ? this._gs.ownedCaps.find(c => c.id === cap.entryId) : null;
            const carry    = gsEntry?.enchant === 'halflife' ? (gsEntry?.storedBonus ?? 0) : 0;
            if (gsEntry?.enchant === 'halflife' && cap.entryId != null) {
                this._halflifeEarned.set(cap.entryId, (bonus ?? 0) + roundBonus + voltage);
            }
            // Gem effect-bonus i roundCapBonuses så badge viser total ekstra grundværdi
            if ((bonus ?? 0) > 0 && cap.entryId != null) {
                this._roundCapBonuses.set(cap.entryId, roundBonus + (bonus ?? 0));
            }
            // Rarity-slammere (Common/Uncommon/Rare/Legendary-fokus) — kun caps af den
            // matchende rarity ganges, så det vises i DENNE caps egen chain, ikke i
            // den delte positionChain (som gælder alle caps i kastet).
            const capRarity   = cap.def?.rarity ?? 1;
            const rarityMult = passiveMultiplier(
                slammers,
                s => s.passive?.type === 'rarityMultiplier' && s.passive.rarity === capRarity,
                amplify
            );
            if (rarityMult > 1) triggeredRarities.add(capRarity);
            // Magic (Gilded Gargoyle) — kun caps der faktisk ER enchantede lige nu.
            const holoMult = gsEntry?.enchant != null
                ? passiveMultiplier(slammers, s => s.passive?.type === 'holoMultiplier', amplify) : 1;
            if (holoMult > 1) holoTriggerValue = holoMult;
            // Rundevis aura-multiplier (fx martyr/Relic Hunter) — akkumuleret i
            // _roundCapMultipliers ovenfor i Phase 2b, samme mønster som roundBonus.
            const roundMult  = this._roundCapMultipliers.get(cap.entryId) ?? 1;
            const capChain   = [...positionChain, ...(rarityMult > 1 ? [rarityMult] : []), ...(holoMult > 1 ? [holoMult] : []), ...(roundMult !== 1 ? [roundMult] : [])];
            const capScore   = Math.floor(((baseValue ?? 1) + (bonus ?? 0) + roundBonus + carry + flatSlammerBonus + voltage) * (localMultiplier ?? 1) * roundMult);
            const finalScore = Math.floor(capScore * finalGlobalMult * rarityMult * holoMult);
            return { cap, capScore, finalScore, effectMeta: effectMeta ?? null, chain: capChain, carry, destroySelf: !!destroySelf, grantCaps: grantCaps ?? [] };
        });
        // Rarity Multiplier-feedback: én badge pr. UNIK rarity der rent faktisk
        // triggede denne gang (se dedup ovenfor).
        triggeredRarities.forEach(rarity => {
            const raritySlammer = slammers.find(s => s.passive?.type === 'rarityMultiplier' && s.passive.rarity === rarity);
            if (!raritySlammer) return;
            const value = passiveMultiplier(slammers, s => s.passive?.type === 'rarityMultiplier' && s.passive.rarity === rarity, amplify);
            this._ui.showRarityMultBadge(raritySlammer, rarity, value);
        });
        // Magic-feedback (Gilded Gargoyle) — én badge pr. kast, ikke pr. enchantet cap.
        if (holoTriggerValue > 1) {
            const holoSlammer = slammers.find(s => s.passive?.type === 'holoMultiplier');
            if (holoSlammer) this._ui.showPassiveTriggerBadge(holoSlammer, `×${holoTriggerValue}`, '#d4af37', '#000');
        }
        // Overdrive (Quarterback Sis) ganges her, ÉN gang på den samlede kast-score
        // — undgår at hver cap floor()'er sin egen halvering væk for sig (se note
        // ved finalGlobalMult ovenfor).
        const rawScoreGained = scoredCaps.reduce((sum, { finalScore }) => sum + finalScore, 0);
        const scoreGained    = Math.floor(rawScoreGained * overdriveMult);
        if (overdriveMult < 1 && actualWon.length > 0) {
            const overdriveSlammer = slammers.find(s => s.passive?.type === 'overdrive');
            if (overdriveSlammer) this._ui.showPassiveTriggerBadge(overdriveSlammer, `×${overdriveMult}`, '#cc2222');
        }

        this._wonCapsAll.push(...actualWon.map(({ cap }) => cap));
        this._totalScore += scoreGained;
        this._throwsLeft--;

        const hasNextThrow = this._throwsLeft > 0 && updatedFaceDown.length > 0;

        // ── Pop animations + per-cap score floats ────────────────────────────
        const popDelay   = Math.max(80, 500 / Math.max(actualWon.length, 1));
        const finalScore = this._scoreBase + this._totalScore;

        // Runde-ende resultat-overlay må ikke poppe op før sidste score-float er
        // landet — ellers dækker den skærmen mens spilleren stadig burde se
        // sidste kasts effekter/scores rulle ud. Kaldes derfor herfra, ikke
        // synkront længere nede, og kun hvis runden faktisk er slut.
        const showRoundResults = () => this._ui.showResults(
            this._wonCapsAll.length, this._totalScore,
            this._wonCapsAll, updatedFaceDown.length === 0
        );

        const scoreDelays = scoredCaps.map(({ cap }, i) => Math.max(i * popDelay, surgeLandDelay.get(cap) ?? 0));
        const lastIdx      = scoreDelays.reduce((best, d, i) => d > scoreDelays[best] ? i : best, 0);

        scoredCaps.forEach(({ cap, capScore, effectMeta, chain, carry, destroySelf, grantCaps }, i) => {
            const isLast = i === lastIdx;
            this.delay(() => {
                const { x, y } = this._projectToScreen(cap.body.position);
                if (effectMeta) this._spawnEffectFeedback(cap.body.position, x, y, effectMeta);
                const auraMeta = auraFeedback.get(cap);
                if (auraMeta)  this._spawnEffectFeedback(cap.body.position, x, y, auraMeta);
                this._ui.showScoreFloat(x, y, capScore, chain, () => {
                    this._popCapMesh(cap.mesh);
                    this._ui.popCollectIcon(cap.def);
                    // Ability-udløst permanent fjernelse (jackpot/martyr, se
                    // destroy-ability-draft.md). Ironclad-caps når aldrig hertil med
                    // destroySelf=true — ironcladEnchant() nulstiller flaget allerede
                    // i selve effekt-resolveringen (EffectResolver._applyEnchant), så
                    // der er bevidst INGEN separat ironclad-check her. Filter er trygt
                    // som no-op for ghosts (negativt entryId, findes aldrig i ownedCaps).
                    // Feedback er in-battle-view (ring + lille ikon-indikator, samme
                    // mønster som alle andre effekter), IKKE en sticker-overlay — den
                    // sidste virkede for forstyrrende for noget der sker midt i et kast.
                    if (destroySelf && this._gs) {
                        this._gs.ownedCaps = this._gs.ownedCaps.filter(c => c.id !== cap.entryId);
                        this._spawnEffectFeedback(cap.body.position, x, y, { type: 'destroy' });
                        // Debris Eater — permanent +value til multiplieren for HVER cap
                        // der destroyes, samme mønster som throwSaver/sharden/balance
                        // (se GameState.multiplierChain/addSlammer). currentValue vokser
                        // her for hver destroyet cap enkeltvis, ikke pr. kast.
                        this._gs.ownedSlammers
                            .filter(s => s.passive?.type === 'destroyGrowth')
                            .forEach(s => {
                                const p = s.passive;
                                const oldValue = p.currentValue ?? 1.0;
                                p.currentValue = oldValue + p.value;
                                p.description  = `Each cap destroyed adds ×${p.value} permanently · Current: ×${p.currentValue.toFixed(1)}`;
                                this._ui.showRelicGain(s.texFront, oldValue, p.currentValue, 1, 'cap destroyed');
                            });
                    }
                    // Ballast → Husk (og fremtidige lignende effekter): permanent
                    // tilføjelse til samlingen, samme sted/timing som destroySelf
                    // ovenfor (efter score-floatet er landet, ikke før).
                    if (grantCaps?.length > 0 && this._gs) {
                        grantCaps.forEach(def => this._gs.gainCap(def));
                        this._ui.flashBagBtn();
                    }
                    if (isLast) {
                        this._ui.setScore(finalScore);
                        if (scoreGained > 0) this._ui.showScoreGain(scoreGained);
                        if (!hasNextThrow) showRoundResults();
                        if (this.onScoreSettled) this.onScoreSettled(finalScore);
                    }
                }, carry);
            }, scoreDelays[i]);
        });
        if (scoredCaps.length === 0) {
            this._ui.setScore(finalScore);
            if (!hasNextThrow) showRoundResults();
            if (this.onScoreSettled) setTimeout(() => this.onScoreSettled(finalScore), 0);
        }

        // huskGranted-cappen findes først rigtigt i applyRestack() (se
        // _pendingHuskGrants) — her er den kun med som forhåndsvisning i
        // pile-overlayets tælling, ligesom spawnDefs (backup) allerede er.
        const displayRemaining = hasNextThrow
            ? [...updatedFaceDown, ...spawnDefs, ...(huskGranted ? [{ def: HUSK_CAP_DEF, enchant: null }] : [])]
            : updatedFaceDown;
        this._ui.updatePileButtons(displayRemaining, this._wonCapsAll, this._geb, this._exhaustedThisRound);
        this._ui.updateThrowPips(this._throwsLeft, this._throwsTotal);

        if (hasNextThrow) {
            this._pendingWon         = actualWon.map(({ cap }) => cap);
            this._pendingFaceDown    = updatedFaceDown;
            this._pendingThrowsDone  = this._throwsTotal - this._throwsLeft;
            this._pendingSpawnDefs   = spawnDefs;

            // Animate stack button for each spawn cap, after score floats finish
            if (spawnDefs.length > 0) {
                const spawnAnimDelay = scoredCaps.length > 0
                    ? scoredCaps.length * popDelay + 350
                    : 350;
                spawnDefs.forEach((entry, i) => {
                    this.delay(() => this._ui.popStackIcon(entry.def ?? entry), spawnAnimDelay + i * 200);
                });
            }
            // Samme "flyv op til stack-knappen"-animation for en Husk-cap Ballast
            // lige har tilføjet til stacken (se ballastActive/huskGranted ovenfor).
            if (huskGranted) {
                const huskAnimDelay = scoredCaps.length > 0
                    ? scoredCaps.length * popDelay + 350
                    : 350;
                this.delay(() => this._ui.popStackIcon(HUSK_CAP_DEF), huskAnimDelay);
            }

            const bossVetoMsg = bossMult === 0 && actualWon.length > 0 ? ` · ${this._activeBoss.name}: 0pts!` : '';
            const flippedMsg = actualWon.length > 0
                ? `${actualWon.length} flipped · ${updatedFaceDown.length} left${bossVetoMsg}`
                : `Miss! · ${updatedFaceDown.length} left`;
            this._ui.setStatus(miss && actualWon.length === 0
                ? `Miss! · ${updatedFaceDown.length} left`
                : flippedMsg);
            this._ui.setActionPrompt('Tap to continue');
            this._phase = 'ready';
        } else {
            // Unused throws → grow throwSaver multiplier
            if (this._throwsLeft > 0 && this._gs) {
                this._gs.ownedSlammers
                    .filter(s => s.passive?.type === 'throwSaver')
                    .forEach(s => {
                        const p = s.passive;
                        const oldValue = p.currentValue ?? 1.0;
                        p.currentValue = oldValue + this._throwsLeft * p.value;
                        p.description  = `Each unused throw adds ×${p.value} · Current: ×${p.currentValue.toFixed(1)}`;
                        this._ui.showRelicGain(s.texFront, oldValue, p.currentValue, this._throwsLeft);
                    });
            }
            // HALFLIFE: persist earned bonuses for flipped caps, decay unflipped
            if (this._gs) {
                this._halflifeEarned.forEach((earned, capId) => {
                    this._gs.saveHalflifeBonus(capId, earned);
                });
                updatedFaceDown.forEach(cap => {
                    const gsEntry = cap.entryId != null
                        ? this._gs.ownedCaps.find(c => c.id === cap.entryId) : null;
                    if (gsEntry?.enchant !== 'halflife') return;
                    // Consolation: score ½ of stored value, then decay it
                    if (gsEntry.storedBonus > 0) {
                        const consolation = Math.ceil(gsEntry.storedBonus / 2);
                        this._totalScore += consolation;
                        const { x, y } = this._projectToScreen(cap.body.position);
                        this._ui.showScoreFloat(x, y, consolation, [], null);
                    }
                    this._gs.decayHalflifeBonus(cap.entryId);
                });
            }

            // ILLUSIONIST (Whispering Shadow) — hele stakken blev flippet denne runde.
            if (this._gs && updatedFaceDown.length === 0 &&
                (this._gs.ownedSlammers ?? []).some(s => s.passive?.type === 'illusionist')) {
                const slot = this._gs.grantRandomConsumable();
                if (slot !== false && this.onFreeCardGranted) this.onFreeCardGranted(slot);
            }

            this._voltageBonus    = 0;
            this._roundCapBonuses = new Map();
            this._roundCapMultipliers = new Map();
            this._ui.updatePileButtons(updatedFaceDown, this._wonCapsAll, this._geb, this._exhaustedThisRound);

            this._phase = 'done';
            this._ui.setStatus('Round over!');
            this._ui.setActionPrompt('Tap to continue');
            if (this.onRoundEnd) this.onRoundEnd({
                totalScore:  this._scoreBase + this._totalScore,
                capsFlipped: this._wonCapsAll.length,
            });
        }
    }

    // Afgør et Trick Shot-forsøg — kaldes fra _resolveAndScore's fork, aldrig
    // fra normal scoring. Rører aldrig this._gs, this._totalScore eller this._wonCapsAll.
    _resolveTrickShotAttempt(wonCaps, faceDownCaps) {
        const success = resolveTrickShot(this._activeTrickShot.check, wonCaps, faceDownCaps);

        this._throwsLeft = 0;
        this._phase      = 'done';
        this._render.setReticleVisible(false);
        this._ui.setActionPrompt(null);
        this._ui.setStatus(success ? 'Trick Shot cleared!' : 'Trick Shot missed');

        if (this.onTrickShotResolved) this.onTrickShotResolved(success);
    }

    _spawnEffectFeedback(worldPos, screenX, screenY, meta) {
        if (meta.type === 'solo') {
            const color  = meta.qualifies ? 0x4cff88 : 0xff5555;
            const holdMs = meta.qualifies ? 700 : 500;
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, color, holdMs, 350);
        } else if (meta.type === 'neighbours') {
            const holdMs = 180 + meta.count * 200 + 300;
            this._render.spawnEffectRing(worldPos, VERY_NEARBY_RADIUS, 0xffd700, holdMs, 350);
        } else if (meta.type === 'magnet') {
            this._render.spawnEffectRing(worldPos, 10, 0xffaa00, 1400, 500);
        } else if (meta.type === 'rally') {
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, 0x44ffcc, 700, 400);
            (meta.targets ?? []).forEach(pos =>
                this._render.spawnEffectRing(pos, 0.7, 0x44ffcc, 400, 250));
        } else if (meta.type === 'crew') {
            (meta.targets ?? []).forEach(pos =>
                this._render.spawnEffectRing(pos, 0.7, 0xaaffaa, 400, 250));
        } else if (meta.type === 'martyr') {
            // Egen farve (magenta/lilla) — samme NEARBY_RADIUS-ring som rally,
            // men skal ikke se ud som rally, det er en anden effekt (martyr).
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, 0xcc44ff, 700, 400);
            (meta.targets ?? []).forEach(pos =>
                this._render.spawnEffectRing(pos, 0.7, 0xcc44ff, 400, 250));
        } else if (meta.type === 'absorb') {
            if ((meta.bonus ?? 0) > 0) {
                this._render.spawnEffectRing(worldPos, 14, 0xffdd44, 900, 600);
                this._render.spawnEffectRing(worldPos,  7, 0xffffff, 500, 350);
            }
        } else if (meta.type === 'surge') {
            const color  = meta.success ? 0x4cff88 : 0xff5555;
            const holdMs = meta.success ? 600 : 450;
            this._render.spawnEffectRing(worldPos, NEARBY_RADIUS, color, holdMs, 350);
            if (meta.success && meta.targetPos) {
                this._render.spawnEffectRing(meta.targetPos, 1.4, 0xff6622, 300, 200);
            }
        } else if (meta.type === 'destroy') {
            // Ability-udløst permanent fjernelse (jackpot/martyr) — hurtig, mørk
            // "poof"-ring i selve battle-viewet i stedet for en sticker-overlay.
            this._render.spawnEffectRing(worldPos, 2.5, 0x1a1a1a, 350, 300);
            this._render.spawnEffectRing(worldPos, 1.2, 0xff4444, 250, 250);
            audio.play('destroy');
        } else if (meta.type === 'exhaust') {
            // Midlertidig fjernelse (kun denne runde) — grå/tåget ring, bevidst
            // adskilt fra destroys mørke/røde, matcher VERY_NEARBY_RADIUS (det er
            // derfra targets faktisk blev fundet). Selve lyden spilles IKKE her —
            // den skal følge drypvis-fjernelsen pr. cap, se EXHAUST_DRIP_MS-loopet
            // ovenfor, ikke denne ene ring der vises for hele gruppen på én gang.
            this._render.spawnEffectRing(worldPos, VERY_NEARBY_RADIUS, 0x888899, 600, 400);
        }
        this._ui.showEffectIndicator(screenX, screenY, meta);
    }

    _projectToScreen(worldPos, worldRadius = 0) {
        const cam = this._cam.camera;
        const vv  = window.visualViewport;
        const vw  = vv ? vv.width  : window.innerWidth;
        const vh  = vv ? vv.height : window.innerHeight;
        const c   = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z).project(cam);
        const cx  = Math.round((c.x *  0.5 + 0.5) * vw);
        const cy  = Math.round((c.y * -0.5 + 0.5) * vh);
        if (!worldRadius) return { x: cx, y: cy };
        // Project a point offset by worldRadius to get perspective-correct screen size
        const e  = new THREE.Vector3(worldPos.x + worldRadius, worldPos.y, worldPos.z).project(cam);
        const ex = Math.round((e.x * 0.5 + 0.5) * vw);
        return { x: cx, y: cy, r: Math.abs(ex - cx) };
    }

    _popCapMesh(mesh) {
        const start = performance.now();
        const dur   = 300;
        (function tick() {
            const t = Math.min((performance.now() - start) / dur, 1);
            const s = t < 0.40
                ? 1 + (t / 0.40) * 0.50
                : 1.50 * (1 - (t - 0.40) / 0.60);
            mesh.scale.set(s, s, s);
            if (t < 1) requestAnimationFrame(tick);
        })();
    }
}
