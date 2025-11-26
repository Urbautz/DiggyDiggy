class Dwarf {
    constructor(name) {
        this.name = name;
        this.shovelType = 'stone shovel';
        this.diggingPower = 1; // Represents how many squares the dwarf can dig per action
    }

    dig() {
        // Logic for digging action
        console.log(`${this.name} is digging with a ${this.shovelType}.`);
        return this.diggingPower;
    }
}

export default Dwarf;