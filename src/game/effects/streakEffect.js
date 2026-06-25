// +1 per other cap flipped in this same throw
export function streakEffect(_cap, ctx) {
    return { bonus: Math.max(0, ctx.capsFlippedThisThrow - 1) };
}
