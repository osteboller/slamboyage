import { CAP_DEFS } from '../../config/constants.js';

// Generisk — læser spawnPool/spawnCount fra selve cap-definitionen i stedet
// for at hardkode hvilke caps der spawnes, så andre caps kan bruge samme
// effekt med deres egen pool uden at røre denne fil.
export function spawnEffect(cap, _ctx) {
    const pool  = cap.def.spawnPool ?? [];
    const count = cap.def.spawnCount ?? 1;
    if (pool.length === 0) return {};

    const defs = [];
    for (let i = 0; i < count; i++) {
        const name = pool[Math.floor(Math.random() * pool.length)];
        const def  = CAP_DEFS.find(d => d.name === name);
        if (def) defs.push(def);
    }
    return { instantSpawn: defs };
}
