// Base data}
const gameversion = '0.11.0';
const gridWidth = 10;
const gridDepth = 11; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Material registry — easy to extend later
const materials = [
  { id: 'earth', name: 'Earth', type:'Loose',   hardness: 10, probability: 300, worth: 0.5,               minlevel: 0, maxlevel: 999, color: '#6b4b2c' },
  { id: 'Sand',  name: 'Sand', type:'Loose',    hardness: 10, probability: 200, worth: 0.7,               minlevel: 0, maxlevel: 100, color: '#e0aa46' },
  { id: 'mud',   name: 'Mud', type:'Loose',     hardness: 15, probability: 100, worth: 0,                 minlevel: 0, maxlevel: 999, color: '#4a2f13ff' },
  { id: 'clay',  name: 'Clay', type:'Loose',    hardness: 25, probability: 100, worth: 1.4,               minlevel: 75, maxlevel: 1999, color: '#a57f61' },
  { id: 'gravel',name: 'Gravel',  type:'Loose', hardness: 30, probability: 200, worth: 0.9,               minlevel: 150, maxlevel: 2999, color: '#534f4fff' },

  { id: 'sandstone', name: 'Sandstone',  type:'Stone Soft', hardness: 80, probability: 400, worth: 3.0,   minlevel: 500, maxlevel: 9999, color: '#9d4d39ff' },
  { id: 'limestone', name: 'Limestone' ,type:'Stone Soft',  hardness: 80, probability: 200, worth: 2.5,   minlevel: 1200, maxlevel: 9999, color: '#a8a19fff' },
  { id: 'Chalk',     name: 'Chalk', type:'Stone Soft',      hardness: 30, probability: 100, worth: 2.0,   minlevel: 2000, maxlevel: 9999, color: '#a6b8adff' },
  { id: 'ClayStone', name: 'Clay Stone',type:'Stone Soft',  hardness: 100, probability: 300, worth: 2.0, minlevel: 3000, maxlevel: 15999, color: '#53412fff' },

  { id: 'Marble', name: 'Marble', type:'Stone Medium',      hardness: 250, probability: 200, worth: 10,   minlevel: 4000, maxlevel: 29999, color: '#7a706eff' },
  { id: 'Slate', name: 'Slate', type: 'Stone Medium',       hardness: 400, probability: 400, worth: 5,   minlevel: 5000, maxlevel: 99999, color: '#483b37ff' },
  { id: 'Schist', name: 'Schist', type: 'Stone Medium',     hardness: 400, probability: 200, worth: 5,   minlevel: 5000, maxlevel: 199999, color: '#1d354dff' },
  { id: 'Dolomite', name: 'Dolomite', type: 'Stone Medium', hardness: 400, probability: 200, worth: 12,   minlevel: 5000, maxlevel: 99999, color: '#956f88ff' },

  { id: 'Granite', name: 'Granite', type:'Stone Hard',      hardness: 500, probability: 400, worth: 12,   minlevel: 18000,  color: '#280918ff' },
  { id: 'Basalt', name: 'Basalt', type: 'Stone Hard',       hardness: 750, probability: 400, worth: 17,    minlevel: 95000, color: '#484848ff' },
  { id: 'Obsidian', name: 'Obsidian', type: 'Stone Hard',   hardness: 950, probability: 200, worth: 25,   minlevel: 195000, color: '#184f48ff' },
  { id: 'Quartzite', name: 'Quartzite', type: 'Stone Hard', hardness: 1500, probability: 200, worth: 31,  minlevel: 135000, color: '#c35858ff' }, 

  { id: 'Coal', name: 'Coal',type:'Special',                hardness: 80, probability: 80, worth: 10.5,   minlevel: 500, color: '#191919ff' },
  { id: 'Magma', name: 'Magma',type:'Special',              hardness: 800, probability: 50, worth: 0,    minlevel: 8000, color: '#fa6509ff' },

  { id: 'Bronce Ore', name: 'Bronce Ore', type:'Ore Soft',  hardness: 100, probability: 50, worth: 18,     minlevel: 2000, maxlevel: 99999, color: '#7e6136ff' },
  { id: 'Copper Ore', name: 'Copper Ore',type:'Ore Soft',   hardness: 180, probability: 50, worth: 50,    minlevel: 8000, maxlevel: 99999, color: '#c75e41ff' },
  { id: 'Silver Ore', name: 'Silver  Ore', type:'Ore Soft',  hardness: 350, probability: 15, worth: 190,    minlevel: 6000, maxlevel: 99999, color: '#c5c5c5ff' },

  { id: 'Gold Ore', name: 'Gold Ore', type:'Ore Medium',    hardness: 400, probability: 15, worth: 100000,  minlevel: 15000, color: '#d6a80eff' },
  { id: 'Iron Ore', name: 'Iron Ore', type:'Ore Medium',    hardness: 500, probability: 50, worth: 800,    minlevel: 77000, maxlevel: 99999, color: '#572012ff' },
  { id: 'Zinc Ore', name: 'Zinc Ore',type:'Ore Medium',     hardness: 650, probability: 25, worth: 1150,   minlevel: 31000, maxlevel: 99999, color: '#8ec281ff' },
  
  { id: 'Platinum Ore', name: 'Platinum Ore', type:'Ore Hard',    hardness: 1000, probability: 15, worth: 2500, minlevel: 75000, color: '#c75e41ff' },
  { id: 'Titanium Ore', name: 'Titanium Ore', type:'Ore Hard',    hardness: 200, probability: 15, worth: 3000, minlevel: 100000, color: '#57375dff' },
  { id: 'Adamantine Ore', name: 'Adamantine Ore', type:'Ore Hard', hardness: 7000, probability: 15, worth: 7000, minlevel: 250000, color: '#8eb95eff' }


];


// Tools
const tools = [
    { name: 'Stone Shovel', power: 1, upgradecost: 50},
    { name: 'Bronce Shovel', power: 2.6, upgradecost: 7500},
    { name: 'Copper Shovel', power: 16, upgradecost: 25000},
    { name: 'Copper Pickaxe', power: 110, upgradecost: 99000},
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

// Smelter tasks - ordered list of tasks the smelter will attempt to perform
let smelterTasks = [
    { id: 'do-nothing', name: 'Do Nothing', description: 'The smelter sits idle.', input: null, output: null, type: 'none' },
    { id: 'dry-mud', name: 'Dry Mud', description: 'Dry mud into clay.', input: { material: 'mud', amount: 2 }, output: { material: 'clay', amount: 1 } },
    { id: 'grind-sandstone', name: 'Grind Sandstone', description: 'Grind sandstone into sand.', input: { material: 'sandstone', amount: 1 }, output: { material: 'Sand', amount: 5 }, requires: 'grinding-machine' }
];

let researchtree = [
    { id: 'improved-digging', name: 'Improved Digging Technique', cost: 50, level: 0,
      description: 'Dwarfs dig 1% harder.' }, 
    { id: 'better-housing', name: 'Better Housing', cost: 100, level: 0,  
      description: 'The Home is more comfy, letting them rest faster. Diminishing returns per level.' },
    { id: 'trading', name: 'Better trading', cost: 100, level: 0,  
      description: 'Sell Prices for materials are improved by 3% per level' },
    { id: 'grinding-machine', name: 'Grinding Machine', cost: 200, level: 0, maxlevel: 1,
      description: 'Unlocks the grind task at the Smelter.' },
    { id: 'buckets', name: 'Bigger Buckets', cost: 500, level: 0, maxlevel:10, 
      description: 'Increases bucket capacity by 1 per level.' },
    { id: 'material-science', name: 'Material Science', cost: 500, level: 0, maxlevel: 5,
      description: 'Increases critical hit chance to any stone by 5% per level.' },
    { id: 'union-busting', name: 'Union Busting', cost: 500, level: 0, maxlevel: 15,
      description: 'Reduces dwarf strike likelihood by 5% per level when you run out of money.' },
    { id: 'wage-optimization', name: 'Wage Negotiation', cost: 1000, level: 0, maxlevel: 20,
      description: 'Reduces wage increase per dwarf level by 1%.' },
    { id: 'expertise-stone', name: 'Stone Expertise', cost: 3000, level: 0, maxlevel: 15, requires: [{'material-science':3}],
      description: 'When a dwarf does a critical strike he has a 2% chance do one-hit any stone.' },
    { id: 'expertise-ore', name: 'Ore Expertise', cost: 20000, level: 0, maxlevel: 15, requires: [{'material-science':5}, {'expertise-stone':1}],
      description: 'When a dwarf does a critical strike he has a 3% chance do one-hit any ore.' },
    ];
let activeResearch = null; // Track which research is currently being researched
    
let grid = [];
let startX = 0;
let gold = 10;

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

// Transaction log - keeps last 100 money transactions
let transactionLog = [];

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
// smelter: place fifth cell (4,0) in drop-grid coordinates
const smelter = { x: dropGridStartX + 4, y: 0 };