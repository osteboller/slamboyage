export const EFFECT_LABELS = {
    'zone_inner': { name: 'Inner Zone', desc: '+1★ near centre' },
    'zone_outer': { name: 'Outer Zone', desc: '+1★ near edge' },
    'flat':       { name: 'Reliable',   desc: 'always +1★' },
    'neighbour':  { name: 'Pack',       desc: '+1★ per close neighbour' },
    'solo':       { name: 'Lone Wolf',  desc: '+2★ if isolated' },
    'streak':     { name: 'Streak',     desc: '+1★ per flip this throw' },
    'spawn':      { name: 'Spawn',      desc: 'spawns new caps onto the plate, scored this throw' },
    'backup':     { name: 'Backup',     desc: 'adds a copy to the next throw' },
    'magnet':     { name: 'Lasso',      desc: 'pulls nearby caps closer' },
    'rally':      { name: 'Rally',      desc: '+1 base to each nearby cap for the rest of the round' },
    'crew':       { name: 'Crew',       desc: '+1 base to each same-series cap for the rest of the round' },
    'cue_slam':   { name: 'Cue Ball',   desc: 'blasts a random Pewl cap when flipped' },
    'surge':      { name: 'Flipper',    desc: 'flips the nearest face-down cap and triggers its effect' },
    'absorb':     { name: 'Absorb',     desc: 'gains all extra base value from every other cap this round (max +1000★)' },
    'jackpot':    { name: 'Jackpot',    desc: '+50★ flat, then permanently destroyed' },
    'martyr':     { name: 'Martyr',     desc: '2.5× to nearby caps, then permanently destroyed' },
    'territorial': { name: 'Territorial', desc: 'exhausts very-nearby caps from other series for the rest of the round — +4★ per cap exhausted' },
    'ballast':    { name: 'Ballast',     desc: 'each throw it stays face-down: ×2 to that throw, and grants a Husk cap' },
    'husk':       { name: 'Husk',        desc: 'does nothing, destroyed when flipped' },
};

// Kort effect-navn — brugt i collection/reward/shop-kort, hvor der ikke er plads til en hel sætning.
export const effectName = id => EFFECT_LABELS[id]?.name ?? id;
// Fuld uddybende tekst — brugt i cap-detail (capviewer), hvor spilleren aktivt har bedt om detaljer.
export const effectDesc = id => EFFECT_LABELS[id]?.desc ?? '';
