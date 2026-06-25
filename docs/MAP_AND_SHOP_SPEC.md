# Map & Shop spec — Slamberz repo 2

*Primær reference: Dice-a-million (map + shop + reward struktur)*
*Sekundær reference: Gemini shop mock-up*

---

## Nuværende tilstand i repo 2

- Lineært kort med 5 noder (1-1 → 1-5), venstre → højre ✓
- Target score per node trækkes fra akkumuleret score — men score-visning er buggy:
  - **Bug:** Score-visning tager ikke højde for at threshold fratrækkes mellem noder og at man bruger score i shoppen
- Shop eksisterer men er en simpel vertikal liste — skal redesignes
- Reward-skærm ikke implementeret
- Bag/taske ikke implementeret
- Ingen afstikkere endnu

---

## Map

### Struktur

```
[1-1] → [REWARD] → [SHOP] → [1-2] → [REWARD] → [SHOP] → ... → [1-5]
          ↕ (tilfældig)                 ↕ (tilfældig)
       [AFSTIKKER]                  [AFSTIKKER]
```

- 5 noder per "face"
- Lineært venstre → højre ✓
- Afstikkere: 2 stk per run, tilfældig placering
- Run slutter ved fejlet node — ingen reward eller shop efter fejl

### Hvad vises på kortet

- Alle 5 noders target score synlige fra starten
- Nuværende node fremhævet (gylden kant)
- Afstikkere som sidegrene fra den tilknyttede node
- Øverst venstre: bag-ikon → åbner bag-oversigt (ikke implementeret endnu)
- Nederst højre: akkumuleret score (stor, tydelig)
- Nederst mod midten: op til **3 udstyrede kort** (one-time-use spillekort — se nedenfor)

### Kort — one-time-use (ikke relics/ringe)

Kort er forbrugsvarer man udstyrer og bruger aktivt under en node:
- Eksempler: "Score multiplier ×2 dette kast", "Få et ekstra kast", "Alle caps tæller som vendt dette kast"
- Op til 3 kort kan være udstyret ad gangen — vises som kort-ikoner nederst på map-skærmen
- Bruges ved at aktivere dem inden eller under et kast
- Fås via reward-skærm eller shop
- **Ikke det samme som relics/ringe** — relics er permanente passive bonusser der hører til bag-oversigten

### Bag (ikke implementeret endnu)

- Åbnes via bag-ikon øverst venstre på map-skærmen
- Viser alle caps, slammere og relics/ringe man har samlet i dette run
- Relics/ringe vises her med deres passive beskrivelse
- Bruges også til at vælge hvilke kort man vil have udstyret

### Node-flow

```
1. Vis map → spiller klikker på aktuel node
2. Spil noden (1-3 kast, eksisterende game loop)
3a. Score ≥ target → reward-skærm → shop → tilbage til map
3b. Score < target → "Run over"-skærm → hovedmenu
```

### Afstikkere

- Sideboks knyttet til en tilfældig node
- Caps-baseret udfordring, f.eks. "Vend mindst 3 caps i ét kast"
- Hvert forsøg koster score (f.eks. 25★) — ingen gratis forsøg
- Klarer man den → reward for den node opgraderes
- Fejler man → scorer brugt, kan prøve igen mod betaling

---

## Shop

### Koncept

Shoppen har to sektioner:

**Øverste bånd** — 5 individuelle caps/slammere man kan købe direkte (med reroll)

**Nedre sektion** — **2 pakker** at vælge imellem. Når man klikker på en pakke åbnes den og man får **3 valgmuligheder**. Hvad de 3 valg er afhænger af pakketypen:

| Pakketype | De 3 valg indeholder |
|-----------|----------------------|
| POG Collector Pack | 3 forskellige caps (fra samme serie) |
| Slammer Strike Pack | 3 forskellige slammere |
| Mystery Bag | 1 cap + 1 slammer + 1 ring/relic — blandet |

Man vælger ét af de 3 — de andre forsvinder.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [BAG]  [STACK]                    SHOP              [SETTINGS] │
│                                                                  │
│  ↺ REROLL                                    [SKULL] REMOVE CAP │
│  10★                                                            │
│  ╔════════════════════════════════════════════════════════╗     │
│  ║  [CAP1]  [CAP2]  [CAP3]  [SLM1]  [SLM2]             ║     │
│  ║   2★      2★      2★      4★      4★                 ║     │
│  ╚════════════════════════════════════════════════════════╝     │
│  (diagonalt bånd som Dice-a-million)                            │
│                                                                  │
│  ┌───────────────────────┐   ┌───────────────────────┐         │
│  │   PAKKE 1             │   │   PAKKE 2             │         │
│  │   (f.eks. Collector)  │   │   (f.eks. Mystery)    │         │
│  │         10★           │   │         8★            │         │
│  └───────────────────────┘   └───────────────────────┘         │
│                                                                  │
│                              [NEXT ROUND (Next: 50★)]           │
│                                                               15★│
└─────────────────────────────────────────────────────────────────┘
```

### Pakke-åbning (pop-up / ny skærm)

```
┌──────────────────────────────────────────────┐
│         POG COLLECTOR PACK — Vælg 1          │
│                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │Common   │  │Uncommon │  │Common   │     │
│  │ [CAP]   │  │ [CAP]   │  │ [CAP]   │     │
│  │ Red     │  │ Jebus   │  │ Alien   │     │
│  │ Raptor  │  │ Skull   │  │         │     │
│  └─────────┘  └─────────┘  └─────────┘     │
└──────────────────────────────────────────────┘
```

### Øverste bånd — individuelle caps og slammere

- 5 pladser, horisontal række på diagonalt bånd
- Typisk 3-4 caps + 1-2 slammere, tilfændigt fra CAP_DEFS / SLAMMER_DEFS
- Vare: ikon + pris i ★ + rarity-badge
- Klik → tooltip (navn, rarity, beskrivelse/effekt)
- Køb → vare forsvinder, score fratrækkes

### Reroll

- Reroller kun øverste bånd (ikke de 2 pakker)
- Første reroll: 10★, fordobles per tryk: 10 → 20 → 40 → 80
- Pris vises på knappen

### Remove/Sell caps

- Kranium-ikon øverst til højre
- Åbner cap-oversigt, klik for at sælge (f.eks. 5★ per cap)
- Bruges til at tynde stakken

---

## Score-logik (bug-fix)

```
RunState.score  ← eneste kilde til sandhed, vises overalt
  + point fra kast
  - threshold ved bestået node
  - shop-køb (bånd og pakker)
  - afstikker-forsøg
```

**Fix:** Al score-visning skal læse fra `RunState.score` — ikke fra en separat kast-tæller.

---

## Reward-skærm (ikke implementeret)

Vises efter bestået node, inden shop.

**Type A — Cap reward** (almindelig):
- 3 tilfældige caps at vælge imellem (varierende rarity)

**Type B — Ring/Relic reward**:
- 3 relics/ringe med passiv effektbeskrivelse
- Valgt relic gemmes i bag

**Type C — Kort reward**:
- 3 one-time-use kort at vælge imellem

**Type D — Cap enchant/upgrade** (sjælden, kræver enchant-system):
- 3 enchant-valg til eksisterende caps
- Ét valg kan erstatte eksisterende upgrade

**Fælles elementer:**
- "Skip rewards" øverst til højre → +5★
- Afstikker klaret → ét af de 3 valg er opgraderet (Common → Uncommon osv.)
- Flow: reward → shop → map

---

## Hvad agenten skal bygge (prioriteret)

### Fase 1 — Score-bug fix (blocker)
- [ ] Al score-visning læser fra `RunState.score`
- [ ] Threshold fratrækkes `RunState.score` ved bestået node
- [ ] Shop-køb fratrækkes `RunState.score`
- [ ] Valider på tværs af map → spil → shop → map

### Fase 2 — Map-polish
- [ ] Target score synlig på alle noder fra starten
- [ ] Aktuel node fremhævet visuelt
- [ ] 3 kort-slots nederst mod midten (tomme placeholders)
- [ ] Bag-ikon øverst venstre (placeholder — åbner tom oversigt)
- [ ] Afstikker-sidegrene på kortet (2 per run, tilfældig node — placeholder)

### Fase 3 — Shop-redesign
- [ ] Øverste bånd: 5 pladser, horisontal på diagonalt bånd
- [ ] Reroll-knap med fordobling
- [ ] Nedre sektion: 2 pakker
- [ ] Pakke-åbning: pop-up med 3 valg afhængig af pakketype
- [ ] Remove/Sell caps
- [ ] Tooltip ved klik

### Fase 4 — Reward-skærm
- [ ] "Choose 1" med 3 kort (Type A: cap)
- [ ] Skip +5★
- [ ] Overgang reward → shop → map
- [ ] Type B/C når systemer er klar

### Fase 5 — Afstikkere
- [ ] Udfordring + pris-prompt
- [ ] Reward-opgradering ved success

### Fase 6 — Bag
- [ ] Bag-oversigt: caps, slammere, relics, kort
- [ ] Kort-udstyring (hvilke 3 er aktive)

---

*Sidst opdateret: session dag 4 — kort vs. relics præciseret, shop 2-pakker opdateret*
