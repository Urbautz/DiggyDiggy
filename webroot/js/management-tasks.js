// ============================================================================
// DIGGY DIGGY DWARF - MANAGEMENT TASKS
// ============================================================================
// This file contains all management task execution and activation logic
// to keep game-worker.js clean and maintainable.
// ============================================================================

/**
 * Execute a completed management task
 * @param {Object} task - The task to execute
 * @param {Object} taskDef - The task definition from managementTasks
 * @param {Object} context - Game state context (gold, materials, gems, etc.)
 * @returns {Object} - Updated context after task execution
 */
function executeManagementTask(task, taskDef, context) {
    console.log(`[Management] Executing task: ${task.type}`);

    // Calculate trade bonus once (used by all selling tasks)
    const totalTradeBonus = calculateTradeBonus(context.researchData, context.dwarfs);

    switch (task.type) {
        case 'sell-material':
            return executeSellMaterial(task, context, totalTradeBonus);

        case 'sell-non-craftables':
            return executeSellNonCraftables(task, context, totalTradeBonus);

        case 'sell-gems':
            return executeSellGems(task, context, totalTradeBonus);

        case 'cut-gems':
            return executeCutGems(task, context);

        // TODO: Implement other task types
        case 'auto-reserach-cheapest':
        case 'auto-invest':
            console.log(`[Management] Task type ${task.type} not yet implemented`);
            return context;

        default:
            console.log(`[Management] Unknown task type: ${task.type}`);
            return context;
    }
}

/**
 * Execute sell-material task
 */
function executeSellMaterial(task, context, totalTradeBonus) {
    const materialId = task.values.material;
    const keepQuantity = task.values.keepQuantity || 0;
    const currentStock = context.materialsStock[materialId] || 0;

    if (currentStock > keepQuantity) {
        const material = context.materials[materialId];
        if (material) {
            const amountToSell = currentStock - keepQuantity;
            const goldEarned = Math.floor(amountToSell * material.worth * totalTradeBonus);

            context.gold += goldEarned;
            context.materialsStock[materialId] = keepQuantity;

            // Log transaction
            context.pendingTransactions.push({
                type: 'income',
                amount: goldEarned,
                description: `[Auto] Sold ${amountToSell}x ${material.name}`
            });

            console.log(`[Management] Sold ${amountToSell}x ${material.name} for ${goldEarned} gold (kept ${keepQuantity})`);
        }
    }

    return context;
}

/**
 * Execute sell-non-craftables task
 */
function executeSellNonCraftables(task, context, totalTradeBonus) {
    const smelterInputMaterials = getSmelterInputMaterials();

    let totalGold = 0;
    let totalItems = 0;

    for (const [id, m] of Object.entries(context.materials)) {
        const materialType = m.type || '';

        // Skip materials that are:
        // - Used in smelter tasks (inputs for recipes)
        // - Ingots (valuable crafted materials)
        // - Gems (have their own sell task)
        if (smelterInputMaterials.has(id)) continue;
        if (materialType.startsWith('Ingot')) continue;
        if (materialType.startsWith('Gem')) continue;

        const count = context.materialsStock[id] || 0;
        if (count > 0) {
            const goldForThisMaterial = Math.floor(count * m.worth * totalTradeBonus);
            totalGold += goldForThisMaterial;
            totalItems += count;
            console.log(`[Management] Selling ${count}x ${m.name} for ${goldForThisMaterial} gold`);

            // Log individual material transaction
            context.pendingTransactions.push({
                type: 'income',
                amount: goldForThisMaterial,
                description: `[Auto] Sold ${count}x ${m.name}`
            });

            context.materialsStock[id] = 0;
        }
    }

    if (totalItems > 0) {
        context.gold += totalGold;
        console.log(`[Management] Sold all non-craftable materials (${totalItems} items) for ${totalGold} gold`);
    }

    return context;
}

/**
 * Execute sell-gems task
 */
function executeSellGems(task, context, totalTradeBonus) {
    const gemtype = task.values.gemtype || 'any';
    const maxcarats = task.values.maxcarats || 1;

    // Find gems to sell (unpolished, matching type and carat criteria)
    const gemsToSell = context.gems.filter(gem => {
        const typeMatches = (gemtype === 'any') || (gem.type === gemtype);
        const caratMatches = gem.carat <= maxcarats;
        return typeMatches && caratMatches && !gem.polished && !gem.markedForCutting;
    });

    if (gemsToSell.length > 0) {
        let totalGold = 0;
        let soldCount = 0;

        // Group gems by type for better logging
        const gemGroups = {};
        for (const gem of gemsToSell) {
            if (!gemGroups[gem.type]) {
                gemGroups[gem.type] = { count: 0, gold: 0 };
            }

            const gemMaterial = context.materials[gem.type];
            if (gemMaterial) {
                const gemValue = Math.floor(gemMaterial.worth * gem.carat * totalTradeBonus);
                gemGroups[gem.type].count++;
                gemGroups[gem.type].gold += gemValue;
                totalGold += gemValue;
                soldCount++;
            }
        }

        // Remove sold gems from gems array
        for (let i = context.gems.length - 1; i >= 0; i--) {
            if (gemsToSell.includes(context.gems[i])) {
                context.gems.splice(i, 1);
            }
        }

        // Add gold
        context.gold += totalGold;

        // Log individual gem type transactions
        for (const [type, data] of Object.entries(gemGroups)) {
            const gemMaterial = context.materials[type];
            context.pendingTransactions.push({
                type: 'income',
                amount: data.gold,
                description: `[Auto] Sold ${data.count}x ${gemMaterial.name}`
            });
            console.log(`[Management] Sold ${data.count}x ${gemMaterial.name} for ${data.gold} gold`);
        }

        console.log(`[Management] Sold ${soldCount} gems for ${totalGold} gold total`);
    }

    return context;
}

/**
 * Execute cut-gems task
 */
function executeCutGems(task, context) {
    const gemtype = task.values.gemtype || 'any';
    const minQuantity = task.values.minQuantity || 10;
    const mincarats = task.values.mincarats || 1;

    // Find gems to mark for cutting (unpolished, not already marked, matching criteria)
    const candidateGems = context.gems.filter(gem => {
        const typeMatches = (gemtype === 'any') || (gem.type === gemtype);
        const caratMatches = gem.carat >= mincarats;
        return typeMatches && caratMatches && !gem.polished && !gem.markedForCutting;
    });

    if (candidateGems.length >= minQuantity) {
        // Mark all matching gems for cutting
        let markedCount = 0;
        for (const gem of candidateGems) {
            gem.markedForCutting = true;
            gem.cuttingProgress = 0;
            markedCount++;
        }
        console.log(`[Management] Marked ${markedCount} gems for cutting (type: ${gemtype}, min carats: ${mincarats})`);
    }

    return context;
}

/**
 * Check if management tasks should be activated based on current game state
 * @param {Array} activeManagementTasks - List of active tasks
 * @param {Object} context - Game state context
 */
function checkManagementTaskActivation(activeManagementTasks, context) {
    if (!activeManagementTasks || activeManagementTasks.length === 0) return;

    for (const task of activeManagementTasks) {
        const taskDef = context.managementTasks[task.type];
        if (!taskDef) continue;
        if (task.active) continue;

        let shouldActivate = false;

        // Check activation condition based on task type
        switch (task.type) {
            case 'sell-material':
                shouldActivate = checkSellMaterialActivation(task, context);
                break;

            case 'sell-non-craftables':
                shouldActivate = checkSellNonCraftablesActivation(task, context);
                break;

            case 'sell-gems':
                shouldActivate = checkSellGemsActivation(task, context);
                break;

            case 'cut-gems':
                shouldActivate = checkCutGemsActivation(task, context);
                break;

            case 'auto-reserach-cheapest':
                shouldActivate = checkAutoResearchActivation(task, context);
                break;

            case 'auto-invest':
                shouldActivate = checkAutoInvestActivation(task, context);
                break;

            default:
                // Unknown task type, keep current state
                continue;
        }

        // Update task active status
        task.active = shouldActivate;
    }
}

/**
 * Check if sell-material task should activate
 */
function checkSellMaterialActivation(task, context) {
    const material = task.values.material;
    const minQuantity = task.values.minQuantity || 0;
    const currentStock = context.materialsStock[material] || 0;
    return currentStock > minQuantity;
}

/**
 * Check if sell-non-craftables task should activate
 */
function checkSellNonCraftablesActivation(task, context) {
    const minQuantity = task.values.minQuantity || 0;
    const totalNonCraftables = calculateNonCraftableMaterialsTotal(context.materialsStock);
    return totalNonCraftables > minQuantity;
}

/**
 * Check if sell-gems task should activate
 */
function checkSellGemsActivation(task, context) {
    const gemtype = task.values.gemtype || 'any';
    const minQuantity = task.values.minQuantity || 0;
    const maxcarats = task.values.maxcarats || 1;

    let matchingGemCount = 0;
    for (const gem of context.gems) {
        const typeMatches = (gemtype === 'any') || (gem.type === gemtype);
        if (typeMatches && gem.carat <= maxcarats && !gem.polished && !gem.markedForCutting) {
            matchingGemCount++;
        }
    }
    return matchingGemCount > minQuantity;
}

/**
 * Check if cut-gems task should activate
 */
function checkCutGemsActivation(task, context) {
    const gemtype = task.values.gemtype || 'any';
    const minQuantity = task.values.minQuantity || 0;
    const mincarats = task.values.mincarats || 1;

    let matchingGemCount = 0;
    for (const gem of context.gems) {
        const typeMatches = (gemtype === 'any') || (gem.type === gemtype);
        if (typeMatches && gem.carat >= mincarats && !gem.polished && !gem.markedForCutting) {
            matchingGemCount++;
        }
    }
    return matchingGemCount >= minQuantity;
}

/**
 * Check if auto-research task should activate
 */
function checkAutoResearchActivation(task, context) {
    const minBankGold = task.values.minBankGold || 0;
    const minQueueSize = task.values.minQueueSize || 0;
    return context.gold > minBankGold && context.researchQueue.length <= minQueueSize;
}

/**
 * Check if auto-invest task should activate
 */
function checkAutoInvestActivation(task, context) {
    const minBankGold = task.values.minBankGold || 0;
    return context.gold > minBankGold;
}

// Note: calculateTradeBonus, getSmelterInputMaterials, and calculateNonCraftableMaterialsTotal
// are already defined in utils.js and available via importScripts

// Export functions for use in worker and main thread
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        executeManagementTask,
        checkManagementTaskActivation,
        calculateTradeBonus,
        getSmelterInputMaterials,
        calculateNonCraftableMaterialsTotal
    };
}
