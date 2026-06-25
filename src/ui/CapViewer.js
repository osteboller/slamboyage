import { POG_R, POG_H, SLAM_H } from '../config/constants.js';

export class CapViewer {
    constructor(container) {
        this._container = container;
        this._texCache  = {};
        this._visible   = false;
        this._dragging  = false;
        this._animId    = null;
        this._mesh      = null;
        this._loadId    = 0;
        this._lastX     = 0;
        this._lastY     = 0;

        // ── Scene ───────────────────────────────────────────────────────────
        this._scene  = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        this._camera.position.set(0, 0, 4);

        this._scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(3, 5, 4);
        this._scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.5);
        fill.position.set(-3, -2, 2);
        this._scene.add(fill);

        // ── Renderer ────────────────────────────────────────────────────────
        // Pre-cached quaternion for auto-rotation — skæv akse giver 3D-tumble-effekt
        this._autoQ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0.15, 1, 0.08).normalize(), 0.004
        );

        this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this._renderer.setSize(220, 220);
        this._renderer.setClearColor(0x000000, 0);
        container.appendChild(this._renderer.domElement);

        // ── Drag-to-rotate ──────────────────────────────────────────────────
        const el = this._renderer.domElement;
        el.style.touchAction = 'none';

        el.addEventListener('pointerdown', e => {
            e.stopPropagation(); // forhindrer globalt "luk panel"-event
            this._dragging = true;
            this._lastX    = e.clientX;
            this._lastY    = e.clientY;
            el.setPointerCapture(e.pointerId);
        });
        el.addEventListener('pointermove', e => {
            if (!this._dragging || !this._mesh) return;
            const dx = e.clientX - this._lastX;
            const dy = e.clientY - this._lastY;
            const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0),  dx * 0.012);
            const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0),  dy * 0.012);
            this._mesh.quaternion.premultiply(qY);
            this._mesh.quaternion.premultiply(qX);
            this._lastX = e.clientX;
            this._lastY = e.clientY;
        });
        el.addEventListener('pointerup',     () => { this._dragging = false; });
        el.addEventListener('pointercancel', () => { this._dragging = false; });
    }

    async show(def, type = 'cap') {
        const id = ++this._loadId;
        this._visible = true;

        if (type === 'slammer') {
            await this._showSlammer(def, id);
        } else {
            await this._showCap(def, id);
        }
    }

    async _showCap(def, id) {
        const [frontTex, backTex] = await Promise.all([
            this._loadTex(def.texFront),
            this._loadTexBack(def.texBack),
        ]);
        if (id !== this._loadId) return;

        if (this._mesh) {
            this._scene.remove(this._mesh);
            this._mesh.geometry.dispose();
            this._mesh.material.forEach(m => m.dispose());
        }

        const geo = new THREE.CylinderGeometry(POG_R, POG_R, POG_H * 0.35, 64, 1, false);
        const mat = [
            new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: 0.6 }),
            frontTex
                ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.22, metalness: 0.05 })
                : new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.22 }),
            backTex
                ? new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5 })
                : new THREE.MeshStandardMaterial({ color: 0xb0a89a, roughness: 0.88 }),
        ];
        this._mesh = new THREE.Mesh(geo, mat);
        // Start med forsiden ~30° vendt mod kameraet — giver 3D-dybde
        this._mesh.rotation.x = Math.PI / 2 - 0.25;
        this._mesh.rotation.y = 0.3 + Math.PI / 4 + Math.PI / 6;
        this._scene.add(this._mesh);
        this._startLoop();
    }

    async _showSlammer(def, id) {
        const [frontTex, backTex] = await Promise.all([
            this._loadTex(def.texFront),
            this._loadTexBack(def.texBack),
        ]);
        if (id !== this._loadId) return;

        if (this._mesh) {
            this._scene.remove(this._mesh);
            this._mesh.geometry.dispose();
            this._mesh.material.forEach(m => m.dispose());
        }

        // Slammer bruger samme radius som caps men større højde
        const geo = new THREE.CylinderGeometry(POG_R, POG_R, SLAM_H * 0.8, 36, 1, false);
        const mat = [
            def._knurl
                ? new THREE.MeshStandardMaterial({ map: def._knurl, roughness: 0.55, metalness: 0.35 })
                : new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.3 }),
            frontTex
                ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.15, metalness: 0.5 })
                : new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.05, metalness: 0.7 }),
            backTex
                ? new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.3, metalness: 0.3 })
                : new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.4 }),
        ];
        this._mesh = new THREE.Mesh(geo, mat);
        // Start med forsiden vendt mod kameraet
        this._mesh.rotation.x = Math.PI / 2 - 0.25;
        this._mesh.rotation.y = 0.3 + Math.PI / 4 + Math.PI / 6;
        this._scene.add(this._mesh);
        this._startLoop();
    }

    hide() {
        this._visible = false;
        if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
    }

    _startLoop() {
        if (this._animId) cancelAnimationFrame(this._animId);
        const tick = () => {
            if (!this._visible) return;
            this._animId = requestAnimationFrame(tick);
            if (!this._dragging && this._mesh) this._mesh.quaternion.premultiply(this._autoQ);
            this._renderer.render(this._scene, this._camera);
        };
        tick();
    }

    async _loadTex(url) {
        if (!url) return null;
        if (this._texCache[url]) return this._texCache[url];
        return new Promise(resolve => {
            new THREE.TextureLoader().load(url, tex => {
                tex.colorSpace = THREE.SRGBColorSpace;
                this._texCache[url] = tex;
                resolve(tex);
            }, undefined, () => resolve(null));
        });
    }

    async _loadTexBack(url) {
        if (!url) return null;
        const key = url + '__back';
        if (this._texCache[key]) return this._texCache[key];
        const tex = await this._loadTex(url);
        if (!tex) return null;
        const rotated = tex.clone();
        rotated.rotation = Math.PI;
        rotated.center.set(0.5, 0.5);
        rotated.needsUpdate = true;
        this._texCache[key] = rotated;
        return rotated;
    }
}
