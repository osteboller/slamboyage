import { ENCHANT_DEFS } from '../config/enchantDefs.js';

/**
 * Bygger standardiseret cap-thumbnail markup: billede + enchant-holo-overlay + badge.
 * Layout, størrelse, rotation og animation styres IKKE her — det forbliver i hvert
 * kaldesteds egen CSS via de klasser der sendes ind som imgClass/wrapClass.
 *
 * @param {object} entry      - { id?, def, enchant? } eller bare en def direkte
 * @param {object} opts
 * @param {string} opts.wrapClass  - ekstra klasse(r) på wrapper-div
 * @param {string} opts.imgClass   - klasse på <img>, fx 'reward-cap-img'
 * @param {string} opts.idAttr     - attributnavn for id på wrapper, default 'data-cap-id'
 * @param {boolean} opts.dimmed    - tilføjer data-dimmed="true" på wrapper
 * @param {string} opts.extraAttrs - ekstra HTML-attributter på wrapper (fx data-idx, style)
 * @param {string} opts.innerHTML  - ekstra HTML-indhold indeni wrapper efter overlay
 */
export function capThumbnailHTML(entry, opts = {}) {
    const {
        wrapClass  = '',
        imgClass   = 'cap-thumb-img',
        idAttr     = 'data-cap-id',
        dimmed     = false,
        extraAttrs = '',
        innerHTML  = '',
    } = opts;

    const def     = entry.def ?? entry;
    const enchant = entry.enchant ?? null;
    const id      = entry.id;

    // data-sfx="cap_select" her (ikke pr. kaldested) — denne helper er det ene
    // fælles sted ALLE cap-thumbnails i hele spillet renderes igennem (collection,
    // pile-overlay, shop, reward, packs osv.), så pokerjeton-klikket dækker dem
    // automatisk allesammen uden at hvert kaldested selv skal huske det.
    if (!def?.texFront) {
        const hex = '#' + ((def?.color ?? 0xaaaaaa) >>> 0).toString(16).padStart(6, '0');
        return `<span class="cap-enchant-wrap ${wrapClass}" title="${def?.name ?? ''}" data-sfx="cap_select"
                     style="background:${hex};opacity:${dimmed ? 0.55 : 1}" ${extraAttrs}></span>`;
    }

    const enchantDef  = enchant ? ENCHANT_DEFS.find(e => e.id === enchant) : null;
    const overlayHTML = enchantDef
        ? `<img class="enchant-thumb-overlay" src="assets/enchants/${enchantDef.overlayAsset}" alt="">` +
          `<div class="enchant-thumb-badge" style="background:${enchantDef.color}">${enchantDef.icon}</div>`
        : '';

    const idFrag = id != null ? `${idAttr}="${id}"` : '';

    return `<div class="cap-enchant-wrap ${wrapClass}" ${idFrag} data-sfx="cap_select"` +
           ` title="${def.name}" ${dimmed ? 'data-dimmed="true"' : ''} ${extraAttrs}>` +
           `<img class="${imgClass}" src="${def.texFront}" alt="${def.name}">` +
           `${overlayHTML}${innerHTML}</div>`;
}
