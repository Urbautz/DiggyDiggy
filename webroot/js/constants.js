// ============================================================================
// DIGGY DIGGY DWARF - GAME CONSTANTS
// ============================================================================
// This file contains all game balance constants and configuration values.
// These constants are shared across all game modules.
// ============================================================================

// Game version
const gameversion = '0.20.2';

// ============================================================================
// DWARF CONSTANTS
// ============================================================================

const DWARF_BASE_POWER = 3; // Base damage without tools
const DWARF_DIG_POWER_BONUS = 0.1; // 10% bonus per dig power point
const DWARF_ENERGY_COST_PER_DIG = 5; // Energy consumed per dig action
const DWARF_ENERGY_COST_PER_MOVE = 1; // Energy consumed per move
const DWARF_BASE_ENERGY_COST_TASK = 10; // Base energy consumed per research or smelting action
const DWARF_LOW_ENERGY_THRESHOLD = 20; // Energy below which dwarf seeks rest
const DWARF_REST_AMOUNT = 15; // Energy restored per rest tick
const DWARF_BASE_WAGE = 0.01; // Base gold cost per dig action
const DWARF_WAGE_INCREASE_RATE = 0.18; // 18% wage increase per level
const DWARF_WAGE_INCREASE_MIN = 0.01; // Minimum wage increase rate (with research)
const DWARF_XP_PER_ACTION = 1; // XP gained per dig/smelt action

// XP calculation function - uses exponential scaling
// Target: Level 0: 25xp, Level 1: 50xp, Level 2: 132, Level 5: 300, Level 10: 1000, Level 25: 25000, Level 50: 100000
function getDwarfXpForLevel(level) {
    // Hardcoded level 0 requirement
    if (level === 0) return 25;

    // Formula: 50 * level^1.4 (rounded) for level 1+
    // This creates exponential growth matching the target progression
    return Math.round(50 * Math.pow(level, 1.4));
}
const DWARF_STRIKE_BASE_CHANCE = 0.3; // 30% chance to continue without pay
const DWARF_LEVELUP_ENERGY_MULTIPLIER = 1.2; // 20% energy increase on levelup
const DWARF_LEVELUP_STRENGTH_BONUS = 5; // Bucket capacity increase per strength point
const DWARF_RESET_COST_PER_LEVEL = 1000; // Gold cost per level to reset points

// ============================================================================
// COMBAT CONSTANTS
// ============================================================================

const CRITICAL_HIT_BASE_CHANCE = 0.02; // 2% base critical hit chance
const CRITICAL_HIT_DAMAGE_MULTIPLIER = 2; // Critical hits do double damage
const CRITICAL_HIT_ANIMATION_DURATION = 300; // Milliseconds for crit animation
const ONE_HIT_ANIMATION_DURATION = 300; // Milliseconds for one-hit animation
const STONE_EXPERTISE_ONE_HIT_CHANCE = 0.02; // 2% per level
const ORE_EXPERTISE_ONE_HIT_CHANCE = 0.03; // 3% per level

// ============================================================================
// RESEARCH CONSTANTS
// ============================================================================

const RESEARCH_IMPROVED_DIGGING_BONUS = 0.01; // 1% per level
const RESEARCH_MATERIAL_SCIENCE_CRIT_BONUS = 0.05; // 5% crit chance per level
const RESEARCH_UNION_BUSTING_BONUS = 0.05; // 5% less strike chance per level
const RESEARCH_WAGE_OPTIMIZATION_REDUCTION = 0.01; // 1% wage increase reduction per level
const RESEARCH_BETTER_HOUSING_BASE_BONUS = 0.1; // 10% base rest bonus
const RESEARCH_BETTER_HOUSING_DIMINISH = 0.15; // Diminishing returns factor
const RESEARCH_TRADING_BONUS = 0.03; // 3% better sell prices per level
const RESEARCH_PRICE_NEGOTIATIONS_BONUS = 0.01; // 1% sell price bonus per wisdom level of highest wisdom dwarf
const RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_RATE = 0.000125; // 0.1% interest rate for gold below 1000
const RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT = 100; // Gold limit for tier 1 interest
const RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_RATE = 0.00000135; // 0.025% interest rate for gold below 100k
const RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT = 10100; // Gold limit for tier 2 interest
const RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_RATE = 0.0000000875; // 0% interest rate for gold below 10M
const RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_LIMIT = 110100; // Gold limit for tier 3 interest
const RESEARCH_BUCKET_CAPACITY_BONUS = 1; // 1 extra capacity per level
const RESEARCH_STONE_POLISHING_BREAK_REDUCTION = 0.08; // 8% less break chance per level
const RESEARCH_FURNACE_INSULATION_BONUS = 0.10; // 10% less heat loss per level
const RESEARCH_COST_MULTIPLIER = 1.3; // Research cost formula: baseCost * (1.3^(level-1)), rounded to 0 digits
const RESEARCH_WISDOM_PROBABILITY_BONUS = 2; // 2% probability bonus per wisdom point
const RESEARCH_HARDNESS_SCALING_PER_LEVEL = 1; // Hardness increase per research level
const RESEARCH_HARDNESS_MAX = 9999; // Maximum hardness for endless researches
const RESEARCH_HARDNESS_MIN = 10; // Minimum hardness (cannot be reduced below this)
const RESEARCH_MIN_SUCCESS_CHANCE = 0.05; // Minimum 5% success chance for any dwarf attempting research

// ============================================================================
// GRID GENERATION CONSTANTS
// ============================================================================

const GRID_CLUSTERING_HORIZONTAL_CHANCE = 0.5; // 50% chance to use same material as left tile
const GRID_CLUSTERING_VERTICAL_CHANCE = 0.5; // 50% chance to use same material as above tile
const GRID_MOVE_DOWN_CHANCE = 0.7; // 70% chance to move down to dig lower
const GRID_MOVE_UP_CHANCE = 0.2; // 20% chance to move up after horizontal move

// ============================================================================
// GEM SPAWN CONSTANTS
// ============================================================================

const GEM_SPAWN_CHANCE = 0.04; // 4% chance to find a gem when destroying stone materials
const GEM_CUTTING_VALUE_MULTIPLIER = 1.8; // 80% value increase when gems are cut and polished
const GEM_CUTTING_TICKS_REQUIRED = 50; // Ticks required to cut and polish a gem
const GEM_CARAT_DEPTH_DIVISOR = 2500; // Depth divisor for calculating maximum gem carat

// ============================================================================
// GEM EFFECT CONSTANTS - RUBY
// ============================================================================

const RUBY_ENERGY_MIN_CHANCE = 5; // Minimum energy prevention chance (%)
const RUBY_ENERGY_MAX_CHANCE = 80; // Maximum energy prevention chance (%)
const RUBY_ENERGY_CARAT_NORMALIZER = 2.5; // Normalization factor for carat values
const RUBY_ENERGY_MAX_CARAT = 10000; // Maximum carat value for formula scaling

// ============================================================================
// GEM EFFECT CONSTANTS - EMERALD
// ============================================================================

const EMERALD_CRIT_MIN_MULTIPLIER = 0.5; // Minimum crit chance multiplier (0.5 = 50% increase)
const EMERALD_CRIT_MAX_MULTIPLIER = 40; // Maximum crit chance multiplier (40 = 4000% increase)
const EMERALD_CRIT_CARAT_NORMALIZER = 2.5; // Normalization factor for carat values
const EMERALD_CRIT_MAX_CARAT = 10000; // Maximum carat value for formula scaling

// ============================================================================
// GEM EFFECT CONSTANTS - SAPPHIRE
// ============================================================================

const SAPPHIRE_STRENGTH_MIN_BONUS = 1; // Minimum strength bonus (%)
const SAPPHIRE_STRENGTH_MAX_BONUS = 50; // Maximum strength bonus (%)
const SAPPHIRE_STRENGTH_CARAT_NORMALIZER = 2.5; // Normalization factor for carat values
const SAPPHIRE_STRENGTH_MAX_CARAT = 10000; // Maximum carat value for formula scaling

// ============================================================================
// GEM EFFECT CONSTANTS - DIAMOND
// ============================================================================

const DIAMOND_DIGPOWER_MIN_BONUS = 1; // Minimum dig power bonus (%)
const DIAMOND_DIGPOWER_MAX_BONUS = 50; // Maximum dig power bonus (%)
const DIAMOND_DIGPOWER_CARAT_NORMALIZER = 2.5; // Normalization factor for carat values
const DIAMOND_DIGPOWER_MAX_CARAT = 10000; // Maximum carat value for formula scaling

// ============================================================================
// GEM EFFECT CONSTANTS - AMETHYST
// ============================================================================

const AMETHYST_RESEARCH_MIN_BONUS = 1; // Minimum research bonus (%)
const AMETHYST_RESEARCH_MAX_BONUS = 50; // Maximum research bonus (%)
const AMETHYST_RESEARCH_CARAT_NORMALIZER = 2.5; // Normalization factor for carat values
const AMETHYST_RESEARCH_MAX_CARAT = 10000; // Maximum carat value for formula scaling

// ============================================================================
// SMELTER CONSTANTS
// ============================================================================

const SMELTER_BASE_TEMPERATURE = 25; // Starting and minimum temperature
const SMELTER_MAX_TEMPERATURE_LIMIT = 1500; // Absolute maximum temperature
const SMELTER_COOLING_RATE = 0.0005; // 0.05% cooling per tick
const SMELTER_POLISH_BREAK_CHANCE = 0.05; // 5% base break chance when polishing

// Smelter task time requirements (in ticks)
const SMELTER_HEATING_TICKS_REQUIRED = 1; // Time to heat furnace
const SMELTER_BASIC_PROCESSING_TICKS_REQUIRED = 2; // Time for basic processing (drying mud)
const SMELTER_GRINDING_TICKS_REQUIRED = 5; // Time for grinding operations
const SMELTER_POLISHING_TICKS_REQUIRED = 10; // Time for stone polishing
const SMELTER_SOFT_METAL_TICKS_REQUIRED = 10; // Time for soft metal smelting (bronce, copper, zinc)
const SMELTER_ALLOY_TICKS_REQUIRED = 12; // Time for alloy creation
const SMELTER_IRON_TICKS_REQUIRED = 15; // Time for pig iron smelting
const SMELTER_STEEL_TICKS_REQUIRED = 20; // Time for iron and steel smelting
const SMELTER_HARDENED_STEEL_TICKS_REQUIRED = 22; // Time for hardened steel smelting
const SMELTER_DWARF_STEEL_TICKS_REQUIRED = 28; // Time for dwarfen steel smelting
const SMELTER_PRECIOUS_METAL_TICKS_REQUIRED = 30; // Time for precious metal smelting (silver, gold)
const SMELTER_ORE_ENRICHMENT_TICKS_REQUIRED = 35; // Time for exotic ore enrichment (wolfram, uranium, plutonium)

// Smelter difficulty system (wisdom-based reruns like research)
const SMELTER_WISDOM_PROBABILITY_BONUS = 2; // 2% success bonus per wisdom point
const SMELTER_MIN_SUCCESS_CHANCE = 0.25; // Minimum 25% success chance per attempt
const SMELTER_HARDNESS_DIVISOR = 8; // Divide material hardness by this to get smelting difficulty

// ============================================================================
// TASK PRIORITY CONSTANTS
// ============================================================================

const TASK_RESEARCH_CHANCE = 0.5; // 50% chance to do research/smelting instead of digging
const TASK_RESEARCH_SPLIT = 0.5; // 50/50 split between research and smelting

// ============================================================================
// FORGE CONSTANTS
// ============================================================================

const FORGE_BASE_QUALITY = 10; // Base quality before material hardness
const FORGE_HAMMERING_BONUS_PER_ITERATION = 8; // Quality bonus per hammering iteration
const FORGE_HAMMERING_SUCCESS_RATE = 0.90; // 90% success rate per hammering iteration
const FORGE_HAMMERING_MAX_ITERATIONS = 10; // Maximum hammering iterations
const FORGE_COOLING_BONUS_PER_QUALITY = 2; // Quality bonus per cooling oil quality point
const FORGE_COOLING_BASE_BRITTLE_CHANCE = 0.30; // 30% base chance of brittle failure
const FORGE_COOLING_BRITTLE_REDUCTION_PER_QUALITY = 0.012; // 1.2% brittle chance reduction per quality
const FORGE_COOLING_MAX_QUALITY = 25; // Maximum cooling oil quality
const FORGE_COOLING_BASE_COST = 500; // Base cost for quality 2+ cooling oil
const FORGE_COOLING_COST_MULTIPLIER = 1.25; // Cost multiplier per quality level
const FORGE_HANDLE_BONUS_PER_QUALITY = 1.5; // Quality bonus per handle quality point
const FORGE_HANDLE_MAX_QUALITY = 50; // Maximum handle quality
const FORGE_HANDLE_BASE_COST = 100; // Base cost for handle quality
const FORGE_HANDLE_COST_MULTIPLIER = 1.15; // Cost multiplier per quality level
const FORGE_SHARPENING_ITERATIONS = 3; // Fixed number of sharpening passes
const FORGE_SHARPENING_MIN_VARIANCE = -0.05; // -5% minimum sharpening variance
const FORGE_SHARPENING_MAX_VARIANCE = 0.20; // +20% maximum sharpening variance
const FORGE_SUCCESS_RATE_HIGH_THRESHOLD = 0.7; // 70% success rate threshold for "high" rating
const FORGE_SUCCESS_RATE_MEDIUM_THRESHOLD = 0.4; // 40% success rate threshold for "medium" rating

// ============================================================================
// TOOL CONSTANTS
// ============================================================================

const TOOL_LEVEL_BONUS = 0.1; // 10% bonus per tool level
const TOOL_UPGRADE_COST_MULTIPLIER = 2; // Cost doubles with each level

// ============================================================================
// ENCHANTING CONSTANTS
// ============================================================================

const ENCHANT_BASE_COST = 500; // Base gold cost for enchanting
const ENCHANT_COST_MULTIPLIER = 4; // Cost multiplier per enchantment level
const ENCHANT_POWER_BONUS = 0.08; // 8% power bonus per enchantment level

// ============================================================================
// GAME SYSTEM CONSTANTS
// ============================================================================

const STUCK_DETECTION_TICKS = 25; // Ticks before teleporting stuck dwarf
const FAILSAFE_CHECK_INTERVAL = 100; // Ticks between failsafe checks
const AUTO_REFRESH_INTERVAL = 2000; // Milliseconds for transaction modal refresh

// ============================================================================
// CHEAT MODE CONSTANTS
// ============================================================================

const CHEAT_GOLD_BONUS = 5000; // Gold added by cheat code
const CHEAT_DEPTH_MULTIPLIER = 2; // Depth multiplier for cheat code
