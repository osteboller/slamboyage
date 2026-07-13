import { zoneInnerEffect, zoneOuterEffect } from './zoneEffects.js';
import { flatEffect }      from './flatEffect.js';
import { neighbourEffect } from './neighbourEffect.js';
import { soloEffect }      from './soloEffect.js';
import { streakEffect }    from './streakEffect.js';
import { spawnEffect }     from './spawnEffect.js';
import { backupEffect }    from './backupEffect.js';
import { magnetEffect }    from './magnetEffect.js';
import { rallyEffect }     from './rallyEffect.js';
import { crewEffect }      from './crewEffect.js';
import { surgeEffect }     from './surgeEffect.js';
import { absorbEffect }    from './absorbEffect.js';
import { jackpotEffect }   from './jackpotEffect.js';
import { martyrEffect }    from './martyrEffect.js';
import { territorialEffect } from './territorialEffect.js';
import { ballastEffect }   from './ballastEffect.js';
import { huskEffect }      from './huskEffect.js';

// Registry: effect ID → handler function
// Adding a new effect = one line here + one file in this folder
export const EFFECTS = {
    'zone_inner': zoneInnerEffect,
    'zone_outer': zoneOuterEffect,
    'flat':       flatEffect,
    'neighbour':  neighbourEffect,
    'solo':       soloEffect,
    'streak':     streakEffect,
    'spawn':      spawnEffect,
    'backup':     backupEffect,
    'magnet':     magnetEffect,
    'rally':      rallyEffect,
    'crew':       crewEffect,
    'cue_slam':   () => ({}), // placeholder — physics handled in RoundManager Phase A (not yet implemented)
    'surge':      surgeEffect,
    'absorb':     absorbEffect,
    'jackpot':    jackpotEffect,
    'martyr':     martyrEffect,
    'territorial': territorialEffect,
    'ballast':    ballastEffect,
    'husk':       huskEffect,
};
