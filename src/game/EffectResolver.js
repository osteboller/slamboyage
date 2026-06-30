import { EFFECTS }  from './effects/index.js';
import { ENCHANTS } from './enchants/index.js';

// From SLAMBERZ_EFFECTS_REF.md — proximity constants
export const NEARBY_RADIUS       = 8; // world units
export const VERY_NEARBY_RADIUS  = 3; // world units

// EffectResult shape — all fields optional from effect functions; defaults applied here
const EMPTY_RESULT = Object.freeze({
    baseValue:       1,
    bonus:           0,
    localMultiplier: 1,
    returnToStack:   false,
    triggerCaps:    [],
    fx:             null,
    effectMeta:     null, // { type, ... } — drives visual effect ring in UI
    spawnCaps:      [],   // cap defs to inject into the next throw's stack
    auraBonus:      0,    // bonus to grant to other matching caps this throw
    auraFilter:     null, // 'nearby' | 'series' | 'series_or_nearby'
    flipNearby:     0,    // number of nearby face-down caps to surge-flip
});

export class EffectResolver {
    // Resolve effect + enchant for a single cap → EffectResult
    resolve(cap, context) {
        const base   = this._applyEffect(cap, context);
        const result = this._applyEnchant(cap, context, base);
        return result;
    }

    // Build context for one cap relative to all caps in this throw
    buildContext(cap, allCaps, throwIndex, capsFlippedThisThrow = 0) {
        const p  = cap.body.position;
        const distanceFromCenter = Math.sqrt(p.x * p.x + p.z * p.z);

        const nearbyCaps = allCaps.filter(other => {
            if (other === cap) return false;
            const op = other.body.position;
            const dx = p.x - op.x, dz = p.z - op.z;
            return Math.sqrt(dx * dx + dz * dz) < NEARBY_RADIUS;
        });

        const closeNeighbourCaps = allCaps.filter(other => {
            if (other === cap) return false;
            const op = other.body.position;
            const dx = p.x - op.x, dz = p.z - op.z;
            return Math.sqrt(dx * dx + dz * dz) < VERY_NEARBY_RADIUS;
        });

        return { distanceFromCenter, nearbyCaps, closeNeighbourCaps, allCaps, throwIndex, capsFlippedThisThrow };
    }

    // ─── PRIVATE ──────────────────────────────────────────────────────────────

    _applyEffect(cap, context) {
        const fn = EFFECTS[cap.def?.effect];
        if (!fn) return { ...EMPTY_RESULT };
        return { ...EMPTY_RESULT, ...fn(cap, context) };
    }

    _applyEnchant(cap, context, base) {
        const fn = ENCHANTS[cap.enchant];
        if (!fn) return base;
        return { ...base, ...fn(cap, context, base) };
    }
}
