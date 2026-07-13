export function backupEffect(cap, _ctx) {
    return { spawnCaps: [{ def: cap.def, enchant: cap.enchant ?? null }] };
}
