// Samme "wonCaps er allerede autoritativ"-logik som exactlyOneFaceUp — se den
// fil for hvorfor vi ikke selv tjekker isFaceUp(body) her.
// 0 tæller bevidst IKKE som "lige" — et rent miss skal ikke kunne cleare denne.
export function evenFlipCount(wonCaps, faceDownCaps) {
    return wonCaps.length > 0 && wonCaps.length % 2 === 0;
}
