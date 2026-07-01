export class Cap {
    constructor(mesh, body, def, enchant = null, entryId = null, isGhost = false) {
        this.mesh    = mesh;
        this.body    = body;
        this.def     = def;
        this.enchant = enchant;
        this.entryId = entryId;
        this.isGhost = isGhost;
    }
}
