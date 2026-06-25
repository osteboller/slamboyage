export class CollisionManager {
    constructor(world) {
        this._active      = false;
        this.pendingBlast = false;
        this.pendingMiss  = false;
        this.onBlast      = null;
        this.onMiss       = null;
        world.addEventListener('beginContact', (event) => {
            if (!this._active) return;
            const { bodyA, bodyB } = event;
            const isSlammer = (b) => b.userData?.kind === 'slammer';
            const isCap     = (b) => b.userData?.kind === 'cap';
            const isGround  = (b) => b.userData?.kind === 'ground';
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