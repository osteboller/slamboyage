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

// Delt med UI'et (boss-info-sticker/kort-tooltip) så den viste procent aldrig
// kan drifte fra hvad der rent faktisk trækkes fra scoren.
export function getNoGlamFamPenalty(ownedCaps) {
    const enchantedCount = ownedCaps.filter(c => c.enchant).length;
    const penaltyPercent = Math.min(10 * enchantedCount, 80);
    return { enchantedCount, penaltyPercent };
}

function noGlamFamMultiplier(ctx) {
    const { penaltyPercent } = getNoGlamFamPenalty(ctx.ownedCaps);
    return 1 - penaltyPercent / 100;
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
