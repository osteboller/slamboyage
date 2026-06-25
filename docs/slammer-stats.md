# Slammer Stats — Design & Status

## Hvad er implementeret

Hver slammer har tre mekaniske stats og et separat UI-rating:

| Stat | Felt | Effekt |
|---|---|---|
| **Power** | `power` (float) | Direkte multiplikator på blast-kraft: `force = sqrt(3.5) * shotSpeed * power` |
| **Weight** | `mass` (float) | Fysik-legemets masse — tung slammer afbøjes ikke af caps, ruller langsommere. Påvirker **ikke** blast-kraft. |
| **Precision** | `precision` (float) | Deler `BASE_OSC_SPEED (7.0)` — høj precision = langsom power-bar = nemmere at time |

UI-visning (pips) er **uafhængig** af de mekaniske værdier og styres af `rating: { power, precision, weight }` (skala 1–5).

### Nuværende værdier

| Slammer | mass | power | precision | rating (P/Pr/W) |
|---|---|---|---|---|
| Gold Raptor | 3.5 | 0.55 | 1.00 | 3 / 3 / 3 |
| Yin Yang | 2.5 | 0.48 | 1.40 | 2 / 5 / 2 |
| Skull Slammer | 4.0 | 0.60 | 0.65 | 4 / 1 / 4 |

Gold Raptor er kalibreret til at matche spillet præcis som det var **før** stats blev indført (`sqrt(3.5) * speed * 0.55`).

---

## Bug: slammer "phaser gennem" caps uden at flytte dem

### Symptom
Slammeren landede oven på en cap uden at flytte den. Runden sluttede som miss.

### Årsag
Race condition i game-loopets rækkefølge. Den gamle ordre:
```
throwCtrl.update()   ← CCD tjekker pre-step position
physics.step()       ← gulv-kontakt sætter pendingMiss = true
checkPending()       ← miss vinder, _active = false
```
Næste frame opdager CCD pass-through, men `_active` er allerede `false` → for sent.

### Fix
`physics.step` rykket **før** `throwCtrl.update` i `BattleScreen._loop`:
```
physics.step()       ← gulv-kontakt sætter pendingMiss = true
throwCtrl.update()   ← CCD bruger post-step position, sætter pendingBlast = true
checkPending()       ← blast vinder over miss ✓
```

---

## Mangler / TODO

- [ ] **Weight føles ikke i gameplay** — caps vender sidelæns til forskellig grad afhængigt af slammer-masse, men det er subtilt. Overvej om weight skal påvirke noget mere konkret (f.eks. bounce-restitution på slammer/cap contact material).
- [ ] **Balance-tuning** — Skull vs. Yin Yang forskel er ~25% i kraft og 2x i bar-hastighed. Skal afprøves mere systematisk når run flow er på plads og man kan se tydelig forskel i score over flere runder.
- [ ] **Stat-display** — pips vises kun i slammer-detail popup. Overvej om stats skal fremgå i shop/select-UI når det bygges.
- [ ] **Flere slammers** — systemet er klar til nye slammers med unikke stat-profiler (f.eks. ultra-præcis men nul power, eller "lucky" med random power per kast).
