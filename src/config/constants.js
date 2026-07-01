export const VERSION = '0.4.1';

export const ENCHANT_OVERLAY_OPACITY = 0.65;
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
    { name: 'Raptor Slammer', type: 'raptor', texFront: 'assets/slammers/raptor_slammer_front.png', texBack: 'assets/slammers/raptor_slammer_b.png', rimColor: 0x7a5410, mass: 3.5, power: 0.55, precision: 1.00, rating: { power: 3, precision: 3, weight: 3 } },
    { name: 'Yin Yang',       type: 'holo',   texFront: 'assets/slammers/ying_yang.png',            texBack: 'assets/slammers/ying_yang_b.png',         rimColor: 0x111111, mass: 2.5, power: 0.48, precision: 1.40, rating: { power: 2, precision: 5, weight: 2 } },
    { name: 'Skull Slammer',  type: 'skull',  texFront: 'assets/slammers/skull_slammer.png',        texBack: 'assets/slammers/skull_slammer_b.png',     rimColor: 0x000000, mass: 5.0, power: 0.62, precision: 0.65, rating: { power: 4, precision: 1, weight: 4 } },
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
    // Raptor Strike Squad  (5 common · 4 uncommon · 2 rare · 1 legendary)
    { rarity: 1, series: 'raptor_strike', color: 0xdd3344, name: 'Red Raptor',    mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/raptor_strike/01_red.png',           texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { rarity: 1, series: 'raptor_strike', color: 0x2277cc, name: 'Blue Raptor',   mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/raptor_strike/02_blue.png',          texBack: 'assets/caps/raptor_strike/02_blue_b.png'   },
    { rarity: 1, series: 'raptor_strike', color: 0xdd9911, name: 'Gold Raptor',   mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/raptor_strike/03_yellow.png',        texBack: 'assets/caps/raptor_strike/03_yellow_b.png' },
    { rarity: 1, series: 'raptor_strike', color: 0x33aa44, name: 'Green Raptor',  mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/raptor_strike/04_green.png',         texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { rarity: 1, series: 'raptor_strike', color: 0xe05522, name: 'Heavy Mech',    mass: 1.0, bounce: 0.3, effect: 'solo',       texFront: 'assets/caps/raptor_strike/09_mech.png',          texBack: 'assets/caps/raptor_strike/16_mech_b.png'   },
    { rarity: 2, series: 'raptor_strike', color: 0xcc2222, name: 'Red Strike',    mass: 1.0, bounce: 0.3, effect: 'streak',     texFront: 'assets/caps/raptor_strike/05_red_stance.png',    texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { rarity: 2, series: 'raptor_strike', color: 0x1166cc, name: 'Blue Strike',   mass: 1.0, bounce: 0.3, effect: 'flat',       texFront: 'assets/caps/raptor_strike/06_blue_stance.png',   texBack: 'assets/caps/raptor_strike/02_blue_b.png'   },
    { rarity: 2, series: 'raptor_strike', color: 0xcc8800, name: 'Gold Strike',   mass: 1.0, bounce: 0.3, effect: 'zone_inner', texFront: 'assets/caps/raptor_strike/07_yellow_stance.png', texBack: 'assets/caps/raptor_strike/03_yellow_b.png' },
    { rarity: 2, series: 'raptor_strike', color: 0xcc3333, name: 'Team Raptor',   mass: 1.0, bounce: 0.3, effect: 'crew',       texFront: 'assets/caps/raptor_strike/08_team.png',          texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { rarity: 3, series: 'raptor_strike', color: 0xaaaacc, name: 'Silver Raptor', mass: 1.0, bounce: 0.3, effect: 'surge',      texFront: 'assets/caps/raptor_strike/11_silver.png',        texBack: 'assets/caps/raptor_strike/12_silver_b.png' },
    { rarity: 3, series: 'raptor_strike', color: 0x22aa77, name: 'Mecha',         mass: 1.0, bounce: 0.3, effect: 'absorb',     texFront: 'assets/caps/raptor_strike/12_mecha.png',         texBack: 'assets/caps/raptor_strike/18_mecha_b.png'  },
    { rarity: 4, series: 'raptor_strike', color: 0xaa2211, name: 'Raptor Sigil',  mass: 1.0, bounce: 0.3, effect: 'spawn',      texFront: 'assets/caps/raptor_strike/10_raptor_sigel.png',  texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    // Legacy Discs
    { rarity: 3, series: 'legacy_discs',  color: 0xcc3377, name: 'Alien',           mass: 1.0, bounce: 0.3, effect: 'zone_outer', texFront: 'assets/caps/legacy_discs/18_alien.png',  texBack: 'assets/caps/legacy_discs/18_alien_b.png'   },
    { rarity: 3, series: 'legacy_discs',  color: 0x44aa22, name: '8-Ball',          mass: 1.0, bounce: 0.3, effect: 'zone_outer', texFront: 'assets/caps/legacy_discs/24_8ball.png',  texBack: 'assets/caps/legacy_discs/24_8ball_b.png'   },
    // Scary Skullz  (5 common · 4 uncommon · 2 rare · 1 legendary)
    { rarity: 1, series: 'scary_skullz',  color: 0x553366, name: 'Street Skull',     mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/scary_skullz/02_street_skull.png',     texBack: 'assets/caps/scary_skullz/02_street_skull_b.png'      },
    { rarity: 1, series: 'scary_skullz',  color: 0x00bb88, name: 'Cyber Skull',      mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/scary_skullz/04_cyber_skull.png',      texBack: 'assets/caps/scary_skullz/04_cyber_skull_b.png'       },
    { rarity: 1, series: 'scary_skullz',  color: 0x1a6622, name: 'Snek Skull',       mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/scary_skullz/06_snek_skull.png',       texBack: 'assets/caps/scary_skullz/06_snek_skull_b.png'        },
    { rarity: 1, series: 'scary_skullz',  color: 0x4488cc, name: 'Aero Skull',       mass: 1.0, bounce: 0.3, effect: 'zone_outer', texFront: 'assets/caps/scary_skullz/10_aero_skull.png',       texBack: 'assets/caps/scary_skullz/01_jebus_skull_b.png'       },
    { rarity: 1, series: 'scary_skullz',  color: 0x111111, name: 'Pirate Skull',     mass: 1.0, bounce: 0.3, effect: 'neighbour',  texFront: 'assets/caps/scary_skullz/12_pirate_skull.png',     texBack: 'assets/caps/scary_skullz/01_jebus_skull_b.png'       },
    { rarity: 2, series: 'scary_skullz',  color: 0xcc2211, name: 'Jpn Skull',        mass: 1.0, bounce: 0.3, effect: 'surge',      texFront: 'assets/caps/scary_skullz/03_jpn_skull.png',        texBack: 'assets/caps/scary_skullz/03_jpn_skull_b.png'         },
    { rarity: 2, series: 'scary_skullz',  color: 0xcc7700, name: 'Chief Skull',      mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/scary_skullz/07_chief_skull.png',      texBack: 'assets/caps/scary_skullz/07_chief_skull_b.png'       },
    { rarity: 2, series: 'scary_skullz',  color: 0x5a3010, name: 'Critter Skulls',   mass: 1.0, bounce: 0.3, effect: 'spawn',      texFront: 'assets/caps/scary_skullz/05_critter_skulls.png',  texBack: 'assets/caps/scary_skullz/05_critter_skulls_b.png'    },
    { rarity: 2, series: 'scary_skullz',  color: 0x442266, name: 'Hoodoo Skull',     mass: 1.0, bounce: 0.3, effect: 'zone_inner', texFront: 'assets/caps/scary_skullz/11_hoodoo_skull.png',     texBack: 'assets/caps/scary_skullz/01_jebus_skull_b.png'       },
    { rarity: 3, series: 'scary_skullz',  color: 0xb08840, name: 'Prairie Skull',    mass: 1.0, bounce: 0.3, effect: 'magnet',     texFront: 'assets/caps/scary_skullz/08_prarie_skull.png',     texBack: 'assets/caps/scary_skullz/08_prarie_skull_b.png'      },
    { rarity: 3, series: 'scary_skullz',  color: 0x1122aa, name: 'Dual Snake Skull', mass: 1.0, bounce: 0.3, effect: 'streak',     texFront: 'assets/caps/scary_skullz/09_dual_snake_skull.png', texBack: 'assets/caps/scary_skullz/09_dual_snake_skull_b.png'  },
    { rarity: 4, series: 'scary_skullz',  color: 0xf0e0c0, name: 'Jebus Skull',      mass: 1.0, bounce: 0.3, effect: 'solo',       texFront: 'assets/caps/scary_skullz/01_jebus_skull.png',      texBack: 'assets/caps/scary_skullz/01_jebus_skull_b.png'       },
    // Cosmic Caps  (5 common · 4 uncommon · 2 rare · 1 legendary)
    { rarity: 1, series: 'cosmic_caps', color: 0x55cc44, name: 'Calm in Peace',    mass: 1.0, bounce: 0.3,                      texFront: 'assets/caps/cosmic_caps/01_calm_in_peace.png',        texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 1, series: 'cosmic_caps', color: 0x55bb33, name: 'Phone Homie',      mass: 1.0, bounce: 0.3,                      texFront: 'assets/caps/cosmic_caps/03_phone_homie.png',          texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 1, series: 'cosmic_caps', color: 0x88cc44, name: 'Hang Light',       mass: 1.0, bounce: 0.3,                     texFront: 'assets/caps/cosmic_caps/04_hang_light.png',           texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 1, series: 'cosmic_caps', color: 0x22aacc, name: "Surfin' Alien II", mass: 1.0, bounce: 0.3,                      texFront: 'assets/caps/cosmic_caps/06_surfin_with_alien_2.png',  texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 1, series: 'cosmic_caps', color: 0x1199cc, name: "Surfin' Alien",    mass: 1.0, bounce: 0.3, effect: 'rally',     texFront: 'assets/caps/cosmic_caps/09_surfin_with_alien.png',    texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 2, series: 'cosmic_caps', color: 0x33cc55, name: 'Ollien',           mass: 1.0, bounce: 0.3, effect: 'surge',    texFront: 'assets/caps/cosmic_caps/02_Ollien.png',                texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 2, series: 'cosmic_caps', color: 0xcc4466, name: 'Space Rockera',    mass: 1.0, bounce: 0.3, effect: 'streak',    texFront: 'assets/caps/cosmic_caps/05_space_rockera.png',        texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 2, series: 'cosmic_caps', color: 0x44bb88, name: 'Save Space',       mass: 1.0, bounce: 0.3, effect: 'flat',      texFront: 'assets/caps/cosmic_caps/07_save_space.png',           texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 2, series: 'cosmic_caps', color: 0x9933cc, name: 'Kino Morph',        mass: 1.0, bounce: 0.3, effect: 'solo',      texFront: 'assets/caps/cosmic_caps/08_xeno_kino.png',            texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 3, series: 'cosmic_caps', color: 0xcc4422, name: 'Martian Graffiti', mass: 1.0, bounce: 0.3, effect: 'crew',      texFront: 'assets/caps/cosmic_caps/10_martian_graffiti.png',     texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 3, series: 'cosmic_caps', color: 0xffaa22, name: 'Lift Off',         mass: 1.0, bounce: 0.3, effect: 'spawn',     texFront: 'assets/caps/cosmic_caps/11_they_have_lift_off.png',   texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    { rarity: 4, series: 'cosmic_caps', color: 0x558899, name: 'Meditative Space', mass: 1.0, bounce: 0.3, effect: 'magnet',    texFront: 'assets/caps/cosmic_caps/12_meditative_space.png',     texBack: 'assets/caps/cosmic_caps/cosmic_caps_b.png' },
    // Pewl Ballz  (5 common · 4 uncommon · 2 rare · 1 legendary)
    { rarity: 1, series: 'pewl_ballz', color: 0xddcc00, name: 'Yellow Pewl',   mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/01_pewls.png', texBack: 'assets/caps/pewl_ballz/01_pewls_b.png' },
    { rarity: 1, series: 'pewl_ballz', color: 0x2266cc, name: 'Blue Pewl',     mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/02_pewls.png', texBack: 'assets/caps/pewl_ballz/02_pewls_b.png' },
    { rarity: 1, series: 'pewl_ballz', color: 0x882299, name: 'Plum Pewl',     mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/04_pewls.png', texBack: 'assets/caps/pewl_ballz/04_pewls_b.png' },
    { rarity: 1, series: 'pewl_ballz', color: 0x228833, name: 'Green Pewl',    mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/06_pewls.png', texBack: 'assets/caps/pewl_ballz/06_pewls_b.png' },
    { rarity: 1, series: 'pewl_ballz', color: 0x882211, name: 'Maroon Pewl',   mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/07_pewls.png', texBack: 'assets/caps/pewl_ballz/07_pewls_b.png' },
    { rarity: 2, series: 'pewl_ballz', color: 0xccbb00, name: 'Yellow Stripe', mass: 1.0, bounce: 0.35, effect: 'solo',       texFront: 'assets/caps/pewl_ballz/09_pewls.png', texBack: 'assets/caps/pewl_ballz/09_pewls_b.png' },
    { rarity: 2, series: 'pewl_ballz', color: 0xbb2211, name: 'Red Stripe',    mass: 1.0, bounce: 0.35, effect: 'surge',       texFront: 'assets/caps/pewl_ballz/11_pewls.png', texBack: 'assets/caps/pewl_ballz/11_pewls_b.png' },
    { rarity: 2, series: 'pewl_ballz', color: 0x771188, name: 'Plum Stripe',   mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/12_pewls.png', texBack: 'assets/caps/pewl_ballz/12_pewls_b.png' },
    { rarity: 2, series: 'pewl_ballz', color: 0xcc6600, name: 'Orange Stripe', mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/13_pewls.png', texBack: 'assets/caps/pewl_ballz/13_pewls_b.png' },
    { rarity: 3, series: 'pewl_ballz', color: 0x111111, name: 'Black Pewl',    mass: 1.0, bounce: 0.35, effect: 'flat',       texFront: 'assets/caps/pewl_ballz/08_pewls.png', texBack: 'assets/caps/pewl_ballz/08_pewls_b.png' },
    { rarity: 3, series: 'pewl_ballz', color: 0xf5f5f5, name: 'Cue Ball',      mass: 1.0, bounce: 0.35, effect: 'cue_slam',  texFront: 'assets/caps/pewl_ballz/16_pewls.png', texBack: 'assets/caps/pewl_ballz/16_pewls_b.png' },
    { rarity: 4, series: 'pewl_ballz', color: 0xdd88ff, name: 'Rainbow',       mass: 1.0, bounce: 0.35,                       texFront: 'assets/caps/pewl_ballz/21_pewls.png', texBack: 'assets/caps/pewl_ballz/01_pewls_b.png' },
];