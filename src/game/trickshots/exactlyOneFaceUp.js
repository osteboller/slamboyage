// wonCaps er allerede den autoritative "vundet"-liste fra spil-logikken (inkl.
// magnet- og surge-flippede caps). Vi tjekker IKKE isFaceUp(body) her — en
// surge-flippet caps quaternion opdateres først når dens spin-animation lander,
// hvilket sker efter dette kald. wonCaps.length er derfor det korrekte tal.
export function exactlyOneFaceUp(wonCaps, faceDownCaps) {
    return wonCaps.length === 1;
}
