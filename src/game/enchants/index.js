import { boomerangEnchant } from './boomerangEnchant.js';
import { gildedEnchant }    from './gildedEnchant.js';
import { reverbEnchant }    from './reverbEnchant.js';
import { halflifeEnchant }  from './halflifeEnchant.js';
import { ironcladEnchant }  from './ironcladEnchant.js';

// Registry: enchant ID → handler function
// Adding a new enchant = one line here + one file in this folder
export const ENCHANTS = {
    'boomerang': boomerangEnchant,
    'gilded':    gildedEnchant,
    'reverb':    reverbEnchant,
    'halflife':  halflifeEnchant,
    'ironclad':  ironcladEnchant, // now has something to protect against: destroySelf (jackpot/martyr)
    // 'feather':  featherEnchant,  // no stack space
};
