# Day 6 Status

## Hvad vi nåede

### Score display juice
- `setScore()` tweener nu jævnt fra gammel til ny værdi (ease-out-cubic, 120–450ms)
- **Battle gains**: guld `+X★` float popper ud fra score-displayet (nede til højre) når det *sidste* caps score er talt færdigt — ikke når kastet registreres
- **Shop deductions**: rød `-X★` float popper ud fra score-displayet når man køber en cap eller pakke
- Score-displayet opdateres nu korrekt *efter* alle floats er animeret færdige (rykket ind i `isLast` onFinalNumber callback i RoundManager)

### Threshold-animation ved rundeafslutning
- `showThresholdResult(clearScore, totalScore, won)` tilføjet til UIManager
- Kaldes fra `BattleScreen.onRoundEnd` med 750ms delay (så score-floats når at lande)
- Goal-nummeret i `#run-info` (øverst til højre) tweener fra `clearScore` ned mod:
  - **Won**: 0 → boksen skifter til pastel grøn
  - **Lost**: `clearScore - totalScore` (det der manglede) → boksen skifter til pastel rød
- Farve nulstilles i `resetScore()` ved næste battle-start

### REMOVE CAPS knap
- Endte med at gå tilbage til original styling (hvid baggrund, sort border)

---

## Ikke løst / buggy

### Threshold-animation virker ikke
Brugeren bekræftede at den ikke fungerer. Ikke debugget endnu. Mulige årsager:
- `#run-goal-score` er et `<b>` element — men `textContent` burde stadig virke
- `onRoundEnd` callback timing: den fires *samtidig* med at score-floats kører, så 750ms er måske ikke nok
- `run-info` elementet er muligvis `display:none` på det tidspunkt (det skjules efter battle)
- `clearRunInfo()` kaldes i `BattleScreen.exit()` — men `onRoundEnd` fires *før* exit, så det burde være fint

---

## Godt sted at starte i morgen

**Debug threshold-animationen:**

1. Åbn DevTools og tjek om `document.getElementById('run-goal-score')` returnerer noget mens man er i battle
2. Tjek om `#run-info` er synlig på det tidspunkt `showThresholdResult` kører (750ms efter `onRoundEnd`)
3. Evt. sæt `console.log` i starten af `showThresholdResult`'s setTimeout callback for at se om den overhovedet kører
4. Alternativt: `onRoundEnd` triggeres fra RoundManager mens score-floats stadig er i gang — måske burde threshold-animationen kobles på `isLast` onFinalNumber i stedet for `onRoundEnd`

**Relevante filer:**
- `src/ui/UIManager.js` → `showThresholdResult()`
- `src/screens/BattleScreen.js` → `onRoundEnd` callback (linje ~41)
- `src/styles/hud.css` → `#run-info`, `.run-info--won`, `.run-info--lost`
