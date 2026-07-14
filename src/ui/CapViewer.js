import { audio } from '../audio/AudioManager.js';
import { POG_R, POG_H, SLAM_H, ENCHANT_OVERLAY_OPACITY } from '../config/constants.js';
import { ENCHANT_DEFS } from '../config/enchantDefs.js';

// Enchant-preview crossfade-timing — matcher .reward-enchant-preview's CSS-
// keyframes (reward.css) så 2D-kortenes billed-skift og den 3D-mønts
// overlay-puls føles som SAMME effekt, bare i to forskellige renderere.
const PREVIEW_CYCLE_MS = 5200;
const PREVIEW_HOLD_MS  = 2000;
const PREVIEW_FADE_MS  = 600;

// Trekant-kurve med hold-faser: 0 (hold) → fade op → ENCHANT_OVERLAY_OPACITY
// (hold) → fade ned → gentag. Samme rytme som CSS-crossfaden på reward-kortene.
function previewOpacityCurve(elapsedMs) {
    const t = elapsedMs % PREVIEW_CYCLE_MS;
    if (t < PREVIEW_HOLD_MS)                               return 0;
    if (t < PREVIEW_HOLD_MS + PREVIEW_FADE_MS)              return (t - PREVIEW_HOLD_MS) / PREVIEW_FADE_MS;
    if (t < PREVIEW_HOLD_MS * 2 + PREVIEW_FADE_MS)          return 1;
    if (t < PREVIEW_HOLD_MS * 2 + PREVIEW_FADE_MS * 2)      return 1 - (t - (PREVIEW_HOLD_MS * 2 + PREVIEW_FADE_MS)) / PREVIEW_FADE_MS;
    return 0;
}

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

        // Enchant-preview crossfade (reward-screen "hvad bliver den til?"-forhåndsvisning)
        // — se previewEnchant() nedenfor. To materialer, ikke ét: hvis capen i
        // forvejen HAR en enchant, skal den gamle overlay falme UD præcis når
        // den nye falmer IND, ellers ses begge samtidig i "efter"-fasen.
        this._previewNewMat = null;
        this._previewOldMat = null;
        this._previewStart  = 0;

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

    async show(def, type = 'cap', enchant = null) {
        const id = ++this._loadId;
        audio.play('detail_open');
        this._visible = true;

        // Cap-detail-redesignet (7. juli) strammede kameraets framing for bedre
        // fyld af viewer-rammen (~72%→~85%). Gjaldt oprindeligt kun caps — nu
        // udvidet til også slammere (13. juli, samme radius POG_R på begge
        // mesh-typer, så samme afstand giver samme fyld-procent). Sat pr.
        // show()-kald i stedet for i konstruktøren, da CapViewer er en DELT
        // klasse — både _capViewer og _slammerViewer i UIManager er instanser
        // af den samme klasse, så en konstruktør-ændring ville utilsigtet have
        // ramt begge (var netop grunden til at det blev udsat første gang).
        this._camera.position.z = 3.3;

        // Stop old loop and clear canvas immediately — prevents old cap flashing
        if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
        this._previewNewMat = null;
        this._previewOldMat = null;
        this._clearMesh();
        this._renderer.render(this._scene, this._camera);

        if (type === 'slammer') await this._showSlammer(def, id);
        else await this._showCap(def, id, enchant);
    }

    async _showCap(def, id, enchant = null) {
        const [frontTex, backTex] = await Promise.all([
            this._loadTex(def.texFront),
            this._loadTexBack(def.texBack),
        ]);
        if (id !== this._loadId) return;
        this._clearMesh();

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

        if (enchant) {
            const enchantDef = ENCHANT_DEFS.find(e => e.id === enchant);
            if (enchantDef) {
                const overlayTex = await this._loadTex(`assets/enchants/${enchantDef.overlayAsset}`);
                if (overlayTex && id === this._loadId && this._mesh) {
                    this._addEnchantOverlay(overlayTex);
                }
            }
        }

        this._startLoop();
    }

    async _showSlammer(def, id) {
        const [frontTex, backTex] = await Promise.all([
            this._loadTex(def.texFront),
            this._loadTexBack(def.texBack),
        ]);
        if (id !== this._loadId) return;

        this._clearMesh();

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
        // GUARD er vigtig her — UIManager's globale "luk alt"-lytter kalder
        // hide() UBETINGET på ethvert klik i hele spillet, uanset om en viewer
        // overhovedet var åben. Uden dette tjek ville lyden spille på stort
        // set hvert eneste klik i spillet (samme fælde som setDetailBackdrop
        // stødte på tidligere i denne session).
        if (this._visible) audio.play('detail_close');
        this._visible = false;
        if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
    }

    // Forhåndsvis en NY enchant oven på den allerede-byggede mesh (kaldes
    // EFTER show() er landet — mesh skal eksistere, og skal være bygget UDEN
    // sin egen statiske enchant-overlay — se UIManager._showCapDetail, som
    // sender enchant:null til show() når der forhåndsvises, netop for at
    // undgå at denne metode duplikerer den gamle overlay oveni sig selv).
    // oldEnchantId (capens NUVÆRENDE enchant, hvis nogen) krydsblændes ud
    // præcis når newEnchantId blændes ind — show() selv er ikke egnet til
    // gentagne kald for animationen (fuld mesh-rebuild pr. kald giver et
    // synligt "pop" i stedet for en blød crossfade).
    async previewEnchant(newEnchantId, oldEnchantId = null) {
        const newDef = ENCHANT_DEFS.find(e => e.id === newEnchantId);
        if (!newDef || !this._mesh) return;
        const oldDef = oldEnchantId ? ENCHANT_DEFS.find(e => e.id === oldEnchantId) : null;
        const loadId = this._loadId;

        const [newTex, oldTex] = await Promise.all([
            this._loadTex(`assets/enchants/${newDef.overlayAsset}`),
            oldDef ? this._loadTex(`assets/enchants/${oldDef.overlayAsset}`) : Promise.resolve(null),
        ]);
        if (loadId !== this._loadId || !this._mesh) return;

        if (newTex) this._previewNewMat = this._addEnchantOverlay(newTex, 0).material[1];
        if (oldTex) this._previewOldMat = this._addEnchantOverlay(oldTex, ENCHANT_OVERLAY_OPACITY).material[1];
        this._previewStart = performance.now();
    }

    _clearMesh() {
        this._previewNewMat = null;
        this._previewOldMat = null;
        if (!this._mesh) return;
        this._mesh.children.forEach(child => {
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
        this._scene.remove(this._mesh);
        this._mesh.geometry.dispose();
        this._mesh.material.forEach(m => m.dispose());
        this._mesh = null;
    }

    _addEnchantOverlay(overlayTex, opacity = ENCHANT_OVERLAY_OPACITY) {
        const capHeight = POG_H * 0.35;
        const overlayGeo = new THREE.CylinderGeometry(POG_R * 0.97, POG_R * 0.97, 0.001, 64, 1, false);
        const overlayMat = [
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
            new THREE.MeshBasicMaterial({
                map: overlayTex,
                transparent: true,
                blending: THREE.AdditiveBlending,
                opacity,
                depthWrite: false,
            }),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        ];
        const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
        overlayMesh.position.y = capHeight / 2 + 0.002;
        this._mesh.add(overlayMesh);
        return overlayMesh;
    }

    _startLoop() {
        if (this._animId) cancelAnimationFrame(this._animId);
        const tick = () => {
            if (!this._visible) return;
            this._animId = requestAnimationFrame(tick);
            if (!this._dragging && this._mesh) this._mesh.quaternion.premultiply(this._autoQ);
            if (this._previewNewMat || this._previewOldMat) {
                const curve = previewOpacityCurve(performance.now() - this._previewStart);
                if (this._previewNewMat) this._previewNewMat.opacity = curve * ENCHANT_OVERLAY_OPACITY;
                if (this._previewOldMat) this._previewOldMat.opacity = (1 - curve) * ENCHANT_OVERLAY_OPACITY;
            }
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
