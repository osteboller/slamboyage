// overlayAsset: filename in assets/enchants/ — dark bg eliminated by additive blending
const FALLBACK = 'enchant fx overlay.png';

export const ENCHANT_DEFS = [
    {
        id:           'gilded',
        name:         'GILDED',
        icon:         '◇',
        color:        '#d4a800',
        overlayAsset: 'honeycomb.png',
        description:  'Multiplies its own value by ×2.',
    },
    {
        id:           'reverb',
        name:         'REVERB',
        icon:         '∞',
        color:        '#7722cc',
        overlayAsset: 'reverb.png',
        description:  'Activates its effect twice.',
    },
    {
        id:           'boomerang',
        name:         'BOOMERANG',
        icon:         '↩',
        color:        '#1a8a3a',
        overlayAsset: 'boomerrang.png',
        description:  '1 in 2 chance of returning to the stack after being flipped.',
    },
    {
        id:           'ironclad',
        name:         'IRONCLAD',
        icon:         '▣',
        color:        '#555566',
        overlayAsset: 'ironclad.png',
        description:  'Cannot be destroyed, discarded, or exhausted.',
    },
    {
        id:           'feather',
        name:         'FEATHER',
        icon:         '○',
        color:        '#0099cc',
        overlayAsset: 'feather.png',
        description:  "Doesn't take up space in the stack.",
    },
    {
        id:           'halflife',
        name:         'HALFLIFE',
        icon:         '½',
        color:        '#cc5500',
        overlayAsset: 'halflife.png',
        description:  'Only loses half of its extra value when the round ends.',
    },
];
