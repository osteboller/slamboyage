// Boss-noder: en ekstra, sværere afsluttende node pr. run (node 1-6 osv.).
// `gimmick` refererer til en hook-funktion i src/game/bossModifiers/index.js.
// Bosses uden `gimmick` (Maxmillian) rammer kun clearScore, ingen scoring-hook.
export const BOSS_DEFS = [
    {
        id:          'maxmillian',
        name:        'Maxmillian',
        icon:        '👑',
        description: 'No special gimmick — just a much higher clear score.',
        clearScoreMultiplier: 2.0,
    },
    {
        id:          'even_steven',
        name:        'Even Steven',
        icon:        '⚁',
        description: 'Caps only score if you flip an EVEN number this throw.',
        gimmick:     'even_steven',
        clearScoreMultiplier: 1.3,
    },
    {
        id:          'odd_todd',
        name:        'Odd Todd',
        icon:        '⚂',
        description: 'Caps only score if you flip an ODD number this throw.',
        gimmick:     'odd_todd',
        clearScoreMultiplier: 1.3,
    },
    {
        id:          'no_glam_fam',
        name:        'No Glam Fam',
        icon:        '🚫',
        description: '−10% score for every enchanted cap in your bag (max −80%).',
        gimmick:     'no_glam_fam',
        clearScoreMultiplier: 1.3,
    },
];
