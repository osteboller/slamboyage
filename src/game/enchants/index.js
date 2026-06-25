import { echoEnchant } from './echoEnchant.js';

// Registry: enchant ID → handler function
// Adding a new enchant = one line here + one file in this folder
export const ENCHANTS = {
    'echo': echoEnchant,
};
