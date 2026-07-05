export const TRICK_SHOTS = [
    {
        id:          'flip_one',
        name:        'Flip Just One',
        description: 'Flip exactly 1 cap in a single throw',
        cost:        2,
        check:       'exactlyOneFaceUp',
        icon:        '◉', // map-badge — holdes unik pr. trick shot-type så spilleren kan kende typen på sigt
        // rewardType tildeles nu dynamisk pr. node af GameState._generateNodes()
        // (aldrig sølv, aldrig samme som nodens egen baseline) — se reward-chests-draft.md.
    },
    {
        id:          'table_slam',
        name:        'Table Slam',
        description: 'Slam a cap clean off the table',
        cost:        2,
        check:       'capOffTable',
        icon:        '↗',
    },
    {
        id:          'even_split',
        name:        'Even Split',
        description: 'Flip an EVEN number of caps in a single throw (not 0)',
        cost:        2,
        check:       'evenFlipCount',
        icon:        '⚁', // samme nik som Even Steven-bossen/relic'en
    },
    {
        id:          'odd_one_out',
        name:        'Odd One Out',
        description: 'Flip an ODD number of caps in a single throw',
        cost:        2,
        check:       'oddFlipCount',
        icon:        '⚂', // samme nik som Odd Todd-bossen/relic'en
    },
];

// Ikon pr. reward-type — dækker både nodens baseline (silver/enchant/mystery,
// synlig fra START jf. reward-chests-draft.md) og Trick Shot-opgraderinger
// (gold/enchant/mystery, aldrig silver). Vises på HOVEDNODEN og på Trick
// Shot-grenen, adskilt fra selve trick shot-typens eget ikon.
export const REWARD_TYPE_ICONS = {
    silver:  '◎',
    gold:    '✪',
    enchant: '✦',
    mystery: '❔',
};

// Læsbare labels til samme reward-typer — bruges hvor et rent ikon ikke er nok
// (fx Trick Shot-info-stickeren, der skal forklare hvad man opgraderer TIL).
export const REWARD_TYPE_LABELS = {
    silver:  'Silver Chest',
    gold:    'Gold Chest',
    enchant: 'Enchant',
    mystery: 'Mystery',
};

// Forklarende tekst pr. reward-type — bruges af node-reward-info-stickeren på
// kortet (samme mekanik som Trick Shot/boss-info), så man kan se HVAD man får
// uden at skulle gætte ud fra ikonet alene.
export const REWARD_TYPE_DESCRIPTIONS = {
    silver:  'One random pick: a cap, a slammer, a card, or bonus ★ points.',
    gold:    'Same as a silver chest, but better odds for rare+ caps, new slammers, and bigger ★ bonuses.',
    enchant: 'Pick one of your owned caps to receive a random enchant.',
    mystery: 'A wildcard pick — could be a cap/slammer swap, a free tier upgrade, a new item, or more.',
};
