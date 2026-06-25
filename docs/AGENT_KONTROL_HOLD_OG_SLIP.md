# Agent-opgave: Hold-og-slip kontrol (mobil-sikker)

## ⚠️ Vigtigt: Læs dette inden du rører nogen filer

Denne prompt er skrevet med udgangspunkt i en tidligere version af kodebasen. Den aktuelle kodebase er refaktoreret — logik der tidligere lå i `src/main.js` er sandsynligvis flyttet ud i separate moduler, og filstrukturen kan afvige fra hvad prompten antager.

**Gør følgende inden du implementerer:**

1. Læs den aktuelle filstruktur (`src/` og underkataloger)
2. Find hvor input-callbacks (`onShot`, `onAim` eller tilsvarende) aktuelt er defineret og kobles op
3. Find hvor game-fase-logikken (`phase === 'idle'`, `phase === 'ready'` osv.) aktuelt lever
4. Brug den aktuelle struktur som facit — ikke linjeanvisningerne i denne prompt

Kodeeksemplerne og den beskrevne logik er korrekte. Det er **placeringen** der kan være forældet. Tilpas implementeringen til den struktur du finder, og bevar modulgrænserne der allerede er etableret.

---

Implementér en ny inputmekanik i Slamberz hvor spilleren **holder fingeren/musen nede for at sigte og slipper for at kaste** — i stedet for det nuværende enkelt-klik. Opgaven berører `src/input/InputManager.js`, den fil hvor input-callbacks kobles op (tidligere `src/main.js`), samt tre linjer CSS i `styles.css`. Ingen andre filer røres.

---

## Baggrund og motivation

Det nuværende flow er:
1. Klik → frys power bar → retikel placeres → slammer spawner efter delay

Det nye flow er:
1. **Tryk ned** → retikel vises og følger fingeren/musen (power bar kører stadig frit)
2. **Flyt** (med nede) → retikel opdateres løbende
3. **Slip** → frys power bar på det tidspunkt + kast mod sidst kendte position

Et **kort tap** (under `TAP_MS` millisekunder) bruges til "klik for at fortsætte"-handlinger (`ready`- og `done`-faserne) — præcis som det nuværende enkelt-klik.

---

## Fil 1: `src/input/InputManager.js`

Denne fil eksisterer sandsynligvis uændret fra den gamle struktur. **Erstat hele filen** med følgende indhold:

```js
export class InputManager {
    constructor(domElement, camera) {
        // Callbacks sat af main.js
        this.onAimStart = null; // (x, y, z) — finger/mus trykkes ned i idle-fasen
        this.onAimMove  = null; // (x, y, z) — finger/mus bevæges mens nede i idle-fasen
        this.onRelease  = null; // (x, y, z) — finger/mus slippes efter hold → kast
        this.onTap      = null; // (x, y, z) — kort tap → "fortsæt"-handling (ready/done)

        // Sættes af main.js: returnerer cap-meshes der kan rammes
        this.getHittableObjects = null; // () => THREE.Object3D[]

        const TAP_MS = 200; // Taps kortere end dette = fortsæt-handling; længere = hold-og-sig

        const ray   = new THREE.Raycaster();
        const mVec  = new THREE.Vector2();
        const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        let isDown   = false;
        let downTime = 0;
        let lastHit  = null;

        const raycastWorld = (e) => {
            // Brug første touch-punkt hvis tilgængeligt (mobil)
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            mVec.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
            ray.setFromCamera(mVec, camera);

            // 1. Forsøg raycast mod cap-meshes — giver korrekt XZ når man sigter på stakken
            if (this.getHittableObjects) {
                const objects = this.getHittableObjects();
                if (objects.length > 0) {
                    const hits = ray.intersectObjects(objects, false);
                    if (hits.length > 0) return hits[0].point;
                }
            }

            // 2. Fallback: gulvplanet ved y = 0
            const hit = new THREE.Vector3();
            return ray.ray.intersectPlane(floor, hit) ? hit : null;
        };

        domElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.pointerType !== 'touch') return; // kun primær knap
            e.preventDefault(); // forhindrer long-press context menu og scroll
            isDown   = true;
            downTime = performance.now();
            const hit = raycastWorld(e);
            if (hit) {
                lastHit = hit;
                if (this.onAimStart) this.onAimStart(hit.x, hit.y, hit.z);
            }
        }, { passive: false }); // passive: false er påkrævet for at preventDefault virker

        domElement.addEventListener('pointermove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const hit = raycastWorld(e);
            if (hit) {
                lastHit = hit;
                if (this.onAimMove) this.onAimMove(hit.x, hit.y, hit.z);
            }
        }, { passive: false });

        domElement.addEventListener('pointerup', (e) => {
            if (!isDown) return;
            e.preventDefault();
            isDown = false;
            const held = performance.now() - downTime;
            if (held < TAP_MS) {
                // Kort tap → bruges til ready/done-fase-klik
                if (this.onTap) this.onTap(lastHit?.x, lastHit?.y, lastHit?.z);
            } else {
                // Hold-og-slip → kast
                if (this.onRelease && lastHit) this.onRelease(lastHit.x, lastHit.y, lastHit.z);
            }
        }, { passive: false });

        // Afbryd hvis fingeren forlader canvas-området (f.eks. swipe ud af kanten)
        domElement.addEventListener('pointercancel', () => {
            isDown = false;
        });
    }
}
```

---

## Fil 2: Filen hvor input-callbacks kobles op

I den gamle kodebase lå dette i `src/main.js`. I den refaktorerede version kan det ligge i et andet modul — find filen ved at søge efter `input.onShot` eller `input.onAim`. Det er den fil du skal ændre.

### Ændring A — erstat `input.onAim` og `input.onShot` med fire nye callbacks

Find og **slet** denne blok (eksakt placering afhænger af din aktuelle filstruktur):

```js
// Sættes til true efter done-faseklik for at undertrykke det syntetiske
// mousemove mobilbrowsere fyrer umiddelbart efter pointerdown
let suppressNextAim = false;

input.onAim = (x, y, z) => {
    if (suppressNextAim) { suppressNextAim = false; return; }
    if (phase === 'idle') {
        render.setReticlePosition(x, y, z);
        render.setReticleVisible(true);
    }
};

// Klik → frys power, vis retikel på mål, gå til 'aiming'-fase
// Klik under 'done' starter næste runde direkte (ingen knap nødvendig)
input.onShot = (x, y, z) => {
    if (ui.isOverlayOpen()) { suppressNextAim = true; return; }
    if (phase === 'ready') { suppressNextAim = true; applyRestack(); return; }
    if (phase === 'restacking') return;
    if (phase === 'done') { suppressNextAim = true; buildStack(); return; }
    if (phase !== 'idle') return;
    powerBar.freeze();
    shotSpeed = powerBar.getMappedSpeed();
    shotMass  = ui.getMass();
    pendingX  = x;
    pendingY  = y;
    pendingZ  = z;

    render.setReticlePosition(pendingX, pendingY, pendingZ);
    render.setReticleVisible(true);
    cam.zoomOut(); // Begynd zoom under 1-sekunders pausen så kameraet er klar til action

    phase       = 'aiming';
    aimingStart = performance.now();
    ui.setActionPrompt(null);
    ui.setStatus('Sigter...');
};
```

**Indsæt i stedet** følgende blok på samme sted:

```js
// suppressNextAim er ikke længere nødvendig — hold-og-slip undgår naturligt
// de spurious mousemove-events browsere fyrer efter pointerdown.

// Finger/mus trykkes ned — vis retikel og begynd at spore position
input.onAimStart = (x, y, z) => {
    if (ui.isOverlayOpen()) return;
    if (phase !== 'idle') return;
    pendingX = x; pendingY = y; pendingZ = z;
    render.setReticlePosition(x, y, z);
    render.setReticleVisible(true);
};

// Finger/mus bevæges mens nede — opdater retikel løbende
input.onAimMove = (x, y, z) => {
    if (phase !== 'idle') return;
    pendingX = x; pendingY = y; pendingZ = z;
    render.setReticlePosition(x, y, z);
};

// Finger/mus slippes efter hold → frys power og kast
input.onRelease = (x, y, z) => {
    if (ui.isOverlayOpen()) return;
    if (phase !== 'idle') return;
    pendingX = x; pendingY = y; pendingZ = z;
    powerBar.freeze();
    shotSpeed = powerBar.getMappedSpeed();
    shotMass  = ui.getMass();
    render.setReticlePosition(pendingX, pendingY, pendingZ);
    render.setReticleVisible(true);
    cam.zoomOut();
    phase       = 'aiming';
    aimingStart = performance.now();
    ui.setActionPrompt(null);
    ui.setStatus('Sigter...');
};

// Kort tap → fortsæt-handling afhængig af fase
input.onTap = (x, y, z) => {
    if (ui.isOverlayOpen()) return;
    if (phase === 'ready')      { applyRestack(); return; }
    if (phase === 'restacking') return;
    if (phase === 'done')       { buildStack();   return; }
};
```

### Ændring B — fjern `suppressNextAim`-variablen

Find og slet variabeldeklarationen (søg på `suppressNextAim` i hele `src/`):
```js
let suppressNextAim = false;
```

Fjern også alle steder variablen bruges — typisk `suppressNextAim = true;` i restack- og buildStack-funktioner.

> **Tjek**: Søg på `suppressNextAim` i hele `src/` efter ændringerne — der må ikke forekomme en eneste reference.

---

## Fil 3: `styles.css`

Find eksisterende `#canvas-container`-regel og **tilføj** tre linjer:

```css
#canvas-container {
    width: 100vw;
    height: 100vh;
    touch-action: none;
    user-select: none;              /* tilføj */
    -webkit-user-select: none;      /* tilføj */
    -webkit-touch-callout: none;    /* tilføj — iOS long-press menu */
}
```

---

## Verifikation efter implementering

Test følgende scenarier manuelt (mobilbrowser eller DevTools touch-emulering):

| Scenarie | Forventet adfærd |
|---|---|
| Tryk ned og hold → bevæg finger → slip | Retikel følger finger. Slammer kastes mod sidst kendte position. Power frystes ved slip. |
| Hurtigt tap på banen i idle | Intet sker (for kort til at registreres som kast) |
| Tap i `ready`-fase | Restack sker |
| Tap i `done`-fase | Ny runde starter |
| Hold 2+ sekunder uden at bevæge sig | Intet zoom/context menu — browseren forstyrrer ikke |
| Slip finger uden for canvas-området | Kast annulleres stille (`pointercancel`) |
| Desktop — klik og hold → bevæg mus → slip | Samme adfærd som mobil |

---

## Hvad der ikke ændres

- Power bar mekanik: kører stadig frit i `idle`, frystes stadig ved slip
- `getHittableObjects`-wiring: uændret
- Alle andre faser (`falling`, `blasted`, `settling`, `restacking`): uændret
- `buildStack()`, `applyRestack()`, `endThrow()`: uændret (bortset fra fjernelse af `suppressNextAim`)
- Ingen nye konstanter i `constants.js` — `TAP_MS = 200` er defineret lokalt i `InputManager` da den er ren UI-mekanik uden fysik-relevans
