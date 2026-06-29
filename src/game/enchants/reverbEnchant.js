import { EFFECTS } from '../effects/index.js';

export function reverbEnchant(cap, ctx, base) {
    const fn = EFFECTS[cap.def?.effect];
    if (!fn) return base;
    const second = fn(cap, ctx);
    return {
        ...base,
        bonus:         base.bonus + (second.bonus ?? 0),
        returnToStack: base.returnToStack || (second.returnToStack ?? false),
        spawnCaps:     [...(base.spawnCaps ?? []), ...(second.spawnCaps ?? [])],
    };
}
