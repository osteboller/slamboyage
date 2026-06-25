export class InputManager {
    constructor(domElement, camera) {
        this.onShot = null; // callback(x, z)
        this.onAim  = null; // callback(x, z)

        // Sættes af main.js: returnerer cap-meshes der kan rammes
        // Disse prøves FØR gulvplanet så retikel-positionen matcher det man ser
        this.getHittableObjects = null; // () => THREE.Object3D[]

        const ray   = new THREE.Raycaster();
        const mVec  = new THREE.Vector2();
        const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        const raycastWorld = (e) => {
            mVec.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
            ray.setFromCamera(mVec, camera);

            // 1. Forsøg raycast mod cap-meshes — giver korrekt XZ når man sigter på stakken
            if (this.getHittableObjects) {
                const objects = this.getHittableObjects();
                if (objects.length > 0) {
                    const hits = ray.intersectObjects(objects, false);
                    if (hits.length > 0) return hits[0].point;
                }
            }

            // 2. Fallback: gulvplanet ved y = 0
            const hit = new THREE.Vector3();
            return ray.ray.intersectPlane(floor, hit) ? hit : null;
        };

        domElement.addEventListener('mousemove', (e) => {
            if (!this.onAim) return;
            const hit = raycastWorld(e);
            if (hit) this.onAim(hit.x, hit.y, hit.z);
        });

        // pointerdown frem for click: fjerner den 300ms delay browseren
        // tilføjer på mobil/touch for at detektere double-tap
        domElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // kun primær knap / touch
            if (!this.onShot) return;
            const hit = raycastWorld(e);
            if (hit) this.onShot(hit.x, hit.y, hit.z);
        });
    }
}
