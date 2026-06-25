// Echo: 50% chance the cap returns to the stack after scoring
export function echoEnchant(_cap, _ctx, base) {
    if (Math.random() < 0.5) {
        return { ...base, returnToStack: true, fx: 'echo' };
    }
    return base;
}
