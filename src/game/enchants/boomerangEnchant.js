export function boomerangEnchant(cap, _ctx, base) {
    if (Math.random() < 0.5) {
        return { ...base, spawnCaps: [...(base.spawnCaps ?? []), { def: cap.def, enchant: cap.enchant ?? null }] };
    }
    return base;
}
