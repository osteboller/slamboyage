// +1 per cap within VERY_NEARBY_RADIUS at rest
export function neighbourEffect(_cap, ctx) {
    const count = ctx.closeNeighbourCaps.length;
    return {
        bonus:      count,
        effectMeta: count > 0 ? { type: 'neighbours', count } : null,
    };
}
