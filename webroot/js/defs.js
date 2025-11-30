// Base data}
const gridWidth = 10;
const gridDepth = 11; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Material registry — easy to extend later
const materials = [
    { id: 'earth', name: 'Earth', hardness: 1, probability: 0.01, worth: 0.5, minlevel: 0, maxlevel: 999, color: '#6b4b2c' },
    { id: 'Sand', name: 'Sand', hardness: 1, probability: 0.01, worth: 0.5, minlevel: 0, maxlevel: 100, color: '#e0aa46' },
    { id: 'mud', name: 'Mud', hardness: 2, probability: 0.01, worth: 0.4, minlevel: 0, maxlevel: 999, color: '#4a2f13ff' },
    { id: 'clay', name: 'Clay', hardness: 5, probability: 0.015, worth: 1, minlevel: 75, maxlevel: 1999, color: '#a57f61' },
    { id: 'gravel', name: 'Gravel', hardness: 5, probability: 0.025, worth: 0.8, minlevel: 150, maxlevel: 2999, color: '#534f4fff' },
    { id: 'sandstone', name: 'Sandstone', hardness: 8, probability: 0.025, worth: 2.0, minlevel: 1300, maxlevel: 999999999, color: '#9d4d39ff' },
    { id: 'limestone', name: 'Limestone', hardness: 8, probability: 0.05, worth: 2.1, minlevel: 1200, color: '#a8a19fff' },
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
      bucket: {}, energy: 1000 },
    { name: "Shovelli", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 1000 },
    { name: "Diggmaster", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 1000 },
    { name: "Burrower", 
     shovelType: "Stone", 
     level: 1, xp: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 1000 },
    { name: "Nevertired McPickaxemaster", 
     shovelType: "Stone", 
     level: 1, xp: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 1000 },
    { name: "SuperDigger", 
     shovelType: "Copper", 
     level: 1, xp: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 1000 },
]
    
let grid = [];
let startX = 0;
let gold = 10;

// Global stockpile for collected materials (dwarfs must deliver to drop-off to increase these)
const materialsStock = {};
// Initialize stock counts for all known materials
for (const m of materials) materialsStock[m.id] = 0;

// How many items a dwarf can hold before needing to return to drop-off
const bucketCapacity = 4;

// Drop-off location (where dwarfs should deliver their bucket contents).
// Place the small 3x3 drop-area to the right of the digging grid. Default
// the drop-off to the top-left cell of that 3x3 area (1/1 in 1-based coordinates).
const dropGridStartX = gridWidth; // three-column grid placed immediately to the right
const dropGridWidth = 3, dropGridHeight = 3;
// drop-off inside the small 3x3: top-left => (0,0) in drop-grid coordinates
const dropOff = { x: dropGridStartX + 0, y: 0 };
// bed / house: place second cell on the top row (1,1 in 1-based coordinates)
const house = { x: dropGridStartX + 1, y: 0 };