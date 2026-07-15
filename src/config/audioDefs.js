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
    // Trick Shot-resultat — se TrickShotScreen.js's _showResult().
    trickshot_passed: { src: ['assets/audio/sfx/ui/passed.mp3'] },
    trickshot_failed: { src: ['assets/audio/sfx/ui/failed.mp3'] },
    // Spilles når en GRATIS reward/pakke-valg rent faktisk vælges og bliver en
    // del af samlingen (slammer/kort/cap) — se RewardScreen.js's _confirm()/
    // _confirmChest()/_confirmMystery() og ShopScreen.js's _pickFromPack().
    // IKKE brugt ved almindelige betalte bånd-køb — de har allerede 'purchase'.
    pick_gain: { src: ['assets/audio/sfx/ui/pick_gain.mp3'] },
    // Spilles når man vælger en enchant (RewardScreen._confirmEnchant()), når
    // Mystix-consumablen enchanter et kort (main.js's onUse, def.id==='enchant'),
    // OG erstatter den almindelige tilfældige pop-lyd for enchantede caps der
    // dukker op i shoppens bånd-række (ShopScreen._render()).
    enchant: { src: ['assets/audio/sfx/ui/enchant.mp3'] },
    // Spilles når man klikker en node på kortet og går ind i et kast/kamp —
    // se main.js's goToNode().
    enter_battle: { src: ['assets/audio/sfx/ui/enter_battle.mp3'] },
    // 4 varianter, vælges tilfældigt — spilles når man klikker et fyldt
    // forbrugskort-slot og detail-popup'en åbner, se ConsumableSlots.js.
    card_place_1: { src: ['assets/audio/sfx/ui/card_place-01.mp3'] },
    card_place_2: { src: ['assets/audio/sfx/ui/card_place-02.mp3'] },
    card_place_3: { src: ['assets/audio/sfx/ui/card_place-03.mp3'] },
    card_place_4: { src: ['assets/audio/sfx/ui/card_place-04.mp3'] },
    // Åben/luk af selve 3D cap-/slammer-viewer'en (den roterende mønt-popup) —
    // se CapViewer.js's show()/hide(). Delt klasse for BÅDE cap- og slammer-
    // detail, så dette dækker begge automatisk.
    detail_open:  { src: ['assets/audio/sfx/ui/02-open_detailed view.mp3'] },
    detail_close: { src: ['assets/audio/sfx/ui/01-close_detailed.mp3'] },
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
    // 4 varianter, vælges tilfældigt — bruges BÅDE til shoppens bånd-række OG
    // reward-choice-reveal (erstatter den gamle enkelt-fil choice_pop) — se
    // AudioManager.playShopPop()/playChoiceReveal().
    pop_1: { src: ['assets/audio/sfx/ui/pops-01.mp3'] },
    pop_2: { src: ['assets/audio/sfx/ui/pops-02.mp3'] },
    // Pr.-cap score-float, se UIManager.showScoreFloat() — point_base spiller
    // når selve floatet popper frem med sin grundværdi (+N), point_multi
    // spiller pr. multiplikator-trin der rulles ind i samme float (kæden
    // af ×1.5/×2/osv. der kan opstå pr. cap). Begge nyder allerede
    // play()'s default pitch-variation, så gentagne caps/trin i træk ikke
    // lyder identiske.
    point_base:  { src: ['assets/audio/sfx/score/point_base.mp3'] },
    point_multi: { src: ['assets/audio/sfx/score/point_multi.mp3'] },
    // 3 varianter — den vilde rotations-spin-animation når en cap flippes af
    // Flipper/surge-effekten (animateCapFlipSpin) ELLER materialiserer/falder
    // ned ved en spawn-effekt som Team Raptor (animateCapMaterialize), se
    // RoundManager.js's Phase 2.5/2.6. Bevidst IKKE brugt til almindelig
    // blast-flyvning — det er cap_swosh's rolle, se nedenfor.
    cap_flipper_1: { src: ['assets/audio/sfx/caps/cap_flipper.mp3-01.mp3'] },
    cap_flipper_2: { src: ['assets/audio/sfx/caps/cap_flipper.mp3-02.mp3'] },
    cap_flipper_3: { src: ['assets/audio/sfx/caps/cap_flipper.mp3-03.mp3'] },
    // 3 varianter — ambient "der flyver noget vildt afsted"-lyd, et par
    // tilfældige caps ved hvert blast (ThrowController._blast()), ikke bundet
    // til rotation/spin.
    cap_swosh_1: { src: ['assets/audio/sfx/caps/cap_swosh-01.mp3'] },
    cap_swosh_2: { src: ['assets/audio/sfx/caps/cap_swosh-02.mp3'] },
    cap_swosh_3: { src: ['assets/audio/sfx/caps/cap_swosh-03.mp3'] },
    // Permanent fjernelse af en cap i battle — se RoundManager._resolveAndScore()'s
    // destroySelf-gren (jackpot/martyr-ability) og _spawnEffectFeedback's
    // 'destroy'-gren (den mørke poof-ring).
    destroy: { src: ['assets/audio/sfx/caps/destroy.mp3'] },
    // Territorial-stilens exhaust-effekt — spilles pr. cap, i takt med
    // drypvis-fjernelsen (EXHAUST_DRIP_MS-loopet i RoundManager).
    exhaust: { src: ['assets/audio/sfx/caps/exhaust.mp3'] },
    // Blanco/White Card-consumablen — se main.js's onUse, def.id==='white_card'.
    blanco: { src: ['assets/audio/sfx/ui/blanco.mp3'] },
    // #pack-skip-btn (ShopScreen.js)/#reward-skip-btn (RewardScreen.js) — sat via
    // data-sfx="skip" direkte på knapperne, override'r default button_click.
    skip: { src: ['assets/audio/sfx/ui/skip.mp3'] },
};

// BGM — MP3 (IKKE Ogg) — Safari/iOS understøtter aldrig Ogg Vorbis, i
// modsætning til alle SFX'erne (som allerede var MP3, derfor virkede de fint
// på iPhone mens BGM var tavs). Bevidst KUN ét format i stedet for en
// OGG+MP3-fallback-liste — MP3 afspilles overalt (Chrome/Firefox/Edge/Safari),
// så der er ingen grund til dobbelt filstørrelse for et format Safari alligevel
// aldrig ville bruge.
// randomStart: true → starter et tilfældigt sted i loopet hver gang (se
// bgm_battle's ~4 min-længde, ønsket om variation ved hver ny kamp).
export const BGM_DEFS = {
    menu:       { src: ['assets/audio/bgm/bgm_main_menu.mp3'] },
    shop:       { src: ['assets/audio/bgm/bgm_shop.mp3'] },
    battle:     { src: ['assets/audio/bgm/bgm_battle.mp3'], randomStart: true },
    boss:       { src: ['assets/audio/bgm/bgm_boss.mp3'] },
    failed_run: { src: ['assets/audio/bgm/bgm_failed_run.mp3'] },
};
