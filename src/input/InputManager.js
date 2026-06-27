export class InputManager {
    constructor(domElement, camera) {
        this.onAimStart = null; // (x, y, z) — finger/mus trykkes ned i idle-fasen
        this.onAimMove  = null; // (x, y, z) — finger/mus bevæges mens nede i idle-fasen
        this.onRelease  = null; // (x, y, z) — finger/mus slippes efter hold → kast
        this.onTap      = null; // ()         — kort tap → "fortsæt"-handling (ready/done)

        this.getHittableObjects = null; // () => THREE.Object3D[]

        const TAP_MS = 200;
        const ray    = new THREE.Raycaster();
        const mVec   = new THREE.Vector2();
        const floor  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        let isDown   = false;
        let downTime = 0;
        let lastHit  = null;

        const raycastWorld = (e) => {
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            mVec.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
            ray.setFromCamera(mVec, camera);

            if (this.getHittableObjects) {
                const objects = this.getHittableObjects();
                if (objects.length > 0) {
                    const hits = ray.intersectObjects(objects, false);
                    if (hits.length > 0) return hits[0].point;
                }
            }

            const hit = new THREE.Vector3();
            return ray.ray.intersectPlane(floor, hit) ? hit : null;
        };

        domElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            isDown   = true;
            downTime = performance.now();
            const hit = raycastWorld(e);
            if (hit) {
                lastHit = hit;
                if (this.onAimStart) this.onAimStart(hit.x, hit.y, hit.z);
            }
        }, { passive: false });

        domElement.addEventListener('pointermove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const hit = raycastWorld(e);
            if (hit) {
                lastHit = hit;
                if (this.onAimMove) this.onAimMove(hit.x, hit.y, hit.z);
            }
        }, { passive: false });

        domElement.addEventListener('pointerup', (e) => {
            if (!isDown) return;
            e.preventDefault();
            isDown = false;
            const held = performance.now() - downTime;
            if (held < TAP_MS) {
                if (this.onTap) this.onTap(lastHit?.x, lastHit?.y, lastHit?.z);
            } else {
                if (this.onRelease && lastHit) this.onRelease(lastHit.x, lastHit.y, lastHit.z);
            }
        }, { passive: false });

        domElement.addEventListener('pointercancel', () => {
            isDown = false;
        });

        domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
}
