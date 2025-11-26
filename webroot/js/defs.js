// Base data}
const gridWidth = 20;
const gridDepth = 25; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Material registry — easy to extend later
const materials = [
    { id: 'earth', name: 'Earth', hardness: 1, color: '#6b4b2c' },
    { id: 'clay', name: 'Clay', hardness: 2, color: '#a57f61' },
    { id: 'gravel', name: 'Sandstone', hardness: 2, color: '#443232' },
];

// Tools
const tools = [
    { name: 'Stone', power: 0.4 },
    { name: 'Bronce', power: 0.6 },
    { name: 'Copper', power: 0.8 },
]

let dwarfs = [
    { name: "Diggingston", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {} },
    { name: "Shovelli", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {} },
    { name: "Diggmaster", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0,
     status: 'idle', moveTarget: null,
     bucket: {} },
    { name: "Burrower", 
     shovelType: "Stone", 
     level: 1, xp: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
     bucket: {} },
]
    
let grid = [];
let startX = 0;

// Global stockpile for collected materials (dwarfs must deliver to drop-off to increase these)
const materialsStock = {};
// Initialize stock counts for all known materials
for (const m of materials) materialsStock[m.id] = 0;

// How many items a dwarf can hold before needing to return to drop-off
const bucketCapacity = 4;

// Drop-off location (where dwarfs should deliver their bucket contents). Choose top-left by default.
const dropOff = { x: 0, y: 0 };