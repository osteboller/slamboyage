// Kompakt tal-formattering til UI-visning. Runder ALDRIG selve GameState.score —
// kun den tekst der vises. 3 betydende cifre: 0 decimaler ≥100, 1 decimal ≥10,
// 2 decimaler <10 i mantissen, med overflødige decimal-nuller trimmet.
const SUFFIXES = ['', 'k', 'm', 'b', 't', 'q', 'Q'];

// Grænsen for hvornår vi begynder at forkorte er bevidst 10.000, ikke 1.000 —
// "1.2k" er hverken kortere eller renere end "1200" (samme antal tegn, nogle
// gange endda flere, fx "1250" → "1.25k"), så der er intet at vinde før tallet
// rent faktisk er 5+ cifre.
const COMPACT_FROM = 10000;

export function formatScore(n) {
    const sign = n < 0 ? '-' : '';
    n = Math.abs(Math.round(n));
    if (n < COMPACT_FROM) return sign + n;

    let tier     = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
    let mantissa = n / Math.pow(1000, tier);
    let decimals = mantissa >= 100 ? 0 : mantissa >= 10 ? 1 : 2;
    let str      = mantissa.toFixed(decimals);

    // Afrunding kan skubbe mantissen op til 1000 (fx 999.95 → "1000") — ryk tier op
    if (parseFloat(str) >= 1000 && tier < SUFFIXES.length - 1) {
        tier++;
        mantissa = n / Math.pow(1000, tier);
        decimals = mantissa >= 100 ? 0 : mantissa >= 10 ? 1 : 2;
        str      = mantissa.toFixed(decimals);
    }

    // Trim overflødige decimal-nuller ("1.50" → "1.5", "100.0" → "100") —
    // ramme KUN decimal-delen, ikke heltals-nuller (fx "100" må ikke blive "1")
    if (str.includes('.')) str = str.replace(/0+$/, '').replace(/\.$/, '');

    return sign + str + SUFFIXES[tier];
}
