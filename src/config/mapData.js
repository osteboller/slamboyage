// Node-thresholds pr. loop — håndskrevet tabel for loop 1-4 (aftalt med
// bruger), IKKE en enkelt base-liste × konstant multiplikator som tidligere:
// forholdet mellem loop 1 og loop 2's tal er ikke konstant på tværs af
// noderne, så en fælles skalerings-faktor kunne aldrig ramme begge præcist.
// "boss" er thresholden for en NORMAL boss (clearScoreMultiplier ~1.3, se
// bossDefs.js) — bosses med en anden multiplier skalerer relativt til denne
// baseline i stedet for at ligge oveni den, se getLoopThresholds() nedenfor.
export const LOOP_NODE_THRESHOLDS = [
    { nodes: [2,   4,    8,    15,   20  ], boss: 20     },
    { nodes: [15,  25,   40,   70,   110 ], boss: 150    },
    { nodes: [110, 180,  300,  500,  700 ], boss: 1000   },
    { nodes: [700, 1200, 2000, 3500, 6000], boss: 10000  },
];

// Loop 5+ (ikke eksplicit tabuleret): boss vokser ×EXTRAPOLATE_BOSS_GROWTH pr.
// loop udover tabellen, almindelige noder skaleres som samme forhold til
// bossen som loop 4's egne noder havde (0.07/0.12/0.20/0.35/0.60 af bossen)
// — det mønster er det "modneste" (sidste håndskrevne loop) og bruges derfor
// som skabelon for al fremtidig ekstrapolering.
const EXTRAPOLATE_BOSS_GROWTH = 2.5;
const LAST_LOOP = LOOP_NODE_THRESHOLDS[LOOP_NODE_THRESHOLDS.length - 1];
const LAST_LOOP_NODE_RATIOS = LAST_LOOP.nodes.map(n => n / LAST_LOOP.boss);

// Den "normale" clearScoreMultiplier bosses uden noget specielt har lige nu
// (bossDefs.js) — tabellens "boss"-tal ER thresholden for DEN gruppe. Andre
// bosses (fx Maxmillian, ×2.0) skalerer RELATIVT til denne baseline, så
// forholdet mellem "en nem boss" og "Maxmillian" forbliver konstant på tværs
// af alle loops, i stedet for at blive et fast tillæg der outskaleres.
const BASELINE_BOSS_MULT = 1.3;

export function getLoopThresholds(loop) {
    if (loop <= LOOP_NODE_THRESHOLDS.length) return LOOP_NODE_THRESHOLDS[loop - 1];
    const extraLoops = loop - LOOP_NODE_THRESHOLDS.length;
    const boss  = Math.round(LAST_LOOP.boss * Math.pow(EXTRAPOLATE_BOSS_GROWTH, extraLoops));
    const nodes = LAST_LOOP_NODE_RATIOS.map(r => Math.round(boss * r));
    return { nodes, boss };
}

// bossDef.clearScoreMultiplier (bossDefs.js) er kalibreret mod BASELINE_BOSS_MULT,
// ikke anvendt oveni loopets rå boss-tal — se kommentaren i getLoopThresholds().
export function getBossClearScore(loop, bossDef) {
    const { boss } = getLoopThresholds(loop);
    const mult = bossDef?.clearScoreMultiplier ?? BASELINE_BOSS_MULT;
    return Math.ceil(boss * (mult / BASELINE_BOSS_MULT));
}

// Cap-pris i shop-båndet — pr. rarity (1=common..4=legendary), IKKE flad
// længere. Vokser pr. NODE ryddet (se GameState.capPriceMultiplier), bevidst
// IKKE pr. køb i løbet af runnet (i modsætning til consumable-kort).
export const CAP_PRICE_BY_RARITY = { 1: 2, 2: 3, 3: 5, 4: 7 };
export const CAP_PRICE = CAP_PRICE_BY_RARITY[1]; // fallback for caps uden rarity-felt

// Cap-/pakke-priser vokser pr. node ryddet (GameState._totalNodesCleared,
// run-bredt, nulstilles IKKE pr. loop) i stedet for i spring pr. loop —
// tidligere var priserne flade gennem en hel loop, hvilket gjorde dem for
// dyre lige efter node 1 (hvor man har tjent mindst) og relativt for billige
// sent i loopet (hvor man har tjent mest). START_DISCOUNT gør prisen
// billigere end "normalt" lige efter node 1, GROWTH_PER_NODE eskalerer den
// derefter jævnt.
export const SHOP_PRICE_START_DISCOUNT = 0.6;
export const SHOP_PRICE_GROWTH_PER_NODE = 1.3;

// Ren eksponentiel vækst accelererer uundgåeligt for evigt — bekræftet ved
// live-test: føltes fint til og med node 3-5 (~20 noder ryddet, ×114), men
// for højt ved 4-2 (~22 noder, ×193 — kun 2 noder senere). I stedet for at
// designe en helt ny kurve (risikerer at ødelægge den del der allerede
// føltes rigtig) sættes et simpelt loft, der ikke ændrer noget FØR det
// rammes — kun bremser den videre acceleration. Kan hæves senere når/hvis
// senere loops viser sig at have brug for det.
export const SHOP_PRICE_MAX_MULT = 150;

// Base-sandsynlighed for at en cap i shop-båndet allerede er enchantet med en
// tilfældig enchant, uafhængigt af reroll-antal (ren pr.-slot-sandsynlighed,
// ikke en tæller) — ~1 ud af 5 refresh (5 caps/bånd) i gennemsnit. Eksponeret
// som GameState.shopEnchantChance i stedet for brugt direkte, så en fremtidig
// slammer-passiv kan modificere den uden at ShopScreen skal ændres.
export const SHOP_ENCHANT_BASE_CHANCE = 0.04;
