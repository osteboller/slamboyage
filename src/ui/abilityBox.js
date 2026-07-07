/**
 * Bygger en farvekodet "ability-boks" — venstre-kant i given farve, valgfri
 * fed navne-label øverst, forklaring som brødtekst under. Bruges til cap-abilities
 * (med navn) og enchants (uden navn, da navnet allerede er synligt som ikon på
 * selve mønten — at gentage det er spildt lodret plads, se brainstorm-beslutning).
 *
 * @param {object} opts
 * @param {string} opts.color        - hex-farve til venstre-kant + navne-label-tekst
 * @param {string} [opts.name]       - valgfri fed label øverst i boksen (udelad for enchant)
 * @param {string} opts.description  - forklarende brødtekst
 * @param {string} [opts.extraClass] - ekstra CSS-klasse på wrapperen
 */
export function abilityBoxHTML({ color, name = null, description, extraClass = '' }) {
    if (!description) return '';
    const nameHTML = name
        ? `<div class="ability-box-name" style="color:${color}">${name}</div>`
        : '';
    return `<div class="ability-box ${extraClass}" style="border-left-color:${color}">
        ${nameHTML}
        <div class="ability-box-desc">${description}</div>
    </div>`;
}
