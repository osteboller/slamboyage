export const TRICK_SHOTS = [
    {
        id:          'flip_one',
        name:        'Flip Just One',
        description: 'Flip exactly 1 cap in a single throw',
        cost:        2,
        check:       'exactlyOneFaceUp',
        icon:        '◉', // map-badge — holdes unik pr. trick shot-type så spilleren kan kende typen på sigt
        rewardType:  'enchant', // hvad du får ved at cleare — styrer ikonet på pseudo-noden FØR clearing
    },
    {
        id:          'table_slam',
        name:        'Table Slam',
        description: 'Slam a cap clean off the table',
        cost:        2,
        check:       'capOffTable',
        icon:        '↗',
        rewardType:  'enchant',
    },
];

// Ikon pr. reward-upgrade-type (GameState.markRewardUpgraded's `type`-parameter).
// Vises på HOVEDNODEN når en Trick Shot er clearet — adskilt fra selve
// trick shot-typens ikon (som hører til pseudo-noden/afstikkeren).
export const REWARD_UPGRADE_ICONS = {
    enchant: '✦',
};
