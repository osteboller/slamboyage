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

// Kort-pris i shop-båndet ×1.5 for hvert kort købt, resten af runnen (nulstilles kun i startRun()).
export const CARD_PRICE_GROWTH = 1.5;

// Hard caps på collection — se docs/særskilte md'er for 6. juli/6juli_AGENT_HARDCAPS_AND_PRICE_SCALING.md
export const MAX_OWNED_SLAMMERS = 10;
export const MAX_OWNED_CAPS     = 50;

// Cap-/pakke-priser i shoppen vokser +35% pr. loop (kort-priser har sin egen
// CARD_PRICE_GROWTH ovenfor og er upåvirket af denne).
export const CAP_PRICE_GROWTH_PER_LOOP = 0.35;

export const CAM_BASE  = { x: 0, y: 16, z: 22 }; // zoomed ud (post-blast) — original vinkel
export const CAM_CLOSE = { x: 0, y: 12, z: 8  }; // zoomed ind (idle/aiming) — mere ovenfra

// Field zones — single source of truth for both physics and renderer
// Field play surface radius = 11.4 (RenderEngine CircleGeometry)
export const ZONE_INNER_R = 4.5; // inner bonus zone — gold ring on field
export const ZONE_OUTER_R = 9.0; // outer bonus zone — blue ring on field

// Bordpladens kant — halvdelen af 60×60 PlaneGeometry i RenderEngine._setupGround()
export const GROUND_HALF_SIZE = 30;

// power:     blast-kraftmultiplikator  (1.0 = standard)
// precision: jo højere, jo langsommere svinger power-baren (nemmere at time)
// mass:      slammer-legemets masse    (tungere = mere kinetisk energi)
// power:     blast-kraft (bruges direkte i formlen: shotSpeed * power)
// mass:      fysik-legemets masse — tung slammer afbøjes ikke af caps, ruller langsommere
// precision: power-barens svingehastighed — høj = langsom bar = nemmere at time
// rating:    UI-visning 1–5, uafhængigt af de mekaniske værdier
// Rarity: 1=common 2=uncommon 3=rare 4=legendary (samme skala som CAP_DEFS).
// sellPrice pr. rarity: 2★/4★/7★/12★ (se docs/slammer-passives-draft.md).
// passive: samme shape som RELIC_DEFS brugte — { id, name, icon, type, value, description, [rarity|parity] }.
// null = ingen passiv endnu (kun Regal Pug, bevidst — den var "ekstra" allerede før udvidelsen).
export const SLAMMER_DEFS = [
    { name: 'Raptor Slammer', type: 'raptor', texFront: 'assets/slammers/raptor_slammer_front.png', texBack: 'assets/slammers/raptor_slammer_b.png', rimColor: 0x7a5410, mass: 3.5, power: 0.55, precision: 1.00, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'uncommon_ground', name: 'Uncommon Ground', icon: '◐', type: 'rarityMultiplier', rarity: 2, value: 3, description: 'Uncommon caps score ×3' } },
    { name: 'Yin Yang',       type: 'holo',   texFront: 'assets/slammers/ying_yang.png',            texBack: 'assets/slammers/ying_yang_b.png',         rimColor: 0x111111, mass: 2.5, power: 0.48, precision: 1.40, rating: { power: 2, precision: 5, weight: 2 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'twin_stack', name: 'Twin Stack', icon: '⬡', type: 'stackSize', value: 5, description: 'Stack size +5' } },
    { name: 'Skull Slammer',  type: 'skull',  texFront: 'assets/slammers/skull_slammer.png',        texBack: 'assets/slammers/skull_slammer_b.png',     rimColor: 0x000000, mass: 5.0, power: 0.62, precision: 0.65, rating: { power: 4, precision: 1, weight: 4 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'power_surge', name: 'Power Surge', icon: '◆', type: 'flatBonus', value: 2, description: '+2★ to every cap scored' } },
    // Placeholder-stats — afventer gennemtænkning af hele slammer-systemet.
    { name: 'Corgi Butt',     type: 'corgi',  texFront: 'assets/slammers/slammer_dawgz_01_corgi_butt.png',    texBack: 'assets/slammers/slammer_dawgz_01_corgi_butt_b.png',    rimColor: 0xd9a441, mass: 3.0, power: 0.50, precision: 1.10, rating: { power: 3, precision: 4, weight: 2 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'bargain_bin', name: 'Bargain Bin', icon: '%', type: 'shopDiscount', value: 0.5, description: 'All shop prices ×0.5' } },
    { name: 'Game of Bones',  type: 'bones',  texFront: 'assets/slammers/slammer_dawgz_02_game_of_bones.png', texBack: 'assets/slammers/slammer_dawgz_02_game_of_bones_b.png', rimColor: 0xcac2b0, mass: 4.0, power: 0.58, precision: 0.90, rating: { power: 4, precision: 2, weight: 4 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'deep_bag', name: 'Deep Bag', icon: '▣', type: 'stackSize', value: 3, description: 'Stack size +3' } },
    { name: 'Raptor Sigil',   type: 'raptor', texFront: 'assets/slammers/10_raptor_sigel.png',        texBack: 'assets/slammers/raptor_slammer_b.png',            rimColor: 0xccaa33, mass: 3.5, power: 0.56, precision: 1.05, rating: { power: 3, precision: 4, weight: 3 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'first_strike', name: 'First Strike', icon: '①', type: 'firstThrow', value: 4, description: 'First throw of a round ×4' } },
    { name: 'Alien Bronze',   type: 'alien',  texFront: 'assets/slammers/alien_slammer_bronze.png',   texBack: 'assets/slammers/alien_slammer_bronze_back_2.png', rimColor: 0xcd7f32, mass: 4.2, power: 0.60, precision: 0.80, rating: { power: 4, precision: 2, weight: 4 },
        rarity: 1, sellPrice: 2,
        passive: { id: 'extra_arm', name: 'Extra Arm', icon: '✋', type: 'extraThrow', value: 1, description: '+1 throw every round' } },
    { name: 'Alien Silver',   type: 'alien',  texFront: 'assets/slammers/alien_slammer_silver.png',   texBack: 'assets/slammers/alien_slammer_silver_b.png',   rimColor: 0xc0c0c0, mass: 3.2, power: 0.52, precision: 1.15, rating: { power: 3, precision: 4, weight: 3 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'rare_find', name: 'Rare Find', icon: '◇', type: 'rarityMultiplier', rarity: 3, value: 4, description: 'Rare caps score ×4' } },
    { name: 'Alien Gold',     type: 'alien',  texFront: 'assets/slammers/alien_slammer_pizza.png',    texBack: 'assets/slammers/alien_slammer_gold_b.png',     rimColor: 0xffd700, mass: 2.8, power: 0.50, precision: 1.30, rating: { power: 2, precision: 5, weight: 2 },
        rarity: 4, sellPrice: 12,
        passive: { id: 'legendary_status', name: 'Legendary Status', icon: '★', type: 'rarityMultiplier', rarity: 4, value: 5, description: 'Legendary caps score ×5' } },
    { name: 'Regal Pug',      type: 'corgi',  texFront: 'assets/slammers/slammer_dawgz_03_regal_pug.png',     texBack: 'assets/slammers/slammer_dawgz_03_regal_pug_b.png',     rimColor: 0xb8860b, mass: 3.3, power: 0.53, precision: 1.05, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 1, sellPrice: 2,
        passive: null }, // bevidst passiv-løs — se docs/slammer-passives-draft.md
    { name: 'Swamp Skull',    type: 'skull',  texFront: 'assets/slammers/skull_slam_swamp.png',       texBack: 'assets/slammers/skull_slam_swamp_b.png',       rimColor: 0x3a4a2a, mass: 4.6, power: 0.59, precision: 0.75, rating: { power: 4, precision: 2, weight: 4 },
        rarity: 1, sellPrice: 2,
        passive: { id: 'iron_discipline', name: 'Iron Discipline', icon: '⊛', type: 'throwSaver', value: 0.1, description: 'Each unused throw adds ×0.1 · Current: ×1.0' } },
    { name: 'Voodoo Skull',   type: 'skull',  texFront: 'assets/slammers/skull_slam_voodoo.png',      texBack: 'assets/slammers/skull_slam_voodoo_b.png',      rimColor: 0xb0aec0, mass: 3.6, power: 0.54, precision: 1.20, rating: { power: 3, precision: 4, weight: 3 },
        rarity: 1, sellPrice: 2,
        passive: { id: 'magnet', name: 'Magnet', icon: '◉', type: 'flatBonus', value: 1, description: '+1★ to every cap scored' } },
    // Crypt Keeper har ingen egen bagside endnu — genbruger seriens fælles
    // Skull-bagside (jf. "fælles bagside pr. serie"-konvention i slammer-passives-draft.md).
    { name: 'Crypt Keeper',   type: 'skull',  texFront: 'assets/slammers/skull_slam_crypt_keeper.png', texBack: 'assets/slammers/skull_slammer_b.png',         rimColor: 0x1a1a1a, mass: 4.0, power: 0.57, precision: 0.95, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 4, sellPrice: 12,
        passive: { id: 'last_stand', name: 'Last Stand', icon: '⑤', type: 'lastThrow', value: 4, description: 'Last throw of a round ×4' } },
    { name: 'Pewl 69',        type: 'pewl',   texFront: 'assets/slammers/pewlz_slammer_69.png',       texBack: 'assets/slammers/pewlz_slammer_69_b.png',       rimColor: 0xd4af37, mass: 2.6, power: 0.49, precision: 1.25, rating: { power: 2, precision: 4, weight: 2 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'even_steven_slam', name: 'Even Steven', icon: '⚁', type: 'parityMultiplier', parity: 'even', value: 2, description: 'Throws with an EVEN number of flips score ×2' } },
    { name: 'Pewl 420',       type: 'pewl',   texFront: 'assets/slammers/pewlz_slammer_420.png',      texBack: 'assets/slammers/pewlz_slammer_420_b.png',      rimColor: 0x4a7a3a, mass: 3.4, power: 0.51, precision: 1.10, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 1, sellPrice: 2,
        passive: { id: 'common_touch', name: 'Common Touch', icon: '●', type: 'rarityMultiplier', rarity: 1, value: 2, description: 'Common caps score ×2' } },
    { name: 'Pewl 666',       type: 'pewl',   texFront: 'assets/slammers/pewlz_slammer_666.png',      texBack: 'assets/slammers/pewlz_slammer_666_b.png',      rimColor: 0x5a1a1a, mass: 4.4, power: 0.61, precision: 0.70, rating: { power: 4, precision: 1, weight: 4 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'odd_todd_slam', name: 'Odd Todd', icon: '⚂', type: 'parityMultiplier', parity: 'odd', value: 2, description: 'Throws with an ODD number of flips score ×2' } },
    // Zuper/Zrees slammers — hver har sin egen unikke passive-type, ingen deler
    // type med hinanden eller med de 16 ovenfor (spillerens eksplicitte krav).
    { name: 'Crimson Scarab',    type: 'zuper', texFront: 'assets/slammers/slammer_zuper_crimson_scarab.png',    texBack: 'assets/slammers/slamm_zuper_b.png', rimColor: 0xaa2222, mass: 3.0, power: 0.52, precision: 1.15, rating: { power: 3, precision: 4, weight: 2 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'scarab_hoard', name: 'Scarab Hoard', icon: '🔶', type: 'shardGain', value: 2, description: '+2 Shard whenever a boss is cleared' } },
    { name: 'Sub-Terra King',    type: 'zuper', texFront: 'assets/slammers/slammer_zuper_sub-terra_king.png',   texBack: 'assets/slammers/slamm_zuper_b.png', rimColor: 0x5a3a1a, mass: 4.8, power: 0.60, precision: 0.75, rating: { power: 4, precision: 2, weight: 4 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'shard_king', name: 'Shard King', icon: '♦', type: 'sharden', value: 0.2, description: 'Each unused Shard adds ×0.2 permanently · Current: ×1.0' } },
    { name: 'Gilded Gargoyle',   type: 'zuper', texFront: 'assets/slammers/slammer_zuper_gilded_gargoyle.png',  texBack: 'assets/slammers/slamm_zuper_b.png', rimColor: 0xd4af37, mass: 3.6, power: 0.55, precision: 1.10, rating: { power: 3, precision: 4, weight: 3 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'gargoyle_ward', name: "Gargoyle's Ward", icon: '✦', type: 'holoMultiplier', value: 2, description: 'Enchanted caps score ×2' } },
    { name: 'Whispering Shadow', type: 'zuper', texFront: 'assets/slammers/slammer_zuper_whispering_shadow.png', texBack: 'assets/slammers/slamm_zuper_b.png', rimColor: 0x2a2a3a, mass: 2.4, power: 0.46, precision: 1.35, rating: { power: 2, precision: 5, weight: 2 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'vanishing_act', name: 'Vanishing Act', icon: '🃏', type: 'illusionist', value: 1, description: 'Flip every cap in the stack in one round → get a free random card' } },
    { name: 'Spellbound',        type: 'zrees', texFront: 'assets/slammers/slammer_zrees_spellbound.png',       texBack: 'assets/slammers/slammer_zrees_b.png', rimColor: 0x6633aa, mass: 3.0, power: 0.50, precision: 1.10, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 1, sellPrice: 2,
        passive: { id: 'first_spell', name: 'First Spell', icon: '🔮', type: 'squareCard', value: 1, description: 'Start of round: if you hold no cards, get a free random one' } },
    { name: 'Bloodlines',        type: 'zrees', texFront: 'assets/slammers/slammer_zrees_bloodlines.png',       texBack: 'assets/slammers/slammer_zrees_b.png', rimColor: 0x8a1010, mass: 3.8, power: 0.56, precision: 0.95, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'last_of_the_line', name: 'Last of the Line', icon: '①', type: 'hero', value: 4, description: 'Flip exactly 1 cap in a throw → ×4' } },
    { name: 'Crescent Heights',  type: 'zrees', texFront: 'assets/slammers/slammer_zrees_crescent_high.png',    texBack: 'assets/slammers/slammer_zrees_b.png', rimColor: 0x445577, mass: 3.2, power: 0.51, precision: 1.05, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 1, sellPrice: 2,
        passive: { id: 'lunar_cycle', name: 'Lunar Cycle', icon: '☾', type: 'analogTimer', value: 6, interval: 6, description: 'Every 6th throw this run scores ×6' } },
    { name: "Class of '96",      type: 'zrees', texFront: 'assets/slammers/slammer_zrees_96.png',               texBack: 'assets/slammers/slammer_zrees_b.png', rimColor: 0xdd8800, mass: 3.4, power: 0.53, precision: 1.00, rating: { power: 3, precision: 3, weight: 3 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'nostalgia_pulse', name: 'Nostalgia Pulse', icon: '⏱', type: 'digitalTimer', value: 8, interval: 4, description: 'Every 4th throw this run: +8★ to every cap flipped that throw' } },
    { name: 'Quarterback Sis',   type: 'zrees', texFront: 'assets/slammers/slammer_zrees_quarterback_sis.png',  texBack: 'assets/slammers/slammer_zrees_b.png', rimColor: 0x1155aa, mass: 4.4, power: 0.63, precision: 0.85, rating: { power: 4, precision: 2, weight: 4 },
        rarity: 3, sellPrice: 7,
        passive: { id: 'overdrive', name: 'Overdrive', icon: '⚡', type: 'overdrive', value: 0.5, throwBonus: 3, description: '+3 throws per round, but all scoring is halved' } },
    { name: 'Neon Justice',      type: 'zrees', texFront: 'assets/slammers/slammer_zrees_neon_justice.png',     texBack: 'assets/slammers/slammer_zrees_b.png', rimColor: 0x33ffcc, mass: 2.8, power: 0.48, precision: 1.25, rating: { power: 2, precision: 4, weight: 2 },
        rarity: 2, sellPrice: 4,
        passive: { id: 'scales_of_justice', name: 'Scales of Justice', icon: '⚖', type: 'balance', value: 0.1, description: 'Each consecutive round your collection exactly fills max stack size: +0.1 permanently · Current: ×1.0' } },
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
    { rarity: 1, series: 'raptor_strike', color: 0xccaa44, name: 'Mecha Raptor',  mass: 1.0, bounce: 0.3, effect: 'solo',       texFront: 'assets/caps/raptor_strike/09_mecha_raptor.png',  texBack: 'assets/caps/raptor_strike/16_mech_b.png'   },
    { rarity: 2, series: 'raptor_strike', color: 0xcc2222, name: 'Red Strike',    mass: 1.0, bounce: 0.3, effect: 'streak',     texFront: 'assets/caps/raptor_strike/05_red_stance.png',    texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { rarity: 2, series: 'raptor_strike', color: 0x1166cc, name: 'Blue Strike',   mass: 1.0, bounce: 0.3, effect: 'flat',       texFront: 'assets/caps/raptor_strike/06_blue_stance.png',   texBack: 'assets/caps/raptor_strike/02_blue_b.png'   },
    { rarity: 2, series: 'raptor_strike', color: 0x2e8b4f, name: 'Jade-a-saur',  mass: 1.0, bounce: 0.3, effect: 'zone_inner', texFront: 'assets/caps/raptor_strike/07_drake_saur.png',    texBack: 'assets/caps/raptor_strike/03_yellow_b.png' },
    { rarity: 2, series: 'raptor_strike', color: 0xcc3333, name: 'Team Raptor',   mass: 1.0, bounce: 0.3, effect: 'crew',       texFront: 'assets/caps/raptor_strike/08_team.png',          texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { rarity: 3, series: 'raptor_strike', color: 0xaaaacc, name: 'Silver Raptor', mass: 1.0, bounce: 0.3, effect: 'surge',      texFront: 'assets/caps/raptor_strike/11_silver.png',        texBack: 'assets/caps/raptor_strike/12_silver_b.png' },
    { rarity: 4, series: 'raptor_strike', color: 0xcc9933, name: 'Raptor Fusion', mass: 1.0, bounce: 0.3, effect: 'absorb',     texFront: 'assets/caps/raptor_strike/12_mecha_raptor_saur.png', texBack: 'assets/caps/raptor_strike/18_mecha_b.png'  },
    { rarity: 3, series: 'raptor_strike', color: 0xcc2211, name: 'Droid-e-saur', mass: 1.0, bounce: 0.3, effect: 'spawn',      texFront: 'assets/caps/raptor_strike/10_red_raptor_saur.png', texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
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
    // Dawgz  (5 common · 4 uncommon · 2 rare · 1 legendary)
    { rarity: 1, series: 'dawgz', color: 0xddaa33, name: 'Goldeen',      mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/dawgz/dawgz_01_goldeen.png',      texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 1, series: 'dawgz', color: 0x552583, name: 'Kobe',         mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/dawgz/dawgz_02_kobe.png',         texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 1, series: 'dawgz', color: 0x8b5a2b, name: 'Terry',        mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/dawgz/dawgz_03_terry.png',        texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 1, series: 'dawgz', color: 0xe8e0d0, name: 'Mozart',       mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/dawgz/dawgz_04_mozart.png',       texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 1, series: 'dawgz', color: 0xd9a441, name: 'Doge',         mass: 1.0, bounce: 0.3, effect: 'solo',       texFront: 'assets/caps/dawgz/dawgz_05_doge.png',         texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 2, series: 'dawgz', color: 0x5577aa, name: 'Husk P\'Dey',  mass: 1.0, bounce: 0.3, effect: 'streak',     texFront: 'assets/caps/dawgz/dawgz_06_husky.png',        texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 2, series: 'dawgz', color: 0x1a1a1a, name: 'Black Weenie', mass: 1.0, bounce: 0.3, effect: 'flat',       texFront: 'assets/caps/dawgz/dawgz_07_black_weenie.png', texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 2, series: 'dawgz', color: 0xcc9966, name: 'Pugsby',       mass: 1.0, bounce: 0.3, effect: 'zone_inner', texFront: 'assets/caps/dawgz/dawgz_08_puggy.png',        texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 2, series: 'dawgz', color: 0xaa7744, name: 'Shetsuo',      mass: 1.0, bounce: 0.3, effect: 'crew',       texFront: 'assets/caps/dawgz/dawgz_09_shetsuo.png',      texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 3, series: 'dawgz', color: 0x99aabb, name: 'Malmutti',     mass: 1.0, bounce: 0.3, effect: 'surge',      texFront: 'assets/caps/dawgz/dawgz_10_malmutti.png',     texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 3, series: 'dawgz', color: 0xdddddd, name: 'Dalmer',       mass: 1.0, bounce: 0.3, effect: 'magnet',     texFront: 'assets/caps/dawgz/dawgz_11_dalmay.png',       texBack: 'assets/caps/dawgz/dawgz_b.png' },
    { rarity: 4, series: 'dawgz', color: 0xcc8822, name: 'King Corgi',   mass: 1.0, bounce: 0.3, effect: 'spawn',      texFront: 'assets/caps/dawgz/dawgz_12_king_corgi.png',   texBack: 'assets/caps/dawgz/dawgz_b.png' },

    // Zupers  (5 common · 4 uncommon · 2 rare · 1 legendary) — deler ÉN fælles
    // texBack (zupers_b.png) på tværs af alle 12, ligesom Dawgz.
    { rarity: 1, series: 'zupers', color: 0xaa2233, name: 'Crimson Scarab',        mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/zupers/zupers_01_crimson_scarab.png',        texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 1, series: 'zupers', color: 0x2255cc, name: 'The Blue Hornet',       mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/zupers/zupers_02_the_blue_hornet.png',       texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 1, series: 'zupers', color: 0x223377, name: 'Captain Liberty',       mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/zupers/zupers_03_captain_liberty.png',       texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 1, series: 'zupers', color: 0x66bbdd, name: 'Aero Girl',             mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/zupers/zupers_04_aero_girl.png',             texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 1, series: 'zupers', color: 0x4477aa, name: 'Sky Raider',            mass: 1.0, bounce: 0.3, effect: 'solo',       texFront: 'assets/caps/zupers/zupers_05_sky_raider.png',            texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 2, series: 'zupers', color: 0x2a1a44, name: 'Madame Midnight',       mass: 1.0, bounce: 0.3, effect: 'zone_outer', texFront: 'assets/caps/zupers/zupers_06_madame_midnight.png',       texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 2, series: 'zupers', color: 0xaa5522, name: 'Sub-Terra King',        mass: 1.0, bounce: 0.3, effect: 'magnet',     texFront: 'assets/caps/zupers/zupers_07_sub-terra_king.png',        texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 2, series: 'zupers', color: 0x8844cc, name: 'Doctor Nebula',         mass: 1.0, bounce: 0.3, effect: 'rally',      texFront: 'assets/caps/zupers/zupers_08doctor_nebula.png',          texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 2, series: 'zupers', color: 0xaa3322, name: 'The Iron Patriot',      mass: 1.0, bounce: 0.3, effect: 'flat',       texFront: 'assets/caps/zupers/zupers_09_the_iron_patriot.png',      texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 3, series: 'zupers', color: 0x333344, name: 'The Whispering Shadow', mass: 1.0, bounce: 0.3, effect: 'streak',     texFront: 'assets/caps/zupers/zupers_10_the_whispering_shadow.png', texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 3, series: 'zupers', color: 0xaa8844, name: 'Clockwork Monk',        mass: 1.0, bounce: 0.3, effect: 'surge',      texFront: 'assets/caps/zupers/zupers_11_clockwork_monk.png',        texBack: 'assets/caps/zupers/zupers_b.png' },
    { rarity: 4, series: 'zupers', color: 0xccaa33, name: 'Gilded Gargoyle',       mass: 1.0, bounce: 0.3, effect: 'crew',       texFront: 'assets/caps/zupers/zupers_12_gilded_gargoyle.png',       texBack: 'assets/caps/zupers/zupers_b.png' },

    // Zrees — 90'er tv-serie-parodier  (5 common · 4 uncommon · 2 rare · 1 legendary)
    // — deler ÉN fælles texBack (zrees_b.png) på tværs af alle 12, ligesom Dawgz/Zupers.
    // Jackpot/Martyr (destroy-ability-draft.md) — endelig placering efter test:
    // Quarterback Sis → jackpot, Relic Hunter → martyr. Det skubbede Relic Hunters
    // gamle absorb til Bloodlines, Bloodlines' gamle surge til Midnight Journal, og
    // Midnight Journals gamle solo (Lone Wolf) til Guiding Lights — én rotation af
    // eksisterende, allerede arted caps, ingen taber sit artwork. Basement Tapes
    // (den oprindelige jackpot-vært) er effekt-løs igen, ligesom Neon Justice.
    // Rarity er BEVIDST urørt for nu (kun effekt-tildelingen flyttet rundt).
    { rarity: 1, series: 'zrees', color: 0xee2299, name: 'Neon Justice',       mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/zrees/zrees_01_neon_justice.png',        texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 1, series: 'zrees', color: 0xddaa33, name: 'Guiding Lights',     mass: 1.0, bounce: 0.3, effect: 'solo',       texFront: 'assets/caps/zrees/zrees_02_guiding_lights.png',      texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 1, series: 'zrees', color: 0xcc3322, name: 'Quarterback Sis',    mass: 1.0, bounce: 0.3, effect: 'jackpot',    texFront: 'assets/caps/zrees/zrees_03_quarterback_sis.png',     texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 1, series: 'zrees', color: 0x556633, name: 'Basement Tapes',     mass: 1.0, bounce: 0.3,                       texFront: 'assets/caps/zrees/zrees_04_basement_tapes_1.png',    texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 1, series: 'zrees', color: 0x223366, name: 'Midnight Journal',   mass: 1.0, bounce: 0.3, effect: 'surge',      texFront: 'assets/caps/zrees/zrees_05_midnight_journal.png',    texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 2, series: 'zrees', color: 0x555555, name: 'Off the Record',     mass: 1.0, bounce: 0.3, effect: 'zone_outer', texFront: 'assets/caps/zrees/zrees_06_off_the_record.png',      texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 2, series: 'zrees', color: 0x3355aa, name: 'Orbit9',            mass: 1.0, bounce: 0.3, effect: 'magnet',     texFront: 'assets/caps/zrees/zrees_07_orbit9.png',              texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 2, series: 'zrees', color: 0x8833cc, name: 'Spellbound',        mass: 1.0, bounce: 0.3, effect: 'rally',      texFront: 'assets/caps/zrees/zrees_08_spellbound.png',          texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 2, series: 'zrees', color: 0xcc77aa, name: 'Crescent Heights II', mass: 1.0, bounce: 0.3, effect: 'streak',    texFront: 'assets/caps/zrees/zrees_09_crescent_heights2.png',   texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 3, series: 'zrees', color: 0x991122, name: 'Bloodlines',        mass: 1.0, bounce: 0.3, effect: 'absorb',     texFront: 'assets/caps/zrees/zrees_10_bloodlines.png',          texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 3, series: 'zrees', color: 0xccaa22, name: "Class of '96",      mass: 1.0, bounce: 0.3, effect: 'crew',       texFront: 'assets/caps/zrees/zrees_11_class_of_96.png',         texBack: 'assets/caps/zrees/zrees_b.png' },
    { rarity: 4, series: 'zrees', color: 0xaa7722, name: 'Relic Hunter',      mass: 1.0, bounce: 0.3, effect: 'martyr',     texFront: 'assets/caps/zrees/zrees_12_relic_hunter.png',        texBack: 'assets/caps/zrees/zrees_b.png' },
];