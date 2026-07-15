// Binder-tier-metadata — passivt, altid-aktivt samler-item der giver en permanent
// FLAD bonus til én cap-series' scoring-multiplier (inspireret af "stamps" i
// Dice 'n Million). Stakker ADDITIVT på tværs af ALLE ejede binders for samme
// serie, uanset tier/duplikater — se GameState.seriesBonus(). INGEN slot-loft
// (i modsætning til MAX_OWNED_SLAMMERS) — ownedBinders er et ubegrænset array.
export const BINDER_TIERS = {
    pap:     { label: 'Stock',   value: 0.2, color: '#b08d57' },
    leather: { label: 'Leather', value: 0.5, color: '#6b3f2a' },
    ruby:    { label: 'Ruby',    value: 0.8, color: '#a8123e' },
};

// Relativ trækvægt for hvilken tier en Binder Pack-choice ruller — Stock er
// bevidst almindelig, Ruby MEGET sjælden (~1%).
const BINDER_TIER_WEIGHTS = { pap: 85, leather: 14, ruby: 1 };

export function pickBinderTier() {
    const entries = Object.entries(BINDER_TIER_WEIGHTS);
    const total   = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [tier, w] of entries) {
        r -= w;
        if (r <= 0) return tier;
    }
    return entries[entries.length - 1][0];
}
