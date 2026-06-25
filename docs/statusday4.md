# Status Day 4

## Hvad er lavet (dag 3)

### Run flow
- **StartScreen** — New Run (øverst) / Continue Run (hvis run i gang, viser node + antal caps) / Free Play
- **MapScreen** — 5 noder venstre→højre, done/current/locked states, goal synligt per node
- **ShopScreen** — køb uejede caps med overskydende point, valuta akkumulerer på tværs af noder
- **BattleScreen** — enter(node) / exit(), kender til run-node og clearScore
- **main.js router** — `showScreen(name)` skifter mellem skærme: start → map → battle → shop → map → ...

### Score-system
- Al score = valuta; clearScore trækkes fra; resten gemmes og akkumulerer
- Tab = tilbage til StartScreen (Continue Run vises)
- Vind = ShopScreen → næste node

### Cap effects/enchants arkitektur
Fuldt modulær registry-pattern — ny effekt = én fil + én linje i index.

**Filer:**
- `src/game/effects/zoneEffects.js` — `zone_inner` og `zone_outer`
- `src/game/effects/index.js` — EFFECTS registry
- `src/game/enchants/echoEnchant.js` — `echo` (50% returnToStack)
- `src/game/enchants/index.js` — ENCHANTS registry
- `src/game/EffectResolver.js` — `resolve(cap, ctx)` + `buildContext(cap, allCaps, throwIndex)`

**Cap instance:** `{ mesh, body, def, enchant }` — enchant er string ID eller null  
**Owned caps:** `{ def, enchant }[]` i GameState.ownedCaps (var ownedCapDefs — renamed)

### Starter-samling
4 raptor caps + **Alien** (har `effect: 'zone_inner'`), 8-Ball har `effect: 'zone_outer'`  
Formål: spilleren ser en effect-cap fra starten og får tidlig fornemmelse af systemet.

### Visuel feedback
- Floating `+N` tekst projiceret fra 3D cap-position til skærm-koordinater
- Hvid = normalt point, guld/stor = bonus-point (amount > 1)
- Timingen er synkroniseret med pop-animationen

---

## Kendte bugs / næste ting

### Bug: zone_inner giver kun +1 selvom cap er inden for skiven
**Symptom:** Alien landede visuelt inden for cirklen, men fik kun +1 (ingen bonus).  
**Sandsynlig årsag:** `INNER_RADIUS = 7` er for lille ift. feltets faktiske world-units radius.  
**Fix:** Mål faktisk feltradius (tjek RenderEngine/field-mesh radius), juster `INNER_RADIUS` og `OUTER_RADIUS` i `src/game/effects/zoneEffects.js`. Evt. tilføj debug-output der logger `distanceFromCenter` per cap.

### Næste features (prioriteret)
1. **Fix zone-radier** — se bug ovenfor
2. **Echo-enchant test** — bekræft at returnToStack virker (cap gen-indgår i næste throw)
3. **Score-display ved effect** — evt. farvet ring/glow på cappen der gav bonus (ikke kun float-tekst)
4. **Flere effects** — næste i rækken? (area-trigger der flipper nabocaps, dublering osv.)
5. **Enchant-system i shoppen** — UI til at give en ejet cap en enchant
6. **Run-end screen** — stats efter et fuldt run (brugerens eget ønske, "måske senere")
7. **Balance** — clearScore kurven, CAP_PRICE, starter-stack-størrelse

### Arkitektur-hukommelse
- `returnToStack` virker mekanisk: cap flippes face-down og joins `updatedFaceDown` → tages med i næste applyRestack
- `triggerCaps[]` i EffectResult er reserveret til area-effekter (flipper nabocaps) — ikke implementeret endnu
- `fx` i EffectResult er reserveret til visuelle effekter per cap — ikke koblet til renderer endnu
- `throwIndex` sendes med i context — kan bruges af effects der skalerer med kast-nummer
