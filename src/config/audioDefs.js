// SFX-registret — data-drevet, samme konvention som CAP_DEFS/SLAMMER_DEFS.
// src er altid et array (Howler-format) selv med kun én fil, så BGM senere kan
// tilføje en OGG+MP3-fallback-liste uden at ændre AudioManager-koden.
export const SFX_DEFS = {
    button_click:  { src: ['assets/audio/sfx/ui/button_click.mp3'] },
    error:         { src: ['assets/audio/sfx/ui/error.mp3'] },
    purchase:      { src: ['assets/audio/sfx/ui/purchase.mp3'] },
    cap_select:    { src: ['assets/audio/sfx/caps/cap_select.mp3'] },
    overlay_open:  { src: ['assets/audio/sfx/ui/overlay_open.mp3'] },
    overlay_close: { src: ['assets/audio/sfx/ui/overlay_close.mp3'] },
    choice_pop:    { src: ['assets/audio/sfx/ui/choice_pop.mp3'] },
    // 5 swoosh-lyde nummereret efter kraft (1=svagest, 5=kraftigst) — vælges ud
    // fra hvor på power-baren spilleren ramte, se ThrowController.beginShot().
    swoosh_1: { src: ['assets/audio/sfx/gameplay/swoosh_1.mp3'] },
    swoosh_2: { src: ['assets/audio/sfx/gameplay/swoosh_2.mp3'] },
    swoosh_3: { src: ['assets/audio/sfx/gameplay/swoosh_3.mp3'] },
    swoosh_4: { src: ['assets/audio/sfx/gameplay/swoosh_4.mp3'] },
    swoosh_5: { src: ['assets/audio/sfx/gameplay/swoosh_5.mp3'] },
    // Selve brag-øjeblikket (kollisionen), 5 styrker, valgt efter power — se
    // ThrowController._blast(). Adskilt fra swoosh, som spiller ved selve
    // kastet (før slammeren rammer noget).
    slammer_hit_weak:     { src: ['assets/audio/sfx/gameplay/slammer_hit_weak.mp3'] },
    slammer_hit_low_mid:  { src: ['assets/audio/sfx/gameplay/slammer_hit_low_mid.mp3'] },
    slammer_hit_mid:      { src: ['assets/audio/sfx/gameplay/slammer_hit_mid.mp3'] },
    slammer_hit_high_mid: { src: ['assets/audio/sfx/gameplay/slammer_hit_high_mid.mp3'] },
    slammer_hit_big:      { src: ['assets/audio/sfx/gameplay/slammer_hit_big.mp3'] },
    // 2 varianter, vælges tilfældigt — spilles når et kast rent faktisk resulterer
    // i 0 flippede caps (uanset om det var et rent forbi-kast eller bare for lav
    // power), se RoundManager._resolveAndScore()'s actualWon-opdeling.
    miss_1: { src: ['assets/audio/sfx/gameplay/miss_1.mp3'] },
    miss_2: { src: ['assets/audio/sfx/gameplay/miss_2.mp3'] },
    // 8 varianter, vælges tilfældigt pr. cap — se CollisionManager.js's
    // beginContact-udvidelse for selve landings-detektionen (hastighedstærskel
    // + global cooldown, holder styr på "allerede landet denne kast" pr. cap).
    cap_land_1: { src: ['assets/audio/sfx/gameplay/cap_land-01.mp3'] },
    cap_land_2: { src: ['assets/audio/sfx/gameplay/cap_land-02.mp3'] },
    cap_land_3: { src: ['assets/audio/sfx/gameplay/cap_land-03.mp3'] },
    cap_land_4: { src: ['assets/audio/sfx/gameplay/cap_land-04.mp3'] },
    cap_land_5: { src: ['assets/audio/sfx/gameplay/cap_land-05.mp3'] },
    cap_land_6: { src: ['assets/audio/sfx/gameplay/cap_land-06.mp3'] },
    cap_land_7: { src: ['assets/audio/sfx/gameplay/cap_land-07.mp3'] },
    cap_land_8: { src: ['assets/audio/sfx/gameplay/cap_land-08.mp3'] },
};

// BGM — kun OGG indtil videre (ingen MP3-fallback lavet endnu, se doc'en) —
// virker fint til test i Chrome/Firefox/Edge, men INGEN lyd på Safari/iOS før
// en MP3-fil ligger ved siden af hver OGG her (tilføj den bare til src-arrayet,
// ingen kodeændring nødvendig, Howler vælger selv det format browseren støtter).
// randomStart: true → starter et tilfældigt sted i loopet hver gang (se
// bgm_battle's ~4 min-længde, ønsket om variation ved hver ny kamp).
export const BGM_DEFS = {
    menu:   { src: ['assets/audio/bgm/bgm_main_menu.ogg'] },
    shop:   { src: ['assets/audio/bgm/bgm_shop.ogg'] },
    battle: { src: ['assets/audio/bgm/bgm_battle.ogg'], randomStart: true },
    boss:   { src: ['assets/audio/bgm/bgm_boss.ogg'] },
};
