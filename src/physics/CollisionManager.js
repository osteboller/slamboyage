import { audio } from '../audio/AudioManager.js';

// Cap-landingslyd — tunbare konstanter. MIN_VELOCITY filtrerer rullende/
// glidende caps der bare strejfer gulvet (STILL_LINEAR i constants.js er 0.7,
// "i ro" — landinger skal være tydeligt kraftigere end det for at tælle).
// COOLDOWN_MS er en global debounce på TVÆRS af alle caps, så 15 caps der
// lander inden for få ms af hinanden ikke bliver til en grødet lydvæg.
const CAP_LAND_MIN_VELOCITY = 2.5;
const CAP_LAND_COOLDOWN_MS  = 40;

export class CollisionManager {
    constructor(world) {
        this._active          = false;
        this.pendingBlast      = false;
        this.pendingMiss       = false;
        this.onBlast           = null;
        this.onMiss            = null;
        this._lastLandSoundAt  = 0;
        world.addEventListener('beginContact', (event) => {
            const { bodyA, bodyB } = event;
            const isSlammer = (b) => b.userData?.kind === 'slammer';
            const isCap     = (b) => b.userData?.kind === 'cap';
            const isGround  = (b) => b.userData?.kind === 'ground';

            // Cap-landing — kører UAFHÆNGIGT af _active (den er kun sand i det
            // korte vindue inden slammerens EGEN første kontakt; caps rammer
            // gulvet resten af settle-fasen, længe efter _active er slukket).
            // hasLanded nulstilles pr. cap ved hvert nyt kast, se
            // ThrowController._blast(). Sættes FØR hastigheds-/cooldown-tjek —
            // "første kontakt" gælder uanset om selve lyden rent faktisk spiller.
            const capBody    = isCap(bodyA) ? bodyA : (isCap(bodyB) ? bodyB : null);
            const groundBody = isGround(bodyA) ? bodyA : (isGround(bodyB) ? bodyB : null);
            if (capBody && groundBody && !capBody.userData.hasLanded) {
                capBody.userData.hasLanded = true;
                if (Math.abs(capBody.velocity.y) > CAP_LAND_MIN_VELOCITY) {
                    const now = performance.now();
                    if (now - this._lastLandSoundAt > CAP_LAND_COOLDOWN_MS) {
                        this._lastLandSoundAt = now;
                        audio.play(`cap_land_${1 + Math.floor(Math.random() * 8)}`);
                    }
                }
            }

            if (!this._active) return;
            if (!this.pendingBlast &&
                ((isSlammer(bodyA) && isCap(bodyB)) || (isSlammer(bodyB) && isCap(bodyA)))) {
                this.pendingBlast = true;
            }
            // Slammer rammer gulvet uden at have ramt en cap → miss
            if (!this.pendingBlast && !this.pendingMiss &&
                ((isSlammer(bodyA) && isGround(bodyB)) || (isSlammer(bodyB) && isGround(bodyA)))) {
                this.pendingMiss = true;
            }
        });
    }
    activate() { this._active = true; }
    // Kaldes efter world.step() — blast har prioritet over miss hvis begge sker samme step
    checkPending() {
        if (this.pendingBlast) {
            this.pendingBlast = false;
            this.pendingMiss  = false;
            this._active      = false;
            if (this.onBlast) this.onBlast();
        } else if (this.pendingMiss) {
            this.pendingMiss = false;
            this._active     = false;
            if (this.onMiss) this.onMiss();
        }
    }
    reset() {
        this.pendingBlast = false;
        this.pendingMiss  = false;
        this._active      = false;
    }
    // Safety net kaldt fra game loop når positionelt overlap detekteres —
    // sikrer blast selv hvis Cannon-es broadphase missede kollisionen.
    // Blast vinder over miss: var slammeren tæt nok på en cap til at positionen
    // bekræfter passage, skal det tælle som et hit — ikke et miss.
    forceBlast() {
        if (!this._active || this.pendingBlast) return;
        this.pendingBlast = true;
        this.pendingMiss  = false;
    }
}