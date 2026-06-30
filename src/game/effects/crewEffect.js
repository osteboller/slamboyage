// +1 to every other flipped cap of the same series
export function crewEffect(_cap, _ctx) {
    return { auraBonus: 1, auraFilter: 'series' };
}
