export const VERSION = '0.4.1';
export const POG_R       = 1.2;
export const POG_H       = 0.13;
export const SLAM_H      = 0.28;
export const STACK_COUNT = 8;

export const DEFAULT_SPEED = 65;
export const DEFAULT_MASS  = 3.5;

// Power bar: speed-range når power bar er aktiv (erstatter slideren)
export const POWER_SPEED_MIN = 45;
export const POWER_SPEED_MAX = 100;

// Pause i ms mellem klik og slammer-spawn (giver visuel feedback + mobil-venlig timing)
export const SHOT_DELAY = 1000;
export const THROWS_PER_ROUND = 3;

export const CAM_BASE  = { x: 0, y: 16, z: 22 }; // zoomed ud (post-blast) — original vinkel
export const CAM_CLOSE = { x: 0, y: 12, z: 8  }; // zoomed ind (idle/aiming) — mere ovenfra

// Field zones — single source of truth for both physics and renderer
// Field play surface radius = 11.4 (RenderEngine CircleGeometry)
export const ZONE_INNER_R = 4.5; // inner bonus zone — gold ring on field
export const ZONE_OUTER_R = 9.0; // outer bonus zone — blue ring on field

// power:     blast-kraftmultiplikator  (1.0 = standard)
// precision: jo højere, jo langsommere svinger power-baren (nemmere at time)
// mass:      slammer-legemets masse    (tungere = mere kinetisk energi)
// power:     blast-kraft (bruges direkte i formlen: shotSpeed * power)
// mass:      fysik-legemets masse — tung slammer afbøjes ikke af caps, ruller langsommere
// precision: power-barens svingehastighed — høj = langsom bar = nemmere at time
// rating:    UI-visning 1–5, uafhængigt af de mekaniske værdier
export const SLAMMER_DEFS = [
    { name: 'Gold Raptor',   type: 'gold',  texFront: 'assets/slammers/gold_raptor.png',   texBack: 'assets/slammers/gold_raptor_b.png',   rimColor: 0x7a5410, mass: 3.5, power: 0.55, precision: 1.00, rating: { power: 3, precision: 3, weight: 3 } },
    { name: 'Yin Yang',      type: 'holo',  texFront: 'assets/slammers/ying_yang.png',     texBack: 'assets/slammers/ying_yang_b.png',     rimColor: 0x111111, mass: 2.5, power: 0.48, precision: 1.40, rating: { power: 2, precision: 5, weight: 2 } },
    { name: 'Skull Slammer', type: 'skull', texFront: 'assets/slammers/skull_slammer.png', texBack: 'assets/slammers/skull_slammer_b.png', rimColor: 0x000000, mass: 5.0, power: 0.62, precision: 0.65, rating: { power: 4, precision: 1, weight: 4 } },
];

// ─── SETTLE / DÆMPNING ───────────────────────────────────────────────────────
// Lineær bevægelse = "the boom" (caps der flyver udad) → dæmpes blødt.
// Vinkel-bevægelse = rim-spin / møntrotation           → dæmpes hårdt.
// At adskille de to bevarer det eksplosive look OG dræber den langsomme settling.
export const SETTLE = {
    AIR_LINEAR:      0.04, // næsten ingen → fuld scatter bevares
    AIR_ANGULAR:     0.30, // dræber rim-spin i luften uden at fjerne tumbling

    RAMP_DELAY_MS:    350,
    LINEAR_RAMP_MS:  1200,
    ANGULAR_RAMP_MS:  450, // spin bløder hurtigt af på gulvet
    LINEAR_MAX:      0.94,
    ANGULAR_MAX:     0.97,

    STILL_LINEAR:    0.7,  // var 0.5
    STILL_ANGULAR:   1.4,  // var 0.5 — en cap må rasle lidt og tælle som "i ro"
    MIN_MS:           500,
    MAX_MS:          2500, // var 5000 — hård bagkant
};

export const CAP_DEFS = [
    // Raptor Strike — common, no effect
    { series: 'raptor_strike', color: 0xdd3344, name: 'Red Raptor',      mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/01_red.png',    texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { series: 'raptor_strike', color: 0x2277cc, name: 'Blue Raptor',     mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/02_blue.png',   texBack: 'assets/caps/raptor_strike/02_blue_b.png'   },
    { series: 'raptor_strike', color: 0xdd9911, name: 'Gold Raptor',     mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/03_yellow.png', texBack: 'assets/caps/raptor_strike/03_yellow_b.png' },
    { series: 'raptor_strike', color: 0x7755ee, name: 'Silver',          mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/12_silver.png', texBack: 'assets/caps/raptor_strike/12_silver_b.png' },
    { series: 'raptor_strike', color: 0xe05522, name: 'Mech',            mass: 1.0, bounce: 0.3, effect: 'flat',      texFront: 'assets/caps/raptor_strike/16_mech.png',   texBack: 'assets/caps/raptor_strike/16_mech_b.png'   },
    { series: 'raptor_strike', color: 0x22aa77, name: 'Mecha',           mass: 1.0, bounce: 0.3, effect: 'neighbour', texFront: 'assets/caps/raptor_strike/18_mecha.png',  texBack: 'assets/caps/raptor_strike/18_mecha_b.png'  },
    // Legacy Discs
    { series: 'legacy_discs',  color: 0xcc3377, name: 'Alien',           mass: 1.0, bounce: 0.3, effect: 'zone_inner', texFront: 'assets/caps/legacy_discs/18_alien.png',  texBack: 'assets/caps/legacy_discs/18_alien_b.png'   },
    { series: 'legacy_discs',  color: 0x44aa22, name: '8-Ball',          mass: 1.0, bounce: 0.3, effect: 'zone_outer', texFront: 'assets/caps/legacy_discs/24_8ball.png',  texBack: 'assets/caps/legacy_discs/24_8ball_b.png'   },
    // Scary Skullz
    { series: 'scary_skullz',  color: 0xf0e0c0, name: 'Jebus Skull',     mass: 1.0, bounce: 0.3, effect: 'solo',   texFront: 'assets/caps/scary_skullz/01_jebus_skull.png',      texBack: 'assets/caps/scary_skullz/01_jebus_skull_b.png'    },
    { series: 'scary_skullz',  color: 0x553366, name: 'Street Skull',    mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/02_street_skull.png',     texBack: 'assets/caps/scary_skullz/02_street_skull_b.png'   },
    { series: 'scary_skullz',  color: 0xcc2211, name: 'Jpn Skull',       mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/03_jpn_skull.png',        texBack: 'assets/caps/scary_skullz/03_jpn_skull_b.png'      },
    { series: 'scary_skullz',  color: 0x00bb88, name: 'Cyber Skull',     mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/04_cyber_skull.png',      texBack: 'assets/caps/scary_skullz/04_cyber_skull_b.png'    },
    { series: 'scary_skullz',  color: 0x5a3010, name: 'Critter Skulls',  mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/05_critter_skulls.png',   texBack: 'assets/caps/scary_skullz/05_critter_skulls_b.png' },
    { series: 'scary_skullz',  color: 0x1a6622, name: 'Snek Skull',      mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/06_snek_skull.png',       texBack: 'assets/caps/scary_skullz/06_snek_skull_b.png'     },
    { series: 'scary_skullz',  color: 0xcc7700, name: 'Chief Skull',     mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/07_chief_skull.png',      texBack: 'assets/caps/scary_skullz/07_chief_skull_b.png'    },
    { series: 'scary_skullz',  color: 0xb08840, name: 'Prairie Skull',   mass: 1.0, bounce: 0.3,                   texFront: 'assets/caps/scary_skullz/08_prarie_skull.png',     texBack: 'assets/caps/scary_skullz/08_prarie_skull_b.png'   },
    { series: 'scary_skullz',  color: 0x1122aa, name: 'Dual Snake Skull',mass: 1.0, bounce: 0.3, effect: 'streak', texFront: 'assets/caps/scary_skullz/09_dual_snake_skull.png', texBack: 'assets/caps/scary_skullz/09_dual_snake_skull_b.png' },
];