import { Body, BODY_TYPES } from '../../lib/cannon.js';
import { createCapShape, createSlammerShape } from '../physics/shapes/ShapeFactory.js';
import { Cap }     from '../entities/Cap.js';
import { Slammer } from '../entities/Slammer.js';
import { POG_R, POG_H, SLAM_H } from '../config/constants.js';

export class EntityFactory {
    constructor(physics, render, texCache) {
        this._physics  = physics;
        this._render   = render;
        this._texCache = texCache;
    }

    spawnCap(def, y, enchant = null) {
        const tex = (url) => url ? this._texCache[url] : null;
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(POG_R, POG_R, POG_H, 36),
            [
                new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: 0.6 }),
                tex(def.texFront)
                    ? new THREE.MeshStandardMaterial({ map: tex(def.texFront), roughness: 0.22, metalness: 0.05 })
                    : new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.22, metalness: 0.05 }),
                tex(def.texBack)
                    ? new THREE.MeshStandardMaterial({ map: tex(def.texBack), roughness: 0.5 })
                    : new THREE.MeshStandardMaterial({ color: 0xb0a89a, roughness: 0.88 }),
            ]
        );
        mesh.castShadow = mesh.receiveShadow = true;
        this._render.addMesh(mesh);

        const body = new Body({
            mass:           def.mass,
            material:       this._physics.mCap,
            linearDamping:  0.85,
            angularDamping: 0.85,
            allowSleep:     true,
            type:           BODY_TYPES.STATIC,
        });
        body.addShape(createCapShape());
        body.quaternion.setFromEuler(Math.PI + (Math.random() - 0.5) * 0.04, Math.random() * Math.PI * 2, 0);
        body.position.set(0, y, 0);
        body.userData = { kind: 'cap' };
        this._physics.world.addBody(body);

        return new Cap(mesh, body, def, enchant);
    }

    // capCount bruges til at beregne staktoppen — sendes ind fremfor at læse globalt array
    spawnSlammer(slammerDef, x, z, speed, mass, capCount) {
        const tex   = (url) => url ? this._texCache[url] : null;
        const knurl = slammerDef?._knurl ?? null;
        const mesh  = new THREE.Mesh(
            new THREE.CylinderGeometry(POG_R, POG_R, SLAM_H, 36),
            [
                knurl
                    ? new THREE.MeshStandardMaterial({ map: knurl, roughness: 0.55, metalness: 0.35 })
                    : new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.3 }),
                tex(slammerDef?.texFront)
                    ? new THREE.MeshStandardMaterial({ map: tex(slammerDef.texFront), roughness: 0.15, metalness: 0.5 })
                    : new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.05, metalness: 0.7 }),
                tex(slammerDef?.texBack)
                    ? new THREE.MeshStandardMaterial({ map: tex(slammerDef.texBack), roughness: 0.3, metalness: 0.3 })
                    : new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.4 }),
            ]
        );
        mesh.castShadow = true;
        this._render.addMesh(mesh);

        const body = new Body({
            mass,
            material:       this._physics.mSlammer,
            linearDamping:  0,
            angularDamping: 0,
            allowSleep:     false,
        });
        body.addShape(createSlammerShape());
        const stackTop = POG_H * 0.5 + (capCount - 1) * (POG_H + 0.01) + SLAM_H + 0.5;
        body.position.set(x, stackTop + 6, z);
        body.velocity.set(0, -speed, 0);
        body.ccdSpherRadius     = Math.sqrt(POG_R * POG_R + (SLAM_H / 2) * (SLAM_H / 2));
        body.ccdMotionThreshold = 0.1;
        body.userData = { kind: 'slammer' };
        this._physics.world.addBody(body);

        return new Slammer(mesh, body);
    }
}
