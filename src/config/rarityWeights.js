// Progression-skaleret rarity-vægtning — bruges alle steder caps (og cap-lignende
// pools) rulles tilfældigt, så en spiller ikke ser en bunke legendaries lige efter
// node 1-1. Vægtene skifter med gs.loop (1, 2, 3+), IKKE med node-index inden for
// et loop — se docs for baggrund (DaM-inspireret gacha-kurve).
//
// rarity: 1=common, 2=uncommon, 3=rare, 4=legendary.
const WEIGHTS_BY_LOOP = [
    { 1: 70, 2: 25, 3: 5,  4: 0  }, // loop 1
    { 1: 50, 2: 30, 3: 15, 4: 5  }, // loop 2
    { 1: 35, 2: 30, 3: 22, 4: 13 }, // loop 3+
];

function weightsForLoop(loop) {
    const idx = Math.min(Math.max((loop ?? 1) - 1, 0), WEIGHTS_BY_LOOP.length - 1);
    return WEIGHTS_BY_LOOP[idx];
}

// Vælger ÉT element fra `items` (skal have en `.rarity`-property, 1-4), vægtet
// efter loop. Falder tilbage til ren uniform tilfældighed hvis pool'en kun
// indeholder rarities med vægt 0 for det loop (fx en rent legendary-pool i loop 1).
export function pickWeightedItem(items, loop) {
    if (items.length === 0) return undefined;
    const weights = weightsForLoop(loop);
    const total   = items.reduce((sum, it) => sum + (weights[it.rarity ?? 1] ?? 1), 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    let r = Math.random() * total;
    for (const it of items) {
        r -= (weights[it.rarity ?? 1] ?? 1);
        if (r <= 0) return it;
    }
    return items[items.length - 1];
}

// Vælger `count` DISTINKTE elementer (uden tilbagelægning) fra `items`, vægtet
// efter loop pr. træk. Bruges til "vælg 3 forskellige caps"-rewards/bands.
export function pickWeightedItems(items, loop, count) {
    const remaining = [...items];
    const picked    = [];
    for (let i = 0; i < count && remaining.length > 0; i++) {
        const item = pickWeightedItem(remaining, loop);
        picked.push(item);
        remaining.splice(remaining.indexOf(item), 1);
    }
    return picked;
}
