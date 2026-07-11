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
export function watchRewardTitleSpacing(screenEl) {
    const titleBox = screenEl?.querySelector('.reward-title-box');
    if (!titleBox) return () => {};

    const update = () => {
        const space = titleBox.offsetTop + titleBox.offsetHeight + 20;
        screenEl.style.setProperty('--reward-title-space', `${space}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
}
