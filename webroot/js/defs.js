// ============================================================================
// DIGGY DIGGY DWARF - GAME DATA DEFINITIONS
// ============================================================================
// This file contains all game data (materials, tools, research, etc.)
// All game constants have been moved to constants.js
// ============================================================================

// Grid dimensions (used as initial values, can be modified at runtime)
const gridWidth = 10;
const gridDepth = 11; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// ============================================================================
// MATERIAL REGISTRY
// ============================================================================
const materials = {
  // ──────────────────────────────────────────────────────────────────────────
  // LOOSE MATERIALS
  // ──────────────────────────────────────────────────────────────────────────
  'earth': {
    name: 'Earth',
    type: 'Loose',
    hardness: 10,
    probability: 300,
    worth: 0.5,
    minlevel: 0,
    maxlevel: 999,
    color: '#6b4b2c',
    weight: 5
  },
  'sand': {
    name: 'Sand',
    type: 'Loose',
    hardness: 10,
    probability: 200,
    worth: 0.7,
    minlevel: 0,
    maxlevel: 100,
    color: '#e0aa46',
    weight: 5
  },
  'mud': {
    name: 'Mud',
    type: 'Loose',
    hardness: 15,
    probability: 100,
    worth: 0,
    minlevel: 0,
    maxlevel: 999,
    color: '#4a2f13ff',
    weight: 5
  },
  'clay': {
    name: 'Clay',
    type: 'Loose',
    hardness: 25,
    probability: 100,
    worth: 1.4,
    minlevel: 75,
    maxlevel: 1999,
    color: '#a57f61',
    weight: 5
  },
  'gravel': {
    name: 'Gravel',
    type: 'Loose',
    hardness: 30,
    probability: 200,
    worth: 0.9,
    minlevel: 150,
    maxlevel: 2999,
    color: '#534f4fff',
    weight: 5
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SOFT STONE
  // ──────────────────────────────────────────────────────────────────────────
  'chalk': {
    name: 'Chalk',
    type: 'Stone Soft',
    hardness: 30,
    probability: 100,
    worth: 16.0,
    minlevel: 600,
    maxlevel: 9999,
    color: '#a6b8adff',
    weight: 12
  },
  'calcite': {
    name: 'Calcite',
    type: 'Stone Soft',
    hardness: 50,
    probability: 150,
    worth: 11.2,
    minlevel: 800,
    maxlevel: 14999,
    color: '#bbb995ff',
    weight: 13
  },
  'aragonite': {
    name: 'Aragonite',
    type: 'Stone Soft',
    hardness: 60,
    probability: 120,
    worth: 2.4,
    minlevel: 1000,
    maxlevel: 12999,
    color: '#c75480ff',
    weight: 13
  },
  'gabbro': {
    name: 'Gabbro',
    type: 'Stone Soft',
    hardness: 70,
    probability: 180,
    worth: 8.6,
    minlevel: 500,
    maxlevel: 17999,
    color: '#d4a536ff',
    weight: 14
  },
  'pyroxene': {
    name: 'Pyroxene',
    type: 'Stone Soft',
    hardness: 75,
    probability: 100,
    worth: 5.7,
    minlevel: 1800,
    maxlevel: 12999,
    color: '#9acd32ff',
    weight: 14
  },
  'sandstone': {
    name: 'Sandstone',
    type: 'Stone Soft',
    hardness: 80,
    probability: 400,
    worth: 2.5,
    minlevel: 500,
    maxlevel: 9999,
    color: '#9d4d39ff',
    weight: 15
  },
  'limestone': {
    name: 'Limestone',
    type: 'Stone Soft',
    hardness: 80,
    probability: 200,
    worth: 2.5,
    minlevel: 1200,
    maxlevel: 39999,
    color: '#a8a19fff',
    weight: 15
  },
  'lime': {
    name: 'Lime',
    type: 'Processed',
    hardness: 0,
    probability: 0,
    worth: 8.0,
    minlevel: 2400,
    color: '#e8f4f0ff',
    weight: 3
  },
  'peridotite': {
    name: 'Peridotite',
    type: 'Stone Soft',
    hardness: 90,
    probability: 140,
    worth: 7.8,
    minlevel: 2500,
    maxlevel: 13999,
    color: '#7cbc6bff',
    weight: 14
  },
  'claystone': {
    name: 'Clay Stone',
    type: 'Stone Soft',
    hardness: 100,
    probability: 300,
    worth: 2.0,
    minlevel: 3000,
    maxlevel: 15999,
    color: '#53412fff',
    weight: 15
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MEDIUM STONE
  // ──────────────────────────────────────────────────────────────────────────
  'andesite': {
    name: 'Andesite',
    type: 'Stone Medium',
    hardness: 200,
    probability: 150,
    worth: 8,
    minlevel: 3500,
    maxlevel: 25999,
    color: '#564848ff',
    weight: 24
  },
  'marble': {
    name: 'Marble',
    type: 'Stone Medium',
    hardness: 250,
    probability: 200,
    worth: 29,
    minlevel: 4000,
    maxlevel: 29999,
    color: '#7a706eff',
    weight: 25
  },
  'polished marble': {
    name: 'Polished Marble',
    type: 'Processed',
    hardness: 250,
    probability: 0,
    worth: 140,
    minlevel: 99999,
    color: '#c8c0beff',
    weight: 20
  },
  'rhyolite': {
    name: 'Rhyolite',
    type: 'Stone Medium',
    hardness: 350,
    probability: 220,
    worth: 9,
    minlevel: 4500,
    maxlevel: 35999,
    color: '#8b7355ff',
    weight: 24
  },
  'schist': {
    name: 'Schist',
    type: 'Stone Medium',
    hardness: 400,
    probability: 200,
    worth: 15,
    minlevel: 5000,
    maxlevel: 199999,
    color: '#1d354dff',
    weight: 25
  },
  'slate': {
    name: 'Slate',
    type: 'Stone Medium',
    hardness: 800,
    probability: 200,
    worth: 19,
    minlevel: 5000,
    color: '#483b37ff',
    weight: 25
  },
  'dolomite': {
    name: 'Dolomite',
    type: 'Stone Medium',
    hardness: 900,
    probability: 200,
    worth: 12,
    minlevel: 5000,
    color: '#956f88ff',
    weight: 25
  },

  // ──────────────────────────────────────────────────────────────────────────
  // HARD STONE
  // ──────────────────────────────────────────────────────────────────────────
  'gneiss': {
    name: 'Gneiss',
    type: 'Stone Hard',
    hardness: 1050,
    probability: 100,
    worth: 22,
    minlevel: 15000,
    color: '#c9a875ff',
    weight: 34
  },
  'granite': {
    name: 'Granite',
    type: 'Stone Hard',
    hardness: 1100,
    probability: 400,
    worth: 31,
    minlevel: 18000,
    color: '#280918ff',
    weight: 35
  },
  'polished granite': {
    name: 'Polished Granite',
    type: 'Processed',
    hardness: 250,
    probability: 0,
    worth: 250,
    minlevel: 99999,
    color: '#4a1828ff',
    weight: 30
  },
  'andalusite': {
    name: 'Andalusite',
    type: 'Stone Hard',
    hardness: 1200,
    probability: 180,
    worth: 13,
    minlevel: 25000,
    color: '#d47846ff',
    weight: 34
  },
  'komatiite': {
    name: 'Komatiite',
    type: 'Stone Hard',
    hardness: 1400,
    probability: 160,
    worth: 15,
    minlevel: 45000,
    color: '#825135ff',
    weight: 34
  },
  'hornfels': {
    name: 'Hornfels',
    type: 'Stone Hard',
    hardness: 1600,
    probability: 220,
    worth: 16,
    minlevel: 65000,
    color: '#6b6b6bff',
    weight: 35
  },
  'basalt': {
    name: 'Basalt',
    type: 'Stone Hard',
    hardness: 1750,
    probability: 400,
    worth: 17,
    minlevel: 95000,
    color: '#484848ff',
    weight: 35
  },
  'sillimanite': {
    name: 'Sillimanite',
    type: 'Stone Hard',
    hardness: 1850,
    probability: 140,
    worth: 20,
    minlevel: 125000,
    color: '#8b7d5bff',
    weight: 34
  },
  'obsidian': {
    name: 'Obsidian',
    type: 'Stone Hard',
    hardness: 1950,
    probability: 200,
    worth: 45,
    minlevel: 195000,
    color: '#184f48ff',
    weight: 35
  },
    'polished obsidian': {
    name: 'Polished Obsidian',
    type: 'Processed',
    hardness: 250,
    probability: 0,
    worth: 290,
    minlevel: 99999,
    color: '#2a6f68ff',
    weight: 30
  },
  'quartzite': {
    name: 'Quartzite',
    type: 'Stone Hard',
    hardness: 2500,
    probability: 200,
    worth: 31,
    minlevel: 135000,
    color: '#c35858ff',
    weight: 35
  },
  // ──────────────────────────────────────────────────────────────────────────
  // SPECIAL MATERIALS
  // ──────────────────────────────────────────────────────────────────────────
  'coal': {
    name: 'Coal',
    type: 'Special',
    hardness: 80,
    probability: 80,
    worth: 10.5,
    minlevel: 500,
    color: '#191919ff',
    weight: 8
  },
  'magma': {
    name: 'Magma',
    type: 'Special',
    hardness: 100,
    probability: 50,
    worth: 0,
    minlevel: 8000,
    color: '#fa6509ff',
    weight: 10
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GEMS
  // ──────────────────────────────────────────────────────────────────────────
  'ruby': {
    name: 'Ruby',
    type: 'Gem',
    hardness: 300,
    probability: 0,
    worth: 50,
    minlevel: 5000,
    color: '#9b111eff',
    weight: 1
  },
  'emerald': {
    name: 'Emerald',
    type: 'Gem',
    hardness: 400,
    probability: 0,
    worth: 50,
    minlevel: 5000,
    color: '#50c878ff',
    weight: 1
  },
  'sapphire': {
    name: 'Sapphire',
    type: 'Gem',
    hardness: 500,
    probability: 0,
    worth: 50,
    minlevel: 5000,
    color: '#0f52baff',
    weight: 1
  },
  'diamond': {
    name: 'Diamond',
    type: 'Gem',
    hardness: 600,
    probability: 0,
    worth: 75,
    minlevel: 5000,
    color: '#b9f2ffff',
    weight: 1
  },
  'amethyst': {
    name: 'Amethyst',
    type: 'Gem',
    hardness: 900,
    probability: 0,
    worth: 90,
    minlevel: 5000,
    color: '#9966ccff',
    weight: 1
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SOFT ORES & INGOTS
  // ──────────────────────────────────────────────────────────────────────────
  'bronce ore': {
    name: 'Bronce Ore',
    type: 'Ore Soft',
    hardness: 100,
    probability: 75,
    worth: 38,
    minlevel: 2000,
    color: '#7e6136ff',
    weight: 30
  },
  'bronce': {
    name: 'Bronce Ingot',
    type: 'Ingot',
    hardness: 100,
    probability: 0,
    worth: 175,
    minlevel: 99999,
    color: '#cd7f32ff',
    forge: 'Base',
    weight: 18
  },
  'copper ore': {
    name: 'Copper Ore',
    type: 'Ore Soft',
    hardness: 180,
    probability: 50,
    worth: 60,
    minlevel: 6000,
    color: '#c75e41ff',
    weight: 30
  },
  'copper': {
    name: 'Copper Ingot',
    type: 'Ingot',
    hardness: 175,
    probability: 0,
    worth: 300,
    minlevel: 99999,
    color: '#962c0cff',
    forge: 'Base',
    weight: 18
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MEDIUM ORES & INGOTS
  // ──────────────────────────────────────────────────────────────────────────
  'zinc ore': {
    name: 'Zinc Ore',
    type: 'Ore Medium',
    hardness: 650,
    probability: 25,
    worth: 200,
    minlevel: 15000,
    color: '#8ec281ff',
    weight: 40
  },
  'zinc': {
    name: 'Zinc Ingot',
    type: 'Ingot',
    hardness: 300,
    probability: 0,
    worth: 450,
    minlevel: 99999,
    color: '#3e6b4eff',
    forge: 'Plating',
    weight: 15
  },
  'brass': {
    name: 'Brass Ingot',
    type: 'Ingot',
    hardness: 250,
    probability: 0,
    worth: 950,
    minlevel: 99999,
    color: '#fbd86eff',
    forge: 'Base',
    weight: 18
  },
  'silver ore': {
    name: 'Silver Ore',
    type: 'Ore Medium',
    hardness: 350,
    probability: 0,
    worth: 1200,
    minlevel: 10999,
    color: '#c0c0c0ff',
    weight: 42
  },
  'silver': {
    name: 'Silver Ingot',
    type: 'Ingot',
    hardness: 35,
    probability: 0,
    worth: 2600,
    minlevel: 99999,
    color: '#c0c0c0ff',
    forge: 'Plating',
    weight: 20
  },
  'gold ore': {
    name: 'Gold Ore',
    type: 'Ore Medium',
    hardness: 400,
    probability: 15,
    worth: 3000,
    minlevel: 15000,
    color: '#d6a80eff',
    weight: 45
  },
  'gold': {
    name: 'Gold Ingot',
    type: 'Ingot',
    hardness: 40,
    probability: 0,
    worth: 5500,
    minlevel: 99999,
    color: '#ffd700ff',
    forge: 'Plating',
    weight: 22
  },
  'iron ore': {
    name: 'Iron Ore',
    type: 'Ore Medium',
    hardness: 500,
    probability: 50,
    worth: 400,
    minlevel: 30000,
    color: '#572012ff',
    weight: 48
  },
  'pig iron': {
    name: 'Pig Iron Ingot',
    type: 'Ore Medium',
    hardness: 10,
    probability: 0,
    worth: 500,
    minlevel: 99999,
    color: '#4a4a4aff',
    weight: 40
  },
  'iron': {
    name: 'Iron Ingot',
    type: 'Ingot',
    hardness: 325,
    probability: 0,
    worth: 600,
    minlevel: 99999,
    color: '#4a4a4aff',
    forge: 'Base',
    weight: 25
  },
  'steel': {
    name: 'Steel',
    type: 'Ingot',
    hardness: 400,
    probability: 0,
    worth: 700,
    minlevel: 99999,
    color: '#3f3939ff',
    forge: 'Base',
    weight: 25
  },
  'hardened steel': {
    name: 'Hardened Steel',
    type: 'Ingot',
    hardness: 450,
    probability: 0,
    worth: 720,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 25
  },
  'dwarf steel': {
    name: 'Dwarf Steel',
    type: 'Ingot',
    hardness: 500,
    probability: 0,
    worth: 800,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 25
  },

  // ──────────────────────────────────────────────────────────────────────────
  // HARD ORES
  // ──────────────────────────────────────────────────────────────────────────
  'platinum ore': {
    name: 'Platinum Ore',
    type: 'Ore Hard',
    hardness: 4000,
    probability: 15,
    worth: 2500,
    minlevel: 75000,
    color: '#c75e41ff',
    weight: 50
  },
    'platinum': {
    name: 'Platinum Ingot',
    type: 'Ingot',
    hardness: 700,
    probability: 0,
    worth: 2800,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 25
  },
  'titanium ore': {
    name: 'Titanium Ore',
    type: 'Ore Hard',
    hardness: 6000,
    probability: 15,
    worth: 3000,
    minlevel: 100000,
    color: '#57375dff',
    weight: 50
  },
    'titanium': {
    name: 'Titanium Ingot',
    type: 'Ingot',
    hardness: 900,
    probability: 0,
    worth: 2800,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 50
  },
  'adamantine ore': {
    name: 'Adamantine Ore',
    type: 'Ore Hard',
    hardness: 10000,
    probability: 15,
    worth: 7000,
    minlevel: 250000,
    color: '#8eb95eff',
    weight: 50
  },
    'adamantine': {
    name: 'Adamantine Ingot',
    type: 'Ingot',
    hardness: 1200,
    probability: 0,
    worth: 7500,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 50
  },
};


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

// Plating effects - define what each plating material does when applied to tools
const platingEffects = {
    'zinc': {
        name: 'Zinc Plating',
        description: 'Digging consumes 2 less energy',
        effect: 'energyReduction',
        value: 2
    },
    'silver': {
        name: 'Silver Plating',
        description: '+40% gem probability',
        effect: 'gemProbability',
        value: 1.40
    },
    'gold': {
        name: 'Gold Plating',
        description: '+10% higher critical strike chance',
        effect: 'criticalStrike',
        value: 1.10
    }
};

// ============================================================================
// SMELTER TASKS REGISTRY
// ============================================================================
// Smelter tasks - object where id is the key, with ordered array tracking task priority
const smelterTasksData = {
  // ──────────────────────────────────────────────────────────────────────────
  // CONTROL TASKS
  // ──────────────────────────────────────────────────────────────────────────
  'do-nothing': {
    name: 'Do Nothing',
    description: 'The smelter sits idle.',
    input: null,
    output: null,
    type: 'none'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // HEATING TASKS
  // ──────────────────────────────────────────────────────────────────────────
  'heat-furnace': {
    name: 'Heat up furnace (Coal)',
    description: 'Consume 1 coal to heat the furnace by 100° to a max of 2000° (with full research).',
    input: { material: 'coal', amount: 0.1 },
    output: null,
    type: 'heating',
    heatGain: 100,
    ticksRequired: SMELTER_HEATING_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 1
  },
  'heat-magma-furnace': {
    name: 'Heat up furnace (Magma)',
    description: 'Consume 1 magma to heat the furnace. The furnace will heat to max. temperature.',
    input: { material: 'magma', amount: 1 },
    output: null,
    type: 'heating',
    heatGain: 'dynamic',
    ticksRequired: SMELTER_HEATING_TICKS_REQUIRED,
    requires: 'magma-furnace',
    hardness: 1
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GEM CUTTING
  // ──────────────────────────────────────────────────────────────────────────
  'cut-polish-gem': {
    name: 'Cut and Polish Gem',
    description: 'Cut and polish a gem to make them usable in tools, increases value by 50%).',
    input: null,
    output: null,
    type: 'gem-cutting',
    ticksRequired: GEM_CUTTING_TICKS_REQUIRED,
    requires: 'gem-cutting',
    hardness: 1
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BASIC PROCESSING
  // ──────────────────────────────────────────────────────────────────────────
  'dry-mud': {
    name: 'Dry Mud',
    description: 'Dry mud into clay.',
    input: { material: 'mud', amount: 2 },
    output: { material: 'clay', amount: 1 },
    ticksRequired: SMELTER_BASIC_PROCESSING_TICKS_REQUIRED,
    hardness: 1
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GRINDING TASKS
  // ──────────────────────────────────────────────────────────────────────────
  'grind-sandstone': {
    name: 'Grind Sandstone',
    description: 'Grind sandstone into sand.',
    input: { material: 'sandstone', amount: 1 },
    output: { material: 'sand', amount: 5 },
    ticksRequired: SMELTER_GRINDING_TICKS_REQUIRED,
    requires: 'grinding-machine',
    hardness: 5
  },
  'grind-limestone': {
    name: 'Grind Limestone',
    description: 'Grind limestone into lime.',
    input: { material: 'limestone', amount: 1 },
    output: { material: 'lime', amount: 3 },
    ticksRequired: SMELTER_GRINDING_TICKS_REQUIRED,
    requires: 'grinding-machine',
    hardness: 5
  },

  // ──────────────────────────────────────────────────────────────────────────
  // STONE POLISHING
  // ──────────────────────────────────────────────────────────────────────────
  'polish-marble': {
    name: 'Polish Marble',
    description: 'Polish marble (50% break chance).',
    input: { material: 'marble', amount: 1 },
    output: { material: 'polished marble', amount: 1 },
    breakChance: 0.5,
    ticksRequired: SMELTER_POLISHING_TICKS_REQUIRED,
    requires: 'stone-polishing',
    hardness: 10
  },
  'polish-granite': {
    name: 'Polish Granite',
    description: 'Polish granite (50% break chance).',
    input: { material: 'granite', amount: 1 },
    output: { material: 'polished granite', amount: 1 },
    breakChance: 0.5,
    ticksRequired: SMELTER_POLISHING_TICKS_REQUIRED,
    requires: 'stone-polishing',
    hardness: 12
  },
  'polish-obsidian': {
    name: 'Polish Obsidian',
    description: 'Polish obsidian (50% break chance).',
    input: { material: 'obsidian', amount: 1 },
    output: { material: 'polished obsidian', amount: 1 },
    breakChance: 0.5,
    ticksRequired: SMELTER_POLISHING_TICKS_REQUIRED,
    requires: 'stone-polishing',
    hardness: 15
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SOFT METAL SMELTING
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-bronce': {
    name: 'Smelt Bronce',
    description: 'Smelt bronce ore.',
    input: { material: 'bronce ore', amount: 1 },
    output: { material: 'bronce', amount: 1 },
    minTemp: 950,
    ticksRequired: SMELTER_SOFT_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 18
  },
  'smelt-copper': {
    name: 'Smelt Copper',
    description: 'Smelt copper ore.',
    input: { material: 'copper ore', amount: 1 },
    output: { material: 'copper', amount: 1 },
    minTemp: 1085,
    ticksRequired: SMELTER_SOFT_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 20
  },
  'smelt-zinc': {
    name: 'Smelt Zinc',
    description: 'Smelt zinc ore.',
    input: { material: 'zinc ore', amount: 1 },
    output: { material: 'zinc', amount: 1 },
    minTemp: 420,
    ticksRequired: SMELTER_SOFT_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 15
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ALLOY CREATION
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-brass': {
    name: 'Smelt Brass',
    description: 'Create brass alloy.',
    inputs: [
      { material: 'bronce', amount: 2 },
      { material: 'copper', amount: 1 }
    ],
    output: { material: 'brass', amount: 1 },
    minTemp: 950,
    ticksRequired: SMELTER_ALLOY_TICKS_REQUIRED,
    requires: 'alloys',
    hardness: 25
  },

  // ──────────────────────────────────────────────────────────────────────────
  // IRON & STEEL SMELTING
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-pig-iron': {
    name: 'Smelt Pig Iron',
    description: 'Smelt iron ore into pig iron.',
    input: { material: 'iron ore', amount: 1 },
    output: { material: 'pig iron', amount: 1 },
    minTemp: 1100,
    ticksRequired: SMELTER_IRON_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 30
  },
  'smelt-iron': {
    name: 'Smelt Iron',
    description: 'Smelt pig iron into iron.',
    input: { material: 'pig iron', amount: 1 },
    output: { material: 'iron', amount: 1 },
    minTemp: 1200,
    ticksRequired: SMELTER_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 35
  },
  'smelt-steel': {
    name: 'Smelt Steel',
    description: 'Smelt Steel.',
    input: { material: 'iron', amount: 5 },
    output: { material: 'steel', amount: 1 },
    minTemp: 1350,
    ticksRequired: SMELTER_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 45
  },
  'smelt-steel-hardened': {
    name: 'Smelt Hardened Steel',
    description: 'Smelt hardened steel.',
    input: { material: 'steel', amount: 5 },
    output: { material: 'hardened steel', amount: 1 },
    minTemp: 1950,
    ticksRequired: SMELTER_HARDENED_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 60
  },
  'smelt-steel-dwarf': {
    name: 'Smelt Dwarfen Steel',
    description: 'Smelt dwarfen steel.',
    input: { material: 'hardened steel', amount: 5 },
    output: { material: 'dwarf steel', amount: 1 },
    minTemp: 2400,
    ticksRequired: SMELTER_DWARF_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 80
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PRECIOUS METAL SMELTING
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-silver': {
    name: 'Smelt Silver',
    description: 'Smelt silver ore.',
    input: { material: 'silver ore', amount: 1 },
    output: { material: 'silver', amount: 1 },
    minTemp: 962,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 40
  },
  'smelt-gold': {
    name: 'Smelt Gold',
    description: 'Smelt gold ore.',
    input: { material: 'gold ore', amount: 1 },
    output: { material: 'gold', amount: 1 },
    minTemp: 1064,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 50
  },

  // ──────────────────────────────────────────────────────────────────────────
  // HARD METAL SMELTING
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-platinum': {
    name: 'Smelt Platinum',
    description: 'Smelt platinum ore.',
    input: { material: 'platinum ore', amount: 1 },
    output: { material: 'platinum', amount: 1 },
    minTemp: 1768,
    ticksRequired: SMELTER_DWARF_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 70
  },
  'smelt-titanium': {
    name: 'Smelt Titanium',
    description: 'Smelt titanium ore.',
    input: { material: 'titanium ore', amount: 1 },
    output: { material: 'titanium', amount: 1 },
    minTemp: 1668,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 75
  },
  'smelt-adamantine': {
    name: 'Smelt Adamantine',
    description: 'Smelt adamantine ore.',
    input: { material: 'adamantine ore', amount: 1 },
    output: { material: 'adamantine', amount: 1 },
    minTemp: 2850,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 100
  }
};

// Ordered array of smelter task IDs (determines task priority)
let smelterTasks = [
    'do-nothing',
    'heat-furnace',
    'heat-magma-furnace',
    'cut-polish-gem',
    'dry-mud',
    'grind-sandstone',
    'grind-limestone',
    'polish-marble',
    'polish-granite',
    'polish-obsidian',
    'smelt-bronce',
    'smelt-copper',
    'smelt-zinc',
    'smelt-brass',
    'smelt-pig-iron',
    'smelt-iron',
    'smelt-steel',
    'smelt-steel-hardened',
    'smelt-steel-dwarf',
    'smelt-silver',
    'smelt-gold',
    'smelt-platinum',
    'smelt-titanium',
    'smelt-adamantine'
];

// Smelter temperature system
let smelterTemperature = 25; // Current temperature in degrees
let smelterCoalMinTemp = 25; // Minimum temperature for coal heating (user configurable)
let smelterCoalMaxTemp = 1200; // Maximum temperature for coal heating (user configurable)
let smelterMagmaMinTemp = 25; // Minimum temperature for magma heating (user configurable)
let smelterHeatingMode = false; // Track if we're currently in heating mode (for hysteresis)

let researchtree = [
    { id: 'improved-digging', name: 'Improved Digging Technique', cost: 50, goldCost: 10, level: 0, hardness: 10,
      description: 'Dwarfs dig 1% harder.' },
    { id: 'better-housing', name: 'Better Housing', cost: 100, goldCost: 10, level: 0, hardness: 20,
      description: 'The Home is more comfy, letting them rest faster. Diminishing returns per level.' },
    { id: 'trading', name: 'Better trading', cost: 100, goldCost: 10, level: 0, hardness: 30,
      description: 'Prices are improved by 3% per level' },
    { id: 'price-negotiations', name: 'Price Negotiations', cost: 3000, goldCost: 500, level: 0, maxlevel: 1, hardness: 50, requires: [{'trading':10}],
      min_depth: 5000, description: 'The wisest dwarf negotiates better. His wisdom gives +1% sell price per skill point.' },
    { id: 'small-time-investments', name: 'Small Time Investments', cost: 5000, goldCost: 1000, level: 0, maxlevel: 1, hardness: 100, requires: [{'price-negotiations':1}],
      min_depth: 8000, description: 'Invest your gold wisely. Gain small interest up to 100.000 gold.' },
    { id: 'buckets', name: 'Bigger Buckets', cost: 300, goldCost: 200, level: 0, maxlevel:10, hardness: 50,
      description: 'Increases bucket weight capacity by 5% per level. Base: 50kg + (5kg × strength).' },
    { id: 'union-busting', name: 'Union Busting', cost: 500, goldCost: 500, level: 0, maxlevel: 15, hardness: 60,
      description: 'Reduces dwarf strike likelihood by 5% per level when you run out of money.' },
    { id: 'tool-enchanting', name: 'Tool Enchanting', cost: 600, goldCost: 300, level: 0, maxlevel: 30, hardness: 150,
      min_depth: 250, description: 'Hire a wizard to enchant your tools, better enchantments with higher levels.' },
    { id: 'grinding-machine', name: 'Grinding Machine', cost: 200, goldCost: 200, level: 0, maxlevel: 1, hardness: 70,
      min_depth: 500, description: 'Unlocks the grind task at the Smelter.' },
    { id: 'stone-polishing', name: 'Stone Polishing', cost: 500, goldCost: 500, level: 0, maxlevel: 5, hardness: 200, requires: [{'grinding-machine':1}],
      min_depth: 4000, description: 'Unlocks stone polishing at the Smelter. Each level reduces break chance by 8% (from 50% base).' },
    { id: 'gem-cutting', name: 'Gem Cutting', cost: 1500, goldCost: 5000, level: 0, maxlevel: 1, hardness: 300, requires: [{'grinding-machine':1}],
      min_depth: 1000, description: 'Unlocks gem cutting at the smelter. The cutting takes 250 Ticks.' },
    { id: 'gem-setting', name: 'Gem Setting', cost: 1500, goldCost: 5000, level: 0, maxlevel: 3, hardness: 320, requires: [{'gem-cutting':1}],
      min_depth: 1000, description: 'Set up to 3 Gems into the dwarfs tools.' },
      { id: 'furnace', name: 'Furnace', cost: 750, goldCost: 750, level: 0, maxlevel: 1, hardness: 250, requires: [{'grinding-machine':1}],
      min_depth: 2000, description: 'Unlocks the furnace for smelting of ores.' },
    { id: 'furnace-insulation', name: 'Furnace Insulation', cost: 10000, goldCost: 10000, level: 0, maxlevel: 5, hardness: 500, requires: [{'furnace':1}],
      min_depth: 2000, description: 'Reduces furnace heat loss by 10% per level (from 0.05% base cooling rate).' },
    { id: 'forge', name: 'Forge', cost: 2000, goldCost: 2000, level: 0, maxlevel: 1, hardness: 350, requires: [{'furnace':1}],
      min_depth: 2000, description: 'Unlocks the forge for crafting and upgrading tools.' },
    { id: 'alloys', name: 'Alloys', cost: 4000, goldCost: 8000, level: 0, maxlevel: 1, hardness: 700, requires: [{'furnace':1}],
      min_depth: 15000, description: 'Unlocks the ability to create alloys in the smelter.' },
    { id: 'material-science', name: 'Material Science', cost: 500, goldCost: 500, level: 0, maxlevel: 5, hardness: 100,
      min_depth: 1000, description: 'Increases critical hit chance to any stone by 5% per level.' },
    { id: 'wage-optimization', name: 'Wage Negotiation', cost: 1000, goldCost: 1000, level: 0, maxlevel: 20, hardness: 400,
      min_depth: 3000, unlock_requires: 'wage_increase', description: 'Reduces wage increase per dwarf level by 1%.' },
    { id: 'expertise-stone', name: 'Stone Expertise', cost: 3000, goldCost: 3000, level: 0, maxlevel: 15, hardness: 450, requires: [{'material-science':3}],
      min_depth: 1000, description: 'When a dwarf does a critical strike he has a 2% chance to one-hit any stone.' },
    { id: 'expertise-ore', name: 'Ore Expertise', cost: 20000, goldCost: 20000, level: 0, maxlevel: 15, hardness: 800, requires: [{'material-science':5}, {'expertise-stone':1}],
      min_depth: 2000, description: 'When a dwarf does a critical strike he has a 3% chance to one-hit any ore.' },
    { id: 'furnace-temperature', name: 'Furnace Temperature', cost: 5000, goldCost: 5000, level: 0, maxlevel: 15, hardness: 550, requires: [{'forge':1}],
      min_depth: 6000, description: 'Increases maximum furnace temperature by 100° per level (from 1500° to 3000°).' },
    { id: 'magma-furnace', name: 'Magma Operated Furnace', cost: 25000, goldCost: 50000, level: 0, maxlevel: 1, hardness: 1000, requires: [{'furnace-insulation':5},  {'furnace-temperature':10}],
      min_depth: 8000, description: 'Unlocks the ability to use Magma to heat the furnace. Magma heats based on your Furnace Temperature research level.' },
    ];
let activeResearch = null; // Track which research is currently being researched
let researchQueue = []; // Queue for up to 5 researches
    
let grid = [];
let startX = 0;
let gold = 50;

let dwarfs = [
    { name: "Diggingston",
      toolId: 1,
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriority: ['digging', 'research', 'smelting'],
      taskBlacklist: [] },
    { name: "Shovelli",
      toolId: 2,
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 0, y: 0,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriority: ['digging', 'research', 'smelting'],
      taskBlacklist: [] },
    { name: "Diggmaster",
      toolId: 3,
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100,
    taskPriority: ['digging', 'research', 'smelting'],
    taskBlacklist: [] },
    { name: "Burrower",
     toolId: 4,
     level: 0, xp: 0,
     digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100,
    taskPriority: ['digging', 'research', 'smelting'],
    taskBlacklist: [] },
    { name: "NevertiredMcPickaxemer",
     toolId: 5,
     level: 0, xp: 0,
     digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100,
    taskPriority: ['digging', 'research', 'smelting'],
    taskBlacklist: [] },
    { name: "SmartDigger",
     toolId: 6,
     level: 0, xp: 0,
     digPower: 0, maxEnergy: 100, strength: 0, wisdom: 3,
     x: 0, y: 0,
     status: 'idle', moveTarget: null,
    bucket: {}, energy: 100,
    taskPriority: ['research', 'smelting', 'digging',],
    taskBlacklist: [] },
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
for (const id in materials) materialsStock[id] = 0;

// Gems array - separate from materials, each gem is a unique object with ID
let gems = [];
let nextGemId = 1;

// How many items a dwarf can hold before needing to return to drop-off
const bucketCapacity = 4;

// Drop-off location (where dwarfs should deliver their bucket contents).
// Place the small 2x2 drop-area to the right of the digging grid.
const dropGridStartX = gridWidth; // 2x2 grid placed immediately to the right
const dropGridWidth = 2, dropGridHeight = 2;
// drop-off inside the 2x2 grid: first cell (0,0) in drop-grid coordinates
const dropOff = { x: dropGridStartX + 0, y: 0 };
// bed / house: place second cell (1,0) in drop-grid coordinates
const house = { x: dropGridStartX + 1, y: 0 };
// research: place third cell (0,1) in drop-grid coordinates
const research = { x: dropGridStartX + 0, y: 1 };
// smelter: place fourth cell (1,1) in drop-grid coordinates
const smelter = { x: dropGridStartX + 1, y: 1 };