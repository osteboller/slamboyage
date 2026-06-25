# Holo foil strategy — Slamberz caps

## Baggrund og vision

Rigtige 90'er POG/mælkekaps-caps har holografisk folie som en separat fysisk komponent bag motivet. Folien er uafhængig af motivet — den kan have sin egen farve og sit eget mønster, og den skinner igennem der hvor motivet er transparent. Dette system gengiver den mekanik digitalt.

Alle caps i Slamberz har **potentiale for holo/foil finish**. En cap starter typisk uden holo (`holo: null`) og kan opgraderes under et run, købes holo i shoppen, eller komme som en særlig foil-variant fra start.

---

## Tre-lags kompositionsmodel

Hvert cap-face (forside og bagside) komponeres af tre uafhængige lag i `buildCapFaceTexture(def)`:

```
┌─────────────────────────────────┐
│  LAG 3 — Motiv (forrest)        │  PNG med transparent baggrund
│  Kan aldrig overskrives af holo │  texMotif / texMotifBack
├─────────────────────────────────┤
│  LAG 2 — Holo overlay           │  Proceduralt genereret canvas
│  null = usynlig                 │  Opgraderes under run / i shop
│  Blender med screen/overlay     │
├─────────────────────────────────┤
│  LAG 1 — Baggrund (bageste)     │  Solid farve eller mønster
│  Altid synlig                   │  bgColor + bgPattern i cap-def
│  Erstattes visuelt af holo      │
└─────────────────────────────────┘
```

Alle tre lag composites til **ét enkelt `CanvasTexture`** — Three.js ser aldrig lagene, kun det færdige resultat. Nul ændringer i fysik, render-loop eller materialesystem.

### Hvornår bruges originale PNG vs. tre-lags?

```js
// Ingen holo → brug original PNG direkte, ingen ekstra beregning
if (!def.holo) return texCache[def.texFront];

// Holo aktiv → composer alle tre lag
return buildCapFaceTexture(def, texCache);
```

---

## Cap-def struktur

```js
// constants.js — komplet cap-definition med holo-support
{
    series:      'scary_skullz',
    name:        'Jebus Skull',
    mass:        1.0,
    bounce:      0.3,

    // Originale PNG'er (bruges når holo: null)
    texFront:    'assets/caps/scary_skullz/01_jebus_skull.png',
    texBack:     'assets/caps/scary_skullz/01_jebus_skull_b.png',

    // Tre-lags system (bruges når holo er aktiv)
    texMotif:    'assets/caps/scary_skullz/01_jebus_skull_motif.png',  // transparent baggrund
    texMotifBack: null,  // bagside deles ofte inden for serie → series_back_motif.png

    bgColor:     '#1a0a2e',   // synlig når holo: null og ingen texFront
    bgPattern:   'stars',     // valgfrit mønster på baggrundslaget

    // Holo-definition — null = ingen holo
    holo: null,
    // Eksempel med holo aktiv:
    // holo: {
    //     palette:   'rainbow',   // se paletter nedenfor
    //     pattern:   'checker',   // se mønstre nedenfor
    //     intensity: 0.75,        // 0.0–1.0
    // },
}
```

---

## Holo-parametere

### `palette` — farvetoning af folien

Styrer hvilke farver spektret drejer rundt om. Kombineres med diffraktionseffekten.

| Navn | Beskrivelse | Eksempel-cap |
|------|-------------|--------------|
| `rainbow` | Fuldt spektrum, ingen farvetoning | Bowler, Space Precinct |
| `prismatic` | Fuld regnbue med høj mætning | Sticky (krydsede knogler) |
| `fire` | Rød/orange/guld dominans | Dragon Lord (rød) |
| `ice` | Blå/cyan/hvid dominans | — |
| `venom` | Lilla/grøn galakse | Poison (første cap) |
| `gold` | Guld/amber glitter | T-Lex (skæl-baggrund) |
| `void` | Mørk lilla/sort med gnister | — |
| `aurora` | Grøn/lilla nordlys | — |

### `pattern` — geometrisk præg i folien

Det underliggende mønster i folien der skaber retningsbevægelse i lyset.

| Navn | Beskrivelse | Eksempel-cap |
|------|-------------|--------------|
| `smooth` | Ingen mønster — ren diffraktion | Dragon Lord, T-Lex |
| `checker` | Skakternet | Sticky, Jebus Skull |
| `triangles` | Trekant-tessellering | United United |
| `stars` | Stjerne-/glitter-punkter | POG (hunden), Sugar Skull |
| `scales` | Reptil/havfrue-skæl | Unicorn (bund-højre) |
| `radial` | Koncentriske ringe fra centrum | Bowler |
| `lines` | Parallelle linjer / striber | — |
| `diamonds` | Diamant-gitter | — |

### `intensity` — styrke

`0.0` = holo usynlig (svarer til `holo: null`), `1.0` = fuld holo-effekt, baggrund næsten ikke synlig. Typisk `0.6–0.85` for en autentisk look.

---

## Kombinationsrum

Med 8 paletter × 8 mønstre = **64 unikke holo-typer** fra dag ét, og systemet er uendeligt udvidbart da begge dimensioner bare er nye generator-funktioner.

Eksempler på caps fra referenceark kortlagt til parametere:

| Cap | palette | pattern | intensity |
|-----|---------|---------|-----------|
| Poison (galakse) | `venom` | `smooth` | 0.85 |
| Sticky (knogler) | `prismatic` | `checker` | 0.80 |
| Galactic Bad Guys | `rainbow` | `stars` | 0.75 |
| Dragon Lord (rød) | `fire` | `smooth` | 0.90 |
| T-Lex | `gold` | `scales` | 0.70 |
| Bowler | `rainbow` | `radial` | 0.75 |
| Sugar Skull | `prismatic` | `stars` | 0.85 |
| United United | `rainbow` | `triangles` | 0.70 |
| Unicorn | `aurora` | `scales` | 0.75 |

---

## Modulstruktur

```
src/render/
  HoloComposer.js        ← ny: genererer holo-lag ud fra { palette, pattern, intensity }
  CapOverlayFactory.js   ← ny: komponerer alle tre lag til ét CanvasTexture
  TextureLoader.js       ← uændret: loader texMotif på samme måde som texFront
```

### `HoloComposer.js` — ansvar

```js
// Eksporterer én funktion:
export function drawHoloLayer(ctx, S, holoDef) {
    // 1. Tegn pattern-laget (geometrisk præg)
    drawPattern(ctx, S, holoDef.pattern);
    // 2. Blend palette-farver ovenpå med globalCompositeOperation
    drawPalette(ctx, S, holoDef.palette, holoDef.intensity);
}

// Interne funktioner — én pr. pattern-type:
function drawPattern(ctx, S, pattern) { /* checker, stars, scales osv. */ }
function drawPalette(ctx, S, palette, intensity) { /* rainbow, fire, venom osv. */ }
```

### `CapOverlayFactory.js` — ansvar

```js
export function buildCapFaceTexture(def, texCache) {
    const S = 256;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = S;
    const ctx = cvs.getContext('2d');

    // Lag 1: Baggrund
    ctx.fillStyle = def.bgColor ?? '#222222';
    ctx.fillRect(0, 0, S, S);
    if (def.bgPattern) drawBgPattern(ctx, S, def.bgPattern);

    // Lag 2: Holo overlay (kun hvis aktiv)
    if (def.holo) {
        ctx.globalCompositeOperation = 'screen';
        drawHoloLayer(ctx, S, def.holo);
        ctx.globalCompositeOperation = 'source-over';
    }

    // Lag 3: Motiv forrest
    const motifImg = texCache[def.texMotif]?.image;
    if (motifImg) ctx.drawImage(motifImg, 0, 0, S, S);

    const tex = new THREE.CanvasTexture(cvs);
    return tex;
}

// Ved holo-opgradering under run:
export function upgradeCapHolo(cap, holoDef, texCache) {
    cap.def.holo = holoDef;
    const newTex = buildCapFaceTexture(cap.def, texCache);
    cap.mesh.material[1].map = newTex;
    cap.mesh.material[1].map.needsUpdate = true;
}
```

---

## Asset-pipeline

### Navnekonvention for Aseprite-eksport

```
assets/caps/{series}/
  {id}_{name}.png          ← original forside med baggrund (eksisterende)
  {id}_{name}_b.png        ← bagside (eksisterende)
  {id}_{name}_motif.png    ← forside UDEN baggrund (ny — transparent alpha)
  {series}_back_motif.png  ← fælles bagside-motif for hele serien (ny, valgfri)
```

### Aseprite-workflow

1. Åbn eksisterende cap-fil
2. Slet/skjul baggrundslagets farve (behold kun motivet)
3. Eksporter som `{id}_{name}_motif.png` med transparent baggrund
4. Original `{id}_{name}.png` bevares uændret — bruges stadig når `holo: null`

### Rækkefølge

Start med **én cap** som proof of concept (anbefaling: `01_jebus_skull` — den har en veldefineret baggrund der er let at isolere). Valider at tre-lags systemet fungerer i browseren. Derefter batch-eksporter resten.

---

## Progression og shop-integration

Holo er en **cap-egenskab**, ikke et separat item. Det betyder:

```js
// En cap i spillerens samling kan have holo eller ej
cap.def.holo = null;           // standard
cap.def.holo = { palette: 'fire', pattern: 'smooth', intensity: 0.8 };  // opgraderet

// Opgradering sker via:
upgradeCapHolo(cap, newHoloDef, texCache);  // rebuilder tekstur on-the-fly
```

**Shop-scenarier:**
- Køb en cap der allerede er holo (holo-def er del af varen)
- Køb en "foil enchant" der appliceres på en cap du allerede ejer
- Erstatte en eksisterende holo med en anden (f.eks. skifte `fire` → `void`)

**Run-scenarier:**
- Find en foil-opgradering som relic/reward
- En cap "antændes" visuelt når den får en fire-egenskab (holo skifter automatisk)
- Score-multiplikatorer kan være knyttet til specifikke holo-typer

---

## Hvad der IKKE ændres

- `PhysicsEngine.js` — uberørt
- `CollisionManager.js` — uberørt
- `RenderEngine.js` — uberørt
- `main.js` game loop — ét kald ændres i `buildCap()`
- Eksisterende PNG-assets — bevares alle, ingen sletning

---

*Sidst opdateret: session dag 4 — holo-strategi brainstorm*

---

## Implementeringsstrategi og referencer

### Reference-implementering

**simeydotme/pokemon-cards-css**
- Repo: https://github.com/simeydotme/pokemon-cards-css
- Live demo: https://poke-holo.simey.me/
- Teknik: CSS Transforms, Gradients, Blend-modes og Filters med SvelteJS
- Effekter: shine, glimmer, foil texture, galaxy holo, prismatic m.fl.

Dette er den bedste visuelle reference for hvad holo-effekten *skal* se ud som. Repo'et kan ikke bruges direkte i Slamberz (CSS virker ikke på WebGL/Three.js objekter), men det dokumenterer præcist hvilke effekt-typer der findes og hvordan de ser ud.

### Hvad der KAN gøres i Slamberz (Three.js)

**Mulighed A — Canvas CanvasTexture (kan laves nu)**
- Proceduralt genereret holo-baggrund på et `<canvas>` element
- Statisk — skifter ikke farve med caps-rotation
- Ser ud som et holo-*print*, ikke holo-*folie*
- Nul performance-påvirkning
- Konklusion: for simpelt — ikke anderledes nok fra det vi allerede har

**Mulighed B — ShaderMaterial med Fresnel (den rigtige løsning)**
- Fragment shader beregner vinkel mellem cap-normal og kamera per pixel
- Holo-farven roterer og skifter automatisk når cap'en roterer i luften
- Præcis den samme visuelle effekt som simeydotme's CSS — bare i 3D
- `mix-blend-mode: color-dodge` i CSS svarer til `THREE.AdditiveBlending` i Three.js
- Kræver nyt `HoloMaterial.js` modul (~60-80 linjer GLSL + JS)
- Performance: 20 holo-caps = 20 draw calls med shader per frame — acceptabelt på desktop, skal testes på svagere hardware

### Teknisk oversættelse CSS → Three.js ShaderMaterial

```
CSS (simeydotme)                 →    Three.js (Slamberz)
────────────────────────────────────────────────────────
CSS custom properties (--mx, --my)    GLSL uniforms (vNormal, time)
mousemove event                        Three.js render loop (cap rotation)
mix-blend-mode: color-dodge            THREE.AdditiveBlending
linear-gradient (roterende)            hue-rotation i fragment shader
Svelte component                       HoloMaterial.js (~60-80 linjer)
```

### Nyt modul der skal oprettes

```
src/render/HoloMaterial.js    ← ShaderMaterial med Fresnel-effekt
                                 Eksponerer: createHoloMaterial(holoDef)
                                 Uniforms: baseMap, holoColor1, holoColor2,
                                           pattern, intensity, time
```

`time`-uniform opdateres i render-loopet så effekten animerer løbende — selv når cap'en ligger stille.

### Hvornår implementeres det

**Parkeret** — afventer stabil run-struktur i repo 2.

Holo er visuel polish, ikke kernemeknik. Prioriter score, shop, map og kortmekanik først. Når run-strukturen er solid er holo et afgrænset og veldefineret stykke arbejde.

Første implementeringsskridt når tiden er rigtig:
1. Lav `HoloMaterial.js` med en simpel regnbue Fresnel-shader
2. Test på én enkelt cap med `holo: { palette: 'rainbow', pattern: 'smooth' }`
3. Valider performance med 20 caps i scenen
4. Udvid med mønstre og paletter

---

*Holo-strategi parkeret: session dag 4*
