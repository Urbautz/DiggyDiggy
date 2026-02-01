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
  // This list has been automatically reordered by minlevel.
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
    maxlevel: 300,
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
    maxlevel: 1999,
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
    maxlevel: 2999,
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
    maxlevel: 3999,
    color: '#534f4fff',
    weight: 5
  },
  'gabbro': {
    name: 'Gabbro',
    type: 'Stone Soft',
    hardness: 40,
    probability: 180,
    worth: 8.6,
    minlevel: 500,
    maxlevel: 17999,
    color: '#d4a536ff',
    weight: 14
  },
  'sandstone': {
    name: 'Sandstone',
    type: 'Stone Soft',
    hardness: 50,
    probability: 400,
    worth: 2.5,
    minlevel: 500,
    maxlevel: 9999,
    color: '#9d4d39ff',
    weight: 15
  },
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
  'chalk': {
    name: 'Chalk',
    type: 'Stone Soft',
    hardness: 40,
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
    hardness: 55,
    probability: 120,
    worth: 3.4,
    minlevel: 1000,
    maxlevel: 12999,
    color: '#c75480ff',
    weight: 13
  },
    'bronce ore': {
    name: 'Bronce Ore',
    type: 'Ore Soft',
    hardness: 100,
    probability: 112.5,
    worth: 38,
    minlevel: 1000,
    color: '#7e6136ff',
    weight: 30
  },
  'limestone': {
    name: 'Limestone',
    type: 'Stone Soft',
    hardness: 60,
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
    worth: 1.04,
    minlevel: 1200,
    color: '#e8f4f0ff',
    weight: 3
  },
  'pyroxene': {
    name: 'Pyroxene',
    type: 'Stone Soft',
    hardness: 65,
    probability: 100,
    worth: 5.7,
    minlevel: 1800,
    maxlevel: 12999,
    color: '#9acd32ff',
    weight: 14
  },
  'loose stone': {
    name: 'Loose Stone',
    type: 'Loose',
    hardness: 35,
    probability: 100,
    worth: 0.9,
    minlevel: 1850,
    color: '#d7c8baff',
    weight: 6
  },

  'peridotite': {
    name: 'Peridotite',
    type: 'Stone Soft',
    hardness: 75,
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
    hardness: 80,
    probability: 300,
    worth: 2.0,
    minlevel: 3000,
    maxlevel: 15999,
    color: '#53412fff',
    weight: 15
  },
  'andesite': {
    name: 'Andesite',
    type: 'Stone Medium',
    hardness: 100,
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
    hardness: 150,
    probability: 200,
    worth: 29,
    minlevel: 4000,
    maxlevel: 29999,
    color: '#7a706eff',
    weight: 25
  },
  'rhyolite': {
    name: 'Rhyolite',
    type: 'Stone Medium',
    hardness: 150,
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
    hardness: 175,
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
    hardness: 225,
    probability: 200,
    worth: 19,
    minlevel: 5000,
    color: '#483b37ff',
    weight: 25
  },
  'dolomite': {
    name: 'Dolomite',
    type: 'Stone Medium',
    hardness: 425,
    probability: 200,
    worth: 12,
    minlevel: 5000,
    color: '#956f88ff',
    weight: 25
  },
  'copper ore': {
    name: 'Copper Ore',
    type: 'Ore Soft',
    hardness: 1800,
    probability: 75,
    worth: 60,
    minlevel: 6000,
    color: '#c75e41ff',
    weight: 30
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
  'silver ore': {
    name: 'Silver Ore',
    type: 'Ore Medium',
    hardness: 2100,
    probability: 30,
    worth: 1200,
    minlevel: 10999,
    color: '#c0c0c0ff',
    weight: 42
  },
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
  'zinc ore': {
    name: 'Zinc Ore',
    type: 'Ore Medium',
    hardness: 650,
    probability: 37.5,
    worth: 200,
    minlevel: 15000,
    color: '#8ec281ff',
    weight: 40
  },
  'gold ore': {
    name: 'Gold Ore',
    type: 'Ore Medium',
    hardness: 400,
    probability: 22.5,
    worth: 3000,
    minlevel: 15000,
    color: '#d6a80eff',
    weight: 45
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
  'iron ore': {
    name: 'Iron Ore',
    type: 'Ore Medium',
    hardness: 500,
    probability: 75,
    worth: 400,
    minlevel: 22000,
    color: '#572012ff',
    weight: 48
  },
  'nickel ore': {
    name: 'Nickel Ore',
    type: 'Ore Medium',
    hardness: 450,
    probability: 45,
    worth: 350,
    minlevel: 40000,
    color: '#b2b25cff',
    weight: 46
  },
  'komatiite': {
    name: 'Komatiite',
    type: 'Stone Hard',
    hardness: 2400,
    probability: 160,
    worth: 15,
    minlevel: 45000,
    color: '#825135ff',
    weight: 34
  },
  'platinum ore': {
    name: 'Platinum Ore',
    type: 'Ore Hard',
    hardness: 4000,
    probability: 22.5,
    worth: 2500,
    minlevel: 55000,
    color: '#c75e41ff',
    weight: 50
  },
  'hornfels': {
    name: 'Hornfels',
    type: 'Stone Hard',
    hardness: 3600,
    probability: 220,
    worth: 16,
    minlevel: 65000,
    color: '#6b6b6bff',
    weight: 35
  },
  'titanium ore': {
    name: 'Titanium Ore',
    type: 'Ore Hard',
    hardness: 6000,
    probability: 22.5,
    worth: 3000,
    minlevel: 90000,
    color: '#57375dff',
    weight: 50
  },
  'basalt': {
    name: 'Basalt',
    type: 'Stone Hard',
    hardness: 4750,
    probability: 400,
    worth: 17,
    minlevel: 95000,
    color: '#484848ff',
    weight: 35
  },
  'wolfram ore': {
    name: 'Wolframit',
    type: 'Ore Hard',
    hardness: 5000,
    probability: 22.5,
    worth: 8000,
    minlevel: 100000,
    color: '#b7bd07ff',
    weight: 50
  },
  'sillimanite': {
    name: 'Sillimanite',
    type: 'Stone Hard',
    hardness: 7850,
    probability: 140,
    worth: 20,
    minlevel: 105000,
    color: '#8b7d5bff',
    weight: 34
  },
    'adamantine ore': {
    name: 'Adamantine Ore',
    type: 'Ore Hard',
    hardness: 10000,
    probability: 22.5,
    worth: 7000,
    minlevel: 110000,
    color: '#8eb95eff',
    weight: 50
  },
  'quartzite': {
    name: 'Quartzite',
    type: 'Stone Hard',
    hardness: 8500,
    probability: 200,
    worth: 31,
    minlevel: 115000,
    color: '#c35858ff',
    weight: 35
  },
  'uranium ore': {
    name: 'Uranium Ore',
    type: 'Ore Hard',
    hardness: 1000,
    probability: 22.5,
    worth: 6000,
    minlevel: 125000,
    color: '#26c07dff',
    weight: 25
  },
  'obsidian': {
    name: 'Obsidian',
    type: 'Stone Hard',
    hardness: 9999,
    probability: 200,
    worth: 45,
    minlevel: 125000,
    color: '#184f48ff',
    weight: 35
  },
  'randomium ore': {
    name: 'Randomium Ore',
    type: 'Ore Hard',
    hardness: 5000,
    probability: 20,
    worth: 18000,
    minlevel: 150000,
    color: '#ff00ff',
    weight: 30
  },
  'plutonium ore': {
    name: 'Plutonium Ore',
    type: 'Ore Hard',
    hardness: 4000,
    probability: 22.5,
    worth: 12000,
    minlevel: 175000,
    color: '#35fa00',
    weight: 25
  },
  'polished marble': {
    name: 'Polished Marble',
    type: 'Processed',
    hardness: 250,
    probability: 0,
    worth: 36.25,
    minlevel: 99999,
    color: '#c8c0beff',
    weight: 20
  },
  'polished granite': {
    name: 'Polished Granite',
    type: 'Processed',
    hardness: 250,
    probability: 0,
    worth: 38.75,
    minlevel: 99999,
    color: '#4a1828ff',
    weight: 30
  },
  'polished obsidian': {
    name: 'Polished Obsidian',
    type: 'Processed',
    hardness: 250,
    probability: 0,
    worth: 56.25,
    minlevel: 99999,
    color: '#2a6f68ff',
    weight: 30
  },
  'bronce': {
    name: 'Bronce Ingot',
    type: 'Ingot',
    hardness: 100,
    probability: 0,
    worth: 47.5,
    minlevel: 99999,
    color: '#cd7f32ff',
    forge: 'Base',
    weight: 18
  },
  'copper': {
    name: 'Copper Ingot',
    type: 'Ingot',
    hardness: 175,
    probability: 0,
    worth: 75,
    minlevel: 99999,
    color: '#962c0cff',
    forge: 'Base',
    weight: 18
  },
  'zinc': {
    name: 'Zinc Ingot',
    type: 'Ingot',
    hardness: 300,
    probability: 0,
    worth: 250,
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
    worth: 212.5,
    minlevel: 99999,
    color: '#fbd86eff',
    forge: 'Base',
    weight: 18
  },
  'silver': {
    name: 'Silver Ingot',
    type: 'Ingot',
    hardness: 35,
    probability: 0,
    worth: 1500,
    minlevel: 99999,
    color: '#c0c0c0ff',
    forge: 'Plating',
    weight: 20
  },
  'gold': {
    name: 'Gold Ingot',
    type: 'Ingot',
    hardness: 40,
    probability: 0,
    worth: 3750,
    minlevel: 99999,
    color: '#ffd700ff',
    forge: 'Plating',
    weight: 22
  },
  'pig iron': {
    name: 'Pig Iron Ingot',
    type: 'Ingot',
    hardness: 10,
    probability: 0,
    worth: 500,
    minlevel: 99999,
    color: '#4a4a4aff',
    weight: 40
  },
  'iron': {
    name: 'Iron',
    type: 'Ingot',
    hardness: 325,
    probability: 0,
    worth: 625,
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
    worth: 2344,
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
    worth: 5274,
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
    worth: 7218,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 25
  },
  'nickel': {
    name: 'Nickel Ingot',
    type: 'Ingot',
    hardness: 300,
    probability: 0,
    worth: 437.5,
    minlevel: 99999,
    color: '#979726ff',
    forge: 'Plating',
    weight: 23
  },
    'dwarfen-metallic-glass': {
    name: 'Dwarf Glass',
    type: 'Ingot',
    hardness: 600,
    probability: 0,
    worth: 9569,
    minlevel: 40000,
    color: '#e03607ff',
    forge: 'Base',
    weight: 23
  },
  'platinum': {
    name: 'Platinum Steel',
    type: 'Ingot',
    hardness: 700,
    probability: 0,
    worth: 6055,
    minlevel: 70000,
    color: '#3b371dff',
    forge: 'Base',
    weight: 25
  },
    'moonsilver': {
    name: 'Moonsilver',
    type: 'Ingot',
    hardness: 800,
    probability: 0,
    worth: 17115,
    minlevel: 70000,
    color: '#73bfe5ff',
    forge: 'Base',
    weight: 25
  },
  'titanium': {
    name: 'Titanium Ingot',
    type: 'Ingot',
    hardness: 900,
    probability: 0,
    worth: 18750,
    minlevel: 105000,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 50
  },
  'incocel': {
    name: 'Inocel',
    type: 'Ingot',
    hardness: 1000,
    probability: 0,
    worth: 70860,
    minlevel: 105000,
    color: '#9a2fa4ff',
    forge: 'Base',
    weight: 50
  },
  'adamantine': {
    name: 'Adamantine Ingot',
    type: 'Ingot',
    hardness: 1200,
    probability: 0,
    worth: 87500,
    minlevel: 99999,
    color: '#2d2121ff',
    forge: 'Base',
    weight: 50
  },
    'thornless-dwarfen-silver': {
    name: 'Thornless Silver',
    type: 'Ingot',
    hardness: 1500,
    probability: 0,
    worth: 247422,
    minlevel: 99999,
    color: '#be0d0dff',
    forge: 'Base',
    weight: 50
  },
  'wolfram': {
    name: 'Wolfram Ingot',
    type: 'Ingot',
    hardness: 1000,
    probability: 0,
    worth: 10000,
    minlevel: 99999,
    color: '#b1c41cff',
    forge: 'Plating',
    weight: 50
  },
  'uranium': {
    name: 'Enriched Uranium',
    type: 'Ingot',
    hardness: 800,
    probability: 0,
    worth: 7500,
    minlevel: 99999,
    color: '#13cb7fff',
    forge: 'Plating',
    weight: 25
  },
  'plutonium': {
    name: 'Enriched Plutonium',
    type: 'Ingot',
    hardness: 1100,
    probability: 0,
    worth: 15000,
    minlevel: 99999,
    color: '#35fa00',
    forge: 'Plating',
    weight: 25
  },
  'randomium': {
    name: 'Enriched Randomium',
    type: 'Ingot',
    hardness: 1400,
    probability: 0,
    worth: 22500,
    minlevel: 99999,
    color: '#ff00ff',
    forge: 'Plating',
    weight: 30
  },
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
    },
    'uranium': {
        name: 'Uranium Plating',
        description: '5× one-hit kill chance on critical hits',
        effect: 'oneHitMultiplier',
        value: 5.0
    },
    'nickel': {
        name: 'Nickel Plating',
        description: 'Regenerate 5 energy when moving (instead of consuming 1)',
        effect: 'movementEnergyRegen',
        value: 5
    },
    'wolfram': {
        name: 'Wolfram Plating',
        description: '25% chance for a second dig in the same tick (only one can crit)',
        effect: 'doubleDigChance',
        value: 0.25
    },
    'plutonium': {
        name: 'Plutonium Plating',
        description: '2× one-hit kill chance, 25% chance for nuclear explosion on one-hit (weakens surrounding cells)',
        effect: 'nuclearExplosion',
        value: 2.0,
        explosionChance: 0.25
    },
    'randomium': {
        name: 'Randomium Plating',
        description: '5% chance to turn stone into random ore, 5% chance to turn ore into smelted material, 5% chance for random plating effect',
        effect: 'randomTransmutation',
        stoneToOreChance: 0.05,
        oreToSmeltedChance: 0.05,
        randomPlatingChance: 0.05
    }
};

// ============================================================================
// MASONRY TASKS REGISTRY
// ============================================================================
// Masonry tasks - object where id is the key, with ordered array tracking task priority
const masonryTasksData = {
  // ──────────────────────────────────────────────────────────────────────────
  // CONTROL TASKS
  // ──────────────────────────────────────────────────────────────────────────
  'do-nothing': {
    name: 'Do Nothing',
    description: 'The masonry sits idle.',
    input: null,
    output: null,
    type: 'none'
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
  'sieve-loose-stone': {
    name: 'Sieve Loose Stone',
    description: 'Sieve loose stone into gravel. 2.5% chance to find 0.1 ore from double the current depth.',
    input: { material: 'loose stone', amount: 1 },
    output: { material: 'gravel', amount: 5 },
    bonusChance: 0.08,
    bonusType: 'deep-ore',
    bonusAmount: 0.25,
    ticksRequired: SMELTER_BASIC_PROCESSING_TICKS_REQUIRED,
    hardness: 2
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
  // GEM CUTTING
  // ──────────────────────────────────────────────────────────────────────────
  'cut-polish-gem': {
    name: 'Cut and Polish Gem',
    description: 'Cut and polish a gem to make them usable in tools, increases value by 80%. Duration scales with gem size.',
    input: null,
    output: null,
    type: 'gem-cutting',
    ticksRequired: GEM_CUTTING_BASE_TICKS,
    requires: 'gem-cutting',
    hardness: 1
  }
};

// Ordered array of masonry task IDs (determines task priority)
let masonryTasks = [
    'cut-polish-gem',
    'dry-mud',
    'sieve-loose-stone',
    'do-nothing',
    'grind-sandstone',
    'grind-limestone',
    'polish-marble',
    'polish-granite',
    'polish-obsidian'
];

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
    input: { material: 'iron', amount: 3 },
    output: { material: 'steel', amount: 1 },
    minTemp: 1350,
    ticksRequired: SMELTER_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 45
  },
  'smelt-steel-hardened': {
    name: 'Smelt Hardened Steel',
    description: 'Smelt hardened steel.',
    inputs: [
      { material: 'steel', amount: 1 },
      { material: 'iron', amount: 3 }
    ],
    output: { material: 'hardened steel', amount: 1 },
    minTemp: 1950,
    ticksRequired: SMELTER_HARDENED_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 60
  },
  'smelt-steel-dwarf': {
    name: 'Smelt Dwarfen Steel',
    description: 'Smelt dwarfen steel.',
    inputs: [
      { material: 'hardened steel', amount: 1 },
      { material: 'zinc', amount: 2 }
    ],
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
  'smelt-nickel': {
    name: 'Smelt Nickel',
    description: 'Smelt nickel ore.',
    input: { material: 'nickel ore', amount: 1 },
    output: { material: 'nickel', amount: 1 },
    minTemp: 1455,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 55
  },

  // ──────────────────────────────────────────────────────────────────────────
  // HARD METAL SMELTING
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-platinum': {
    name: 'Platinum Steel',
    description: 'Smelt Platinum steel',
    inputs: [
      { material: 'steel', amount: 1 },
      { material: 'platinum ore', amount: 1 }
    ],
    output: { material: 'platinum', amount: 1 },
    minTemp: 1768,
    ticksRequired: SMELTER_DWARF_STEEL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 70
  },
  'smelt-titanium': {
    name: 'Smelt Titanium',
    description: 'Smelt titanium ore.',
    input: { material: 'titanium ore', amount: 5 },
    output: { material: 'titanium', amount: 1 },
    minTemp: 1668,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 75
  },
  'smelt-adamantine': {
    name: 'Smelt Adamantine',
    description: 'Smelt adamantine ore.',
    input: { material: 'adamantine ore', amount: 10 },
    output: { material: 'adamantine', amount: 1 },
    minTemp: 2850,
    ticksRequired: SMELTER_PRECIOUS_METAL_TICKS_REQUIRED,
    requires: 'furnace',
    hardness: 100
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GLASS METALS ALLOYS
  // ──────────────────────────────────────────────────────────────────────────
  'smelt-dwarfen-metallic-glass': {
    name: 'Smelt Dwarfen Metallic Glass',
    description: 'Create dwarfen metallic glass alloy from dwarfen steel and nickel.',
    inputs: [
      { material: 'dwarf steel', amount: 1 },
      { material: 'nickel', amount: 1 }
    ],
    output: { material: 'dwarfen-metallic-glass', amount: 1 },
    minTemp: 2400,
    ticksRequired: SMELTER_ALLOY_TICKS_REQUIRED,
    requires: 'glass-metals',
    hardness: 90
  },
  'smelt-moonsilver': {
    name: 'Smelt Moonsilver',
    description: 'Create moonsilver alloy from platinum, silver, and nickel.',
    inputs: [
      { material: 'platinum', amount: 1 },
      { material: 'silver', amount: 5 },
      { material: 'nickel', amount: 1 }
    ],
    output: { material: 'moonsilver', amount: 1 },
    minTemp: 1800,
    ticksRequired: SMELTER_ALLOY_TICKS_REQUIRED,
    requires: 'glass-metals',
    hardness: 95
  },
  'smelt-incocel': {
    name: 'Smelt Incocel',
    description: 'Create incocel alloy from titanium and nickel.',
    inputs: [
      { material: 'titanium', amount: 3 },
      { material: 'nickel', amount: 1 }
    ],
    output: { material: 'incocel', amount: 1 },
    minTemp: 1700,
    ticksRequired: SMELTER_ALLOY_TICKS_REQUIRED,
    requires: 'glass-metals',
    hardness: 100
  },
  'smelt-thornless-silver': {
    name: 'Smelt Thornless Silver',
    description: 'Create thornless silver alloy from adamantine, silver, and nickel.',
    inputs: [
      { material: 'adamantine', amount: 2 },
      { material: 'silver', amount: 15 },
      { material: 'nickel', amount: 1 }
    ],
    output: { material: 'thornless-dwarfen-silver', amount: 1 },
    minTemp: 2900,
    ticksRequired: SMELTER_ALLOY_TICKS_REQUIRED,
    requires: 'glass-metals',
    hardness: 110
  }
};

// Ordered array of smelter task IDs (determines task priority)
let smelterTasks = [
    'do-nothing',
    'heat-furnace',
    'heat-magma-furnace',
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
    'smelt-nickel',
    'smelt-platinum',
    'smelt-titanium',
    'smelt-adamantine',
    'smelt-dwarfen-metallic-glass',
    'smelt-moonsilver',
    'smelt-incocel',
    'smelt-thornless-silver'
];

// Smelter temperature system
let smelterTemperature = 25; // Current temperature in degrees
let smelterCoalMinTemp = 25; // Minimum temperature for coal heating (user configurable)
let smelterCoalMaxTemp = 1200; // Maximum temperature for coal heating (user configurable)
let smelterMagmaMinTemp = 25; // Minimum temperature for magma heating (user configurable)
let smelterHeatingMode = false; // Track if we're currently in heating mode (for hysteresis)

// ============================================================================
// ENRICHMENT REGISTRY
// ============================================================================
// Enrichment tasks for processing rare ores (no temperature required)
const enrichmentTasksData = {
  'do-nothing': {
    name: 'Do Nothing',
    description: 'The enrichment facility sits idle.',
    input: null,
    output: null,
    type: 'none'
  },
  'enrich-wolfram': {
    name: 'Enrich Wolfram',
    description: 'Enrich wolfram ore through advanced processing.',
    input: { material: 'wolfram ore', amount: 1 },
    output: { material: 'wolfram', amount: 1 },
    ticksRequired: 250,
    hardness: 105
  },
  'enrich-uranium': {
    name: 'Enrich Uranium',
    description: 'Enrich uranium ore through advanced processing.',
    input: { material: 'uranium ore', amount: 1 },
    output: { material: 'uranium', amount: 1 },
    ticksRequired: 500,
    hardness: 110
  },
  'enrich-plutonium': {
    name: 'Enrich Plutonium',
    description: 'Enrich plutonium ore through advanced processing.',
    input: { material: 'plutonium ore', amount: 1 },
    output: { material: 'plutonium', amount: 1 },
    ticksRequired: 1000,
    hardness: 115
  },
  'enrich-randomium': {
    name: 'Enrich Randomium',
    description: 'Enrich randomium ore through chaotic processing.',
    input: { material: 'randomium ore', amount: 1 },
    output: { material: 'randomium', amount: 1 },
    ticksRequired: 1337,
    hardness: 120
  }
};

// Ordered array of enrichment task IDs (determines task priority)
let enrichmentTasks = [
    'enrich-wolfram',
    'enrich-uranium',
    'enrich-plutonium',
    'enrich-randomium',
    'do-nothing'
];

// ============================================================================
// RESEARCH REGISTRY
// ============================================================================
// Research data - object where id is the key, with ordered array tracking display order
const researchData = {
  'improved-digging': {
    name: 'Improved Digging Technique',
    cost: 50,
    goldCost: 10,
    level: 0,
    hardness: 10,
    description: 'Dwarfs dig 1% harder.'
  },
  'better-housing': {
    name: 'Housing',
    cost: 100,
    goldCost: 500,
    maxlevel: 100,
    level: 0,
    min_depth: 300,
    hardness: 20,
    description: 'The Home is more comfy, letting them rest faster. Diminishing returns per level.'
  },
  'trading': {
    name: 'Better trading',
    cost: 100,
    goldCost: 10,
    level: 0,
    hardness: 30,
    description: 'Prices are improved by 3% per level'
  },
  'small-time-investments': {
    name: 'Small Time Investments',
    cost: 1200,
    goldCost: 1000,
    level: 0,
    maxlevel: 1,
    hardness: 75,
    requires: [{'trading': 5}],
    min_depth: 800,
    description: 'Invest your gold wisely. Gain small interest up to 100.000 gold.'
  },
  'price-negotiations': {
    name: 'Price Negotiations',
    cost: 2000,
    goldCost: 500,
    level: 0,
    maxlevel: 1,
    hardness: 50,
    requires: [{'trading': 5}], 
    min_depth: 5000,
    description: 'The wisest dwarf negotiates better. His wisdom gives +1% sell price per skill point.'
  },

  'one-time-investments': {
    name: 'Long Term Investments',
    cost: 2000,
    goldCost: 5000,
    level: 0,
    maxlevel: 1,
    hardness: 75,
    requires: [{'price-negotiations': 1}],
    min_depth: 5000,
    description: 'Unlock the ability to make one-time investments. Pays back over 12 hours.'
  },
  'wage-optimization': {
    name: 'Wage Negotiation',
    cost: 400,
    goldCost: 1000,
    level: 0,
    maxlevel: 20,
    hardness: 70,
    min_depth: 3000,
    unlock_requires: 'wage_increase',
    description: 'Reduces wage increase per dwarf level by 1%.'
  },
  'buckets': {
    name: 'Bigger Buckets',
    cost: 300,
    goldCost: 200,
    level: 0,
    maxlevel: 10,
    hardness: 30,
    description: 'Increases bucket weight capacity by 5% per level. Base: 50kg + (5kg × strength).'
  },
  'tool-enchanting': {
    name: 'Tool Enchanting',
    cost: 300,
    goldCost: 300,
    level: 0,
    maxlevel: 30,
    hardness: 40,
    min_depth: 250,
    description: 'Hire a wizard to enchant your tools, better enchantments with higher levels.'
  },
  'grinding-machine': {
    name: 'Grinding Machine',
    cost: 200,
    goldCost: 200,
    level: 0,
    maxlevel: 1,
    hardness: 40,
    min_depth: 500,
    description: 'Unlocks the grind task at the Masonry.'
  },
  'stone-polishing': {
    name: 'Stone Polishing',
    cost: 500,
    goldCost: 500,
    level: 0,
    maxlevel: 5,
    hardness: 50,
    requires: [{'grinding-machine': 1}],
    min_depth: 4000,
    description: 'Unlocks stone polishing at the Masonry. Each level reduces break chance by 8% (from 50% base).'
  },
  'gem-cutting': {
    name: 'Gem Cutting',
    cost: 1500,
    goldCost: 5000,
    level: 0,
    maxlevel: 1,
    hardness: 55,
    requires: [{'grinding-machine': 1}],
    min_depth: 5000,
    description: 'Unlocks gem cutting at the masonry.'
  },
  'gem-setting': {
    name: 'Gem Setting',
    cost: 1500,
    goldCost: 5000,
    level: 0,
    maxlevel: 3,
    hardness: 55,
    requires: [{'gem-cutting': 1}],
    min_depth: 5000,
    description: 'Set up to 3 Gems into the dwarfs tools.'
  },
  'furnace': {
    name: 'Furnace',
    cost: 750,
    goldCost: 750,
    level: 0,
    maxlevel: 1,
    hardness: 60,
    requires: [{'grinding-machine': 1}],
    min_depth: 1000,
    description: 'Unlocks the furnace for smelting of ores.'
  },
  'smelter-capacity': {
    name: 'Smelter Capacity',
    cost: 7500,
    goldCost: 25000,
    level: 0,
    maxlevel: 4,
    hardness: 95,
    requires: [{'furnace-insulation': 5}],
    min_depth: 20000,
    description: 'Increases smelter batch size by 1 per level. Smelt multiple items at once (including alloys).'
  },
  'furnace-insulation': {
    name: 'Furnace Insulation',
    cost: 1000,
    goldCost: 8000,
    level: 0,
    maxlevel: 5,
    hardness: 60,
    requires: [{'furnace': 1}],
    min_depth: 2000,
    description: 'Reduces furnace heat loss by 10% per level (from 0.05% base cooling rate).'
  },
  'forge': {
    name: 'Forge',
    cost: 2000,
    goldCost: 2000,
    level: 0,
    maxlevel: 1,
    hardness: 65,
    requires: [{'furnace': 1}],
    min_depth: 1000,
    description: 'Unlocks the forge for crafting and upgrading tools.'
  },
  'alloys': {
    name: 'Alloys',
    cost: 2000,
    goldCost: 8000,
    level: 0,
    maxlevel: 1,
    hardness: 70,
    requires: [{'furnace': 1}],
    min_depth: 15000,
    description: 'Unlocks the ability to create alloys in the smelter.'
  },
    'furnace-temperature': {
    name: 'Furnace Temperature',
    cost: 700,
    goldCost: 1500,
    level: 0,
    maxlevel: 15,
    hardness: 80,
    requires: [{'forge': 1}],
    min_depth: 6000,
    description: 'Increases maximum furnace temperature by 100° per level (from 1500° to 3000°).'
  },
  'magma-furnace': {
    name: 'Magma Operated Furnace',
    cost: 2500,
    goldCost: 50000,
    level: 0,
    maxlevel: 1,
    hardness: 90,
    requires: [{'furnace-insulation': 5}, {'furnace-temperature': 10}],
    min_depth: 8000,
    description: 'Unlocks the ability to use Magma to heat the furnace. Magma heats based on your Furnace Temperature research level.'
  },
  'glass-metals': {
    name: 'Glass Metals',
    cost: 3000,
    goldCost: 60000,
    level: 0,
    maxlevel: 1,
    hardness: 95,
    requires: [{'magma-furnace': 1}],
    min_depth: 40000,
    description: 'Unlocks the ability to create advanced metallic glass alloys with superior properties.'
  },
  'material-science': {
    name: 'Material Science',
    cost: 500,
    goldCost: 500,
    level: 0,
    maxlevel: 5,
    hardness: 70,
    min_depth: 1000,
    description: 'Increases critical hit chance to any stone by 5% per level.'
  },

  'expertise-stone': {
    name: 'Stone Expertise',
    cost: 1000,
    goldCost: 3000,
    level: 0,
    maxlevel: 15,
    hardness: 80,
    requires: [{'material-science': 3}],
    min_depth: 1000,
    description: 'Critical hits have a 2% chance to one-hit any stone.'
  },
  'expertise-ore': {
    name: 'Ore Expertise',
    cost: 1500,
    goldCost: 6000,
    level: 0,
    maxlevel: 15,
    hardness: 85,
    requires: [{'material-science': 5}, {'expertise-stone': 1}],
    min_depth: 2000,
    description: 'Critical hits have a 2% chance to one-hit any ore.',
  },
  'ore-enrichment': {
    name: 'Ore Enrichment',
    cost: 2000,
    goldCost: 50000,
    level: 0,
    maxlevel: 1,
    hardness: 120,
    requires: [{'furnace-temperature': 15}, {'magma-furnace': 1}],
    min_depth: 100000,
    description: 'Unlocks the ability to enrich special ores (Wolfram, Uranium, Plutonium) for use in advanced plating.'
  },
  'management': {
    name: 'Management',
    cost: 5000,
    goldCost: 100000,
    level: 0,
    maxlevel: 1,
    hardness: 100,
    min_depth: 10000,
    description: 'Unlocks dwarf self management to make your life eaiser. Dwarfs will do certain stuff for you.'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // FURNITURE / CONSTRUCTION RESEARCHES
  // ──────────────────────────────────────────────────────────────────────────
  'comfort': {
    name: 'Comfort',
    cost: 200,
    goldCost: 2000,
    level: 0,
    maxlevel: 1,
    hardness: 25,
    requires: [{'better-housing': 1}],
    min_depth: 2000,
    description: 'Unlocks comfortable furniture like rocking chairs.'
  },
  'entertainment': {
    name: 'Entertainment',
    cost: 400,
    goldCost: 8000,
    level: 0,
    maxlevel: 1,
    hardness: 35,
    requires: [{'better-housing': 2}],
    min_depth: 5000,
    description: 'Unlocks entertainment furniture like gaming tables and bars.'
  },
  'organization': {
    name: 'Organization',
    cost: 500,
    goldCost: 5000,
    level: 0,
    maxlevel: 1,
    hardness: 40,
    requires: [{'better-housing': 2}],
    min_depth: 5000,
    description: 'Unlocks organizational furniture like tools racks and desks.'
  },
  'brewing': {
    name: 'Brewing',
    cost: 800,
    goldCost: 15000,
    level: 0,
    maxlevel: 1,
    hardness: 50,
    requires: [{'better-housing': 3}],
    min_depth: 15000,
    description: 'Unlocks brewing-related furniture like ale barrel racks.'
  },
  'knowledge': {
    name: 'Knowledge',
    cost: 1000,
    goldCost: 20000,
    level: 0,
    maxlevel: 1,
    hardness: 55,
    requires: [{'better-housing': 3}],
    min_depth: 25000,
    description: 'Unlocks knowledge furniture like bookshelves.'
  },
  'decoration': {
    name: 'Decoration',
    cost: 1500,
    goldCost: 50000,
    level: 0,
    maxlevel: 1,
    hardness: 65,
    requires: [{'better-housing': 5}],
    min_depth: 50000,
    description: 'Unlocks decorative furniture like banners and potted mushrooms.'
  },
  'religion': {
    name: 'Religion',
    cost: 2000,
    goldCost: 100000,
    level: 0,
    maxlevel: 1,
    hardness: 80,
    requires: [{'better-housing': 7}],
    min_depth: 100000,
    description: 'Unlocks religious furniture like shrines.'
  },
  'artistry': {
    name: 'Artistry',
    cost: 3000,
    goldCost: 250000,
    level: 0,
    maxlevel: 1,
    hardness: 95,
    requires: [{'better-housing': 10}],
    min_depth: 250000,
    description: 'Unlocks artistic furniture like dwarfen statues.'
  },

};

// Ordered array of research IDs (determines display order)
let researchTree = [

  'price-negotiations',
  'small-time-investments',
  'one-time-investments',
  'management',
  'tool-enchanting',
  'grinding-machine',
  'stone-polishing',
  'gem-cutting',
  'gem-setting',
  'furnace',
  'furnace-insulation',
  'forge',
  'alloys',
  'smelter-capacity',
  'material-science',
  'wage-optimization',
  'expertise-stone',
  'expertise-ore',
  'furnace-temperature',
  'magma-furnace',
  'glass-metals',
  'ore-enrichment',
  'improved-digging',
  'better-housing',
  'comfort',
  'entertainment',
  'organization',
  'brewing',
  'knowledge',
  'decoration',
  'religion',
  'artistry',
  'trading',
  'buckets',
];

let managementTasks = {
  'sell-material': {
    name: 'Sell Material',
    description: 'Automatically sell excess materials when stock exceeds defined threshold.',
    values: {material: {Description: 'Material', default:'earth', type:'material-dropdown'},
            minQuantity: {Description: 'Run when quantity >', default:100, type:'number'},
            keepQuantity: {Description: 'Keep a minimum of', default:0, type:'number'}},
    requires: {},
    cost: 5,
    hardness: 1,
  },
  'sell-non-craftables': {
    name: 'Sell Non-Craftables',
    description: 'Automatically sell materials that are not used in any crafting recipes.',
    values: {
      minQuantity: {Description: 'Run when total quantity >', default:1000, type:'number'},
    },
    requires: {},
    cost: 100,
    hardness: 10,
  },
  'sell-gems': {
    name: 'Sell unpolished Gems',
    description: 'Automatically sell unpolished gems.',
    values: {gemtype: {Description: 'Gem Type', default:'any', type:'gem-dropdown'},
             minQuantity: {Description: 'Run when quantity >', default:10, type:'number'},
             maxcarats: {Description: 'Up to carat (incl)', default:1, type:'number'}
            },
    requires: {},
    cost: 50,
    hardness: 15,
  },
    'cut-gems': {
    name: 'Cut Gems',
    description: 'Mark gems for cutting.',
    values: {gemtype: {Description: 'Gem Type', default:'any', type:'gem-dropdown'},
             minQuantity: {Description: 'Run when quantity >', default:10, type:'number'},
             mincarats: {Description: 'Minimum carats', default:1, type:'number'}
            },
    requires: {},
    cost: 50,
    hardness: 15,
  }, 
  'auto-research-cheapest': {
    name: 'Auto research cheapest endless research',
    description: 'Automatically queue the cheapest available research.',
    values: {
      minBankGold: {Description: 'Keep Gold in reserve', default: 100000, type: 'number'},
      minQueueSize: {Description: 'When research queue is shorter than', default: 1, type: 'number'}
    },
    requires: {},
    cost: 75,
    hardness: 20,
  },
  'auto-invest': {
    name: 'Auto Invest',
    description: 'Automatically create one-time investments.',
    values: {
      minBankGold: {Description: 'Keep Gold in reserve', default: 3000000, type: 'number'},
      amountToInvest: {Description: 'Amount to invest', default: 1000000, type: 'number'},
      maxActiveInvestments: {Description: 'Maximum active investments', default: 5, type: 'number'}
    },
    requires: {'one-time-investments': 1},
    cost: 50,
    hardness: 40,
  },
  'activate-furnace-heating': {
    name: 'Activate Furnace Heating',
    description: 'Automatically activate furnace heating when smelter input materials exceed threshold. Moves heating task to top priority and sets min temperature.',
    values: {
      useCoal: {Description: 'Use Coal', default: true, type: 'checkbox'},
      useMagma: {Description: 'Use Magma', default: false, type: 'checkbox'},
      minInputStock: {Description: 'Activate when total ore stock >', default: 10, type: 'number'}
    },
    requires: {'furnace': 1},
    cost: 50,
    hardness: 25,
  },
  'deactivate-furnace-heating': {
    name: 'Deactivate Furnace Heating',
    description: 'Automatically deactivate furnace heating when smelter input materials fall below threshold. Moves heating task to bottom priority.',
    values: {
      useCoal: {Description: 'Deactivate Coal', default: true, type: 'checkbox'},
      useMagma: {Description: 'Deactivate Magma', default: false, type: 'checkbox'},
      maxInputStock: {Description: 'Deactivate when all ore stock <', default: 5, type: 'number'}
    },
    requires: {'furnace': 1},
    cost: 10,
    hardness: 25,
  },
}

// ============================================================================
// CONSTRUCTION / FURNITURE REGISTRY
// ============================================================================
// Furniture definitions for common room and individual dwarf rooms

const furnitureData = {
  // ──────────────────────────────────────────────────────────────────────────
  // COMMON ROOM FURNITURE (more expensive, shared benefits)
  // ──────────────────────────────────────────────────────────────────────────
  'seating-bench': {
    name: 'Seating Bench',
    icon: '🪑',
    room: 'common',
    baseCost: 500,
    minDepth: 500,
    requires: null,
    effect: { restBonus: 0.05 },
    description: 'A sturdy wooden bench. +5% rest recovery per level.'
  },
  'feasting-table': {
    name: 'Feasting Table',
    icon: '🍽️',
    room: 'common',
    baseCost: 800,
    minDepth: 500,
    requires: null,
    effect: { maxEnergyBonus: 2 },
    description: 'A long table for communal meals. +2 max energy per level.'
  },
  'gaming-table': {
    name: 'Gaming Table',
    icon: '🎲',
    room: 'common',
    baseCost: 5000,
    minDepth: 5000,
    requires: 'entertainment',
    effect: { restBonus: 0.08 },
    description: 'For card games and dice. +8% rest recovery per level.'
  },
  'bar-with-barstools': {
    name: 'Bar with Barstools',
    icon: '🍺',
    room: 'common',
    baseCost: 7000,
    minDepth: 10000,
    requires: 'entertainment',
    effect: { maxEnergyBonus: 5 },
    description: 'A proper dwarven bar. +5 max energy per level.'
  },
  'ale-barrel-rack': {
    name: 'Ale Barrel Rack',
    icon: '⚱️',
    room: 'common',
    baseCost: 10000,
    minDepth: 15000,
    requires: 'brewing',
    effect: { restBonus: 0.1 },
    description: 'Stores the finest ale. +10% rest recovery per level.'
  },
  'banner': {
    name: 'Banner',
    icon: '🚩',
    room: 'common',
    baseCost: 15000,
    minDepth: 50000,
    requires: 'decoration',
    effect: { digPowerBonus: 0.01 },
    description: 'Displays clan colors proudly. +1% dig power per level.'
  },
  'shrine': {
    name: 'Shrine',
    icon: '⛩️',
    room: 'common',
    baseCost: 100000,
    minDepth: 100000,
    requires: 'religion',
   effect: { xpGainBonus: 0.01 },
    description: 'A sacred shrine for worship. +1% XP gain per level.'
  },
  'dwarfen-statue': {
    name: 'Dwarfen Statue',
    icon: '🗿',
    room: 'common',
    baseCost: 250000,
    minDepth: 250000,
    requires: 'artistry',
    effect: { strengthBonus: 1, digPowerBonus: 0.02 },
    description: 'A magnificent statue. +1 strength and +2% dig power per level.'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // INDIVIDUAL ROOM FURNITURE (cheaper, benefits specific dwarf)
  // ──────────────────────────────────────────────────────────────────────────
  'bed': {
    name: 'Bed',
    icon: '🛏️',
    room: 'individual',
    baseCost: 500,
    minDepth: 500,
    requires: null,
    effect: { restBonus: 0.05 },
    description: 'A comfortable bed. +5% rest recovery per level.'
  },
  'cabinet': {
    name: 'Cabinet',
    icon: '🧥',
    room: 'individual',
    baseCost: 300,
    minDepth: 500,
    requires: null,
    effect: { maxEnergyBonus: 3 },
    description: 'Storage for belongings. +3 max energy per level.'
  },
  'rocking-chair': {
    name: 'Rocking Chair',
    icon: '🪑',
    room: 'individual',
    baseCost: 2000,
    minDepth: 2000,
    requires: 'comfort',
    effect: { restBonus: 0.08 },
    description: 'A relaxing chair. +8% rest recovery per level.'
  },
  'tools-rack': {
    name: 'Tools Rack',
    icon: '🪓',
    room: 'individual',
    baseCost: 4000,
    minDepth: 5000,
    requires: 'organization',
    effect: { digPowerBonus: 0.015 },
    description: 'Organized tool storage. +1.5% dig power per level.'
  },
  'desk-with-stool': {
    name: 'Desk with Stool',
    icon: '📝',
    room: 'individual',
    baseCost: 5000,
    minDepth: 10000,
    requires: 'organization',
    effect: { xpGainBonus: 0.03 },
    description: 'A workspace for planning. +3% XP gain per level.'
  },
  'bookshelf': {
    name: 'Bookshelf',
    icon: '📖',
    room: 'individual',
    baseCost: 12000,
    minDepth: 25000,
    requires: 'knowledge',
    effect: { wisdomBonus: 2 },
    description: 'Mining manuals and scrolls. +2 wisdom per level.'
  },
  'small-ale-barrel': {
    name: 'Small Ale Barrel',
    icon: '🍺',
    room: 'individual',
    baseCost: 35000,
    minDepth: 75000,
    requires: 'brewing',
    effect: { maxEnergyBonus: 5, restBonus: 0.05 },
    description: 'Personal ale stash. +5 max energy and +5% rest per level.'
  },
  'potted-mushroom': {
    name: 'Potted Mushroom',
    icon: '🍄',
    room: 'individual',
    baseCost: 75000,
    minDepth: 150000,
    requires: 'decoration',
    effect: { digPowerBonus: 0.015, restBonus: 0.04 },
    description: 'A glowing mushroom. +1.5% dig power and +4% rest per level.'
  }
};

// Ordered arrays for display order
const commonRoomFurniture = [
  'seating-bench',
  'feasting-table',
  'gaming-table',
  'bar-with-barstools',
  'ale-barrel-rack',
  'banner',
  'shrine',
  'dwarfen-statue'
];

const individualRoomFurniture = [
  'bed',
  'cabinet',
  'rocking-chair',
  'tools-rack',
  'desk-with-stool',
  'bookshelf',
  'small-ale-barrel',
  'potted-mushroom'
];

// Common room - shared by all dwarfs
// Furniture levels initialized in main.js (initializeFurniture)
const commonRoom = {
  name: 'Common Room',
  furniture: {}
};

// Individual rooms - keyed by room ID
// Each dwarf has a roomId property linking them to their room
// Furniture levels initialized in main.js (initializeFurniture)
const individualRooms = {
  'room-1': { name: "Diggingston's Room", furniture: {} },
  'room-2': { name: "Shovelli's Room", furniture: {} },
  'room-3': { name: "Diggmaster's Room", furniture: {} },
  'room-4': { name: "Burrower's Room", furniture: {} },
  'room-5': { name: "NevertiredMcPickaxemer's Room", furniture: {} },
  'room-6': { name: "SmartDigger's Room", furniture: {} }
};

let activeResearch = null; // Track which research is currently being researched
let researchQueue = []; // Queue for up to 5 researches

let grid = [];
let startX = 0;
let gold = 50;

// Gold sync tracking - prevents race condition between main thread sales and worker ticks
let goldSyncToken = 0;      // Incremented when main thread sends gold update to worker
let pendingGoldDelta = 0;   // Tracks unsynced local gold changes (sales, etc.)

// One-time investments system
let oneTimeInvestments = []; // Array of active one-time investments
let nextInvestmentId = 1; // Next investment ID to assign

let dwarfs = [
    { name: "Diggingston",
      toolId: 1,
      roomId: 'room-1',
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 1, y: -1,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriorityHigh: [],
      taskPriorityNormal: ['digging', 'research', 'masonry', 'smelting', 'managing'],
      taskPriorityNone: [] },
    { name: "Shovelli",
      toolId: 2,
      roomId: 'room-2',
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 1, y: -1,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriorityHigh: [],
      taskPriorityNormal: ['digging', 'research', 'masonry', 'smelting', 'managing'],
      taskPriorityNone: [] },
    { name: "Diggmaster",
      toolId: 3,
      roomId: 'room-3',
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 1, y: -1,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriorityHigh: [],
      taskPriorityNormal: ['digging', 'research', 'masonry', 'smelting', 'managing'],
      taskPriorityNone: [] },
    { name: "Burrower",
      toolId: 4,
      roomId: 'room-4',
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 1, y: -1,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriorityHigh: [],
      taskPriorityNormal: ['digging', 'research', 'masonry', 'smelting', 'managing'],
      taskPriorityNone: [] },
    { name: "NevertiredMcPickaxemer",
      toolId: 5,
      roomId: 'room-5',
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 0,
      x: 1, y: -1,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriorityHigh: [],
      taskPriorityNormal: ['digging', 'research', 'masonry', 'smelting', 'managing'],
      taskPriorityNone: [] },
    { name: "SmartDigger",
      toolId: 6,
      roomId: 'room-6',
      level: 0, xp: 0,
      digPower: 0, maxEnergy: 100, strength: 0, wisdom: 3,
      x: 1, y: -1,
      status: 'idle', moveTarget: null,
      bucket: {}, energy: 100,
      taskPriorityHigh: [],
      taskPriorityNormal: ['managing', 'research', 'masonry', 'smelting', 'digging'],
      taskPriorityNone: [] },
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

// Functions grid - 1x7 grid above the main digging grid (y = -1)
const functionsGridY = -1; // One row above the main grid
const functionsGridWidth = 7;

// Function locations in the 1x7 grid above main grid
// Order: House, Warehouse, Masonry, Smelter, Enrichment, Research, Management
const house = { x: 0, y: functionsGridY };        // First cell (House/Bed)
const dropOff = { x: 1, y: functionsGridY };      // Second cell (Warehouse)
const masonry = { x: 2, y: functionsGridY };      // Third cell (Masonry)
const smelter = { x: 3, y: functionsGridY };      // Fourth cell (Smelter)
const enrichment = { x: 4, y: functionsGridY };   // Fifth cell (Enrichment)
const research = { x: 5, y: functionsGridY };     // Sixth cell (Research)
const management = { x: 6, y: functionsGridY };   // Seventh cell (Management)

// Keep old drop-grid on the right for backward compatibility (2x2 grid)
const dropGridStartX = gridWidth;
const dropGridWidth = 2, dropGridHeight = 2;