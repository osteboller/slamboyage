// usableIn: which screen contexts allow USE (greyed out elsewhere, card is kept)
export const CONSUMABLE_DEFS = [
    {
        id:          'extra_throw',
        name:        'Extra Throw',
        icon:        '🎯',
        description: '+1 throw this battle',
        sellPrice:   3,
        usableIn:    ['battle'],
    },
    {
        id:          'double_next',
        name:        'Double Up',
        icon:        '✌️',
        description: 'Next throw scores ×2',
        sellPrice:   4,
        usableIn:    ['battle'],
    },
    {
        id:          'refresh',
        name:        'Refresh',
        icon:        '🔄',
        description: 'Shop: re-roll items for free · Reward: re-roll picks',
        sellPrice:   2,
        usableIn:    ['shop', 'reward'],
    },
];
