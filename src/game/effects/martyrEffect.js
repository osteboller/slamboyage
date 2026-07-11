// 2.5× multiplier to every other flipped cap within NEARBY_RADIUS, then
// permanently destroys itself — same aura mechanism/range as rallyEffect
// (auraFilter: 'nearby'), but auraMultiplier instead of a flat auraBonus,
// since the cap doesn't survive to give it again. See 9juli_destroy-ability-draft.md.
export function martyrEffect(_cap, _ctx) {
    return { auraMultiplier: 2.5, auraFilter: 'nearby', destroySelf: true };
}
