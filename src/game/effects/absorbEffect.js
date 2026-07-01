export function absorbEffect(cap, ctx) {
    const allRound      = ctx.allRoundCaps ?? ctx.allCaps;
    const getStored     = ctx.getStoredBonus  ?? (() => 0);
    const getRoundBonus = ctx.getRoundBonus   ?? (() => 0);
    const voltagePerCap = ctx.voltageBonus ?? 0;
    const total         = allRound.reduce((sum, c) => {
        if (c === cap) return sum;
        return sum + getStored(c) + getRoundBonus(c) + voltagePerCap;
    }, 0);
    const bonus = Math.min(total, 1000);
    return {
        bonus,
        effectMeta: { type: 'absorb', bonus },
    };
}
