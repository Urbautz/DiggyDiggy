// Base data
const gameversion = '0.11.0';
const gridWidth = 10;
const gridDepth = 11; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Game mechanic constants - centralized for easy tweaking
const TOOL_LEVEL_BONUS = 0.1; // 10% bonus per tool level
const TOOL_UPGRADE_COST_MULTIPLIER = 2; // Cost doubles with each level
const DWARF_BASE_POWER = 3; // Base damage without tools
const DWARF_DIG_POWER_BONUS = 0.1; // 10% bonus per dig power point
const DWARF_ENERGY_COST_PER_DIG = 5; // Energy consumed per dig action
const DWARF_ENERGY_COST_PER_MOVE = 1; // Energy consumed per move
const DWARF_ENERGY_COST_PER_RESEARCH = 10; // Energy consumed per research action
const DWARF_ENERGY_COST_PER_SMELT = 10; // Energy consumed per smelting action
const DWARF_LOW_ENERGY_THRESHOLD = 25; // Energy below which dwarf seeks rest
const DWARF_REST_AMOUNT = 25; // Energy restored per rest tick
const DWARF_BASE_WAGE = 0.01; // Base gold cost per dig action
const DWARF_WAGE_INCREASE_RATE = 0.25; // 25% wage increase per level
const DWARF_WAGE_INCREASE_MIN = 0.05; // Minimum wage increase rate (with research)
const DWARF_XP_PER_ACTION = 1; // XP gained per dig/smelt action
const DWARF_XP_PER_LEVEL = 250; // XP needed per level
const DWARF_STRIKE_BASE_CHANCE = 0.1; // 10% chance to continue without pay
const DWARF_LEVELUP_ENERGY_MULTIPLIER = 1.2; // 20% energy increase on levelup
const DWARF_LEVELUP_STRENGTH_BONUS = 1; // Bucket capacity increase per strength point

const CRITICAL_HIT_BASE_CHANCE = 0.02; // 2% base critical hit chance
const CRITICAL_HIT_DAMAGE_MULTIPLIER = 2; // Critical hits do double damage
const CRITICAL_HIT_ANIMATION_DURATION = 320; // Milliseconds for crit animation
const ONE_HIT_ANIMATION_DURATION = 320; // Milliseconds for one-hit animation
const STONE_EXPERTISE_ONE_HIT_CHANCE = 0.02; // 2% per level
const ORE_EXPERTISE_ONE_HIT_CHANCE = 0.03; // 3% per level

const RESEARCH_IMPROVED_DIGGING_BONUS = 0.01; // 1% per level
const RESEARCH_MATERIAL_SCIENCE_CRIT_BONUS = 0.05; // 5% crit chance per level
const RESEARCH_UNION_BUSTING_BONUS = 0.05; // 5% less strike chance per level
const RESEARCH_WAGE_OPTIMIZATION_REDUCTION = 0.01; // 1% wage increase reduction per level
const RESEARCH_BETTER_HOUSING_BASE_BONUS = 0.1; // 10% base rest bonus
const RESEARCH_BETTER_HOUSING_DIMINISH = 0.15; // Diminishing returns factor
const RESEARCH_TRADING_BONUS = 0.03; // 3% better sell prices per level
const RESEARCH_BUCKET_CAPACITY_BONUS = 1; // 1 extra capacity per level
const RESEARCH_STONE_POLISHING_BREAK_REDUCTION = 0.08; // 8% less break chance per level
const RESEARCH_FURNACE_INSULATION_BONUS = 0.10; // 10% less heat loss per level
const RESEARCH_COST_MULTIPLIER = 2; // Research cost doubles each level

const GRID_CLUSTERING_HORIZONTAL_CHANCE = 0.5; // 50% chance to use same material as left tile
const GRID_CLUSTERING_VERTICAL_CHANCE = 0.5; // 50% chance to use same material as above tile
const GRID_MOVE_DOWN_CHANCE = 0.3; // 30% chance to move down to dig lower
const GRID_MOVE_UP_CHANCE = 0.7; // 70% chance to move up after horizontal move

const SMELTER_BASE_TEMPERATURE = 25; // Starting and minimum temperature
const SMELTER_MAX_TEMPERATURE_LIMIT = 1500; // Absolute maximum temperature
const SMELTER_COOLING_RATE = 0.0005; // 0.05% cooling per tick
const SMELTER_POLISH_BREAK_CHANCE = 0.5; // 50% base break chance when polishing

const TASK_RESEARCH_CHANCE = 0.5; // 50% chance to do research/smelting instead of digging
const TASK_RESEARCH_SPLIT = 0.5; // 50/50 split between research and smelting

const STUCK_DETECTION_TICKS = 25; // Ticks before teleporting stuck dwarf
const FAILSAFE_CHECK_INTERVAL = 100; // Ticks between failsafe checks

const AUTO_REFRESH_INTERVAL = 2000; // Milliseconds for transaction modal refresh

const CHEAT_GOLD_BONUS = 5000; // Gold added by cheat code
const CHEAT_DEPTH_MULTIPLIER = 2; // Depth multiplier for cheat code

// Material registry — easy to extend later
const materials = [
  { id: 'earth', name: 'Earth', type:'Loose',   hardness: 10, probability: 300, worth: 0.5,               minlevel: 0, maxlevel: 999, color: '#6b4b2c' },
  { id: 'Sand',  name: 'Sand', type:'Loose',    hardness: 10, probability: 200, worth: 0.7,               minlevel: 0, maxlevel: 100, color: '#e0aa46' },
  { id: 'mud',   name: 'Mud', type:'Loose',     hardness: 15, probability: 100, worth: 0,                 minlevel: 0, maxlevel: 999, color: '#4a2f13ff' },
  { id: 'clay',  name: 'Clay', type:'Loose',    hardness: 25, probability: 100, worth: 1.4,               minlevel: 75, maxlevel: 1999, color: '#a57f61' },
  { id: 'gravel',name: 'Gravel',  type:'Loose', hardness: 30, probability: 200, worth: 0.9,               minlevel: 150, maxlevel: 2999, color: '#534f4fff' },

  { id: 'sandstone', name: 'Sandstone',  type:'Stone Soft', hardness: 80, probability: 400, worth: 3.0,   minlevel: 500, maxlevel: 9999, color: '#9d4d39ff' },
  { id: 'limestone', name: 'Limestone' ,type:'Stone Soft',  hardness: 80, probability: 200, worth: 2.5,   minlevel: 1200, maxlevel: 9999, color: '#a8a19fff' }, 
  { id: 'Lime', name: 'Lime', type:'Processed',             hardness: 0, probability: 0, worth: 8.0,      minlevel: 99999, color: '#e8f4f0ff' },
  { id: 'Chalk',     name: 'Chalk', type:'Stone Soft',      hardness: 30, probability: 100, worth: 2.0,   minlevel: 2000, maxlevel: 9999, color: '#a6b8adff' },
  { id: 'ClayStone', name: 'Clay Stone',type:'Stone Soft',  hardness: 100, probability: 300, worth: 2.0, minlevel: 3000, maxlevel: 15999, color: '#53412fff' },

  { id: 'Marble', name: 'Marble', type:'Stone Medium',      hardness: 250, probability: 200, worth: 10,   minlevel: 4000, maxlevel: 29999, color: '#7a706eff' },
  { id: 'Polished Marble', name: 'Polished Marble', type:'Processed', hardness: 0, probability: 0, worth: 40,  minlevel: 99999, color: '#c8c0beff' },
  { id: 'Slate', name: 'Slate', type: 'Stone Medium',       hardness: 400, probability: 400, worth: 5,   minlevel: 5000, maxlevel: 99999, color: '#483b37ff' },
  { id: 'Schist', name: 'Schist', type: 'Stone Medium',     hardness: 400, probability: 200, worth: 5,   minlevel: 5000, maxlevel: 199999, color: '#1d354dff' },
  { id: 'Dolomite', name: 'Dolomite', type: 'Stone Medium', hardness: 400, probability: 200, worth: 12,   minlevel: 5000, maxlevel: 99999, color: '#956f88ff' },

  { id: 'Granite', name: 'Granite', type:'Stone Hard',      hardness: 500, probability: 400, worth: 12,   minlevel: 18000,  color: '#280918ff' },
  { id: 'Polished Granite', name: 'Polished Granite', type:'Processed', hardness: 0, probability: 0, worth: 50, minlevel: 99999, color: '#4a1828ff' },

  { id: 'Basalt', name: 'Basalt', type: 'Stone Hard',       hardness: 750, probability: 400, worth: 17,    minlevel: 95000, color: '#484848ff' },
  { id: 'Obsidian', name: 'Obsidian', type: 'Stone Hard',   hardness: 950, probability: 200, worth: 25,   minlevel: 195000, color: '#184f48ff' },
  { id: 'Quartzite', name: 'Quartzite', type: 'Stone Hard', hardness: 1500, probability: 200, worth: 31,  minlevel: 135000, color: '#c35858ff' }, 
  { id: 'Polished Obsidian', name: 'Polished Obsidian', type:'Processed', hardness: 0, probability: 0, worth: 100, minlevel: 99999, color: '#2a6f68ff' },


  { id: 'Coal', name: 'Coal',type:'Special',                hardness: 80, probability: 80, worth: 10.5,   minlevel: 500, color: '#191919ff' },
  { id: 'Magma', name: 'Magma',type:'Special',              hardness: 800, probability: 50, worth: 0,    minlevel: 8000, color: '#fa6509ff' },

  { id: 'Bronce Ore', name: 'Bronce Ore', type:'Ore Soft',  hardness: 100, probability: 75, worth: 18,     minlevel: 2000, maxlevel: 999999, color: '#7e6136ff' },
  { id: 'Bronce', name: 'Bronce Ingot', type:'Ingot',         hardness:100, probability: 0, worth: 75,      minlevel: 99999, color: '#cd7f32ff' },
  { id: 'Copper Ore', name: 'Copper Ore',type:'Ore Soft',   hardness: 180, probability: 50, worth: 50,    minlevel: 6000, maxlevel: 99999, color: '#c75e41ff' },
  { id: 'Copper', name: 'Copper Ingot', type:'Ingot',         hardness:180, probability: 0, worth: 200,     minlevel: 99999, color: '#962c0cff' },
  { id: 'Silver Ore', name: 'Silver Ore', type:'Ore Soft',  hardness: 350, probability: 15, worth: 190,    minlevel: 6000, maxlevel: 99999, color: '#c5c5c5ff' },
  { id: 'Silver', name: 'Silver Ingot', type:'Ingot',         hardness: 35, probability: 0, worth: 750,     minlevel: 99999, color: '#c0c0c0ff' },

  { id: 'Gold Ore', name: 'Gold Ore', type:'Ore Medium',    hardness: 400, probability: 15, worth: 100000,  minlevel: 15000, color: '#d6a80eff' },
  { id: 'Gold', name: 'Gold Ingot', type:'Ingot',             hardness: 40, probability: 0, worth: 500000,  minlevel: 99999, color: '#ffd700ff' },
  { id: 'Iron Ore', name: 'Iron Ore', type:'Ore Medium',    hardness: 500, probability: 50, worth: 800,    minlevel: 77000, maxlevel: 99999, color: '#572012ff' },
  { id: 'Pig Iron', name: 'Pig Iron Ingot', type:'Ingot',     hardness: 10, probability: 0, worth: 3200,    minlevel: 99999, color: '#4a4a4aff' },
  { id: 'Zinc Ore', name: 'Zinc Ore',type:'Ore Medium',     hardness: 650, probability: 25, worth: 1150,   minlevel: 31000, maxlevel: 99999, color: '#8ec281ff' },
  
  { id: 'Platinum Ore', name: 'Platinum Ore', type:'Ore Hard',    hardness: 1000, probability: 15, worth: 2500, minlevel: 75000, color: '#c75e41ff' },
  { id: 'Titanium Ore', name: 'Titanium Ore', type:'Ore Hard',    hardness: 200, probability: 15, worth: 3000, minlevel: 100000, color: '#57375dff' },
  { id: 'Adamantine Ore', name: 'Adamantine Ore', type:'Ore Hard', hardness: 7000, probability: 15, worth: 7000, minlevel: 250000, color: '#8eb95eff' }


];


// Tools
const tools = [
    { name: 'Stone', power: 100},
]

// Tools inventory - array of individual tool instances
const toolsInventory = [
    { id: 1, type: 'Stone', power: 100 },
    { id: 2, type: 'Stone', power: 100 },
    { id: 3, type: 'Stone', power: 100 },
    { id: 4, type: 'Stone', power: 100 },
    { id: 5, type: 'Stone', power: 100 },
    { id: 6, type: 'Stone', power: 100 }
];

// Smelter tasks - ordered list of tasks the smelter will attempt to perform
let smelterTasks = [
    { id: 'do-nothing', name: 'Do Nothing', description: 'The smelter sits idle.', input: null, output: null, type: 'none' },
    { id: 'heat-furnace', name: 'Heat up furnace (Coal)', description: 'Consume 1 coal to heat the furnace by 100°.', input: { material: 'Coal', amount: 0.1 }, output: null, type: 'heating', heatGain: 100, requires: 'furnace' },
    { id: 'dry-mud', name: 'Dry Mud', description: 'Dry mud into clay.', input: { material: 'mud', amount: 2 }, output: { material: 'clay', amount: 1 } },
    { id: 'grind-sandstone', name: 'Grind Sandstone', description: 'Grind sandstone into sand.', input: { material: 'sandstone', amount: 1 }, output: { material: 'Sand', amount: 5 }, requires: 'grinding-machine' },
    { id: 'grind-limestone', name: 'Grind Limestone', description: 'Grind limestone into lime.', input: { material: 'limestone', amount: 1 }, output: { material: 'Lime', amount: 3 }, requires: 'grinding-machine' },
    { id: 'polish-marble', name: 'Polish Marble', description: 'Polish marble (50% break chance).', input: { material: 'Marble', amount: 1 }, output: { material: 'Polished Marble', amount: 1 }, breakChance: 0.5, requires: 'stone-polishing' },
    { id: 'polish-granite', name: 'Polish Granite', description: 'Polish granite (50% break chance).', input: { material: 'Granite', amount: 1 }, output: { material: 'Polished Granite', amount: 1 }, breakChance: 0.5, requires: 'stone-polishing' },
    { id: 'polish-obsidian', name: 'Polish Obsidian', description: 'Polish obsidian (50% break chance).', input: { material: 'Obsidian', amount: 1 }, output: { material: 'Polished Obsidian', amount: 1 }, breakChance: 0.5, requires: 'stone-polishing' },
    { id: 'smelt-bronce', name: 'Smelt Bronce', description: 'Smelt bronce ore (requires 950°).', input: { material: 'Bronce Ore', amount: 1 }, output: { material: 'Bronce', amount: 1 }, minTemp: 950, requires: 'furnace' },
    { id: 'smelt-copper', name: 'Smelt Copper', description: 'Smelt copper ore (requires 1085°).', input: { material: 'Copper Ore', amount: 1 }, output: { material: 'Copper', amount: 1 }, minTemp: 1085, requires: 'furnace' },
    { id: 'smelt-silver', name: 'Smelt Silver', description: 'Smelt silver ore (requires 962°).', input: { material: 'Silver Ore', amount: 1 }, output: { material: 'Silver', amount: 1 }, minTemp: 962, requires: 'furnace' },
    { id: 'smelt-gold', name: 'Smelt Gold', description: 'Smelt gold ore (requires 1064°).', input: { material: 'Gold Ore', amount: 1 }, output: { material: 'Gold', amount: 1 }, minTemp: 1064, requires: 'furnace' },
    { id: 'smelt-iron', name: 'Smelt Pig Iron', description: 'Smelt iron ore into pig iron (requires 1200°).', input: { material: 'Iron Ore', amount: 1 }, output: { material: 'Pig Iron', amount: 1 }, minTemp: 1200, requires: 'furnace' }
];

// Smelter temperature system
let smelterTemperature = 25; // Current temperature in degrees
let smelterMinTemp = 25; // Minimum temperature to maintain (user configurable)
let smelterMaxTemp = 1200; // Maximum temperature to maintain (user configurable)
let smelterHeatingMode = false; // Track if we're currently in heating mode (for hysteresis)

let researchtree = [
    { id: 'improved-digging', name: 'Improved Digging Technique', cost: 50, level: 0,
      description: 'Dwarfs dig 1% harder.' }, 
    { id: 'better-housing', name: 'Better Housing', cost: 100, level: 0,  
      description: 'The Home is more comfy, letting them rest faster. Diminishing returns per level.' },
    { id: 'trading', name: 'Better trading', cost: 100, level: 0,  
      description: 'Sell Prices for materials are improved by 3% per level' },
    { id: 'grinding-machine', name: 'Grinding Machine', cost: 200, level: 0, maxlevel: 1,
      description: 'Unlocks the grind task at the Smelter.' },
    { id: 'stone-polishing', name: 'Stone Polishing', cost: 500, level: 0, maxlevel: 5, requires: [{'grinding-machine':1}],
      description: 'Unlocks stone polishing at the Smelter. Each level reduces break chance by 8% (from 50% base).' },
    { id: 'furnace', name: 'Furnace', cost: 750, level: 0, maxlevel: 1, requires: [{'stone-polishing':1}],
      description: 'Unlocks the furnace for smelting of ores.' },
    { id: 'furnace-insulation', name: 'Furnace Insulation', cost: 1000, level: 0, maxlevel: 5, requires: [{'furnace':1}],
      description: 'Reduces furnace heat loss by 10% per level (from 0.05% base cooling rate).' },
    { id: 'forge', name: 'Forge', cost: 2000, level: 0, maxlevel: 1, requires: [{'furnace':1}],
      description: 'Unlocks the forge for crafting and upgrading tools.' },
    { id: 'forge-temperature', name: 'Forge Temperature', cost: 5000, level: 0, maxlevel: 15, requires: [{'forge':1}],
      description: 'Increases maximum forge temperature by 100° per level (from 1500° to 3000°).' },
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

// Transaction log - keeps detailed transactions from the current hour
let transactionLog = [];

// Transaction history - hourly cumulative summaries (never deleted, saved to file)
// Format: [{ hour: timestamp, transactions: { "description": { income: amount, expense: amount, count: number } } }]
let transactionHistory = [];

// Track the current hour for transaction rollups
let currentHourTimestamp = null;

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
// research: place third cell (2,0) in drop-grid coordinates
const research = { x: dropGridStartX + 2, y: 0 };
// smelter: place fourth cell (3,0) in drop-grid coordinates
const smelter = { x: dropGridStartX + 3, y: 0 };
// forge: place fifth cell (4,0) in drop-grid coordinates
const forge = { x: dropGridStartX + 4, y: 0 };