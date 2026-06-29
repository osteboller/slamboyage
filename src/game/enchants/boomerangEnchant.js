export function boomerangEnchant(_cap, _ctx, base) {
    if (Math.random() < 0.5) {
        return { ...base, returnToStack: true, fx: 'boomerang' };
    }
    return base;
}
