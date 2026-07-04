# Status Day 10

## Hvad er lavet (dag 10)

### Trick Shot — fuld map-integration

Sidste punkt fra dag 9's prioritetsliste er nu færdigt. Egen `TrickShotScreen` (ikke en gren af `BattleScreen`), genbruger den delte 3D-infrastruktur men har sit eget `enter()`/`exit()`/loop.

- Kort/beskrivelse/kost hentes fra `trickShotDefs.js` (`Flip Just One`, `Table Slam`), 2 pr. run, aldrig på 1-1 (spilleren har 0★ der)
- `RoundManager.buildTrickShotStack()` / `_resolveTrickShotAttempt()` forker AFTER effekt/magnet/surge-resolution men FØR normal scoring — samme mønster som senere blev genbrugt til boss
- Reward er en enchant-vælger-oplåsning på hovednoden (`markRewardUpgraded`), ikke direkte score
- Map viser en synlig "afstikker"-gren ved siden af hovednoden: reward-ikon + udfordrings-badge er ALTID synlige (så man ved hvad man får og hvad man skal lave), men selve typen forbliver skjult indtil clearet — først da skifter grenen til et almindeligt ✓
- Klik på grenen viser/skjuler nu en info-sticker (navn/beskrivelse/pris) i stedet for at gå direkte i gang — kun ⚡-knappen i action-baren starter forsøget. Samme mekanik som boss-noden (se nedenfor)

---

### Boss-node — ny klimaks-node (1-6)

Ekstra, sværere afsluttende node tilføjet efter det eksisterende 6-node-layout, med 4 gimmick-varianter:

- **Maxmillian** — bare højt clearScore, ingen gimmick
- **Even Steven** — kun kast med lige antal flips tæller
- **Odd Todd** — kun kast med ulige antal flips tæller
- **No Glam Fam** — -10%/enchantet cap i bag, op til -80%

`src/config/bossDefs.js` + `src/game/bossModifiers/index.js` (`getBossThrowMultiplier`) — rene funktioner der ganges ind i `finalGlobalMult` i `RoundManager`, men holdes UDENFOR den visuelle score-float-kæde.

- Score-wallet nulstilles fuldstændigt ved indgang til boss-kamp
- Ny run-scoped valuta **Shards** (🔶): garanteret +1 for sejr, +1 for at skippe reward-cap, +1 pr. score-threshold (500/2000/10000 — placeholder-tal, skal balanceres)
- Reward: 3 rare/legendary caps at vælge imellem, eller skip for ekstra Shard (genbruger `RewardScreen` med ny `'boss'`-mode)
- Dedikeret **`BossShopScreen`** (egen skærm, ikke en gren af `ShopScreen`) — bruger Shards på rare caps/relics
- Boss' identitet + gimmick er synlig på kortet FRA START (i modsætning til Trick Shot) — klik viser/skjuler forklarende sticker, "Next ▶"-knappen er eneste vej ind i kampen
- Boss-info-headeren dæmpes/pulserer under selve kastet, ligesom Trick Shot-headeren
- Shop før boss viser en "sidste chance for at bruge score"-advarsel
- `DEV SKIP TO BOSS`-knap i hovedmenuen til hurtig test

---

### Ghost cap entryId-bug (Twinsies + absorb) — rettet

Dag 9's åbne hypotese var korrekt: ghost-caps fra Twinsies fik `entryId: null`, så deres egen absorb-bonus scorede korrekt men vistes aldrig som badge (badges er keyet på entryId).

- `addGhostCap` giver nu ghosts unikke negative syntetiske id'er (`_nextGhostId--`, nulstillet pr. `buildStack`)
- To separate badge-lookup-steder i `UIManager` læste fejlagtigt `gsEntry?.id` (undefined for ghosts) i stedet for cappens egen `entryId` — begge rettet

---

### Mobil/fullscreen viewport-fixes

- `100dvh`/`100dvw`-overrides (efter `100vh`/`100vw` så ældre browsere falder tilbage) på `html,body`, `#map-screen`, `#run-end-screen`, `#boss-shop-screen`
- Pause-overlay og run-end-screen fik samme `max-height:100%; overflow-y:auto` fix som tidligere
- Boss-shop havde et layout-bug på mobil: `grid-template-columns: repeat(auto-fit, minmax(...))` gav uens kolonnebredde pr. række — rettet til fast kolonneantal + media queries (samme mønster som `.reward-cards`)

---

### Indhold: cap-omdøbninger, ny serie, rarity-swap

- Raptor Strike Squad: "Heavy Mech"→**Mecha Raptor**, "Gold Strike"→**Jade-a-saur**, "Mecha"→**Raptor Fusion**, "Raptor Sigil"→**Droid-e-saur** (ny tekstur `10_red_raptor_saur.png`)
- Dawgz: **Husky**→**Husk P'Dey**, **Puggy**→**Pugsby**, **Dalmay**→**Dalmer**
- Rarity byttet: **Raptor Fusion** er nu legendary (var rare), **Droid-e-saur** er nu rare (var legendary)
- Ny 12-cap serie **Dawgz** implementeret fuldt ud (5 common/4 uncommon/2 rare/1 legendary), `DAWGZ`-devknap tilføjet

---

### Slammer-udvidelse (3 → 10)

- **Corgi Butt**, **Game of Bones** (Dawgz-tema)
- **Raptor Sigil** (2. Raptor-slammer, genbruger eksisterende Raptor-bagside)
- **Alien Bronze / Silver / Gold** (3 nye Cosmic Caps-slammere)
- Alle med placeholder-stats — afventer gennemtænkning af hele slammer-systemet (se "Næste ting")
- Status pr. serie: Raptor Strike (2✓), Cosmic Caps (3✓), Dawgz (2✓), Scary Skullz (1, mangler 1), Pewl Ballz (1, mangler 1)

---

### SKIPPY — ny consumable

"Peanut Pass™" — skipper den aktuelle Trick Shot-udfordring og giver reward-upgraden med det samme (kalder samme `markRewardUpgraded` som en rigtig clearing ville). Kun brugbar fra map. Sat ind i test-starthånden (erstattede Voltage, som havde tjent sit formål ift. ghost-cap-bug-testen).

---

### Ability-tekst: kort navn vs. fuld beskrivelse

`EFFECT_LABELS` splittet i `{ name, desc }` (`effectName()`/`effectDesc()`-helpers):

- Collection, reward-screen og shop-pack-kort viser nu kun det korte navn ("Lasso", "Absorb", "Inner Zone")
- Cap-detail (capviewer) har fået et nyt `#cap-detail-desc`-felt med den fulde uddybende tekst
- Shop-båndets direkte-køb-caps fik en lille sort sticker med ability-navnet, placeret **under** pris-skiltet (ikke oven på artworket — første forsøg dækkede billedet, andet forsøg blev klemt fladt af `.cap-enchant-wrap`'s `line-height:0`, tredje forsøg ramte selve pris-skiltet — endte med egen absolut positionering under skiltet)

---

### Mystixx-bug: enchant på allerede-enchantet cap

MYSTIXX-consumablen (i modsætning til reward-screenens enchant-valg) udelukkede ikke cappens nuværende enchant fra den tilfældige pulje — en gilded cap kunne roule gilded igen og consumablen gik til spilde uden synlig effekt. Rettet: `ENCHANT_DEFS.filter(e => e.id !== entry.enchant)`.

---

### Diverse

- Svaret på iOS 12.5.7-kompatibilitet: nej, virker ikke — `?.`/`??`/class fields kræver Safari 13.1+/14, Pointer Events kræver Safari 13+, alt sammen brugt gennemgående. Ingen kodeændring, kun info.

---

## Ikke implementeret endnu (bevidst udskudt)

**Slammer/relic-rework-idé** luftet: slammere skal have en passiv effekt så længe de er i samlingen (max 10 stk.), erstatte relics helt, UI-ikoner for fx "4x score first throw" skal blive til små cirkel-ikoner af den relevante slammer. Stats-variation som nu er stadig ok. Skal brainstormes færdigt og skrives som egen `.md` før implementering.

---

## Næste ting (prioriteret)

1. **Boss-balancering** — clearScore-multipliers og Shards-thresholds (500/2000/10000) er placeholder-tal
2. **Live boss-test** — endnu ikke slået en boss ihjel i praksis, bør verificeres via `DEV SKIP TO BOSS`
3. **Slammer/relic-rework** — brainstorm færdig, skriv `.md`, tag stilling til om det er det rigtige træk
4. **De sidste 2 slammere** — en til Scary Skullz, en til Pewl Ballz
5. **IRONCLAD enchant** — beskyttelse mod discard/destroy/exhaust (overført fra dag 9)
6. **Rainbow bagside** — lav `21_pewls_b.png` (overført fra dag 9)
7. **Legacy Discs** — stadig kun 2 caps, tag stilling til om serien skal udvides eller forblive en hemmelig mini-serie (overført fra dag 9)
