import { ZONE_INNER_R, ZONE_OUTER_R } from '../../config/constants.js';

// +1 bonus if cap lands within the gold inner ring
export function zoneInnerEffect(_cap, ctx) {
    return { bonus: ctx.distanceFromCenter < ZONE_INNER_R ? 1 : 0 };
}

// +1 bonus if cap lands beyond the blue outer ring
export function zoneOuterEffect(_cap, ctx) {
    return { bonus: ctx.distanceFromCenter > ZONE_OUTER_R ? 1 : 0 };
}
