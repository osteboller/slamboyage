export const EFFECT_LABELS = {
    'zone_inner': { name: 'Inner Zone', desc: '+1★ near centre' },
    'zone_outer': { name: 'Outer Zone', desc: '+1★ near edge' },
    'flat':       { name: 'Reliable',   desc: 'always +1★' },
    'neighbour':  { name: 'Pack',       desc: '+1★ per close neighbour' },
    'solo':       { name: 'Lone Wolf',  desc: '+2★ if isolated' },
    'streak':     { name: 'Streak',     desc: '+1★ per flip this throw' },
    'spawn':      { name: 'Spawn',      desc: 'adds a copy to the next throw' },
    'magnet':     { name: 'Lasso',      desc: 'pulls nearby caps closer' },
    'rally':      { name: 'Rally',      desc: '+1 base to each nearby cap for the rest of the round' },
    'crew':       { name: 'Crew',       desc: '+1 base to each same-series cap for the rest of the round' },
    'cue_slam':   { name: 'Cue Ball',   desc: 'blasts a random Pewl cap when flipped' },
    'surge':      { name: 'Surge',      desc: 'flips the nearest face-down cap and triggers its effect' },
    'absorb':     { name: 'Absorb',     desc: 'gains all extra base value from every other cap this round (max +1000★)' },
    'jackpot':    { name: 'Jackpot',    desc: '+50★ flat, then permanently destroyed' },
    'martyr':     { name: 'Martyr',     desc: '2.5× to nearby caps, then permanently destroyed' },
};

// Kort ability-navn — brugt i collection/reward/shop-kort, hvor der ikke er plads til en hel sætning.
export const effectName = id => EFFECT_LABELS[id]?.name ?? id;
// Fuld uddybende tekst — brugt i cap-detail (capviewer), hvor spilleren aktivt har bedt om detaljer.
export const effectDesc = id => EFFECT_LABELS[id]?.desc ?? '';
