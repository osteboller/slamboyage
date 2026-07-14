import { CAM_BASE, ZONE_INNER_R, ZONE_OUTER_R, GROUND_HALF_SIZE } from '../config/constants.js';

export class RenderEngine {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e2530);

        this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
        this.camera.position.set(CAM_BASE.x, CAM_BASE.y, CAM_BASE.z);
        this.camera.lookAt(0, 1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this._setupLights();
        this._setupGround();
        this._setupReticle(); // <--- NY: Byg sigtekornet med det samme

        const syncViewportSize = () => {
            const vv = window.visualViewport;
            const w  = vv ? vv.width  : innerWidth;
            const h  = vv ? vv.height : innerHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        };

        window.addEventListener('resize', syncViewportSize);
        window.addEventListener('orientationchange', () => {
            setTimeout(syncViewportSize, 100);
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncViewportSize);
        }

        this.syncViewportSize = syncViewportSize;
    }

    _setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        const sun = new THREE.DirectionalLight(0xfff8e8, 1.2);
        sun.position.set(6, 18, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { near: 1, far: 80, left: -16, right: 16, top: 16, bottom: -16 });
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
        fill.position.set(-5, 6, -8);
        this.scene.add(fill);
    }

    _setupGround() {
        // Mørkt bord med grid
        const groundSize = GROUND_HALF_SIZE * 2;
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(groundSize, groundSize),
            new THREE.MeshStandardMaterial({ color: 0x1e2830, roughness: 0.95 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.scene.add(new THREE.GridHelper(groundSize, groundSize, 0x3a4a4e, 0x2e3e44));

        // Korkmat — mørk kant
        const border = new THREE.Mesh(
            new THREE.CircleGeometry(12.0, 72),
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 })
        );
        border.rotation.x = -Math.PI / 2;
        border.position.y = 0.02;
        border.receiveShadow = true;
        this.scene.add(border);

        // Korkmat — spilleflade med procedural tekstur
        const mat = new THREE.Mesh(
            new THREE.CircleGeometry(11.4, 72),
            new THREE.MeshStandardMaterial({
                map:       this._createCorkTexture(),
                roughness: 0.88,
                metalness: 0.0,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1,
            })
        );
        mat.rotation.x = -Math.PI / 2;
        mat.position.y = 0.04;
        mat.receiveShadow = true;
        this.scene.add(mat);

        // Zone markers — ring width 0.12 so they're visible from camera height
        const zoneMat = (color, opacity) => new THREE.MeshBasicMaterial({
            color, transparent: true, opacity, depthWrite: false,
        });

        const innerRing = new THREE.Mesh(
            new THREE.RingGeometry(ZONE_INNER_R - 0.06, ZONE_INNER_R + 0.06, 72),
            zoneMat(0xf5c842, 0.55) // gold — inner bonus zone
        );
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = 0.07;
        this.scene.add(innerRing);

        const outerRing = new THREE.Mesh(
            new THREE.RingGeometry(ZONE_OUTER_R - 0.06, ZONE_OUTER_R + 0.06, 72),
            zoneMat(0x55aaff, 0.45) // blue — outer bonus zone
        );
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = 0.07;
        this.scene.add(outerRing);
    }

    // Spawns a temporary flat ring in world space — perspective handled by Three.js automatically
    spawnEffectRing(worldPos, radius, color, holdMs = 600, fadeMs = 400) {
        const geo = new THREE.RingGeometry(radius - 0.07, radius + 0.07, 64);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(worldPos.x, worldPos.y + 0.05, worldPos.z);
        this.scene.add(mesh);

        const start = performance.now();
        const total = holdMs + fadeMs;
        const tick = () => {
            const elapsed = performance.now() - start;
            if (elapsed >= total) {
                this.scene.remove(mesh);
                geo.dispose();
                mat.dispose();
                return;
            }
            if (elapsed > holdMs) mat.opacity = 0.85 * (1 - (elapsed - holdMs) / fadeMs);
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // Spins capMesh N full rotations then lands face-up. Uses euler.x directly (not slerp)
    // so we can overshoot by N×360°. Also hops the mesh up off the table mid-flip (sine arc)
    // so the spin reads as "pop up, flip, land" instead of spinning flat on the surface.
    // Calls onDone() when animation completes.
    animateCapFlipSpin(capMesh, spins = 3, durationMs = 900, onDone, hopHeight = 2.4) {
        const startX = capMesh.rotation.x;
        const startY = capMesh.rotation.y;
        const startZ = capMesh.rotation.z;
        const baseY  = capMesh.position.y;
        // Half-turn flips face-down→face-up, then N full spins on top for juice
        const totalAngle = Math.PI + spins * Math.PI * 2;

        capMesh.userData.skipSync = true;
        const start = performance.now();

        const tick = () => {
            const t    = Math.min((performance.now() - start) / durationMs, 1);
            const ease = 1 - Math.pow(1 - t, 2.5); // fast start, slow landing
            capMesh.rotation.x = startX + totalAngle * ease;
            capMesh.rotation.y = startY;
            capMesh.rotation.z = startZ;
            // Asymmetric arc: quick rise (clipping through neighbours while airborne is fine),
            // brief hover at the peak for the spin, then a fast drop so it doesn't linger
            // mid-height through other caps on the way back down.
            let heightT;
            if (t < 0.35) {
                const u = t / 0.35;
                heightT = 1 - (1 - u) ** 2; // ease-out rise
            } else if (t < 0.6) {
                heightT = 1; // hover at peak
            } else {
                const u = (t - 0.6) / 0.4;
                heightT = 1 - u ** 2; // fast accelerating drop
            }
            capMesh.position.y = baseY + heightT * hopHeight;
            if (t < 1) { requestAnimationFrame(tick); return; }
            capMesh.userData.skipSync = false;
            capMesh.position.y = baseY;
            onDone?.();
        };
        requestAnimationFrame(tick);
    }

    // Materialiserer en helt NY cap midt i et kast (fx "Spawn"-effekten) — spawnes
    // ELEVERET og falder ned med spin, i stedet for at rejse sig/hoppe fra
    // hvileposition som animateCapFlipSpin gør. endFaceUp er allerede afgjort FØR
    // kaldet (samme "resultat kendt, skjules af spin undervejs"-mønster som Flipper/
    // surge selv bruger) og styrer direkte landingsrotationen. capMesh.position.y
    // SKAL være sat til den ønskede landingshøjde af kalderen før dette kald.
    // Kalder onDone() når animationen er færdig.
    animateCapMaterialize(capMesh, endFaceUp, spins = 3, durationMs = 900, onDone, dropHeight = 4.8) {
        // Nulstiller HELE rotationen til en ren, IKKE-sammensat tilstand FØR vi
        // læser start-værdier. capMesh.quaternion blev tidligere sat direkte fra
        // en Cannon-quaternion der repræsenterer en SAMMENSAT rotation (X-flip +
        // Y-spin på én gang, se RoundManager). At kun nulstille rotation.x bagefter
        // og genbruge det EKSISTERENDE (Euler-dekomponerede) rotation.y var ikke
        // nok — Euler-dekomponering af en sammensat rotation giver ikke en "ren"
        // Y-komponent man kan regne isoleret videre på; resultatet var uforudsigeligt
        // (så nogle gange rigtigt ud, andre gange landede den synligt med forkert
        // side opad, selvom scoringen internt var korrekt). .set(x,y,z) sætter
        // derimod ALLE tre akser direkte, ikke-sammensat — X/Z garanteret 0, Y en
        // helt ny, ren spin-værdi (den kosmetiske startrotation er ligegyldig for
        // om den ender rigtigt). Mesh'et er usynligt indtil faldet starter (se
        // RoundManager), så der er intet visuelt spring ved at nulstille her.
        capMesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
        const startX = 0;
        const startY = capMesh.rotation.y;
        const startZ = 0;
        const baseY  = capMesh.position.y;
        // 0 = lander face-up, ét halvt spin = lander face-down — plus N fulde spins for juice
        const totalAngle = (endFaceUp ? 0 : Math.PI) + spins * Math.PI * 2;

        capMesh.rotation.x = startX;
        capMesh.userData.skipSync = true;
        capMesh.position.y = baseY + dropHeight;
        capMesh.scale.setScalar(0);
        const start = performance.now();

        const tick = () => {
            const t = Math.min((performance.now() - start) / durationMs, 1);
            // Accelererende (gravity-agtigt) fald — i modsætning til animateCapFlipSpin's
            // stig-hover-fald-bue starter denne allerede oppe og falder bare ned.
            const fallEase = t * t;
            capMesh.position.y = baseY + dropHeight * (1 - fallEase);

            const spinEase = 1 - Math.pow(1 - t, 2.5); // samme "hurtig start, blød landing" som Flipper
            capMesh.rotation.x = startX + totalAngle * spinEase;
            capMesh.rotation.y = startY;
            capMesh.rotation.z = startZ;

            // Pop-in: fuld skala nået efter de første 30% af animationen, så den synligt
            // materialiserer i stedet for bare at "være der".
            capMesh.scale.setScalar(Math.min(t / 0.3, 1));

            if (t < 1) { requestAnimationFrame(tick); return; }
            capMesh.userData.skipSync = false;
            capMesh.position.y = baseY;
            capMesh.scale.setScalar(1);
            onDone?.();
        };
        requestAnimationFrame(tick);
    }

    // Smoothly rotates capMesh from its current quaternion to the target euler over durationMs.
    // Bypasses sync() during animation via skipSync flag; calls onDone(finalQuat) when complete.
    animateCapFlip(capMesh, targetEulerXYZ, durationMs, onDone) {
        const fromQuat = capMesh.quaternion.clone();
        const toQuat   = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(targetEulerXYZ[0], targetEulerXYZ[1], targetEulerXYZ[2])
        );
        capMesh.userData.skipSync = true;
        const start = performance.now();
        const tick = () => {
            const t    = Math.min((performance.now() - start) / durationMs, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            capMesh.quaternion.slerpQuaternions(fromQuat, toQuat, ease);
            if (t < 1) { requestAnimationFrame(tick); return; }
            capMesh.userData.skipSync = false;
            capMesh.quaternion.copy(toQuat);
            onDone?.(toQuat);
        };
        requestAnimationFrame(tick);
    }

    _createCorkTexture() {
    const S   = 512;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = S;
    const ctx = cvs.getContext('2d');

    // Basis asfalt — mørk antracit
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, S, S);

    // Groft aggregat — lyse sten i alle størrelser
    for (let i = 0; i < 1800; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const r = 0.5 + Math.random() * 3.5;
        const v = Math.floor(55 + Math.random() * 80);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${v},${v},${v},${0.4 + Math.random() * 0.5})`;
        ctx.fill();
    }

    // Fin tekstur — støv og sand
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const r = 0.2 + Math.random() * 0.8;
        const v = Math.floor(40 + Math.random() * 60);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${v},${v},${v},${0.2 + Math.random() * 0.4})`;
        ctx.fill();
    }

    // Subtile revner
    for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * S, Math.random() * S);
        ctx.lineTo(Math.random() * S, Math.random() * S);
        ctx.strokeStyle = `rgba(8,8,8,${0.3 + Math.random() * 0.4})`;
        ctx.lineWidth   = 0.5 + Math.random() * 1.5;
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
}

    _setupReticle() {
        const geometry = new THREE.RingGeometry(0.5, 0.75, 48);
        const material = new THREE.MeshBasicMaterial({
            color:     0xff3333,
            side:      THREE.DoubleSide,
            depthTest: false,   // tegnes altid øverst — aldrig bag caps
        });
        this.reticleMesh             = new THREE.Mesh(geometry, material);
        this.reticleMesh.rotation.x  = -Math.PI / 2;
        this.reticleMesh.renderOrder = 999;
        this.reticleMesh.visible     = false;
        this.scene.add(this.reticleMesh);
    }

    setReticleVisible(visible) {
        if (this.reticleMesh) this.reticleMesh.visible = visible;
    }

    // y er det faktiske 3D-punkt på overfladen (cap-top, cap-side eller gulv)
    setReticlePosition(x, y, z) {
        if (this.reticleMesh) {
            this.reticleMesh.position.set(x, y + 0.02, z);
        }
    }

    addMesh(mesh)    { this.scene.add(mesh); }
    removeMesh(mesh) { this.scene.remove(mesh); }
    getDomElement()  { return this.renderer.domElement; }

    sync(caps, slammer) {
        caps.forEach(({ mesh, body }) => {
            if (mesh.userData.skipSync) return; // flip animation in progress
            mesh.position.copy(body.position);
            mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        });
        if (slammer) {
            slammer.mesh.position.copy(slammer.body.position);
            slammer.mesh.quaternion.set(
                slammer.body.quaternion.x, slammer.body.quaternion.y,
                slammer.body.quaternion.z, slammer.body.quaternion.w
            );
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}