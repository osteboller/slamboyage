export class Cap {
    constructor(mesh, body, def, enchant = null, entryId = null) {
        this.mesh    = mesh;
        this.body    = body;
        this.def     = def;
        this.enchant = enchant; // snapshot at spawn — use entryId to resolve live value
        this.entryId = entryId; // ownedCaps entry id — null for free-play caps
    }
}
