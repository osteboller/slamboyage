// Skelner tap fra scroll/drag i scrollbare lister med klikbare items.
// Kalder handler(item) kun hvis fingeren/musen ikke har bevæget sig mere end
// TAP_MOVE_THRESHOLD px mellem pointerdown og pointerup på samme element.
const TAP_MOVE_THRESHOLD = 8;

// Kort "juice"-rotation ved klik/tap på et ikon (cap/slammer-thumbnail) —
// samme visuelle bekræftelse uanset museklik ELLER tap, i modsætning til en
// ren CSS :hover-effekt (som slet ikke fyrer på touch, og derfor kun virkede
// på pc). Kaldes lige når et ikon-klik detekteres, FØR detail-viewer åbnes.
export function pulseIconRotate(el) {
    if (!el) return;
    el.classList.remove('icon-pulse-rotate');
    void el.offsetWidth; // force reflow så klassen kan gen-tilføjes og genstarte animationen
    el.classList.add('icon-pulse-rotate');
    el.addEventListener('animationend', () => el.classList.remove('icon-pulse-rotate'), { once: true });
}

export function bindTapSelect(container, itemSelector, handler) {
    let startX = 0, startY = 0, downEl = null;

    container.addEventListener('pointerdown', e => {
        downEl = e.target.closest(itemSelector);
        startX = e.clientX;
        startY = e.clientY;
    });

    container.addEventListener('pointerup', e => {
        if (!downEl) return;
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx <= TAP_MOVE_THRESHOLD && dy <= TAP_MOVE_THRESHOLD) {
            const el = e.target.closest(itemSelector);
            if (el === downEl) handler(downEl);
        }
        downEl = null;
    });
}
