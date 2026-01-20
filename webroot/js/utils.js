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
 * Get the dwarf's equipped tool instance
 * @param {Object} dwarf - The dwarf object
 * @returns {Object|null} Tool instance or null if no tool equipped
 */
function getDwarfToolInstance(dwarf) {
    if (!dwarf.toolId) return null;
    return toolsInventory.find(t => t.id === dwarf.toolId) || null;
}

/**
 * Get total carat value for a specific gem type from a dwarf's tool
 * @param {Object} dwarf - The dwarf object
 * @param {string} gemType - The gem type to sum (e.g., 'ruby', 'emerald')
 * @returns {number} Total carat value for that gem type
 */
function getGemCaratTotal(dwarf, gemType) {
    const toolInstance = getDwarfToolInstance(dwarf);
    if (!toolInstance || !toolInstance.gems || toolInstance.gems.length === 0) {
        return 0;
    }
    return toolInstance.gems
        .filter(gem => gem.type === gemType)
        .reduce((sum, gem) => sum + gem.carat, 0);
}

/**
 * Calculate a logarithmic bonus with diminishing returns
 * @param {number} value - The input value (e.g., carat)
 * @param {number} minResult - Minimum result value
 * @param {number} maxResult - Maximum result value
 * @param {number} normalizer - Normalizer constant for scaling
 * @param {number} maxValue - Maximum input value for scaling
 * @returns {number} Calculated bonus clamped to [minResult, maxResult]
 */
function calculateLogarithmicBonus(value, minResult, maxResult, normalizer, maxValue) {
    if (value <= 0) return 0;
    const normalizedValue = value / normalizer;
    const maxNormalizedValue = maxValue / normalizer;
    const logFactor = Math.log(1 + normalizedValue) / Math.log(1 + maxNormalizedValue);
    const result = minResult + (maxResult - minResult) * logFactor;
    return Math.min(maxResult, Math.max(minResult, result));
}

/**
 * Get a plating effect value from a dwarf's tool
 * @param {Object} dwarf - The dwarf object
 * @param {string} platingName - The plating type (e.g., 'zinc', 'silver')
 * @param {number} defaultValue - Default value if no matching plating
 * @param {string} [effectKey='value'] - The key in platingEffects to retrieve
 * @returns {number} The plating effect value or default
 */
function getPlatingEffectValue(dwarf, platingName, defaultValue, effectKey = 'value') {
    const toolInstance = getDwarfToolInstance(dwarf);
    if (!toolInstance || !toolInstance.plating) {
        return defaultValue;
    }
    // Normalize plating name comparison (handle case variations)
    const toolPlating = toolInstance.plating.toLowerCase();
    if (toolPlating === platingName.toLowerCase()) {
        return platingEffects[platingName]?.[effectKey] ?? defaultValue;
    }
    return defaultValue;
}

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
 * Uses logarithmic diminishing returns (see calculateLogarithmicBonus)
 * @param {number} carat - Total carat value of Ruby gems
 * @returns {number} Probability (0-80) as percentage
 */
function calculateRubyEnergyPreventionChance(carat) {
    return calculateLogarithmicBonus(carat, RUBY_ENERGY_MIN_CHANCE, RUBY_ENERGY_MAX_CHANCE, RUBY_ENERGY_CARAT_NORMALIZER, RUBY_ENERGY_MAX_CARAT);
}

/**
 * Check if Ruby gems prevent energy consumption for this action
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {boolean} True if energy consumption should be prevented
 */
function shouldRubyPreventEnergyConsumption(dwarf) {
    const totalRubyCarat = getGemCaratTotal(dwarf, 'ruby');
    if (totalRubyCarat <= 0) return false;

    const chance = calculateRubyEnergyPreventionChance(totalRubyCarat);
    return Math.random() * 100 < chance;
}

/**
 * Calculate the critical strike chance multiplier from Emerald gems
 * Uses logarithmic diminishing returns (see calculateLogarithmicBonus)
 * @param {number} carat - Total carat value of Emerald gems
 * @returns {number} Multiplier for critical strike chance (0.5-40.0)
 */
function calculateEmeraldCritMultiplier(carat) {
    return calculateLogarithmicBonus(carat, EMERALD_CRIT_MIN_MULTIPLIER, EMERALD_CRIT_MAX_MULTIPLIER, EMERALD_CRIT_CARAT_NORMALIZER, EMERALD_CRIT_MAX_CARAT);
}

/**
 * Get the Emerald-modified critical strike chance for a dwarf
 * @param {Object} dwarf - The dwarf performing the action
 * @param {number} baseCritChance - Base critical strike chance (0-1)
 * @returns {number} Modified critical strike chance with Emerald bonus (0-1)
 */
function getEmeraldModifiedCritChance(dwarf, baseCritChance) {
    const totalEmeraldCarat = getGemCaratTotal(dwarf, 'emerald');
    if (totalEmeraldCarat <= 0) return baseCritChance;

    const multiplier = Math.max(1, calculateEmeraldCritMultiplier(totalEmeraldCarat)) / 100;
    return baseCritChance * (1 + multiplier);
}

/**
 * Calculate the strength bonus percentage from Sapphire gems
 * Uses logarithmic diminishing returns (see calculateLogarithmicBonus)
 * @param {number} carat - Total carat value of Sapphire gems
 * @returns {number} Bonus percentage (1-50)
 */
function calculateSapphireStrengthBonus(carat) {
    return calculateLogarithmicBonus(carat, SAPPHIRE_STRENGTH_MIN_BONUS, SAPPHIRE_STRENGTH_MAX_BONUS, SAPPHIRE_STRENGTH_CARAT_NORMALIZER, SAPPHIRE_STRENGTH_MAX_CARAT);
}

/**
 * Get the Sapphire-modified strength for a dwarf
 * @param {Object} dwarf - The dwarf
 * @param {number} baseStrength - Base strength value
 * @returns {number} Modified strength with Sapphire bonus
 */
function getSapphireModifiedStrength(dwarf, baseStrength) {
    const totalSapphireCarat = getGemCaratTotal(dwarf, 'sapphire');
    if (totalSapphireCarat <= 0) return baseStrength;

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
 * Uses logarithmic diminishing returns (see calculateLogarithmicBonus)
 * @param {number} carat - Total carat value of Diamond gems
 * @returns {number} Bonus percentage (1-50)
 */
function calculateDiamondDigPowerBonus(carat) {
    return calculateLogarithmicBonus(carat, DIAMOND_DIGPOWER_MIN_BONUS, DIAMOND_DIGPOWER_MAX_BONUS, DIAMOND_DIGPOWER_CARAT_NORMALIZER, DIAMOND_DIGPOWER_MAX_CARAT);
}

/**
 * Get the Diamond-modified dig power for a dwarf
 * @param {Object} dwarf - The dwarf
 * @param {number} basePower - Base dig power value
 * @returns {number} Modified dig power with Diamond bonus
 */
function getDiamondModifiedDigPower(dwarf, basePower) {
    const totalDiamondCarat = getGemCaratTotal(dwarf, 'diamond');
    if (totalDiamondCarat <= 0) return basePower;

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
 * Uses logarithmic diminishing returns (see calculateLogarithmicBonus)
 * @param {number} carat - Total carat value of Amethyst gems
 * @returns {number} Bonus percentage (1-50)
 */
function calculateAmethystResearchBonus(carat) {
    return calculateLogarithmicBonus(carat, AMETHYST_RESEARCH_MIN_BONUS, AMETHYST_RESEARCH_MAX_BONUS, AMETHYST_RESEARCH_CARAT_NORMALIZER, AMETHYST_RESEARCH_MAX_CARAT);
}

/**
 * Get the Amethyst hardness reduction for a dwarf
 * @param {Object} dwarf - The dwarf
 * @returns {number} Hardness reduction from Amethyst gems
 */
function getAmethystHardnessReduction(dwarf) {
    const totalAmethystCarat = getGemCaratTotal(dwarf, 'amethyst');
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
// MATERIAL CATEGORIZATION UTILITIES
// ============================================================================

/**
 * Get a set of material IDs that are used as smelter inputs (craftable materials)
 * @returns {Set<string>} Set of material IDs that are smelter inputs
 */
function getSmelterInputMaterials() {
    const smelterInputMaterials = new Set();
    for (const taskId of smelterTasks) {
        const task = smelterTasksData[taskId];
        if (task && task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
        }
        if (task && task.inputs && Array.isArray(task.inputs)) {
            task.inputs.forEach(input => smelterInputMaterials.add(input.material));
        }
    }
    return smelterInputMaterials;
}

/**
 * Calculate total quantity of non-craftable materials in stock
 * Non-craftable materials are those that are NOT:
 * - Used as smelter inputs
 * - Ingots (used in forge)
 * - Gems
 * @param {Object} materialsStock - The materials stock object
 * @returns {number} Total quantity of non-craftable materials
 */
function calculateNonCraftableMaterialsTotal(materialsStock) {
    const smelterInputMaterials = getSmelterInputMaterials();
    let totalNonCraftables = 0;

    for (const [materialId, quantity] of Object.entries(materialsStock)) {
        const mat = materials[materialId];
        if (!mat) continue;

        const materialType = mat.type || '';

        // Skip materials that are used as smelter inputs or forge inputs (ingots) or gems
        if (smelterInputMaterials.has(materialId)) continue;
        if (materialType.startsWith('Ingot')) continue;
        if (materialType.startsWith('Gem')) continue;

        totalNonCraftables += quantity;
    }

    return totalNonCraftables;
}

/**
 * Calculate total trade bonus (trading research + price negotiations)
 * @param {Object} researchData - Research data object
 * @param {Array} dwarfs - Array of dwarf objects
 * @returns {number} Total trade bonus multiplier
 */
function calculateTradeBonus(researchData, dwarfs) {
    // Trading research bonus
    const tradeBonus = researchData['trading'] ? 1 + (researchData['trading'].level || 0) * RESEARCH_TRADING_BONUS : 1;

    // Price negotiations bonus (1% per wisdom level of highest wisdom dwarf)
    const priceNegotiationsLevel = researchData['price-negotiations']?.level || 0;
    let negotiationsBonus = 1;
    if (priceNegotiationsLevel > 0) {
        let highestWisdom = 0;
        for (const d of dwarfs) {
            if ((d.wisdom || 0) > highestWisdom) {
                highestWisdom = d.wisdom || 0;
            }
        }
        negotiationsBonus = 1 + highestWisdom * RESEARCH_PRICE_NEGOTIATIONS_BONUS;
    }

    return tradeBonus * negotiationsBonus;
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
    return getPlatingEffectValue(dwarf, 'zinc', 0);
}

/**
 * Get the gem spawn probability multiplier from Silver plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Gem probability multiplier (default 1.0)
 */
function getSilverPlatingGemMultiplier(dwarf) {
    return getPlatingEffectValue(dwarf, 'silver', 1.0);
}

/**
 * Get the critical strike chance multiplier from Gold plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Critical strike multiplier (default 1.0)
 */
function getGoldPlatingCritMultiplier(dwarf) {
    return getPlatingEffectValue(dwarf, 'gold', 1.0);
}

/**
 * Get the one-hit kill chance multiplier from Uranium plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} One-hit kill chance multiplier (default 1.0)
 */
function getUraniumPlatingOneHitMultiplier(dwarf) {
    return getPlatingEffectValue(dwarf, 'uranium', 1.0);
}

/**
 * Get the energy regeneration amount from Nickel plating when moving
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Energy regeneration amount (default 0)
 */
function getNickelPlatingEnergyRegeneration(dwarf) {
    return getPlatingEffectValue(dwarf, 'nickel', 0);
}

/**
 * Get the double dig chance from Wolfram plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Double dig chance (default 0)
 */
function getWolframPlatingDoubleDigChance(dwarf) {
    return getPlatingEffectValue(dwarf, 'wolfram', 0);
}

/**
 * Get the one-hit kill chance multiplier from Plutonium plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} One-hit kill chance multiplier (default 1.0)
 */
function getPlutoniumPlatingOneHitMultiplier(dwarf) {
    return getPlatingEffectValue(dwarf, 'plutonium', 1.0);
}

/**
 * Check if Plutonium plating should trigger a nuclear explosion
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {boolean} True if nuclear explosion should occur
 */
function shouldPlutoniumTriggerExplosion(dwarf) {
    const explosionChance = getPlatingEffectValue(dwarf, 'plutonium', 0, 'explosionChance');
    if (explosionChance <= 0) return false;

    const roll = Math.random();
    const triggered = roll < explosionChance;
    console.log(`☢️ [Plutonium] Nuclear explosion roll: ${(roll * 100).toFixed(1)}% ${triggered ? '✅ TRIGGERED!' : '❌ No explosion'}`);
    return triggered;
}

/**
 * Check if dwarf has Randomium plating
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {boolean} True if dwarf has Randomium plating
 */
function hasRandomiumPlating(dwarf) {
    const toolInstance = getDwarfToolInstance(dwarf);
    return toolInstance?.plating?.toLowerCase() === 'randomium';
}

/**
 * Get a random ore that can spawn at the given depth
 * @param {number} depth - Current mining depth
 * @returns {string|null} Material ID of a random ore, or null if none available
 */
function getRandomOreAtDepth(depth) {
    const availableOres = [];
    for (const [materialId, materialData] of Object.entries(materials)) {
        if (materialData.type && materialData.type.includes('Ore')) {
            const minLevel = materialData.minlevel || 0;
            const maxLevel = materialData.maxlevel || 999999;
            if (depth >= minLevel && depth <= maxLevel) {
                availableOres.push(materialId);
            }
        }
    }
    if (availableOres.length === 0) return null;
    return availableOres[Math.floor(Math.random() * availableOres.length)];
}

/**
 * Get a smelted material output for a given ore (from unlocked smelter recipes)
 * @param {string} oreId - The ore material ID
 * @returns {string|null} Material ID of the smelted output, or null if no recipe unlocked
 */
function getSmeltedOutputForOre(oreId) {
    // Search smelter tasks for recipes that use this ore as input
    for (const taskId of smelterTasks) {
        const task = smelterTasksData[taskId];
        if (!task || !task.input || !task.output) continue;

        // Check if task requires research and if it's unlocked
        if (task.requires) {
            const research = researchData[task.requires];
            if (!research || research.level < 1) continue;
        }

        // Check if this task uses the ore as input
        if (task.input.material === oreId) {
            return task.output.material;
        }
    }
    return null;
}

/**
 * Apply a random other plating effect (excluding randomium)
 * @param {Object} dwarf - The dwarf performing the action
 * @param {Object} context - Context with cell, depth, etc.
 * @returns {Object|null} Effect result or null
 */
function applyRandomPlatingEffect(dwarf, context) {
    // Get all plating effects except randomium
    const otherPlatings = Object.keys(platingEffects).filter(p => p !== 'randomium');
    if (otherPlatings.length === 0) return null;

    const randomPlating = otherPlatings[Math.floor(Math.random() * otherPlatings.length)];
    const effect = platingEffects[randomPlating];

    console.log(`🎲 [Randomium] Triggering random plating effect: ${effect.name}`);

    return { plating: randomPlating, effect: effect };
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

/**
 * Apply energy change for movement, accounting for Nickel plating regeneration
 * Nickel plating causes movement to regenerate energy instead of consuming it
 * @param {Object} dwarf - The dwarf performing the movement
 * @param {number} baseCost - Base energy cost for movement (from constants.js)
 */
function applyMovementEnergy(dwarf, baseCost) {
    // Check for Nickel plating - regenerates energy instead of consuming
    const nickelRegen = getNickelPlatingEnergyRegeneration(dwarf);

    if (nickelRegen > 0) {
        // Nickel plating: regenerate energy instead of consuming
        // Cap at max energy (stored directly on dwarf object)
        const maxEnergy = dwarf.maxEnergy || 100;
        dwarf.energy = Math.min(maxEnergy, dwarf.energy + nickelRegen);
    } else {
        // Normal movement: consume energy (with Ruby gem prevention and Zinc plating reduction)
        applyEnergyConsumption(dwarf, baseCost);
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

// ============================================================================
// FURNITURE BONUS UTILITIES
// ============================================================================

/**
 * Calculate total furniture bonuses for a dwarf based on common room and their individual room
 * @param {Object} dwarf - The dwarf to calculate bonuses for
 * @returns {Object} Object containing all furniture bonuses (restBonus, maxEnergyBonus, digPowerBonus, critChanceBonus, strengthBonus, wisdomBonus)
 */
function calculateFurnitureBonuses(dwarf) {
    const bonuses = {
        restBonus: 0,           // Additive percentage bonus to rest recovery
        maxEnergyBonus: 0,      // Flat bonus to max energy
        digPowerBonus: 0,       // Additive percentage bonus to dig power
        critChanceBonus: 0,     // Additive bonus to crit chance
        strengthBonus: 0,       // Flat bonus to strength
        wisdomBonus: 0          // Flat bonus to wisdom
    };

    // Add bonuses from common room furniture (applies to all dwarfs)
    if (typeof commonRoom !== 'undefined' && commonRoom && commonRoom.furniture) {
        for (const furnitureId in commonRoom.furniture) {
            const furnitureLevel = commonRoom.furniture[furnitureId]?.level || 0;
            if (furnitureLevel > 0 && furnitureData[furnitureId]) {
                const effect = furnitureData[furnitureId].effect;
                if (effect) {
                    if (effect.restBonus) bonuses.restBonus += effect.restBonus * furnitureLevel;
                    if (effect.maxEnergyBonus) bonuses.maxEnergyBonus += effect.maxEnergyBonus * furnitureLevel;
                    if (effect.digPowerBonus) bonuses.digPowerBonus += effect.digPowerBonus * furnitureLevel;
                    if (effect.critChanceBonus) bonuses.critChanceBonus += effect.critChanceBonus * furnitureLevel;
                    if (effect.strengthBonus) bonuses.strengthBonus += effect.strengthBonus * furnitureLevel;
                    if (effect.wisdomBonus) bonuses.wisdomBonus += effect.wisdomBonus * furnitureLevel;
                }
            }
        }
    }

    // Add bonuses from dwarf's individual room
    const roomId = dwarf.roomId;
    if (typeof individualRooms !== 'undefined' && roomId && individualRooms[roomId] && individualRooms[roomId].furniture) {
        for (const furnitureId in individualRooms[roomId].furniture) {
            const furnitureLevel = individualRooms[roomId].furniture[furnitureId]?.level || 0;
            if (furnitureLevel > 0 && furnitureData[furnitureId]) {
                const effect = furnitureData[furnitureId].effect;
                if (effect) {
                    if (effect.restBonus) bonuses.restBonus += effect.restBonus * furnitureLevel;
                    if (effect.maxEnergyBonus) bonuses.maxEnergyBonus += effect.maxEnergyBonus * furnitureLevel;
                    if (effect.digPowerBonus) bonuses.digPowerBonus += effect.digPowerBonus * furnitureLevel;
                    if (effect.critChanceBonus) bonuses.critChanceBonus += effect.critChanceBonus * furnitureLevel;
                    if (effect.strengthBonus) bonuses.strengthBonus += effect.strengthBonus * furnitureLevel;
                    if (effect.wisdomBonus) bonuses.wisdomBonus += effect.wisdomBonus * furnitureLevel;
                }
            }
        }
    }

    return bonuses;
}

/**
 * Calculate the base resting rate for a dwarf (energy recovered per tick while resting)
 * @returns {number} Base resting rate from constants
 */
function getBaseRestingRate() {
    return typeof DWARF_REST_AMOUNT !== 'undefined' ? DWARF_REST_AMOUNT : 15;
}

/**
 * Calculate the effective resting rate for a dwarf including furniture bonuses
 * @param {Object} dwarf - The dwarf to calculate for
 * @returns {number} Effective resting rate per tick
 */
function calculateEffectiveRestingRate(dwarf) {
    const baseRate = getBaseRestingRate();
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);
    // restBonus is a percentage bonus (e.g., 0.05 = 5%)
    return baseRate * (1 + furnitureBonuses.restBonus);
}

/**
 * Calculate the one-hit kill chance for a dwarf on critical hits
 * This depends on stone/ore expertise research and plating multipliers
 * @param {Object} dwarf - The dwarf to calculate for
 * @param {string} materialType - The type of material being mined ('Stone' or 'Ore')
 * @returns {number} One-hit chance as a decimal (0-1)
 */
function calculateOneHitChance(dwarf, materialType) {
    let oneHitChance = 0;

    // Get expertise levels (note: IDs are 'expertise-stone' and 'expertise-ore' in defs.js)
    const stoneExpertise = researchData['expertise-stone'];
    const oreExpertise = researchData['expertise-ore'];

    // Calculate base chance from expertise
    if (materialType && materialType.includes('Stone')) {
        const stoneLevel = stoneExpertise ? (stoneExpertise.level || 0) : 0;
        const stoneChancePerLevel = typeof STONE_EXPERTISE_ONE_HIT_CHANCE !== 'undefined' ? STONE_EXPERTISE_ONE_HIT_CHANCE : 0.02;
        oneHitChance = stoneLevel * stoneChancePerLevel;
    } else if (materialType && materialType.includes('Ore')) {
        const oreLevel = oreExpertise ? (oreExpertise.level || 0) : 0;
        const oreChancePerLevel = typeof ORE_EXPERTISE_ONE_HIT_CHANCE !== 'undefined' ? ORE_EXPERTISE_ONE_HIT_CHANCE : 0.03;
        oneHitChance = oreLevel * oreChancePerLevel;
    }

    // Apply Uranium and Plutonium plating multipliers
    const uraniumMultiplier = getUraniumPlatingOneHitMultiplier(dwarf);
    const plutoniumMultiplier = getPlutoniumPlatingOneHitMultiplier(dwarf);
    const totalMultiplier = uraniumMultiplier * plutoniumMultiplier;

    oneHitChance *= totalMultiplier;

    return oneHitChance;
}

/**
 * Calculate the maximum one-hit chance for a dwarf (best case scenario between stone and ore)
 * @param {Object} dwarf - The dwarf to calculate for
 * @returns {Object} Object with stoneChance and oreChance
 */
function calculateMaxOneHitChances(dwarf) {
    return {
        stoneChance: calculateOneHitChance(dwarf, 'Stone'),
        oreChance: calculateOneHitChance(dwarf, 'Ore')
    };
}

/**
 * Calculate critical hit chance including furniture bonuses (wrapper for main thread)
 * @param {Object} dwarf - The dwarf to calculate for
 * @returns {number} Critical hit chance as a decimal (0-1)
 */
function calculateCritChanceWithFurniture(dwarf) {
    // Get base crit chance (includes research, gems, plating)
    let critChance = calculateFinalCritChance(dwarf);

    // Add furniture crit chance bonus (additive)
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);
    critChance += furnitureBonuses.critChanceBonus;

    return critChance;
}
