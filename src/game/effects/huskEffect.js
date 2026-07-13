// "Gør ingenting, destroyer sig selv når flippet" — baseValue:0 så den ikke
// bidrager noget som helst til scoren (i modsætning til EMPTY_RESULT's
// default baseValue:1), destroySelf fjerner den permanent efter scoring.
export function huskEffect(_cap, _ctx) {
    return { baseValue: 0, destroySelf: true };
}
