# SLAMBERZ — Effects Reference
> Design reference for caps, relics, enchants and tokens — inspired by Dice a Million.
> Update continuously as new ideas emerge.

---

## Concept Translation: Dice a Million → Slamberz

Three-column translation: Danish game term → Dice a Million (EN) → Slamberz (EN)

| Danish | Dice a Million (EN) | Slamberz (EN) |
|---|---|---|
| Terning | Die | Cap |
| Samling | Bag | Collection |
| Aktiv stakken der kastes | Hand | Stack (the active throw) |
| Antal i hånden | Hand size | Stack size |
| Point / pips | Pips / face value | Score (★) |
| Ekstra værdi | Extra value | Bonus |
| Ganger | Multiplier | Multiplier |
| Passiv ring | Ring | Relic |
| Forstærkning | Enchantment | Enchant |
| Engangskort | Card | Token |
| Kast | Roll | Throw |
| Runde (node) | Round | Node |
| Nabo-terning | Nearby die | Nearby cap |
| Tæt nabo-terning | Very nearby die | Close neighbour cap |
| Udtøm | Exhaust | Exhaust (skips effect for rest of node) |
| Destruer | Destroy | Destroy (permanently removed from collection) |
| Kassér | Discard | Discard (removed from this throw only) |
| Ladning | Charge | Charge (counts up, triggers at max) |
| Penge / valuta | Pips (carried over) | Score ★ (single currency, carried over) |

---

## Core Concepts

### Win / Fail Condition

- **Win a node:** score ≥ target after all throws are used
- **Fail a node:** score < target after all throws — run ends immediately, no reward or shop
- **Win the run:** complete all nodes in a face (currently 5 nodes per face)
- Target score is visible on all nodes from the start of the map screen

Unused throws have no inherent value by default. A relic (equivalent to Haste Ring) can convert skipped throws into a permanent score multiplier — but this is an edge case, not the default flow.

### Currency

A single currency: **Score (★)**. Carried over between nodes after the threshold is deducted.

```
RunState.score  ← single source of truth
  + score earned from throws
  - node threshold deducted on success
  - shop purchases (band items and packs)
  - detour (afstikker) attempt costs
```

All UI reads from `RunState.score` — never from a separate throw counter.

### The Stack Model

- The player owns a **collection** of caps
- Each throw, caps are **randomly drawn** from the collection up to the current **stack size limit**
- There is **no hand selection step** — what is drawn is what is thrown
- Stack size has a default cap (e.g. 10), upgradeable via relics
- The draw order determines the physical stacking order on the table

**Stack size is the primary resource constraint** — equivalent to hand size in Dice a Million.

### The Slammer

Separate from the stack. Not drawn from the collection. Has its own stats (`mass`, `speedMult`, `precisionMult`, `strengthMult`). Not on the current roadmap for further development beyond what is already implemented.

### Face-up / Face-down

After a blast, each cap settles either **face-up** or **face-down**.

```
cap.isFaceUp()   → effect triggers, cap contributes score
cap.isFaceDown() → nothing happens (neutral / lost)
```

Face-down is not an alternative trigger — it is silence. Specific caps and enchants that deviate from this are always marked explicitly (e.g. Casino Cap, Fragile enchant).

### Enchants

- Each cap can hold **maximum one enchant** at a time
- An enchant **can be replaced** by a new one (old enchant is lost)
- Enchants are distinct from a cap's **base effect** — a cap can have both
  - Example: a cap with base effect "2× to all nearby caps" can also have the Echo enchant (triggers that base effect twice)
- Enchants are acquired via reward screen (Type D) or shop

### Proximity

Physical distance on the table after blast maps to Dice a Million's "nearby" / "very nearby".

```js
// constants.js
NEARBY_RADIUS: 8,        // cm — broad radius
VERY_NEARBY_RADIUS: 3,   // cm — tight radius

function getNearby(cap, allCaps, radius) {
  return allCaps.filter(c => c !== cap && dist2D(cap.pos, c.pos) < radius);
}
```

---

## Run Structure

A face consists of **6 nodes total**: 5 play nodes and 1 relic node.

```
[1-1] → [REWARD+SHOP] → [1-2] → [REWARD+SHOP] → [RELIC NODE] → [1-3] → [REWARD+SHOP] → [1-4] → [REWARD+SHOP] → [1-5] → [RUN COMPLETE]
  └─ detour?                └─ detour?                                       └─ detour?        └─ detour?
```

- 5 play nodes + 1 relic node per face, left → right
- Relic node sits between node 2–3 or node 3–4, random per run
- 2 detours per run, random placement on play nodes
- After each successful play node: reward screen → shop → back to map
- Rim landing has no special scoring state (not in scope)

### Node Types

**Play node** (1-1 through 1-5)
```
1. Map screen → player clicks node
2. Play node (1–3 throws, existing game loop)
3a. Score ≥ target → reward screen → shop → map
3b. Score < target → run over screen → main menu
```

**Relic node** (node 6, visible on map with its own icon)
```
1. Map screen → player clicks relic node
2. Choose 1 of 3 relics (no throw phase)
3. Back to map
```
No shop after the relic node. No fail state.

### Detours (Afstikkere)

- Side branch visible on the map, attached to a play node
- The branch icon shows exactly what the upgraded reward will be — e.g. an enchant icon, a relic icon, or a rarity badge — so the player can make an informed decision before paying
- Caps-based challenge, e.g. "flip at least 3 caps in one throw"
- Each attempt costs ★ — no free tries
- Failure → ★ spent, can retry by paying again
- Success → the reward after the attached node is upgraded, either:
  - **Type upgrade** — reward type changes (e.g. cap reward → enchant reward)
  - **Rarity upgrade** — same reward type but higher rarity (e.g. common cap → rare cap)

---

## Reward Screen

Shown after a successful node, before the shop. Player picks 1 of 3.

| Type | Contents | When |
|---|---|---|
| **A — Cap reward** | 3 caps of varying rarity | Common reward |
| **B — Relic reward** | 3 relics with passive effect description | Occasional |
| **C — Token reward** | 3 one-time-use tokens | Occasional |
| **D — Enchant reward** | 3 enchant options for existing caps | Rare |

- "Skip rewards" button top-right → +5★
- Detour cleared → one of the 3 choices is upgraded in rarity
- Flow: reward → shop → map

---

## Shop

Two sections:

**Top band** — 5 individual caps/slammers, buy directly. Reroll available (10★, doubles per press: 10→20→40→80). Only the top band rerolls.

**Lower section** — 2 packs. Click a pack to open it → 3 choices. Pick 1, others disappear.

| Pack type | 3 choices contain |
|---|---|
| POG Collector Pack | 3 caps (same series) |
| Slammer Strike Pack | 3 slammers |
| Mystery Bag | 1 cap + 1 slammer + 1 relic |

Skull icon top-right → sell caps (e.g. 5★ each) to thin the collection.

---

## PART 1 — CAPS

Caps are the primary building blocks. Each cap has a **base score**, an optional **base effect**, an optional **enchant**, and a **rarity**. Every cap is a D2 — it lands face-up or face-down. Caps are differentiated by the logic of their effect, not by number of faces.

### Category A — Pure Scoring Caps

Simple caps that contribute score when face-up. The backbone of any stack.

| Cap | Inspired by | Effect |
|---|---|---|
| **Standard Cap** | D6 | Face-up: +1 score |
| **Lucky Cap** | Cosmic Die | Face-up: score is a random roll resolved at settle time |
| **Mirror Cap** | Fishdie | Face-up: copies the score of the nearest other face-up cap |
| **Echo Cap** | Echo Cube | Face-up: re-triggers the effect of one random cap from the previous throw |

### Category B — Multiplier Caps

Multiply the score of other caps. Low direct score, high leverage.

| Cap | Inspired by | Effect |
|---|---|---|
| **Copper Cap** | Copper Die | Face-up: 4× multiplier to all caps on the table |
| **Amethyst Cap** | Amethyst | Face-up: 1.5× multiplier to everything |
| **Diamond Cap** | Diamond Die | Face-up: 5× multiplier to everything — destroys itself if a specific condition is met |
| **Carlos Cap** | Carlos's Die | Face-up: X× multiplier to everything, X = number of face-up caps this throw |

### Category C — Proximity Caps

Effect depends on physical landing distance after blast.

| Cap | Inspired by | Effect |
|---|---|---|
| **Pulse Cap** | D12 | Face-up: 2× multiplier + flat bonus to close neighbour caps |
| **Boost Cap** | D7 | Face-up: +bonus to nearby caps, scales with their own score |
| **Cluster Cap** | D8 | Face-up: +8 bonus to all nearby caps that already have score ≥ 8 |
| **Solo Cap** | Cupidie | Face-up: if exactly one nearby cap — 5× to that cap and this one. Otherwise: nothing |
| **Black Hole Cap** | Dark Matter D4 | Face-up: 10× to itself per nearby cap — multiplies those nearby caps by 0 |

### Category D — Conditional Caps

Effect triggers only under a specific context.

| Cap | Inspired by | Effect |
|---|---|---|
| **Casino Cap** | Casino Die | Face-down *(exception)*: flips all other caps to face-up |
| **Coin Cap** | Bottle Cap / 2-faced coin | Face-up: 2× to all other face-up caps. Thematic core cap — literally a D2 |
| **Dada Cap** | Dada Die | Face-up: 3× multiplier to all other face-up caps with the same base score |
| **Even Cap** | Decimal Die | Face-up: all caps on the table count as face-up for scoring this throw |

### Category E — Volatile Caps

High risk, high reward. Destruction is permanent — cap is removed from collection.

| Cap | Inspired by | Effect |
|---|---|---|
| **Glass Cap** | Glass Die | Face-up: 2× to everything — destroys itself if more than half the stack lands face-down |
| **Dynamite Cap** | Fire Die | Face-up: destroys the nearest nearby cap — remaining caps score 2× |
| **Hourglass Cap** | Hourglass | Face-up: consumes one extra throw — gives 2× multiplier per throw consumed |
| **Jackpot Cap** | D666 | Face-up: very high flat score — destroys itself afterwards |

### Category F — Utility / Support Caps

Modify game state rather than scoring directly.

| Cap | Inspired by | Effect |
|---|---|---|
| **Charge Cap** | Atom Die | Face-up: +1 charge to all nearby caps that have a charge mechanic |
| **Fibonacci Cap** | Fibonacci's Die | Face-up on a perfect throw (all caps face-up): permanently upgrades its own base score one step |
| **Marble Cap** | Marble cap | Face-up: increases the chance of drawing rare caps in future throws this run |

---

## PART 2 — RELICS

Relics are passive modifiers — always active for the entire run. Collected via reward screen (Type B) or Mystery Bag. Stored and visible in the bag screen. Never need to be activated.

### Category A — Global Score Relics

| Relic | Inspired by | Effect |
|---|---|---|
| **Aura Stone** | Aura Ring | Increases proximity radius for all nearby cap effects |
| **Steady Anchor** | Analog Mini-Watch | Every 6th throw: 6× multiplier to everything |
| **Noble Entry** | Glamorous Ring | On the first throw of a node: 4× multiplier to everything |
| **Last Gasp** | Last Breath | On the last throw of a node: 4× multiplier to everything |
| **Double Jewel** | Good Job Sticker | Doubles all multipliers *(strong — late unlock)* |
| **Resonance** | Deja-Vu Ring | Caps thrown earlier this node give 2.5× |
| **Haste Relic** | Haste Ring | Skipping an unused throw converts it to a permanent +0.1× score multiplier |

### Category B — Stack Interaction Relics

| Relic | Inspired by | Effect |
|---|---|---|
| **Extra Slot** | Noble Ring | +1 stack size |
| **Pinned Cap** | Friendship Ring | Choose one cap — always included in the draw regardless of stack size |
| **Fission Stone** | Fission Ring | When a cap is destroyed: draw 1 extra cap on the next throw |
| **Magnet** | Attracts everything | All caps pulled toward centre on landing (physics modifier) |
| **Equivalent Link** | Equivalent Link | If all caps land the same (all face-up or all face-down): X× multiplier |
| **Rusty Gear** | Rusty Gear | 4× multiplier to everything — stack size reduced by 1 |

### Category C — Chaos / Luck Relics

| Relic | Inspired by | Effect |
|---|---|---|
| **Blood Relic** | Blood Ring | Each throw: −1★ (multipliable). Increases chance of rare cap in draw |
| **Fire Relic** | Fire Ring | 3× multiplier to everything — one random cap destroyed after scoring |
| **Cursed Relic** | Cursed Ring | Lowest-scoring face-down cap multiplied by 0 — all others multiplied by its score |

### Category D — Economy / Progression Relics

| Relic | Inspired by | Effect |
|---|---|---|
| **Common Buff** | Blank Ring | 5× multiplier to common (white) caps |
| **Discount** | Bling Bling | 50% discount in the shop |
| **Collector's Edge** | Dog Fang Ring | Perfect throw (all face-up): +0.1 permanent score multiplier for this cap type |
| **Lucky Eye** | Lucky Ring | Free reroll of offered rewards at end of node |

---

## PART 3 — ENCHANTS

Enchants modify a single cap's behaviour permanently. Max **one enchant per cap**. Can be replaced (old enchant lost). Distinct from the cap's base effect — both can coexist.

> **Laconism → Free:** In Dice a Million, Laconism means a die takes no hand space. In Slamberz, the equivalent is a cap that **does not count toward stack size limit** — equally powerful since stack size is the primary constraint.

| Enchant | Inspired by | Effect in Slamberz |
|---|---|---|
| **Free** | Laconism | Does not count toward stack size limit |
| **Eternal** | Eternal | Cannot be destroyed or discarded |
| **Echo** | Echo | Triggers its base effect twice |
| **Negative** | Negative | Score is subtracted from total instead of added |
| **Rotten** | Deciduous | Loses accumulated bonus instead of adding it |
| **Fragile** | Fragile | Destroyed if it lands face-down |
| **Loyal** | Loyalty | 50% chance of returning to the draw pool this throw instead of cycling normally |
| **Parasite** | Parasite | Adds one blank (zero-score) cap to the collection each node |
| **Perennial** | Perennial | Only loses half its accumulated bonus at node end |
| **Weak** | Weak | Halves all multipliers ≥ 2× that this cap gives or receives |
| **Wealth** | Wealth | Doubles this cap's own score |

---

## PART 4 — TOKENS

Tokens are single-use. Held between nodes, used at the player's discretion. Max 3 equipped at a time (visible as card slots at the bottom of the map screen).

### Timing categories:
- **Pre-throw** — changes rules before the slammer is released
- **Post-landing** — changes the result after caps have settled
- **Between nodes** — permanent changes to the collection or run state

| Token | Inspired by | Timing | Effect |
|---|---|---|---|
| **Extra Throw** | Extra roll | Pre-throw | +1 throw this node |
| **Flip** | Choose face | Post-landing | Flip one cap from face-down to face-up |
| **Clone** | Clone | Pre-throw | Add a one-time copy of a chosen cap to this throw |
| **Power Up** | Power Up | Pre-throw | +8 bonus to all caps in the next throw |
| **Double** | Multiply | Pre-throw | 2× multiplier to all caps in the next throw |
| **Resurrect** | Resurrect | Between nodes | Restore the last destroyed cap to the collection |
| **Transform** | Transform | Between nodes | Replace one cap with a random new one |
| **Reroll** | Reroll | Any | Reroll offered rewards |
| **Scorched** | Burnt Card | Pre-throw | All caps destroyed on landing — but score double |
| **Shadow Glass** | Shadow Glass | Between nodes | Add a permanent copy of one cap — both copies receive a random curse enchant |

---

## PART 5 — SCORING PIPELINE (pseudocode)

```js
// Run after allStill() and resolveNearbyEffects()
function calculateThrowScore(caps, relics) {
  let total = 0;

  for (const cap of caps) {
    // 1. Base score — only if face-up (default rule)
    let score = cap.isFaceUp() ? cap.baseScore : 0;

    // 2. Bonus — accumulated via nearby cap effects and enchants
    score += cap.bonus;

    // 3. Local multiplier — from this cap's own effect or enchant
    score *= cap.localMultiplier ?? 1;

    total += score;
  }

  // 4. Global relics applied last, in acquisition order
  for (const relic of relics) {
    total *= relic.globalMultiplier ?? 1;
  }

  return Math.floor(total);
}
```

**Order matters:** local score → local multiplier → global multiplier.
Global relics multiply the already-resolved total — this is where exponential scaling happens.

---

## PART 6 — PROXIMITY RESOLUTION (pseudocode)

```js
// Run after allStill(), before scoring
// Lives in ScoreManager — receives positions from PhysicsEngine, no Cannon dependency
function resolveNearbyEffects(caps) {
  for (const cap of caps) {
    if (!cap.isFaceUp()) continue; // face-down caps never trigger
    if (!cap.hasAreaEffect) continue;

    const nearby = caps.filter(c =>
      c !== cap && dist2D(cap.position, c.position) < NEARBY_RADIUS
    );
    const closeNeighbour = nearby.filter(c =>
      dist2D(cap.position, c.position) < VERY_NEARBY_RADIUS
    );

    cap.effect.apply(cap, nearby, closeNeighbour);
  }
}
```

---

## PART 7 — STACK MODEL SUMMARY

| Concept | Dice a Million | Slamberz |
|---|---|---|
| What you own | Bag of dice | Collection of caps |
| What gets played | Drawn hand (subset of bag) | Random draw up to stack size limit |
| Selection step | Yes — choose which drawn dice to roll | No — draw = throw |
| Size limit | Hand size (upgradeable) | Stack size (upgradeable via relics) |
| "Free slot" mechanic | Laconism (no hand space used) | Free enchant (does not count toward stack size) |
| Permanent removal | Destroy (gone from bag) | Destroy (gone from collection) |
| Temporary removal | Discard (gone this roll) | Discard (gone this throw) |
| Guaranteed inclusion | Friendship Ring | Pinned Cap relic |
| Skip unused plays | Haste Ring → permanent multiplier | Haste Relic → same |

---

## PART 8 — IMPLEMENTATION ORDER

1. **Score bug fix** — all UI reads from `RunState.score`; threshold deducted on node success; shop purchases deducted immediately
2. **Face-up/down detection** — robust, this is the foundation of everything
3. **Scoring pipeline** — base → bonus → local multiplier → global multiplier
4. **Stack draw system** — random draw from collection up to stack size limit
5. **Relic system** — array of active relics, each with `globalMultiplier` and/or `onThrowEnd()` / `onNodeEnd()`
6. **Cap types** — start with 3–4 caps (Standard, Coin, Diamond, Copper) to validate the pipeline
7. **Proximity model** — run after physics settle, compute `nearby` and `closeNeighbour` once per throw
8. **Reward screen** — Type A (cap) first; Type B/C/D when systems are ready
9. **Enchants** — `modifiers` array on cap object, processed in scoring pipeline
10. **Tokens** — UI system + `executeToken(token, gameState)` + 3 equipped slots on map screen
11. **Unlock system** — condition check after node, unlocks new caps/relics/enchants

---

*Last updated: session 3 — win/fail condition, currency, run structure, enchant rules (max 1, replaceable), rim landing (not in scope), slammer (not on roadmap), integrated MAP_AND_SHOP_SPEC.*
