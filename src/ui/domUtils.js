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

// Titel-"hak" (start-title/.reward-title-box/.rsp-title) — JS-drevet i stedet
// for en ren CSS @keyframes+steps()-animation, fordi steps() altid looper
// mellem PRÆCIS de samme faste vinkler i PRÆCIS samme rytme hver eneste
// cyklus, hvilket hurtigt føles mekanisk/forudsigeligt. Her rulles en ny
// tilfældig vinkel (symmetrisk omkring 0 — lige meget til begge sider) med et
// let varierende interval (±150ms). Selve "hakket" er et HELT hårdt spring —
// CSS'en har BEVIDST ingen transition på rotate-egenskaben (se .start-title/
// .reward-title-box/.rsp-title), så den nye vinkel vises direkte fra ét frame
// til det næste, ingen tweening. Selv-afsluttende: når elementet bliver
// fjernet fra DOM'en (fx en ny render overskriver innerHTML), stopper loopet
// af sig selv via el.isConnected — ingen eksplicit oprydning nødvendig ved
// kaldestederne.
const TITLE_WOBBLE_RANGE_DEG = 2.2; // -2.2° til +2.2°, symmetrisk
const TITLE_WOBBLE_BASE_MS   = 2600; // dobbelt op fra 1300ms — skiftede for tit
const TITLE_WOBBLE_JITTER_MS = 300; // ~samme relative "meget lidt" variation som før

export function startTitleWobble(el) {
    if (!el) return;
    const tick = () => {
        if (!el.isConnected) return;
        const angle = (Math.random() * 2 - 1) * TITLE_WOBBLE_RANGE_DEG;
        el.style.rotate = `${angle.toFixed(2)}deg`;
        const delay = TITLE_WOBBLE_BASE_MS + (Math.random() * 2 - 1) * TITLE_WOBBLE_JITTER_MS;
        setTimeout(tick, delay);
    };
    tick();
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
