import { exactlyOneFaceUp } from './exactlyOneFaceUp.js';
import { capOffTable }      from './capOffTable.js';
import { evenFlipCount }    from './evenFlipCount.js';
import { oddFlipCount }     from './oddFlipCount.js';

const TRICKSHOT_CHECKS = {
    exactlyOneFaceUp,
    capOffTable,
    evenFlipCount,
    oddFlipCount,
};

export function resolveTrickShot(checkId, wonCaps, faceDownCaps) {
    const fn = TRICKSHOT_CHECKS[checkId];
    return fn ? fn(wonCaps, faceDownCaps) : false;
}
