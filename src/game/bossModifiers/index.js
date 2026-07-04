// Boss-gimmick-hooks: rene funktioner der returnerer en multiplier for kastets
// finalScore. Holdes UDENFOR positionChain (den visuelle score-float-kæde),
// så de ikke forstyrrer relic-multiplier-animationen — se RoundManager.

// ctx: { actualWonCount, ownedCaps }
function evenStevenMultiplier(ctx) {
    return ctx.actualWonCount % 2 === 0 ? 1 : 0;
}

function oddToddMultiplier(ctx) {
    return ctx.actualWonCount % 2 === 1 ? 1 : 0;
}

function noGlamFamMultiplier(ctx) {
    const enchantedCount = ctx.ownedCaps.filter(c => c.enchant).length;
    const penalty = Math.min(0.10 * enchantedCount, 0.80);
    return 1 - penalty;
}

const BOSS_MULTIPLIERS = {
    even_steven: evenStevenMultiplier,
    odd_todd:    oddToddMultiplier,
    no_glam_fam: noGlamFamMultiplier,
};

export function getBossThrowMultiplier(gimmickId, ctx) {
    const fn = BOSS_MULTIPLIERS[gimmickId];
    return fn ? fn(ctx) : 1;
}
