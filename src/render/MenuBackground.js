import { CAP_DEFS, POG_R, POG_H } from '../config/constants.js';

// Dekorativ "juice" til hovedmenuen — svævende, halvgennemsigtige caps bag
// menu-teksten. Egen SCENE + eget kamera (ikke render.scene/render.camera,
// som bruges til selve kampen) — undgår enhver risiko for at et dekorativt
// mesh nogensinde ved et uheld dukker op i selve gameplayet, og kræver ingen
// separat WebGL-kontekst, da samme renderer/canvas genbruges.
// Var 40000 (20s op + 20s ned) — følte sig for hektisk, antallet steg for
// hurtigt og caps blev bedt om at fade ud igen for tidligt. 100s (50+50) giver
// en langt mere rolig, ambient rytme, mere passende til noget der bare skal
// summe roligt i baggrunden af en menu, ikke trække opmærksomhed til sig.
const CYCLE_MS      = 100000; // 50s op + 50s ned, trekant-bølge
const MIN_CAPS      = 1;
const MAX_CAPS      = 9;
const SPAWN_CHECK_MS = 550; // hvor tit vi tjekker om antallet skal justeres
const FADE_MS       = 900;
// Synligt område (halv-udstrækning) + hvor langt udenfor det caps spawner/
// fjernes — caps flyver ind fra en tilfældig kant og ud i den modsatte ende
// (eller skråt til siden), i stedet for bare at vippe på stedet.
const VIEW_X      = 15;
const VIEW_Y      = 9;
const EDGE_MARGIN = 2;

export class MenuBackground {
    constructor(renderer, texCache) {
        this._renderer = renderer;
        this._texCache = texCache;

        this._scene  = new THREE.Scene();
        // Matcher --clr-bg (lyst tema) — uden dette clearer renderer'en til sort
        // (WebGLRenderer's default), som ville give et hakket resultat sammen
        // med den lyse CSS-overlay på #start-screen.
        this._scene.background = new THREE.Color(0xf9f9f9);
        this._camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
        this._camera.position.set(0, 0, 16);
        this._camera.lookAt(0, 0, 0);

        this._scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dir = new THREE.DirectionalLight(0xffffff, 0.5);
        dir.position.set(3, 4, 6);
        this._scene.add(dir);

        this._caps          = []; // se _spawnCap() for shape
        this._running        = false;
        this._animId          = null;
        this._startTime       = 0;
        this._lastSpawnCheck  = 0;
        this._lastFrame       = 0;

        this._onResize = () => {
            this._camera.aspect = innerWidth / innerHeight;
            this._camera.updateProjectionMatrix();
        };

        // Genbrugte temp-objekter til rotationsopbygningen i _animateCaps() —
        // undgår at allokere 4 nye Quaternion/Vector3 pr. cap, hvert frame.
        this._qSpin    = new THREE.Quaternion();
        this._qWobbleX = new THREE.Quaternion();
        this._qWobbleY = new THREE.Quaternion();
        this._qResult  = new THREE.Quaternion();
        this._axisX = new THREE.Vector3(1, 0, 0);
        this._axisY = new THREE.Vector3(0, 1, 0);
        this._axisZ = new THREE.Vector3(0, 0, 1);
    }

    start() {
        if (this._running) return;
        this._running   = true;
        this._startTime = performance.now();
        this._lastFrame = this._startTime;
        window.addEventListener('resize', this._onResize);
        this._loop();
    }

    stop() {
        this._running = false;
        if (this._animId != null) cancelAnimationFrame(this._animId);
        this._animId = null;
        window.removeEventListener('resize', this._onResize);
        this._caps.forEach(c => this._disposeCap(c));
        this._caps = [];
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _loop() {
        if (!this._running) return;
        this._animId = requestAnimationFrame(() => this._loop());

        const now = performance.now();
        const dt  = Math.min(0.05, (now - this._lastFrame) / 1000);
        this._lastFrame = now;

        this._maybeAdjustCount(now);
        this._animateCaps(now, dt);
        this._renderer.render(this._scene, this._camera);
    }

    // Trekant-bølge 0→1→0 over CYCLE_MS — antal caps stiger fra MIN til MAX
    // over første halvdel, falder tilbage over anden halvdel, looper for evigt.
    _targetCount(elapsedMs) {
        const t    = (elapsedMs % CYCLE_MS) / CYCLE_MS;
        const wave = t < 0.5 ? t * 2 : (1 - t) * 2;
        return Math.round(MIN_CAPS + wave * (MAX_CAPS - MIN_CAPS));
    }

    _maybeAdjustCount(now) {
        if (now - this._lastSpawnCheck < SPAWN_CHECK_MS) return;
        this._lastSpawnCheck = now;

        const target = this._targetCount(now - this._startTime);
        // "Levende" = ikke allerede i gang med at fade ud (dem tæller vi ikke
        // med, de er på vej væk uanset).
        const alive = this._caps.filter(c => c.fade !== 'out').length;

        if (alive < target) {
            this._caps.push(this._spawnCap());
        } else if (alive > target) {
            const victim = this._caps.find(c => c.fade !== 'out');
            if (victim) victim.fade = 'out';
        }
    }

    _spawnCap() {
        // Undgår dubletter blandt de caps der er aktive lige nu (udelukker ikke
        // caps der allerede fader ud — de er stadig synlige indtil de er helt
        // væk). Med 100+ mulige caps og maks 9 samtidig er der rigelig plads,
        // så poolen kan aldrig løbe tør.
        const activeNames = new Set(this._caps.map(c => c.defName));
        const pool = CAP_DEFS.filter(d => !activeNames.has(d.name));
        const def  = pool[Math.floor(Math.random() * pool.length)];
        const tex  = url => url ? this._texCache[url] : null;
        // ×3.4 — ved kameraets afstand (16, caps ligger -6 til -15 væk) var
        // caps i ægte POG_R-størrelse nærmest usynlige. Dekorativ baggrund har
        // ingen grund til at matche ægte gameplay-cap-størrelse.
        const r = POG_R * 3.4, h = POG_H * 3.4;
        // depthWrite:true (IKKE false) — hver cap skal opføre sig SOLID overfor
        // andre caps (okkludere dem normalt via depth-bufferen), kun selve
        // gennemsigtigheden mod BAGGRUNDEN er ønsket. Med false blandede
        // overlappende caps sig visuelt sammen (kunne se ÉN cap IGENNEM en
        // anden), hvilket ikke var meningen.
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(r, r, h, 24),
            [
                new THREE.MeshStandardMaterial({ color: 0xe0dbd2, transparent: true, opacity: 0, depthWrite: true }),
                tex(def.texFront)
                    ? new THREE.MeshStandardMaterial({ map: tex(def.texFront), transparent: true, opacity: 0, depthWrite: true })
                    : new THREE.MeshStandardMaterial({ color: def.color, transparent: true, opacity: 0, depthWrite: true }),
                tex(def.texBack)
                    ? new THREE.MeshStandardMaterial({ map: tex(def.texBack), transparent: true, opacity: 0, depthWrite: true })
                    : new THREE.MeshStandardMaterial({ color: 0xb0a89a, transparent: true, opacity: 0, depthWrite: true }),
            ]
        );

        // Spawner lige udenfor en tilfældig kant (bund/top/venstre/højre) med en
        // retning der primært peger IND over skærmen og videre ud i den anden
        // ende (eller skråt til siden) — "flyver ind fra bunden og ud i toppen
        // eller til højre osv", IKKE bare en vippen på stedet. Z er bevidst
        // FAST (ingen kode ændrer den efter spawn) — ingen bevægelse ind/ud af
        // skærmen, kun de to akser der faktisk blev bedt om.
        const edge   = Math.floor(Math.random() * 4); // 0=bund 1=top 2=venstre 3=højre
        const spread = Math.PI * 0.6; // hvor meget retningen kan afvige fra "lige over"
        const speed  = 1.0 + Math.random() * 1.0; // units/sek
        let x, y, angle;
        if (edge === 0)      { x = (Math.random() - 0.5) * VIEW_X * 2; y = -VIEW_Y - EDGE_MARGIN; angle =  Math.PI / 2 + (Math.random() - 0.5) * spread; }
        else if (edge === 1) { x = (Math.random() - 0.5) * VIEW_X * 2; y =  VIEW_Y + EDGE_MARGIN; angle = -Math.PI / 2 + (Math.random() - 0.5) * spread; }
        else if (edge === 2) { x = -VIEW_X - EDGE_MARGIN; y = (Math.random() - 0.5) * VIEW_Y * 2; angle =  0          + (Math.random() - 0.5) * spread; }
        else                 { x =  VIEW_X + EDGE_MARGIN; y = (Math.random() - 0.5) * VIEW_Y * 2; angle =  Math.PI     + (Math.random() - 0.5) * spread; }

        const z = -6 - Math.random() * 9; // altid bag menu-teksten (kamera ved z=16)
        mesh.position.set(x, y, z);

        // VIGTIGT: CylinderGeometry's akse ligger langs LOKAL Y (lodret) — de to
        // flade "cap"-ender (front/bag-teksturerne) vender langs ±Y, IKKE langs Z.
        // Kameraet her kigger langs Z (portræt-agtigt, ikke ovenfra som selve
        // spillets kamera) — uden en grundrotation ser man derfor ALTID kun den
        // tynde cylinder-rand (siden), aldrig den trykte flade, uanset hvor lidt
        // man wobbler om Y bagefter. Basen roterer 90° om X, så lokal Y (front)
        // eller lokal -Y (bagside) peger mod kameraets Z-akse.
        const showBack = Math.random() >= 0.85;
        const qBase = new THREE.Quaternion().setFromAxisAngle(this._axisX, showBack ? -Math.PI / 2 : Math.PI / 2);
        mesh.quaternion.copy(qBase);
        this._scene.add(mesh);

        return {
            mesh, qBase,
            defName: def.name, // se dublet-tjekket øverst i denne funktion
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.3 + Math.random() * 0.3,
            wobbleAmpX:  0.18 + Math.random() * 0.12, // radianer, ±~10-17°
            wobbleAmpY:  0.15 + Math.random() * 0.12,
            spinPhase: Math.random() * Math.PI * 2,
            spinSpeed: (Math.random() - 0.5) * 0.5, // rad/s — spin OM kameraets egen Z-akse (se _animateCaps), ændrer aldrig hvilken flade der vender frem
            targetOpacity: 0.5 + Math.random() * 0.3,
            opacity: 0,
            fade: 'in', // 'in' | 'steady' | 'out'
            // Sandt første gang den rent faktisk er inde i synsfeltet — se
            // _animateCaps()'s "off"-tjek. Den SPAWNER jo bevidst udenfor
            // VIEW_X/VIEW_Y (det er hele "flyv ind udefra"-idéen), så uden
            // dette flag ville den blive markeret "på vej ud" i samme frame
            // den blev født, længe før den nåede ind i billedet.
            hasEntered: false,
        };
    }

    _animateCaps(now, dt) {
        for (let i = this._caps.length - 1; i >= 0; i--) {
            const c = this._caps[i];

            c.mesh.position.x += c.vx * dt;
            c.mesh.position.y += c.vy * dt;

            // Quaternions (ikke Euler .rotation.x/y/z) — undgår sammensætnings-
            // fejl hvor en stor Z-spin kombineret med selv en lille X/Y-wobble
            // kan give helt uforudsigelige nettoorienteringer (det var netop
            // sådan den forrige Euler-version endte med at vise kanten det
            // meste af tiden, selvom hver enkelt akse-værdi var lille). Hver
            // rotation beregnes frisk om VERDENS-akser hvert frame (ingen
            // akkumuleret drift) og sammensættes i rækkefølgen: grundvending
            // (front/bagside mod kamera) → spin om kameraets EGEN Z-akse
            // (ændrer aldrig hvilken flade der vender frem) → let wobble om
            // verdens X/Y (giver et blødt "rock", stadig næsten front-på).
            const t  = (now - this._startTime) / 1000;
            const wt = t * c.wobbleSpeed + c.wobblePhase;
            this._qSpin.setFromAxisAngle(this._axisZ, t * c.spinSpeed + c.spinPhase);
            this._qWobbleX.setFromAxisAngle(this._axisX, Math.sin(wt) * c.wobbleAmpX);
            this._qWobbleY.setFromAxisAngle(this._axisY, Math.cos(wt * 0.85) * c.wobbleAmpY);
            this._qResult.copy(this._qWobbleY).multiply(this._qWobbleX).multiply(this._qSpin).multiply(c.qBase);
            c.mesh.quaternion.copy(this._qResult);

            // Krydset ud af det synlige område — udløser en fade-out (samme
            // mekanisme som _maybeAdjustCount() bruger til at tynde ud), IKKE
            // et instant klip. Den fortsætter med at flyve videre ud i
            // margin-zonen (EDGE_MARGIN) mens den fader — ved normal fart
            // (1-2 units/sek) og FADE_MS's varighed er den for længst udenfor
            // synsfeltet inden opaciteten når 0, så selve fjernelsen (nedenfor,
            // når opacity<=0) sker usynligt uanset. Før var dette et instant
            // dispose, som (nu hvor de fleste caps flyver hele vejen ud i stedet
            // for at blive tyndet ud undervejs, se CYCLE_MS) var blevet den
            // DOMINERENDE fjernelsesvej — så størstedelen så ud til bare at
            // "klippe ud" i stedet for at fade, selvom fade-koden fandtes.
            const inside = Math.abs(c.mesh.position.x) <= VIEW_X && Math.abs(c.mesh.position.y) <= VIEW_Y;
            if (inside) c.hasEntered = true;
            // KUN caps der faktisk har været synlige mindst én gang kan blive
            // markeret "på vej ud" — ellers ville en frisk cap (som bevidst
            // SPAWNER udenfor VIEW_X/VIEW_Y) blive fadet ud i samme frame den
            // blev født, længe før den nåede ind i billedet.
            if (c.hasEntered && !inside && c.fade !== 'out') c.fade = 'out';

            const fadeStep = dt * (1000 / FADE_MS);
            if (c.fade === 'in') {
                c.opacity = Math.min(c.targetOpacity, c.opacity + fadeStep * c.targetOpacity);
                if (c.opacity >= c.targetOpacity) c.fade = 'steady';
            } else if (c.fade === 'out') {
                c.opacity = Math.max(0, c.opacity - fadeStep * c.targetOpacity);
                if (c.opacity <= 0) {
                    this._disposeCap(c);
                    this._caps.splice(i, 1);
                    continue;
                }
            }
            c.mesh.material.forEach(m => { m.opacity = c.opacity; });
        }
    }

    _disposeCap(c) {
        this._scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        c.mesh.material.forEach(m => m.dispose());
    }
}
