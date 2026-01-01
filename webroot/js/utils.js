// ============================================================================
// DIGGY DIGGY DWARF - SHARED UTILITIES
// ============================================================================
// This file contains helper functions shared between main.js and game-worker.js
// All functions should be pure (no side effects) where possible
// ============================================================================

// ============================================================================
// DWARF UTILITIES
// ============================================================================

/**
 * Get dwarf level, treating 0 as valid (level 0 is allowed)
 * @param {Object} dwarf - The dwarf object
 * @returns {number} The dwarf's level (0 or higher)
 */
function getDwarfLevel(dwarf) {
    return typeof dwarf.level === 'number' ? dwarf.level : 0;
}

// ============================================================================
// MATERIAL UTILITIES
// ============================================================================

/**
 * Get a material by its ID
 * @param {string} id - Material ID to look up
 * @returns {Object|null} Material object or null if not found
 */
function getMaterialById(id) {
    return materials[id] || null;
}

/**
 * Select a random material appropriate for the given depth level
 * @param {number} depthLevel - The depth level to select material for
 * @returns {string|null} Selected material ID
 */
function randomMaterial(depthLevel) {
    // Filter materials available at this depth
    const available = [];
    for (const [id, mat] of Object.entries(materials)) {
        const min = mat.minlevel || 0;
        const max = mat.maxlevel || Infinity;
        if (depthLevel >= min && depthLevel <= max && mat.probability > 0) {
            available.push({ id, ...mat });
        }
    }

    if (available.length === 0) {
        // Fallback to earth if nothing else is available
        return 'earth';
    }

    // Calculate total probability weight
    let totalProb = 0;
    for (const mat of available) {
        totalProb += (mat.probability || 0);
    }

    if (totalProb === 0) {
        // If all have zero probability, pick randomly
        return available[Math.floor(Math.random() * available.length)].id;
    }

    // Pick a weighted random material
    let rand = Math.random() * totalProb;
    for (const mat of available) {
        rand -= (mat.probability || 0);
        if (rand <= 0) return mat.id;
    }

    // Fallback to last material in list
    return available[available.length - 1].id;
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
    const gemMaterials = [];
    for (const [id, mat] of Object.entries(materials)) {
        if (mat.type === 'Gem' && mat.minlevel <= startX) {
            gemMaterials.push(id);
        }
    }
    if (gemMaterials.length === 0) return null;
    return gemMaterials[Math.floor(Math.random() * gemMaterials.length)];
}

/**
 * Calculate the probability that a Ruby gem prevents energy consumption
 * Formula uses logarithmic diminishing returns:
 * - Carat 1: ~5%
 * - Carat 25: ~10%
 * - Carat 100: ~50%
 * - Carat 1000: ~75%
 * - Carat 10000: ~79%
 * - Max: 80%
 * @param {number} carat - Total carat value of Ruby gems
 * @returns {number} Probability (0-80) as percentage
 */
function calculateRubyEnergyPreventionChance(carat) {
    if (carat <= 0) return 0;

    // Logarithmic formula with diminishing returns
    // probability = MIN + (MAX - MIN) * (log(1 + carat/NORM) / log(1 + MAX_CARAT/NORM))
    const normalizedCarat = carat / RUBY_ENERGY_CARAT_NORMALIZER;
    const maxNormalizedCarat = RUBY_ENERGY_MAX_CARAT / RUBY_ENERGY_CARAT_NORMALIZER;
    const logFactor = Math.log(1 + normalizedCarat) / Math.log(1 + maxNormalizedCarat);
    const probability = RUBY_ENERGY_MIN_CHANCE + (RUBY_ENERGY_MAX_CHANCE - RUBY_ENERGY_MIN_CHANCE) * logFactor;

    // Clamp to range [MIN, MAX]
    return Math.min(RUBY_ENERGY_MAX_CHANCE, Math.max(RUBY_ENERGY_MIN_CHANCE, probability));
}

/**
 * Check if Ruby gems prevent energy consumption for this action
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {boolean} True if energy consumption should be prevented
 */
function shouldRubyPreventEnergyConsumption(dwarf) {
    if (!dwarf.toolId) return false;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.gems || toolInstance.gems.length === 0) {
        return false;
    }

    // Sum up all Ruby carat values
    const totalRubyCarat = toolInstance.gems
        .filter(gem => gem.type == 'ruby')
        .reduce((sum, gem) => sum + gem.carat, 0);

    if (totalRubyCarat <= 0) {
        return false;
    }


    // Calculate prevention chance and roll
    const chance = calculateRubyEnergyPreventionChance(totalRubyCarat);
    const roll = Math.random() * 100;
    const prevented = roll < chance;

    return prevented;
}

/**
 * Calculate the critical strike chance multiplier from Emerald gems
 * Formula uses logarithmic diminishing returns:
 * - Carat 1: ~0.5 (50% increase)
 * - Carat 25: ~1.0 (100% increase)
 * - Carat 100: ~10.0 (1000% increase)
 * - Carat 1000: ~30.0 (3000% increase)
 * - Carat 10000: ~39.5 (3950% increase)
 * - Max: 40.0 (4000% increase)
 * @param {number} carat - Total carat value of Emerald gems
 * @returns {number} Multiplier for critical strike chance (0.5-40.0)
 */
function calculateEmeraldCritMultiplier(carat) {
    if (carat <= 0) return 0;

    // Logarithmic formula with diminishing returns
    // multiplier = MIN + (MAX - MIN) * (log(1 + carat/NORM) / log(1 + MAX_CARAT/NORM))
    const normalizedCarat = carat / EMERALD_CRIT_CARAT_NORMALIZER;
    const maxNormalizedCarat = EMERALD_CRIT_MAX_CARAT / EMERALD_CRIT_CARAT_NORMALIZER;
    const logFactor = Math.log(1 + normalizedCarat) / Math.log(1 + maxNormalizedCarat);
    const multiplier = EMERALD_CRIT_MIN_MULTIPLIER + (EMERALD_CRIT_MAX_MULTIPLIER - EMERALD_CRIT_MIN_MULTIPLIER) * logFactor;

    // Clamp to range [MIN, MAX]
    return Math.min(EMERALD_CRIT_MAX_MULTIPLIER, Math.max(EMERALD_CRIT_MIN_MULTIPLIER, multiplier));
}

/**
 * Get the Emerald-modified critical strike chance for a dwarf
 * @param {Object} dwarf - The dwarf performing the action
 * @param {number} baseCritChance - Base critical strike chance (0-1)
 * @returns {number} Modified critical strike chance with Emerald bonus (0-1)
 */
function getEmeraldModifiedCritChance(dwarf, baseCritChance) {
    if (!dwarf.toolId) return baseCritChance;
    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.gems || toolInstance.gems.length === 0) {
        return baseCritChance;
    }
    // Sum up all Emerald carat values
    const totalEmeraldCarat = toolInstance.gems
        .filter(gem => gem.type == 'emerald')
        .reduce((sum, gem) => sum + gem.carat, 0);
    if (totalEmeraldCarat <= 0) {
        return baseCritChance;
    }
    // Calculate the multiplier and apply it
    const multiplier = Math.max(1,calculateEmeraldCritMultiplier(totalEmeraldCarat)) / 100;
    return  baseCritChance * (1+multiplier);
}

/**
 * Calculate the strength bonus percentage from Sapphire gems
 * Formula uses logarithmic diminishing returns (1% to 50%)
 * @param {number} carat - Total carat value of Sapphire gems
 * @returns {number} Bonus percentage (1-50)
 */
function calculateSapphireStrengthBonus(carat) {
    if (carat <= 0) return 0;

    // Logarithmic formula with diminishing returns
    const normalizedCarat = carat / SAPPHIRE_STRENGTH_CARAT_NORMALIZER;
    const maxNormalizedCarat = SAPPHIRE_STRENGTH_MAX_CARAT / SAPPHIRE_STRENGTH_CARAT_NORMALIZER;
    const logFactor = Math.log(1 + normalizedCarat) / Math.log(1 + maxNormalizedCarat);
    const bonus = SAPPHIRE_STRENGTH_MIN_BONUS + (SAPPHIRE_STRENGTH_MAX_BONUS - SAPPHIRE_STRENGTH_MIN_BONUS) * logFactor;

    return Math.min(SAPPHIRE_STRENGTH_MAX_BONUS, Math.max(SAPPHIRE_STRENGTH_MIN_BONUS, bonus));
}

/**
 * Get the Sapphire-modified strength for a dwarf
 * @param {Object} dwarf - The dwarf
 * @param {number} baseStrength - Base strength value
 * @returns {number} Modified strength with Sapphire bonus
 */
function getSapphireModifiedStrength(dwarf, baseStrength) {
    if (!dwarf.toolId) return baseStrength;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.gems || toolInstance.gems.length === 0) {
        return baseStrength;
    }

    // Sum up all Sapphire carat values
    const totalSapphireCarat = toolInstance.gems
        .filter(gem => gem.type === 'sapphire')
        .reduce((sum, gem) => sum + gem.carat, 0);

    if (totalSapphireCarat <= 0) return baseStrength;

    // Calculate bonus and apply it
    const bonusPercent = calculateSapphireStrengthBonus(totalSapphireCarat);
    const modifiedStrength = baseStrength * (1 + bonusPercent / 100);

    // Log occasionally (1% chance)
    if (Math.random() < 0.01 && baseStrength > 0) {
        console.log(`💎 Sapphire Strength Boost! ${dwarf.name}'s ${totalSapphireCarat}-carat Sapphire increases strength from ${baseStrength.toFixed(1)} to ${modifiedStrength.toFixed(1)} (+${bonusPercent.toFixed(1)}%)`);
    }

    return modifiedStrength;
}

/**
 * Calculate the dig power bonus percentage from Diamond gems
 * Formula uses logarithmic diminishing returns (1% to 50%)
 * @param {number} carat - Total carat value of Diamond gems
 * @returns {number} Bonus percentage (1-50)
 */
function calculateDiamondDigPowerBonus(carat) {
    if (carat <= 0) return 0;

    // Logarithmic formula with diminishing returns
    const normalizedCarat = carat / DIAMOND_DIGPOWER_CARAT_NORMALIZER;
    const maxNormalizedCarat = DIAMOND_DIGPOWER_MAX_CARAT / DIAMOND_DIGPOWER_CARAT_NORMALIZER;
    const logFactor = Math.log(1 + normalizedCarat) / Math.log(1 + maxNormalizedCarat);
    const bonus = DIAMOND_DIGPOWER_MIN_BONUS + (DIAMOND_DIGPOWER_MAX_BONUS - DIAMOND_DIGPOWER_MIN_BONUS) * logFactor;

    return Math.min(DIAMOND_DIGPOWER_MAX_BONUS, Math.max(DIAMOND_DIGPOWER_MIN_BONUS, bonus));
}

/**
 * Get the Diamond-modified dig power for a dwarf
 * @param {Object} dwarf - The dwarf
 * @param {number} basePower - Base dig power value
 * @returns {number} Modified dig power with Diamond bonus
 */
function getDiamondModifiedDigPower(dwarf, basePower) {
    if (!dwarf.toolId) return basePower;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.gems || toolInstance.gems.length === 0) {
        return basePower;
    }

    // Sum up all Diamond carat values
    const totalDiamondCarat = toolInstance.gems
        .filter(gem => gem.type === 'diamond')
        .reduce((sum, gem) => sum + gem.carat, 0);

    if (totalDiamondCarat <= 0) return basePower;

    // Calculate bonus and apply it
    const bonusPercent = calculateDiamondDigPowerBonus(totalDiamondCarat);
    const modifiedPower = basePower * (1 + bonusPercent / 100);

    // Log occasionally (1% chance)
    if (Math.random() < 0.01 && basePower > 0) {
        console.log(`💎 Diamond Dig Power Boost! ${dwarf.name}'s ${totalDiamondCarat}-carat Diamond increases dig power from ${basePower.toFixed(1)} to ${modifiedPower.toFixed(1)} (+${bonusPercent.toFixed(1)}%)`);
    }

    return modifiedPower;
}

/**
 * Calculate the research bonus percentage from Amethyst gems
 * Formula uses logarithmic diminishing returns (1% to 50%)
 * @param {number} carat - Total carat value of Amethyst gems
 * @returns {number} Bonus percentage (1-50)
 */
function calculateAmethystResearchBonus(carat) {
    if (carat <= 0) return 0;

    // Logarithmic formula with diminishing returns
    const normalizedCarat = carat / AMETHYST_RESEARCH_CARAT_NORMALIZER;
    const maxNormalizedCarat = AMETHYST_RESEARCH_MAX_CARAT / AMETHYST_RESEARCH_CARAT_NORMALIZER;
    const logFactor = Math.log(1 + normalizedCarat) / Math.log(1 + maxNormalizedCarat);
    const bonus = AMETHYST_RESEARCH_MIN_BONUS + (AMETHYST_RESEARCH_MAX_BONUS - AMETHYST_RESEARCH_MIN_BONUS) * logFactor;

    return Math.min(AMETHYST_RESEARCH_MAX_BONUS, Math.max(AMETHYST_RESEARCH_MIN_BONUS, bonus));
}

/**
 * Get the Amethyst hardness reduction for a dwarf
 * @param {Object} dwarf - The dwarf
 * @returns {number} Hardness reduction from Amethyst gems
 */
function getAmethystHardnessReduction(dwarf) {
    if (!dwarf.toolId) return 0;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.gems || toolInstance.gems.length === 0) {
        return 0;
    }

    // Sum up all Amethyst carat values
    const totalAmethystCarat = toolInstance.gems
        .filter(gem => gem.type === 'amethyst')
        .reduce((sum, gem) => sum + gem.carat, 0);

    if (totalAmethystCarat <= 0) return 0;

    // Hardness reduction: carat / 100
    return totalAmethystCarat / 100;
}

/**
 * Get the Amethyst-modified research points for a dwarf
 * @param {Object} dwarf - The dwarf
 * @param {number} baseResearchPoints - Base research points value
 * @returns {number} Modified research points with Amethyst bonus
 * @deprecated This function is deprecated. Use getAmethystHardnessReduction instead.
 */
function getAmethystModifiedResearchPoints(dwarf, baseResearchPoints) {
    // Amethyst no longer modifies research points, it reduces hardness instead
    // Keeping this function for backward compatibility, but it just returns the base value
    return baseResearchPoints;
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
    return researchData[researchId] || null;
}

/**
 * Get the current level of a research
 * @param {string} researchId - Research ID to look up
 * @returns {number} Current research level (0 if not found or not researched)
 */
function getResearchLevel(researchId) {
    const research = researchData[researchId];
    return research ? (research.level || 0) : 0;
}

/**
 * Get the highest wisdom level among all dwarfs
 * @returns {number} Highest wisdom level (0 if no dwarfs)
 */
function getHighestDwarfWisdom() {
    if (!dwarfs || dwarfs.length === 0) return 0;
    return Math.max(...dwarfs.map(d => d.wisdom || 0));
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
 * Calculate the bucket capacity for a dwarf (in kg)
 * Base capacity: 50kg
 * Strength bonus: +5kg per strength point
 * Research bonus: +5% per research level
 * @param {Object} dwarf - The dwarf to calculate capacity for
 * @returns {number} Total bucket capacity in kg
 */
function calculateDwarfBucketCapacity(dwarf) {
    const baseCapacity = 50; // Base capacity in kg
    const baseStrength = dwarf.strength || 0;
    const modifiedStrength = getSapphireModifiedStrength(dwarf, baseStrength);
    const strengthBonus = Math.floor(modifiedStrength) * 5; // 5kg per strength point

    const bucketResearchLevel = getResearchLevel('buckets');
    const researchMultiplier = 1 + (bucketResearchLevel * 0.05); // 5% per level

    return Math.floor((baseCapacity + strengthBonus) * researchMultiplier);
}

/**
 * Calculate the current weight of materials in a dwarf's bucket
 * @param {Object} bucket - The bucket object with material counts
 * @returns {number} Total weight in kg
 */
function calculateBucketWeight(bucket) {
    if (!bucket || Object.keys(bucket).length === 0) return 0;

    let totalWeight = 0;
    for (const [materialId, count] of Object.entries(bucket)) {
        const material = materials[materialId];
        if (material && material.weight) {
            totalWeight += material.weight * count;
        }
    }
    return totalWeight;
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
    const level = getDwarfLevel(dwarf);
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
    const taskId = smelterTasks.find(id => smelterTasksData[id].type === 'gem-cutting');
    return taskId ? smelterTasksData[taskId] : null;
}

/**
 * Get ticks required for gem cutting from task definition
 * @returns {number} Ticks required (defaults to 250 if not found)
 */
function getGemCuttingTicksRequired() {
    const task = getGemCuttingTask();
    return task ? (task.ticksRequired || 250) : 250;
}

/**
 * Check if there are enough materials in stock for a smelter task
 * Handles both single input and multiple inputs (alloys)
 * @param {Object} task - The smelter task to check
 * @param {Object} materialsStock - The materials stock object
 * @returns {boolean} True if all required materials are available
 */
function hasMaterialsForTask(task, materialsStock) {
    // Handle multiple inputs (alloy format)
    if (task.inputs && Array.isArray(task.inputs)) {
        return task.inputs.every(input => {
            const stock = materialsStock[input.material] || 0;
            return stock >= input.amount;
        });
    }

    // Handle single input (legacy format)
    if (task.input && task.input.material && task.input.amount) {
        const stock = materialsStock[task.input.material] || 0;
        return stock >= task.input.amount;
    }

    // No input requirements (e.g., gem cutting, do nothing)
    return true;
}

/**
 * Count the number of actionable smelter tasks (tasks that can be performed right now)
 * @returns {number} Number of actionable tasks
 */
function countActionableSmelterTasks() {
    // Find "do-nothing" index to exclude unreachable tasks
    const doNothingIndex = smelterTasks.findIndex(id => id === 'do-nothing');
    let count = 0;

    for (let i = 0; i < smelterTasks.length; i++) {
        const taskId = smelterTasks[i];

        // Skip if task is unreachable (below "do-nothing")
        if (doNothingIndex >= 0 && i > doNothingIndex && taskId !== 'do-nothing') {
            continue;
        }

        // Skip "do-nothing" task itself
        if (taskId === 'do-nothing') {
            continue;
        }

        const task = smelterTasksData[taskId];
        if (!task) continue;

        // Check if task is unlocked
        const isUnlocked = !task.requires || (researchData[task.requires]?.level || 0) >= 1;
        if (!isUnlocked) continue;

        // Check if task is actionable
        let isActionable = false;

        if (task.type === 'gem-cutting') {
            // For gem cutting, check if there are gems marked for cutting
            const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
            isActionable = !!gemToProcess;
        } else {
            // Check materials
            const hasMaterials = hasMaterialsForTask(task, materialsStock);

            // For heating tasks, check temperature requirements
            if (task.type === 'heating') {
                if (task.heatGain === 'dynamic') {
                    // Magma: check against magma min
                    isActionable = hasMaterials && (smelterTemperature < smelterMagmaMinTemp);
                } else {
                    // Coal: use smelterHeatingMode for accurate status
                    isActionable = hasMaterials && smelterHeatingMode;
                }
            } else if (task.minTemp) {
                // For smelting tasks with temp requirements
                isActionable = hasMaterials && (smelterTemperature >= task.minTemp);
            } else {
                isActionable = hasMaterials;
            }
        }

        if (isActionable) {
            count++;
        }
    }

    return count;
}

// ============================================================================
// PLATING EFFECT UTILITIES
// ============================================================================

/**
 * Get the energy cost reduction from Zinc plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Energy cost reduction amount (default 0)
 */
function getZincPlatingEnergyReduction(dwarf) {
    if (!dwarf.toolId) return 0;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.plating) {
        return 0;
    }

    // Check if the tool has Zinc plating
    if (toolInstance.plating === 'Zinc') {
        // Zinc plating reduces energy consumption by 2 (as defined in defs.js platingEffects)
        const energyReduction = 2;
        console.log(`[Zinc Plating] ${dwarf.name}'s tool has Zinc plating - reducing energy cost by ${energyReduction}`);
        return energyReduction;
    }

    return 0;
}

/**
 * Get the gem spawn probability multiplier from Silver plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Gem probability multiplier (default 1.0)
 */
function getSilverPlatingGemMultiplier(dwarf) {
    if (!dwarf.toolId) return 1.0;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.plating) {
        return 1.0;
    }

    // Check if the tool has Silver plating
    if (toolInstance.plating === 'Silver') {
        // Silver plating increases gem probability by 1.4x (as defined in defs.js platingEffects)
        const gemMultiplier = 1.40;
        console.log(`[Silver Plating] ${dwarf.name}'s tool has Silver plating - gem probability multiplied by ${gemMultiplier}x`);
        return gemMultiplier;
    }

    return 1.0;
}

/**
 * Get the critical strike chance multiplier from Gold plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Critical strike multiplier (default 1.0)
 */
function getGoldPlatingCritMultiplier(dwarf) {
    if (!dwarf.toolId) return 1.0;

    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance || !toolInstance.plating) {
        return 1.0;
    }

    // Check if the tool has Gold plating
    if (toolInstance.plating === 'Gold') {
        // Gold plating increases critical strike chance by 1.1x (as defined in defs.js platingEffects)
        const critMultiplier = 1.10;
        console.log(`[Gold Plating] ${dwarf.name}'s tool has Gold plating - critical strike chance multiplied by ${critMultiplier}x`);
        return critMultiplier;
    }

    return 1.0;
}

// ============================================================================
// ENERGY CONSUMPTION UTILITIES
// ============================================================================

/**
 * Apply energy consumption to a dwarf, accounting for Ruby gem prevention and Zinc plating reduction
 * This centralizes the energy consumption logic to avoid duplication across different actions
 * @param {Object} dwarf - The dwarf performing the action
 * @param {number} baseCost - Base energy cost for the action (from constants.js)
 */
function applyEnergyConsumption(dwarf, baseCost) {
    // Check Ruby gem effect - may completely prevent energy consumption
    if (!shouldRubyPreventEnergyConsumption(dwarf)) {
        // Apply Zinc plating reduction
        const zincReduction = getZincPlatingEnergyReduction(dwarf);
        const energyCost = Math.max(1, baseCost - zincReduction);
        dwarf.energy = Math.max(0, dwarf.energy - energyCost);
    }
}

// ============================================================================
// CRITICAL HIT UTILITIES
// ============================================================================

/**
 * Calculate the final critical hit chance for a dwarf, accounting for all modifiers
 * This centralizes critical hit calculation to avoid duplication across different actions
 *
 * Calculation order:
 * 1. Base chance from constants (CRITICAL_HIT_BASE_CHANCE = 2%)
 * 2. Material Science research bonus (+5% per level)
 * 3. Emerald gem modifier (multiplicative bonus based on carat)
 * 4. Gold plating modifier (+10% multiplicative bonus)
 *
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Final critical hit chance as a decimal (0-1)
 */
function calculateFinalCritChance(dwarf) {
    // Get material science research level
    const materialScience = researchData['material-science'];
    const baseCritChance = CRITICAL_HIT_BASE_CHANCE + ((materialScience ? materialScience.level : 0) * RESEARCH_MATERIAL_SCIENCE_CRIT_BONUS);

    // Apply Emerald gem modifier
    let critChance = getEmeraldModifiedCritChance(dwarf, baseCritChance);

    // Apply Gold plating multiplier
    critChance *= getGoldPlatingCritMultiplier(dwarf);

    return critChance;
}
