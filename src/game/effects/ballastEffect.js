// Al Ballasts faktiske opførsel (2× pr. kast den ligger uflippet + Husk-
// cap pr. sådan kast) sker i RoundManager's kastvise face-down-tjek — IKKE
// her. Denne funktion kører kun DEN gang cappen rent faktisk bliver flippet,
// hvor den ikke skal gøre noget særligt (almindelig base-score, ingen bonus,
// ingen Husk — det stopper netop når den flippes). Beholdt som en eksplicit,
// tom registrering (i stedet for slet ingen 'ballast'-entry i EFFECTS) så det
// er tydeligt i koden at dette er et bevidst valg, ikke en glemt effekt.
export function ballastEffect(_cap, _ctx) {
    return {};
}
