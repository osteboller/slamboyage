// Serie-metadata — label/farve/ikon for hver cap-serie. Ikon er en unicode-emoji
// interim-placeholder; kan erstattes af et rigtigt Aseprite-ikon-asset senere UDEN
// at ændre noget andet sted i koden, da alle forbrugere kun læser dette objekt.
export const SERIES_DEFS = {
    dawgz:         { label: 'DAWGZ',    color: '#c98a3e', icon: '🐾' },
    raptor_strike: { label: 'RAPTORS',  color: '#5a8f4f', icon: '🦖' },
    pewl_ballz:    { label: 'PEWLS',    color: '#3f7d99', icon: '⬤' },
    cosmic_caps:   { label: 'COZMIC',   color: '#6a4fa0', icon: '👽' },
    scary_skullz:  { label: 'SKULLZ',   color: '#4a4a4a', icon: '☠' },
    legacy_discs:  { label: 'LEGACY',   color: '#8a7248', icon: '💿' }, // IKKE ★ — kolliderer visuelt/semantisk med score-stjernen
    zupers:        { label: 'ZUPERS',   color: '#b23a3a', icon: '🦸' },
    zrees:         { label: 'ZREES',    color: '#cc4488', icon: '📼' },
};

// Fallback for evt. ukendt/fremtidig serie-id, så vi aldrig crasher på manglende data.
export const DEFAULT_SERIES_DEF = { label: '???', color: '#888888', icon: '●' };

export function getSeriesDef(seriesId) {
    return SERIES_DEFS[seriesId] ?? DEFAULT_SERIES_DEF;
}

// Færdig HTML til en lille farvet serie-pille — samme visuelle opskrift som
// #cap-detail-series-pill i UIManager.js (${color}22 baggrund, ${color} tekst,
// ${color}55 kant), bare uden at kræve et fast DOM-element at style'e ind i.
// Genbrugt i reward/pack-kort (RewardScreen.js/ShopScreen.js) så cap-navnet
// ikke længere behøver sin egen fulde tekstlinje bare for serien.
export function seriesPillHTML(seriesId) {
    const s = getSeriesDef(seriesId);
    return `<span class="reward-series-pill" style="background:${s.color}22; color:${s.color}; border-color:${s.color}55;">${s.icon} ${s.label}</span>`;
}
