// Reserverer nøjagtig plads til .reward-title-box i toppen af #reward-screen,
// i stedet for at gætte en fast clamp()-værdi i CSS. Titlens højde varierer
// med pakke-/reward-navnets længde (kan wrappe til 2 linjer på smalle
// skærme), så en fast gætteværdi kunne stadig lade kortene stikke ind under
// titlen på visse tekst+viewport-kombinationer — de blev bare "gemt bag"
// titlen i stedet for foran den, efter z-index blev rettet til at give
// titlen konsekvent forrang. Måler den RIGTIGE renderede højde i stedet.
//
// Returnerer en oprydningsfunktion — kald den når skærmen forlades/genskabes
// for at fjerne resize-listeneren igen.
// Måler .reward-title-anchor (IKKE .reward-title-box) — anchoren er nu det
// rent POSITIONEREDE element (se reward.css), .reward-title-box selv bærer
// kun dekorativ rotate/translate-bevægelse og er ikke længere positioneret
// direkte. offsetTop/offsetHeight er upåvirket af transform/rotate/translate
// under alle omstændigheder, men skal måles på det element der faktisk SIDDER
// fast i layoutet.
export function watchRewardTitleSpacing(screenEl) {
    const titleBox = screenEl?.querySelector('.reward-title-anchor');
    if (!titleBox) return () => {};

    const update = () => {
        const space = titleBox.offsetTop + titleBox.offsetHeight + 20;
        screenEl.style.setProperty('--reward-title-space', `${space}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
}
