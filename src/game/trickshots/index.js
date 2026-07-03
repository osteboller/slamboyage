import { exactlyOneFaceUp } from './exactlyOneFaceUp.js';
import { capOffTable }      from './capOffTable.js';

const TRICKSHOT_CHECKS = {
    exactlyOneFaceUp,
    capOffTable,
};

export function resolveTrickShot(checkId, wonCaps, faceDownCaps) {
    const fn = TRICKSHOT_CHECKS[checkId];
    return fn ? fn(wonCaps, faceDownCaps) : false;
}
