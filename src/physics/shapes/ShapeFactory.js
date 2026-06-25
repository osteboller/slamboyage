import { Cylinder } from '../../../lib/cannon.js';
import { POG_R, POG_H, SLAM_H } from '../../config/constants.js';

export function createCapShape() {
    return new Cylinder(POG_R, POG_R, POG_H, 16);
}

export function createSlammerShape() {
    return new Cylinder(POG_R, POG_R, SLAM_H, 16);
}
