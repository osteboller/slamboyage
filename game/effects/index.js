import { zoneInnerEffect, zoneOuterEffect } from './zoneEffects.js';
import { flatEffect }      from './flatEffect.js';
import { neighbourEffect } from './neighbourEffect.js';
import { soloEffect }      from './soloEffect.js';
import { streakEffect }    from './streakEffect.js';
import { spawnEffect }     from './spawnEffect.js';
import { magnetEffect }    from './magnetEffect.js';

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
    'magnet':     magnetEffect,
    'cue_slam':   () => ({}), // placeholder — physics handled in RoundManager Phase A (not yet implemented)
};
