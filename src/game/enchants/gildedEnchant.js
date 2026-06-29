export function gildedEnchant(_cap, _ctx, base) {
    return { ...base, baseValue: (base.baseValue ?? 1) * 2 };
}
