// ============================================================================
// DIGGY DIGGY DWARF - SHARED UTILITIES
// ============================================================================
// This file contains helper functions shared between main.js and game-worker.js
// All functions should be pure (no side effects) where possible
// ============================================================================

// ============================================================================
// MATERIAL UTILITIES
// ============================================================================

/**
 * Get a material by its ID
 * @param {string} id - Material ID to look up
 * @returns {Object|null} Material object or null if not found
 */
function getMaterialById(id) {
    return materials.find(m => m.id === id) || null;
}

/**
 * Select a random material appropriate for the given depth level
 * @param {number} depthLevel - The depth level to select material for
 * @returns {Object|null} Selected material object
 */
function randomMaterial(depthLevel) {
    // Filter materials available at this depth
    const available = materials.filter(mat => {
        const min = mat.minlevel || 0;
        const max = mat.maxlevel || Infinity;
        return depthLevel >= min && depthLevel <= max && mat.probability > 0;
    });

    if (available.length === 0) {
        // Fallback to earth if nothing else is available
        return materials.find(m => m.id === 'earth') || null;
    }

    // Calculate total probability weight
    let totalProb = 0;
    for (const mat of available) {
        totalProb += (mat.probability || 0);
    }

    if (totalProb === 0) {
        // If all have zero probability, pick randomly
        return available[Math.floor(Math.random() * available.length)];
    }

    // Pick a weighted random material
    let rand = Math.random() * totalProb;
    for (const mat of available) {
        rand -= (mat.probability || 0);
        if (rand <= 0) return mat;
    }

    // Fallback to last material in list
    return available[available.length - 1];
}

/**
 * Extract base material name (removes " Ingot" suffix)
 * @param {string} name - Material name
 * @returns {string} Base name without suffix
 */
function extractMaterialBaseName(name) {
    return name.replace(' Ingot', '');
}

// ============================================================================
// GEM UTILITIES
// ============================================================================

/**
 * Randomly select a gem from the available gems defined in materials
 * @returns {string|null} Gem material ID or null if no gems available
 */
function selectRandomGem() {
    const gemMaterials = materials.filter(m => m.type === 'Gem');
    if (gemMaterials.length === 0) return null;
    return gemMaterials[Math.floor(Math.random() * gemMaterials.length)].id;
}

// ============================================================================
// RESEARCH UTILITIES
// ============================================================================

/**
 * Get a research by its ID
 * @param {string} researchId - Research ID to look up
 * @returns {Object|null} Research object or null if not found
 */
function getResearch(researchId) {
    return researchtree.find(r => r.id === researchId) || null;
}

/**
 * Get the current level of a research
 * @param {string} researchId - Research ID to look up
 * @returns {number} Current research level (0 if not found or not researched)
 */
function getResearchLevel(researchId) {
    const research = getResearch(researchId);
    return research ? (research.level || 0) : 0;
}

/**
 * Calculate the cost for a research at a specific level
 * @param {number} baseCost - Base cost of the research
 * @param {number} targetLevel - Target level to calculate cost for
 * @returns {number} Calculated cost for that level
 */
function calculateResearchCost(baseCost, targetLevel) {
    return Math.round(baseCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
}

/**
 * Check if a smelter task is unlocked by research
 * @param {Object} task - Smelter task to check
 * @returns {boolean} True if unlocked, false otherwise
 */
function isSmelterTaskUnlocked(task) {
    if (!task.requires) return true; // No requirement, always unlocked
    const requiredResearch = getResearch(task.requires);
    if (!requiredResearch) return true; // Research not found, assume unlocked
    return (requiredResearch.level || 0) > 0;
}

// ============================================================================
// DWARF UTILITIES
// ============================================================================

/**
 * Calculate the bucket capacity for a dwarf
 * @param {Object} dwarf - The dwarf to calculate capacity for
 * @returns {number} Total bucket capacity
 */
function calculateDwarfBucketCapacity(dwarf) {
    const bucketBonus = getResearchLevel('buckets');
    const dwarfStrength = dwarf.strength || 0;
    return bucketCapacity + bucketBonus + dwarfStrength;
}

/**
 * Calculate XP gain from material hardness
 * @param {number} hardness - Material hardness value
 * @returns {number} XP to award
 */
function calculateXPFromHardness(hardness) {
    return Math.ceil(Math.sqrt(hardness));
}

/**
 * Calculate wage for a dwarf based on level and research
 * @param {Object} dwarf - The dwarf to calculate wage for
 * @returns {number} Wage amount
 */
function calculateWage(dwarf) {
    const level = dwarf.level || 1;
    const wageOptimization = getResearchLevel('wage-optimization');

    // Start with base wage
    let wage = DWARF_BASE_WAGE;

    // Calculate wage increase rate (18% per level, reduced by 1% per research level)
    const increaseRate = DWARF_WAGE_INCREASE_RATE - (wageOptimization * RESEARCH_WAGE_OPTIMIZATION_REDUCTION);
    const clampedRate = Math.max(DWARF_WAGE_INCREASE_MIN, increaseRate);

    // Apply increase for each level above 1
    for (let i = 1; i < level; i++) {
        wage += wage * clampedRate;
    }

    return wage;
}

/**
 * Check if player can afford wage, or if dwarf will strike
 * @param {Object} dwarf - The dwarf to check for
 * @param {number} currentGold - Current gold amount
 * @returns {Object} {canPay: boolean, willStrike: boolean, wage: number}
 */
function checkCanAffordWageOrStrike(dwarf, currentGold) {
    const wage = calculateWage(dwarf);

    if (currentGold >= wage) {
        return { canPay: true, willStrike: false, wage };
    }

    // Can't afford - check strike chance
    const unionBusting = getResearchLevel('union-busting');
    const strikeReduction = unionBusting * RESEARCH_UNION_BUSTING_BONUS;
    const strikeChance = Math.max(0, DWARF_STRIKE_BASE_CHANCE - strikeReduction);
    const willStrike = Math.random() > strikeChance;

    return { canPay: false, willStrike, wage };
}

// ============================================================================
// SMELTER UTILITIES
// ============================================================================

/**
 * Get the gem cutting task from smelter tasks
 * @returns {Object|null} Gem cutting task or null if not found
 */
function getGemCuttingTask() {
    return smelterTasks.find(t => t.type === 'gem-cutting') || null;
}

/**
 * Get ticks required for gem cutting from task definition
 * @returns {number} Ticks required (defaults to 250 if not found)
 */
function getGemCuttingTicksRequired() {
    const task = getGemCuttingTask();
    return task ? (task.ticksRequired || 250) : 250;
}
