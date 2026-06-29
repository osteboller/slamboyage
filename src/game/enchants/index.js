import { boomerangEnchant } from './boomerangEnchant.js';
import { gildedEnchant }    from './gildedEnchant.js';
import { reverbEnchant }    from './reverbEnchant.js';

// Registry: enchant ID → handler function
// Adding a new enchant = one line here + one file in this folder
export const ENCHANTS = {
    'boomerang': boomerangEnchant,
    'gilded':    gildedEnchant,
    'reverb':    reverbEnchant,
    // 'ironclad': ironcladEnchant, // can't be destroyed/discarded
    // 'feather':  featherEnchant,  // no stack space
    // 'halflife': halflifeEnchant, // keeps half extra value after round
};
