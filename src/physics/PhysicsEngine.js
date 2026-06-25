import { World, Body, Box, Vec3, Material, ContactMaterial } from '../../lib/cannon.js';

export class PhysicsEngine {
    constructor() {
        this.world = new World({ gravity: new Vec3(0, -200, 0) });
        this.world.allowSleep      = true;
        this.world.sleepSpeedLimit = 4.5;
        this.world.sleepTimeLimit  = 0.25;

        this.mCap     = new Material('cap');
        this.mGround  = new Material('ground');
        this.mSlammer = new Material('slammer');

        this.world.addContactMaterial(new ContactMaterial(this.mCap,     this.mGround,  { friction: 0.38, restitution: 0.28 }));
        this.world.addContactMaterial(new ContactMaterial(this.mCap,     this.mCap,     { friction: 0.12, restitution: 0.0  }));
        this.world.addContactMaterial(new ContactMaterial(this.mSlammer, this.mCap,     { friction: 0.05, restitution: 0.0  }));
        this.world.addContactMaterial(new ContactMaterial(this.mSlammer, this.mGround,  { friction: 0.5,  restitution: 0.15 }));

        // Box i stedet for Plane — CCD fungerer ikke pålideligt mod uendelige Plane-shapes.
        // Kasse er 100×4×100 enheder, topplade sidder præcist ved y=0.
        this.groundBody = new Body({ mass: 0, material: this.mGround });
        this.groundBody.addShape(new Box(new Vec3(500, 2, 500)));
        this.groundBody.position.set(0, -2, 0);
        this.groundBody.userData = { kind: 'ground' };
        this.world.addBody(this.groundBody);
    }

    step(dt, activeCaps = 0) {
        const substeps = activeCaps <= 2 ? 20 : 10;
        this.world.step(1 / 120, dt, substeps);
    }
}