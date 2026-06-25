// type: 'globalMultiplier' → multiplies the entire throw score
//       'flatBonus'        → adds to every flipped cap's bonus before localMultiplier
//       'stackSize'        → increases GameState.stackSizeLimit immediately on pickup
export const RELIC_DEFS = [
    { id: 'golden_eye',  name: 'Golden Eye',  icon: '◎', type: 'globalMultiplier', value: 1.5, description: 'All throw scores ×1.5' },
    { id: 'lucky_flip',  name: 'Lucky Flip',  icon: '◈', type: 'globalMultiplier', value: 2.0, description: 'All throw scores ×2'   },
    { id: 'magnet',      name: 'Magnet',      icon: '◉', type: 'flatBonus',        value: 1,   description: '+1★ to every cap scored' },
    { id: 'power_surge', name: 'Power Surge', icon: '◆', type: 'flatBonus',        value: 2,   description: '+2★ to every cap scored' },
    { id: 'deep_bag',    name: 'Deep Bag',    icon: '▣', type: 'stackSize',        value: 3,   description: 'Stack size +3'           },
    { id: 'twin_stack',  name: 'Twin Stack',  icon: '⬡', type: 'stackSize',        value: 5,   description: 'Stack size +5'           },
];
