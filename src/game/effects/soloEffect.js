// +2 if no other caps land within NEARBY_RADIUS
export function soloEffect(_cap, ctx) {
    const qualifies = ctx.nearbyCaps.length === 0;
    return {
        bonus:      qualifies ? 2 : 0,
        effectMeta: { type: 'solo', qualifies },
    };
}
