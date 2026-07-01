# Status Day 9

## Hvad er lavet (dag 9)

### Base value badge — +N under cap-cirklen

Caps der har ekstra grundværdi (voltage, crew/rally, effekt-bonus, halflife stored) viser nu et orange `+N`-badge **under** cap-billedet i stack-knapperne og i cap-detail-vieweren.

- `.cap-thumb` mistede `overflow: hidden` så badge ikke klippes af — cap-billeder forbliver cirkulære via `border-radius: 50%` på `.cap-thumb-img` selv
- Badge CSS: `bottom: -14px; left: 50%; transform: translateX(-50%)` — centreret under cirklen
- `margin-bottom: 10px` på rows giver plads til badge
- Samme badge vises i cap detail viewer via `.cap-detail-extra-base`

---

### `_roundCapBonuses` — universelt base-bonus system

Crew og rally var tidligere implementeret som en per-kast `incomingAura`-map der nulstilledes efter hvert kast. Redesignet til at følge samme model som voltage: en persisterende `Map<entryId, number>` der lever hele runden.

**`RoundManager._roundCapBonuses`:**
- Initialiseres (tom Map) ved `buildStack` sammen med `_voltageBonus = 0`
- Crew/rally skrives ind ved kast-slut og **akkumuleres** hen over runden (kaster man rally to gange, får naboerne +2)
- Crew rækker nu til **alle** caps i runden — ikke kun dem i det aktuelle kast
- Effekt-bonusser (absorb, flat, solo) skrives også ind efter scoring
- Nulstilles ved runde-afslutning (samme blok som `_voltageBonus = 0`)

**`_geb` getter** (getExtraBase) — returnerer en funktion `(id) => voltageBonus + roundCapBonuses.get(id)` der sendes til alle `updatePileButtons`-kald.

**Badge-opdatering:** Batchet — ét kald per kast-afslutning. Undtagelse: voltage-kort brugt mellem kast opdaterer med det samme.

---

### Voltage badge bug — nulstilling ved runde-slut

`_voltageBonus` blev ikke nulstillet ved runde-afslutning, så badge'et viste voltage-bonus i shoppen og fremover i run'et. Rettet: nulstilles i round-end-blokken i `RoundManager` inden `this._phase = 'done'`.

---

### FEATHER enchant — implementeret

Feather-caps tæller ikke med i stack-size-grænsen men er altid garanteret i stakken.

**BattleScreen** adskiller owned caps i to grupper før `buildStack`:
```js
const featherCaps = ownedCaps.filter(c => c.enchant === 'feather');
const regularCaps = ownedCaps.filter(c => c.enchant !== 'feather');
const shuffled    = regularCaps.sort(…).slice(0, stackSizeLimit);
const stackCaps   = [...featherCaps, ...shuffled];
```

**Pile-knap denominator:** `Math.min(total, stackSizeLimit)` — viser grænsen som denominator når feather/spawn pusher over (fx `11/10`). Ved normal brug (6 caps, limit 10) vises `6/6` så feather-bonussen ikke er synlig medmindre man faktisk overskrider grænsen.

---

### Mystery pack refresh bug — rettet

Refresh-kort (REFRESH consumable) virkede ikke i mystery packs fordi `refreshCurrentView()` i `ShopScreen` manglede en `mystery`-case. Tilføjet case der genererer `{ itemType, def }`-objekter (samme format som ved første åbning).

---

### Afstikker enchant reward — implementeret

Ny reward-variant (`mode: 'enchant'`) i `RewardScreen`. Vises i stedet for normal cap-reward når en afstikker-node ryddes.

**Tre kort viser:**
- Cap-billede fra samlingen (med nuværende enchant-overlay hvis den har en)
- Cap-navn + serie
- Det foreslåede enchant i enchantens farve (`◇ GILDED`, `½ HALFLIFE` osv.)
- Enchant-beskrivelse
- Hvis cap allerede har enchant: `½ HALFLIFE → replaced`-advarsel
- PICK-knap (eller klik på kort)

Samme cap kan optræde i flere valg. Refresh-kort giver nye tilfældige valg. Skip giver +5★ som normalt.

**`GameState.applyEnchant(capId, enchantId)`** bruges til at skrive enchant på den valgte cap-entry.

**Test-hook i `main.js`:** Første node (id=1) sender til `'enchant-reward'` i stedet for normal `'reward'`. Kommenteret med `// TEST: fjernes når map-integration er klar`.

**Starthånd til test:** Voltage-kortet i slot 3 erstattet med Refresh-kort.

---

## Næste ting (prioriteret)

1. **Afstikker map-integration** — side-noder på kortet (2 per run), challenge-logik i `BattleScreen` (spor f.eks. "flip 3 caps i ét kast"), kost-per-forsøg (25★)
2. **Pause-menu overlay** — plan er skrevet (`okay-jeg-har-en-woolly-valley.md`)
3. **IRONCLAD enchant** — beskyttelse mod discard/destroy/exhaust
4. **Rainbow bagside** — lav `21_pewls_b.png`
5. **Legacy Discs** — kun 2 caps, bør udvides eller holdes som hemmelig mini-serie
6. **Twinsies + absorb** — hypotese: absorb ekskluderer begge Mecha-instanser (original + ghost) pga. `entryId`-match → 72−16=56 i stedet for 72
