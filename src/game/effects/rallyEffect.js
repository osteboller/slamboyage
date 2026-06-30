// +1 to every other flipped cap within NEARBY_RADIUS
export function rallyEffect(_cap, _ctx) {
    return { auraBonus: 1, auraFilter: 'nearby' };
}
