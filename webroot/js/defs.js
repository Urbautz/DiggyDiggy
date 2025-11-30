// Base data}
const gameversion = '0.10.0';
const gridWidth = 10;
const gridDepth = 11; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Material registry — easy to extend later
const materials = [
    { id: 'earth', name: 'Earth', hardness: 1, probability: 0.01, worth: 0.5, minlevel: 0, maxlevel: 999, color: '#6b4b2c' },
    { id: 'Sand', name: 'Sand', hardness: 1, probability: 0.01, worth: 0.7, minlevel: 0, maxlevel: 100, color: '#e0aa46' },
    { id: 'mud', name: 'Mud', hardness: 2, probability: 0.01, worth: 0.4, minlevel: 0, maxlevel: 999, color: '#4a2f13ff' },
    { id: 'clay', name: 'Clay', hardness: 5, probability: 0.015, worth: 1.4, minlevel: 75, maxlevel: 1999, color: '#a57f61' },
    { id: 'gravel', name: 'Gravel', hardness: 5, probability: 0.025, worth: 0.9, minlevel: 150, maxlevel: 2999, color: '#534f4fff' },
    { id: 'sandstone', name: 'Sandstone', hardness: 8, probability: 0.025, worth: 2.0, minlevel: 500, maxlevel: 9999, color: '#9d4d39ff' },
    { id: 'limestone', name: 'Limestone', hardness: 8, probability: 0.05, worth: 2.1, minlevel: 1200, maxlevel: 9999, color: '#a8a19fff' },
	{ id: 'Coal', name: 'Coal', hardness: 8, probability: 0.01, worth: 2.5, minlevel: 1500, maxlevel: 9999, color: '#191919ff' },
	{ id: 'Chalk', name: 'Chalk', hardness: 10, probability: 0.03, worth: 1.1, minlevel: 2000, maxlevel: 9999, color: '#a6b8adff' },
	{ id: 'Salt', name: 'Salt', hardness: 5, probability: 0.005, worth: 4.5, minlevel: 1500, maxlevel: 9999, color: '#efdaedff' },
	{ id: 'Bronce Ore', name: 'Bronce', hardness: 30, probability: 0.005, worth: 6.5, minlevel: 3000, maxlevel: 99999, color: '#7e6136ff' },
	{ id: 'Marble', name: 'Marble', hardness: 40, probability: 0.05, worth: 8, minlevel: 4000, maxlevel: 99999, color: '#7a706eff' },
	{ id: 'Slate', name: 'Slate', hardness: 110, probability: 0.05, worth: 2, minlevel: 5000, maxlevel: 99999, color: '#483b37ff' },
	{ id: 'Copper Ore', name: 'Copper Ore', hardness: 15, probability: 0.005, worth: 15, minlevel: 4000, maxlevel: 99999, color: '#c75e41ff' },
    { id: 'Gold Ore', name: 'Gold Ore', hardness: 30, probability: 0.0005, worth: 1000, minlevel: 5000, maxlevel: 99999, color: '#d6a80eff' }
];


// Tools
const tools = [
    { name: 'Stone Shovel', power: 0.4, upgradecost: 50},
    { name: 'Bronce Shovel', power: 0.6, upgradecost: 7500},
    { name: 'Copper Shovel', power: 0.8, upgradecost: 25000},
]

// Tools inventory - array of individual tool instances
const toolsInventory = [
    { id: 1, type: 'Stone Shovel', level: 1 },
    { id: 2, type: 'Stone Shovel', level: 1 },
    { id: 3, type: 'Stone Shovel', level: 1 },
    { id: 4, type: 'Stone Shovel', level: 1 },
    { id: 5, type: 'Stone Shovel', level: 1 },
    { id: 6, type: 'Stone Shovel', level: 1 }
];

let dwarfs = [
    { name: "Diggingston", 
      toolId: 1, 
      level: 1, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100 },
    { name: "Shovelli", 
      toolId: 2, 
      level: 1, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100 },
    { name: "Diggmaster", 
      toolId: 3, 
      level: 1, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100 },
    { name: "Burrower", 
     toolId: 4, 
     level: 1, xp: 0,
     digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100 },
    { name: "Nevertired McPickaxemaster", 
     toolId: 5, 
     level: 1, xp: 0,
     digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100 },
    { name: "SuperDigger", 
     toolId: 6, 
     level: 1, xp: 0,
     digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100 },
]

let researchtree = [
    { id: 'improved-digging', name: 'Improved Digging Technique', cost: 50, level: 0,
      description: 'Dwarfs dig 1% harder.' }, 
    { id: 'better-housing', name: 'Better Housing', cost: 100, level: 0,  
      description: 'The Home is more comfy, letting them rest faster. Diminishing returns per level.' },
        { id: 'trading', name: 'Better trading', cost: 100, level: 0,  
      description: 'Sell Prices for materials are improved by 3% per level' },
   /* { id: 'advanced-tools', name: 'Advanced Tools', cost: 2000, level: 0, maxlevel: 1,
      description: 'Unlocks Bronce Shovel for crafting.' },
    { id: 'superior-tools', name: 'Superior Tools', cost: 50000, level: 0, maxlevel: 1,
      description: 'Unlocks Copper Shovel for crafting.' } */
]

let activeResearch = null; // Track which research is currently being researched
    
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
const dropGridStartX = gridWidth; // six-column grid placed immediately to the right
const dropGridWidth = 6, dropGridHeight = 1;
// drop-off inside the 6x1 grid: first cell (0,0) in drop-grid coordinates
const dropOff = { x: dropGridStartX + 0, y: 0 };
// bed / house: place second cell (1,0) in drop-grid coordinates
const house = { x: dropGridStartX + 1, y: 0 };
// workbench: place third cell (2,0) in drop-grid coordinates
const workbench = { x: dropGridStartX + 2, y: 0 };
// research: place fourth cell (3,0) in drop-grid coordinates
const research = { x: dropGridStartX + 3, y: 0 };