// "Cannot be destroyed, discarded, or exhausted." Protects against ability-
// triggered removal (destroySelf today, exhaustSelf once that exists) by
// forcing the flag back off — same override pattern as gildedEnchant/etc,
// applied AFTER the base effect via EffectResolver._applyEnchant(). Does NOT
// affect the shop's own remove-cap flow (GameState.useDestroy()) — that's an
// unrelated, player-initiated action, never blocked by this enchant.
export function ironcladEnchant(_cap, _ctx, base) {
    return { ...base, destroySelf: false };
}
