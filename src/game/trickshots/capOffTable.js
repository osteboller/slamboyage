import { GROUND_HALF_SIZE } from '../../config/constants.js';

export function capOffTable(wonCaps, faceDownCaps) {
    return [...wonCaps, ...faceDownCaps].some(c => {
        const p = c.body.position;
        return Math.abs(p.x) > GROUND_HALF_SIZE || Math.abs(p.z) > GROUND_HALF_SIZE;
    });
}
