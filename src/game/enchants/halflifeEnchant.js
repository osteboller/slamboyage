// HALFLIFE scores face-down caps at round end — see RoundManager._scoreHalflifeCaps()
// No modification to EffectResult when cap IS flipped normally
export function halflifeEnchant(_cap, _ctx, base) {
    return base;
}
