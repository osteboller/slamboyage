import { SFX_DEFS, BGM_DEFS } from '../config/audioDefs.js';

const VOL_STORAGE_KEY = 'slamberz_audio_volumes';
// Var 900ms — dengang blev den sat KORT specifikt for at give hurtige klik
// mindre tid til at kollidere med et fade der endnu ikke var færdigt. Den
// bekymring er siden løst rigtigt af _bgmEpoch-mekanismen nedenfor (et
// forældet fade-ud→stop()-kald tjekker nu eksplicit om sporet er blevet
// genstartet imens, uanset hvor lang tid fadet tager) — så en længere,
// blødere fade er tryg at bruge nu, uanset hvor hurtigt man klikker mellem
// skærme. 1800ms føles markant mindre "pludseligt" end 900ms uden at være
// sløvt.
const BGM_FADE_MS = 1800;
// Minimumstid et spor skal have kørt før et NYT playBGM()-kald må afbryde det
// — uden dette kunne hurtig navigation frem og tilbage mellem shop og map
// (fx reroll i shoppen, eller bare browse mellem shop/map/battle) få musikken
// til at flippe mellem shop- og battle-temaet hele tiden i stedet for at få
// lov at "sætte sig". Et blokeret skifte er bare stille — spiller videre
// uændret, indtil et SENERE playBGM()-kald rammer efter minimumstiden er gået.
const MIN_BGM_PLAY_MS = 45000;
// Debounce'en ovenfor gælder KUN skift mellem disse to spor (i begge
// retninger) — det var her "flapper frem og tilbage" problemet reelt opstod.
// menu/boss/failed_run skal stadig altid skifte/fade med det samme, uanset
// hvor længe det forrige spor har kørt (fx en run der lige er tabt skal
// høres med det samme, ikke risikere at blive blokeret af et shop/battle-
// spor der lige er startet).
const DEBOUNCED_BGM_IDS = new Set(['shop', 'battle']);

// Global lyd-singleton — importér `audio` direkte hvor den skal bruges
// (`import { audio } from '.../audio/AudioManager.js'`) i stedet for at sende
// den gennem hver skærms deps-objekt. Samme mønster som CAP_DEFS/EFFECTS-
// registrene: AudioManager er et rent cross-cutting UI-lag uden egen game-
// state, så konstruktør-plumbing gennem alle skærme ville kun være støj.
//
// Bygget oven på Howler (lib/howler.min.js, global window.Howl/window.Howler)
// fremfor rå Web Audio API — Howler håndterer selv mobil-autoplay-unlock
// (afspilning køes automatisk indtil første rigtige bruger-tap) og OGG/MP3-
// format-fallback, så der er ingen grund til at genopfinde det her.
class AudioManager {
    constructor() {
        const savedVol   = this._loadVolumes();
        this._sfxVolume  = savedVol.sfx;
        this._bgmVolume  = savedVol.bgm;

        this._sfx = {};
        for (const [id, def] of Object.entries(SFX_DEFS)) {
            this._sfx[id] = new Howl({ src: def.src, volume: (def.volume ?? 1) * this._sfxVolume });
        }

        // IKKE html5:true — blev prøvet for hurtigere opstart (BGM-filerne er
        // store, bgm_battle er ~4MB), men et almindeligt <audio>-element er
        // skrøbeligt overfor hurtige stop()→play()-cyklusser (browseren kan
        // afvise et play()-kald der kolliderer med et lige-afsluttet pause(),
        // og fejler ofte helt tavst) — det var reelt roden til at BGM nogle
        // gange slet ikke kom tilbage ved hurtig navigation. Web Audio-
        // tilstanden (default) håndterer stop+genstart langt mere robust.
        // Howler køer selv .play()-kald til loading er færdig, så SFX'ernes
        // whenReady()-gate nedenfor er nok — BGM behøver ikke samme garanti,
        // en lille forsinkelse på allerførste afspilning er ikke kritisk.
        this._bgm         = {};
        for (const [id, def] of Object.entries(BGM_DEFS)) {
            this._bgm[id] = new Howl({ src: def.src, loop: true, volume: 0 });
        }
        this._activeBgmId = null;
        // Tidspunkt det nuværende spor rent faktisk STARTEDE (ikke bare blev
        // "bedt om" — se MIN_BGM_PLAY_MS-tjekket i playBGM()).
        this._activeBgmSince = 0;
        // "Generation" pr. spor — bumpes hver gang sporet (gen)startes via
        // next.play() i playBGM(). Et planlagt fade-ud→stop()-kald husker hvilken
        // generation DET tilhørte, og springer stop() over hvis sporet er blevet
        // genstartet (= ny generation) siden — ellers kunne et forældet,
        // forsinket stop-kald dræbe en frisk afspilning af SAMME spor et par
        // hundrede ms efter den startede (fx battle→menu→battle igen, hurtigere
        // end BGM_FADE_MS), hørt som "musikken forsvinder ved Continue".
        this._bgmEpoch = {};
        // Hvilke BGM-spor der er blevet spillet mindst én gang denne session —
        // se randomStart-håndteringen i playBGM(): et spor springer bevidst det
        // tilfældige startpunkt over FØRSTE gang det nogensinde spiller, så man
        // altid hører intro'en mindst én gang, før senere afspilninger begynder
        // et vilkårligt sted.
        this._bgmHeardIds = new Set();

        // Global, delegeret klik-lyd — ALLE <button>-elementer i hele spillet får
        // automatisk 'button_click', uden at nogen skærm selv skal huske at kalde
        // audio.play() ved hver ny knap. To indbyggede overrides, begge helt
        // deklarative (ingen JS-ændring nødvendig andre steder for at bruge dem):
        //   - class="cant-afford" (etableret konvention i ShopScreen/BossShopScreen,
        //     se shop.css) → spiller 'error' i stedet, automatisk.
        //   - data-sfx="X" på selve elementet → spiller lyd X i stedet ("none" for
        //     slet ingen lyd). capThumbnailHTML() sætter fx data-sfx="cap_select"
        //     på alle cap-thumbnails ét sted, så det dækker hele spillet med det samme.
        // 'click' (ikke 'pointerdown') — pointerdown fyrer FØR en scroll-gestus kan
        // skelnes fra et tryk, så et forsøg på at scrolle en liste hen over en knap
        // udløste lyden hver gang uden at der reelt blev klikket. 'click' undertrykkes
        // automatisk af browseren hvis touchet bevæger sig (bliver en scroll), så den
        // rammer kun rigtige, gennemførte tryk — samme grundproblem/løsning som
        // bindTapSelect (se pause-panel) allerede bruger andre steder i koden.
        document.addEventListener('click', e => this._onGlobalClick(e));
    }

    // Resolver når alle SFX (IKKE BGM, se html5-kommentaren ovenfor) enten er
    // loaded eller er fejlet (loaderror) — én manglende/404'et fil skal aldrig
    // kunne blokere spillet fra at starte. Kaldes fra main.js, samme mønster
    // som `await loadTextures(...)`, FØR loading-screenen skjules — retter
    // problemet med at en lyd blev afspillet før filen var klar (kendt fra et
    // tidligere projekt), i stedet for at stole blindt på Howlers interne kø.
    whenReady() {
        const sounds = Object.values(this._sfx);
        return Promise.all(sounds.map(s => new Promise(resolve => {
            if (s.state() === 'loaded') { resolve(); return; }
            s.once('load', resolve);
            s.once('loaderror', resolve);
        })));
    }

    _onGlobalClick(e) {
        const el = e.target.closest('button, [data-sfx]');
        if (!el || el.disabled) return;
        const override = el.dataset.sfx;
        if (override === 'none') return;
        if (override) { this.play(override); return; }
        this.play(el.classList.contains('cant-afford') ? 'error' : 'button_click');
    }

    // opts: { volume, rate } — begge valgfrie, per-afspilning (rører ikke lydens
    // egen standardværdi for næste gang den spiller).
    // rate: tilfældig pitch-variation (±20%, 0.80–1.20) som DEFAULT på hver
    // afspilning — uden det lyder et hyppigt gentaget klik (button_click/
    // cap_select/choice_pop) helt identisk hver gang, hvilket hurtigt bliver
    // robotisk/trættende. Startede på ±10%, men det var for svagt til at
    // mærkes på korte perkussive lyde (fx choice_pop) — øret er dårligere til
    // at opfatte pitch-forskelle på transiente lyde end på holdte toner.
    // opts.rate kan sætte en eksplicit værdi og overstyrer den tilfældige
    // variation.
    play(id, opts = {}) {
        const sound = this._sfx[id];
        if (!sound) return;
        const soundId = sound.play();
        sound.volume((opts.volume ?? 1) * this._sfxVolume, soundId);
        sound.rate(opts.rate ?? (0.80 + Math.random() * 0.40), soundId);
    }

    // Fælles pulje (2 tilfældige varianter) for alt der "popper frem" — reward-
    // choice-reveal og shoppens bånd-række deler samme lyde. Egne navngivne
    // metoder (ikke bare rått play() alle steder) så de to sammenhænge kan
    // adskilles hvis de senere skal lyde forskelligt, uden at røre kaldestederne.
    _playRandomPop() {
        const i = 1 + Math.floor(Math.random() * 2);
        this.play(`pop_${i}`);
    }

    // Kaldes én gang PR. valg der popper frem på skærmen (reward/enchant-reward/
    // chest-reward/mystery-reward/slammer-choice/boss-reward/pack-opening).
    playChoiceReveal() {
        this._playRandomPop();
    }

    // Kaldes én gang PR. cap/kort der popper frem i shoppens bånd-række, se
    // ShopScreen.js's _render().
    playShopPop() {
        this._playRandomPop();
    }

    // Vælger tilfældigt mellem 4 varianter — kaldes når et fyldt forbrugskort-
    // slot klikkes og detail-popup'en åbner, se ConsumableSlots.js.
    playCardPlace() {
        const i = 1 + Math.floor(Math.random() * 4);
        this.play(`card_place_${i}`);
    }

    // Vælger tilfældigt mellem 3 varianter — den vilde spin-animation når en
    // cap flippes (Flipper/surge) eller materialiserer (spawn), se
    // RoundManager.js. rate:1 — spin-animationens egen varighed/juice bærer
    // allerede intensiteten, ingen grund til at sløre den med ekstra pitch.
    playCapFlipper() {
        const i = 1 + Math.floor(Math.random() * 3);
        this.play(`cap_flipper_${i}`, { rate: 1 });
    }

    // Vælger tilfældigt mellem 3 varianter — ambient "flyver vildt afsted"-lyd
    // for et par caps pr. blast, se ThrowController._blast().
    playCapSwoosh() {
        const i = 1 + Math.floor(Math.random() * 3);
        this.play(`cap_swosh_${i}`);
    }

    // ─── BGM ──────────────────────────────────────────────────────────────────
    // Crossfade: forrige spor toner ud, nyt spor toner ind — kaldes fra
    // main.js's showScreen()-router pr. skærm. Ingen effekt hvis samme spor
    // allerede spiller (fx to reward-agtige skærme i træk).
    //
    // Robusthed: Howler GENBRUGER ikke automatisk en allerede-spillende
    // instans når .play() kaldes igen — den lægger en NY instans oven på den
    // gamle. En tidligere version af denne metode stolede på et tidsvindue
    // (fade færdig → stop), men ved hurtig navigation (map→shop→map igen,
    // inden for selve fade-vinduet) kunne SAMME spor blive bedt om at spille
    // igen, før dets forrige instans nåede at blive stoppet — hørtes som to
    // numre oven i hinanden. Løsning: stop ALT andet BGM eksplicit hver gang,
    // i stedet for at regne på timing.
    playBGM(id) {
        if (!id || id === this._activeBgmId) return;
        const next = this._bgm[id];
        if (!next) return;

        // Det nuværende spor har ikke kørt længe nok endnu — ignorer skiftet
        // stille, bliv på det nuværende. Gælder kun shop↔battle (se
        // DEBOUNCED_BGM_IDS) — alle andre spor skifter altid med det samme.
        // _activeBgmId er null ved den ALLERførste afspilning nogensinde
        // (intet at afbryde), så den går altid igennem.
        const now = performance.now();
        const isDebouncedPair = this._activeBgmId
            && DEBOUNCED_BGM_IDS.has(this._activeBgmId)
            && DEBOUNCED_BGM_IDS.has(id);
        if (isDebouncedPair && now - this._activeBgmSince < MIN_BGM_PLAY_MS) return;

        const prevId = this._activeBgmId;
        this._activeBgmId    = id;
        this._activeBgmSince = now;

        Object.entries(this._bgm).forEach(([bid, howl]) => {
            if (bid === id || !howl.playing()) return;
            if (bid === prevId) {
                // Det spor der faktisk var hørbart lige nu — blød fade-ud. Husker
                // DENNE generation af sporet — hvis det bliver genstartet (ny
                // generation) før fade'et når at fuldføre, skal dette forældede
                // stop-kald IKKE dræbe den nye afspilning (se _bgmEpoch ovenfor).
                const epoch = this._bgmEpoch[bid] ?? 0;
                howl.fade(howl.volume(), 0, BGM_FADE_MS);
                howl.once('fade', () => {
                    if ((this._bgmEpoch[bid] ?? 0) === epoch) howl.stop();
                });
            } else {
                // Enhver anden efterladt/spøgelses-instans (fx en tidligere
                // 'next' der aldrig nåede at blive registreret som prevId,
                // se ovenstående race) — stoppes med det samme, tavst.
                howl.stop();
            }
        });

        // Garanterer at 'next' selv ikke har en efterladt instans kørende
        // (fx hvis DEN var en 'prev' der endnu ikke var nået at blive
        // stoppet) — uden dette kunne .play() lægge en frisk instans oven på
        // en gammel, stadig-fadende-ud instans af SAMME spor.
        if (next.playing()) next.stop();
        this._bgmEpoch[id] = (this._bgmEpoch[id] ?? 0) + 1;

        // seek() kræver at filen faktisk er loaded (duration() ellers 0) — vent
        // til 'play' rent faktisk er fyret (Howler køer selv play() til load er
        // færdig), så et tilfældigt startpunkt altid rammer inden for sporets
        // reelle længde. Springes over hvis dette er FØRSTE gang sporet nogensinde
        // spiller denne session (se _bgmHeardIds) — fx battle-temaets intro skal
        // altid høres mindst én gang, før senere afspilninger starter tilfældigt.
        if (BGM_DEFS[id]?.randomStart && this._bgmHeardIds.has(id)) {
            next.once('play', () => next.seek(Math.random() * next.duration()));
        }
        this._bgmHeardIds.add(id);
        next.volume(0);
        next.play();
        next.fade(0, this._bgmVolume, BGM_FADE_MS);
    }

    stopBGM() {
        const curId = this._activeBgmId;
        const cur   = curId ? this._bgm[curId] : null;
        this._activeBgmId = null;
        if (cur?.playing()) {
            const epoch = this._bgmEpoch[curId] ?? 0;
            cur.fade(cur.volume(), 0, BGM_FADE_MS);
            cur.once('fade', () => {
                if ((this._bgmEpoch[curId] ?? 0) === epoch) cur.stop();
            });
        }
    }

    // ─── VOLUME (burger-menu slidere) ──────────────────────────────────────────
    setSfxVolume(v) {
        this._sfxVolume = Math.max(0, Math.min(1, v));
        Object.values(this._sfx).forEach(s => s.volume(this._sfxVolume));
        this._saveVolumes();
    }

    setBgmVolume(v) {
        this._bgmVolume = Math.max(0, Math.min(1, v));
        const cur = this._activeBgmId ? this._bgm[this._activeBgmId] : null;
        if (cur?.playing()) cur.volume(this._bgmVolume);
        this._saveVolumes();
    }

    getSfxVolume() { return this._sfxVolume; }
    getBgmVolume() { return this._bgmVolume; }

    _loadVolumes() {
        try {
            const raw = localStorage.getItem(VOL_STORAGE_KEY);
            if (!raw) return { sfx: 1, bgm: 0.6 };
            const parsed = JSON.parse(raw);
            return {
                sfx: typeof parsed.sfx === 'number' ? parsed.sfx : 1,
                bgm: typeof parsed.bgm === 'number' ? parsed.bgm : 0.6,
            };
        } catch {
            return { sfx: 1, bgm: 0.6 };
        }
    }

    _saveVolumes() {
        try {
            localStorage.setItem(VOL_STORAGE_KEY, JSON.stringify({ sfx: this._sfxVolume, bgm: this._bgmVolume }));
        } catch { /* privat browsing e.l. — ikke kritisk, bare ikke persisteret */ }
    }
}

export const audio = new AudioManager();
