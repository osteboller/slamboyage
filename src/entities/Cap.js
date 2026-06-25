export class Cap {
    constructor(mesh, body, def, enchant = null) {
        this.mesh    = mesh;
        this.body    = body;
        this.def     = def;
        this.enchant = enchant; // string ID or null
    }
}
