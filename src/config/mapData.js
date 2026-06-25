// Base node thresholds for loop 1. Each subsequent loop scales by +50%.
// clearScore per loop N = ceil(baseClear * (1 + (N-1) * 0.5))
export const BASE_NODES = [
    { baseClear: 2 },
    { baseClear: 3 },
    { baseClear: 4 },
    { baseClear: 5 },
    { baseClear: 6 },
];

export const CAP_PRICE = 2; // score points per cap in shop
