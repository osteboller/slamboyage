// Generisk effekt-type (samme mønster som jackpot/martyr) — targeting/fjernelse
// af de faktiske mål sker i RoundManager (Phase 1.5), denne funktion erklærer
// bare INTENT + bonus pr. faktisk exhausted cap. "Territorial" er selve
// ability-navnet — "exhaust" er den underliggende, genbrugelige MEKANIK
// (exhaustBonus/exhaustFilter-felterne), ligesom destroySelf er mekanikken
// bag de individuelt navngivne jackpot/martyr.
export function territorialEffect(_cap, _ctx) {
    return { exhaustBonus: 4, exhaustFilter: 'other_series_very_near' };
}
