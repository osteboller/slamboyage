# Status Day 11

## Hvad er lavet (dag 11)

De 4 `6juli_AGENT_*`-prompts (`docs/særskilte md'er for 6. juli/`) implementeret i deres tilsigtede rækkefølge — hver enkelt har sin egen "kør X før denne"-afhængighed til den foregående, primært fordi de bygger videre på samme `_price()`/klik-konsistens-refaktorer. Opgave 3 (reward/shop-konsistens) fik derudover en lang række opfølgende rettelser fra brugertest samme dag, beskrevet for sig selv nedenfor.

---

### 1. Bugfixes + oprydning (`6juli_AGENT_BUGFIXES_AND_CLEANUP2.md`)

5 uafhængige opgaver:

- **Discard-cost reset-bug**: `_discardCostBase` nulstillede forkert i `nextLoop()` i stedet for kun i `startRun()` — prisen faldt tilbage til basis ved hvert loop-skift i stedet for at blive ved med at eskalere gennem hele runnen. Fjernet fra `nextLoop()`.
- **Kort-priser steg ikke ved køb**: ny `GameState.buyConsumableCard(def, basePrice)` (samme `canAfford()`-guard-mønster som `buyCap()`/`useDiscard()`), ny `CARD_PRICE_GROWTH = 1.5`-konstant. `ShopScreen`s tidligere direkte `this._gs.score -= cardPrice` (brud på "score-mutation går gennem GameState"-reglen) erstattet af et kald til den nye metode.
- **Mystixx-mobil valgte forkert cap ved scroll**: `showCapPicker()` bandt valg til `pointerdown`, som fyrer FØR browseren ved om det er tap eller scroll-start. Ny delt helper `bindTapSelect()` (`src/ui/domUtils.js`, ny fil) skelner via en bevægelses-threshold (8px); kun brugt i Mystixx-vælgeren, ikke de ~15 andre `pointerdown`-steder i `UIManager.js` (uændret indtil bekræftet nødvendigt der også).
- **AMPLIFYZ (`double_relic`) gjorde ingenting**: fandtes kun i `consumableDefs.js`, ingen dispatch-case, intet flag. Implementeret fra bunden: `amplifyPassives`-flag på `GameState` (forbrug-ved-næste-kast, samme mønster som `activeDouble`), ny delt `src/game/passiveUtils.js` (`passiveMultiplier`/`passiveFlatBonus`) der samler de tidligere spredte `filter().reduce()`-udtryk for first/last/parity/rarity-multiplier + flatBonus ét sted, med amplify koblet ind som sidste parameter.
- **New Run/Retry/Try Again sprang IKKE map-screen over**: DRY'et ud i en delt `goToNode(node)`-funktion i `main.js`, brugt af `startScreen.onNewRun`, `ui.onPauseRetry` og `runEndScreen.onTryAgain` — alle tre lander nu direkte i node 1-1. `map-btn`s uafhængige peek-visning er upåvirket.

---

### 2. Hard caps + prisskalering (`6juli_AGENT_HARDCAPS_AND_PRICE_SCALING.md`)

- **`MAX_OWNED_SLAMMERS = 10`**: tilbud forbliver synlige/vælgelige selv ved loftet — kun selve commit blokeres, med en ny dismissable `showMaxSlammersMessage()`-sticker ("Max Slammers reached — sell to make room") der linker direkte til `openCollection('slammers')`. Guardet 5 steder: `RewardScreen._confirm/_confirmChest/_confirmMystery`, shop-pakkens slammer-commit, `BossShopScreen._buy()`. `swap_slammer` er undtaget (netto-neutral, fjerner én/tilføjer én).
- **`MAX_OWNED_CAPS = 50`** (bekræftet med Buller før kørsel): shop-køb blokerer aktivt/viser "FULL" (dårlig UX at lade spilleren betale for noget der bare konverteres tilbage). Reward/kiste/mystery falder i stedet tilbage til en ny `compensateFullCollection()` — konverterer den forspildte cap til ★ (sellPrice eller 4★-fallback) i stedet for at tabe rewarden stille.
- **`CAP_PRICE_GROWTH_PER_LOOP = 0.35`**: ny `capPriceMultiplier`-getter på `GameState`. `ShopScreen._price()` gjort type-bevidst (`kind: 'cap' | 'pack'`) i stedet for tre spredte ad-hoc-multiplikator-kilder.

---

### 3. Reward- og shop-kort-konsistens (`6juli_AGENT_REWARD_AND_SHOP_CARD_CONSISTENCY.md`) + opfølgende brugertest-runde

Den suverænt største af de fire, og den eneste der affødte flere runder af skærmbillede-drevne rettelser efter selve implementeringen. Kernereglen hele opgaven retrofitter ind alle steder: **ikon-klik = inspektion (åbner detail-viewer med en handlings-knap), dedikeret knap = commit, resten af kortet = dødt.**

**Selve prompten:**
- Mystery-reward viste en generisk "MYSTERY"-label uanset udfald — genbruger nu samme kort-skabeloner som normale rewards (`_capCards`/`_slammerCards`-stil: rigtig rarity, serie, ability/passiv-tekst) for `new_cap`/`new_slammer`/`card`; swap/transform beholder før→efter-visningen uden den vildledende label.
- Chest-reward havde samme problem OG ingen detail-viewer-vej overhovedet — samme retrofit, plus rigtig rarity-tekst i badgen (var fejlagtigt "SILVER/GOLD CHEST"; kiste-tier er nu en separat, mindre indikator ovenover kortet).
- `RewardScreen`: ny delt `_iconClick()`-helper bruges på tværs af alle 5 modes (cap/slammer/enchant/boss/chest/mystery) i stedet for hvert sit ad-hoc klik-tjek.
- `UIManager._showSlammerDetail()` udvidet med samme generiske `action`-parameter som cap-detail — nyt `#slammer-detail-action`-element. Første gang slammer-inspektion-før-valg findes i spillet.
- `BossShopScreen` omdesignet til "slim card"-stil (rarity/ability/passiv pr. valg) med samme ikon-vs-knap-opdeling; udvidet fra 3 caps + 2 slammere til 5 caps + 3 slammere, nu i to bånd-rækker der genbruger `ShopScreen`s egne `.shop-band`-CSS-klasser i stedet for dupliceret styling.

**Opfølgende rettelser (samme underliggende opgave, fundet via skærmbilleder EFTER implementering):**
- Root cause for "slammer-ikoner åbner ikke detail-view" på tværs af flere kontekster (boss shop, mystery, kister, pakker): `.reward-cap-img { pointer-events: none; }` blokerede alle bare `<img>`-klik — caps virkede kun som et sideeffekt af deres egen wrapper-div. Én linje rettede alle rapporterede steder på én gang.
- Boss Shop lagt om til 5-i-en-række (var 4+1), cramped bånd-margener rettet så de rent faktisk clearer price-tag/effect-sticker.
- Boss Shop: Shards-saldo flyttet op ved siden af burger-menuen, score-0-stickeren fjernet specifikt her (meningsløs efter en nulstillet boss-kamp), Continue-knappen overtager den frigjorte plads.
- Chest/mystery: kortet forskudt mod venstre, detail-popup åbner til højre. Første forsøg brugte vw-skalerede offsets pr. skærmkant — viste sig (a) ikke gated til samme `≥720px`-breakpoint som kortets eget skub (overlap på mobil) og (b) at vokse ubegrænset med skærmbredden (stort tomrum på brede skærme). Rettet til en fast afstand-fra-midten (delt `--reward-side-half`-token), så kort+popup altid holder konstant indbyrdes afstand, og til at falde helt tilbage til centreret under 720px.
- Genindført et dæmpet baggrundslag (`#detail-backdrop`, samme `--overlay-modal`-token som resten af spillet) bag cap/slammer/relic-detail — savnet fra "gamle dage", nu centralt vist/skjult sammen med selve popup'en, inklusive fra alle commit-knapperne, ikke kun klik-udenfor.
- Ny `pulseIconRotate()`-helper (`domUtils.js`): erstatter en ren CSS `:hover`-rotation (fyrer aldrig på touch) med en klik/tap-udløst one-shot-animation, wired ind alle steder man kan klikke et cap/slammer-ikon (reward, shop-pakker, boss shop).
- AMPLIFYZ-opfølgning: flaget var oprindeligt en boolean (fra opgave 1) og stakkede derfor ikke — 2 kort i træk viste stadig kun én forøgelse. Konverteret til `amplifyStacks`-counter (mirror af `activeDouble`), formel ændret til `base^(1+stacks)` (multiplikative passiver) / `base×(1+stacks)` (flatBonus).
- Nyt badge-system for rarity/parity/flatBonus-passiver (matcher First Strike/Last Stand's rigere feedback): dedikerede transiente pop-in/pop-out-badges i stedet for slet ingen feedback. Undervejs rettet en ægte bug hvor `flipCount % 2 === 0` også var sandt for `flipCount = 0` (et rent miss udløste Even Steven spuriøst) samt en badge-"blødning" ind i næste skærm hvis animationen ikke nåede at færdiggøres.

---

### 4. Kompakt tal-formattering (`6juli_AGENT_NUMBER_FORMATTING.md`)

- Ny `src/ui/formatScore.js`: k/m/b/t/q/Q-notation, 3 betydende cifre, rører aldrig selve `GameState.score`.
- Vigtig bug undgået, ikke bare en formattering: `UIManager.setScore()` læste tidligere sit tween-animations-startpunkt tilbage via `parseInt(el.textContent)` — brækker i det øjeblik teksten er formatteret (`parseInt("1.01k")` → `1`, ikke `1010`), hvilket ville have ødelagt selve op/ned-tællingen for store tal. Erstattet med et instansfelt (`_lastScoreValue`) der husker den rå værdi uafhængigt af hvad der vises.
- `showThresholdResult()`, `showScoreDeduct`/`showScoreGain`, samt de statiske goal/score-visninger i `MapScreen`/`ShopScreen`/`RewardScreen`/`RunEndScreen` wrapped i `formatScore()`.
- **Justeret efter test samme dag**: grænsen for hvornår der forkortes hævet fra 1.000 til 10.000. "1.2k" er hverken kortere eller renere end "1200" (samme antal tegn — nogle gange endda flere, fx `1250` → `1.25k`), så der var intet at vinde ved at forkorte 4-cifrede tal. Fra 10.000 og op giver det derimod mening (`12000` → `12k`).

---

## Ikke implementeret endnu

Alle 4 prompts er fuldt implementeret. To ubekræftede antagelser fra selve prompterne står stadig som skrevet (ingen har bedt om at ændre dem, men de er bevidste gæt, ikke fakta):

- Reroll-cost (`_rerollCostBase`) beholder sin eksisterende nulstilling i `nextLoop()` — kun discard-cost blev rettet til at være run-persistent. Hvis reroll også skal opføre sig sådan, er det samme ét-linje-fix.
- Kort-prisstigningen (`_cardPriceMult`) nulstiller kun i `startRun()`, ikke pr. loop — samme antagelse, samme sted at ændre hvis det viser sig forkert.

---

## Næste ting (prioriteret)

1. **Bekræft de to antagelser ovenfor** (reroll-cost/kort-pris pr.-loop-reset) — billige at rette hvis Buller vil have dem run-persistente i stedet.
2. **Collection-grid tap/scroll** — `bindTapSelect()` blev bevidst kun sat på Mystixx-vælgeren; bekræft om Collection-grid'en har samme scroll-vælger-forkert-cap-symptom, brug samme helper hvis ja.
3. **Playtest boss-shop og chest/mystery side-popup layoutet** på en reel smal telefon og en reel bred skærm — regnet igennem matematisk denne session, ikke set i en browser endnu.
4. Uændrede, ældre backlog-punkter fra dag 10 (boss-balancering, live boss-test, kiste/mystery-vægte, IRONCLAD/FEATHER-enchants i rullepuljen, Rainbow-bagside, Legacy Discs) er ikke rørt af dagens 4 prompts og står stadig åbne som beskrevet i `statusday10.md`.
