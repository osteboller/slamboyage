// Multiplikative passiver (first/last/parity/rarity). Hvert AMPLIFYZ-kort
// tilføjer ÉN ekstra trigger af det kombinerede bidrag (stakker, ligesom
// DÜBBLE/activeDouble) — 1 kort = kvadreret (base²), 2 kort = base³, osv.
// stacks = antal AMPLIFYZ brugt denne runde (0 = ingen effekt, base¹).
export function passiveMultiplier(slammers, matchFn, stacks = 0) {
    const base = slammers.filter(matchFn).reduce((m, s) => m * s.passive.value, 1);
    return stacks > 0 ? base ** (1 + stacks) : base;
}

// Additive passiver (flatBonus). Samme stak-logik: hvert kort lægger ÉT ekstra
// bidrag oveni (1 kort = ×2, 2 kort = ×3, osv.).
export function passiveFlatBonus(slammers, matchFn, stacks = 0) {
    const base = slammers.filter(matchFn).reduce((sum, s) => sum + s.passive.value, 0);
    return stacks > 0 ? base * (1 + stacks) : base;
}
