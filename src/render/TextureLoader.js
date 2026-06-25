import { CAP_DEFS, SLAMMER_DEFS } from '../config/constants.js';

function createKnurlTexture(rimColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const r = (rimColor >> 16) & 0xff, g = (rimColor >> 8) & 0xff, b = rimColor & 0xff;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 512, 64);
    const ridgeCount = 48, rw = 512 / ridgeCount;
    for (let i = 0; i < ridgeCount; i++) {
        const x = i * rw;
        const grad = ctx.createLinearGradient(x, 0, x + rw, 0);
        grad.addColorStop(0,    'rgba(255,255,255,0.28)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.06)');
        grad.addColorStop(0.65, 'rgba(0,0,0,0.12)');
        grad.addColorStop(1,    'rgba(0,0,0,0.32)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, rw, 64);
    }
    return new THREE.CanvasTexture(canvas);
}

export async function loadTextures(onProgress) {
    const cache  = {};
    const loader = new THREE.TextureLoader();

    const urls = [
        ...CAP_DEFS.flatMap(d => [d.texFront, d.texBack]),
        ...SLAMMER_DEFS.flatMap(d => [d.texFront, d.texBack]),
    ].filter(Boolean);
    const total  = urls.length;
    let   loaded = 0;

    const load = url => new Promise(res => {
        loader.load(url, tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            if (onProgress) onProgress(++loaded / total);
            res(tex);
        }, undefined, () => {
            console.warn('Tekstur mangler:', url);
            if (onProgress) onProgress(++loaded / total);
            res(null);
        });
    });

    await Promise.all(urls.map(url => load(url).then(tex => { cache[url] = tex; })));

    for (const def of SLAMMER_DEFS) {
        def._knurl = createKnurlTexture(def.rimColor);
    }

    return cache;
}
