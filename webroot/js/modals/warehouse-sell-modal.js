/**
 * Warehouse Sell Modal
 * Handles bulk selling operations for different material categories
 */

/**
 * Open the warehouse sell modal with all bulk sell options
 */
function openWarehouseSellModal() {
    const tradeBonus = 1 + getResearchLevel('trading') * RESEARCH_TRADING_BONUS;

    // Calculate values for each category
    const smelterInputMaterials = new Set();
    const craftableMaterials = new Set(); // Materials that can be crafted (outputs of recipes)
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
        }
        if (task.inputs && Array.isArray(task.inputs)) {
            task.inputs.forEach(input => smelterInputMaterials.add(input.material));
        }
        /* Output materials should NOT be added to the craftable list.
        if (task.output && task.output.material) {
            craftableMaterials.add(task.output.material);
        } */
    }

    let looseValue = 0;
    let stonesValue = 0;
    let oresValue = 0;
    let nonCraftablesValue = 0;
    let ingotsValue = 0;
    let heatingValue = 0;
    let allValue = 0;

    const looseMaterials = [];
    const stonesMaterials = [];
    const oresMaterials = [];
    const nonCraftablesMaterials = [];
    const ingotsMaterials = [];
    const heatingMaterials = [];
    const allMaterials = [];

    for (const m of materials) {
        const id = m.id;
        const count = materialsStock[id] || 0;
        if (count > 0) {
            const value = count * m.worth * tradeBonus;
            allValue += value;

            const materialType = m.type || '';

            // Loose materials (not in smelter inputs, not ingots)
            if (materialType.startsWith('Loose') && value > 0) {
                looseValue += value;
                looseMaterials.push({ name: m.name, count });
            }

            // Stones
            if (materialType.startsWith('Stone') && value > 0) {
                stonesValue += value;
                stonesMaterials.push({ name: m.name, count });
            }

            // Ores
            if (materialType.startsWith('Ore') && value > 0) {
                oresValue += value;
                oresMaterials.push({ name: m.name, count });
            }

            // Non-craftables (raw materials that cannot be crafted - not outputs of recipes)
            if (!craftableMaterials.has(id)
                && !smelterInputMaterials.has(id)
                && !materialType.startsWith('Gem')
                && value > 0) {
                nonCraftablesValue += value;
                nonCraftablesMaterials.push({ name: m.name, count });
            }

            // Ingots
            if (materialType.startsWith('Ingot') && value > 0) {
                ingotsValue += value;
                ingotsMaterials.push({ name: m.name, count });
            }

            // Heating materials
            if (materialType.startsWith('Special') && value > 0) {
                heatingValue += value;
                heatingMaterials.push({ name: m.name, count });
            }
        }
    }

    // Helper function to format material list
    const formatMaterialList = (materials) => {
        if (materials.length === 0) return '';
        return materials.map(m => `${m.name}: ${m.count}`).join(', ');
    };

    // Update modal values
    document.getElementById('wso-loose-value').textContent = formatNumber(looseValue, 'gold') + ' 💰';
    document.getElementById('wso-loose-details').textContent = formatMaterialList(looseMaterials);

    document.getElementById('wso-stones-value').textContent = formatNumber(stonesValue, 'gold') + ' 💰';
    document.getElementById('wso-stones-details').textContent = formatMaterialList(stonesMaterials);

    document.getElementById('wso-ores-value').textContent = formatNumber(oresValue, 'gold') + ' 💰';
    document.getElementById('wso-ores-details').textContent = formatMaterialList(oresMaterials);

    document.getElementById('wso-non-craftables-value').textContent = formatNumber(nonCraftablesValue, 'gold') + ' 💰';
    document.getElementById('wso-non-craftables-details').textContent = formatMaterialList(nonCraftablesMaterials);

    document.getElementById('wso-ingots-value').textContent = formatNumber(ingotsValue, 'gold') + ' 💰';
    document.getElementById('wso-ingots-details').textContent = formatMaterialList(ingotsMaterials);

    document.getElementById('wso-heating-value').textContent = formatNumber(heatingValue, 'gold') + ' 💰';
    document.getElementById('wso-heating-details').textContent = formatMaterialList(heatingMaterials);

    document.getElementById('wso-all-value').textContent = formatNumber(allValue, 'gold') + ' 💰';
    document.getElementById('wso-all-details').textContent = formatMaterialList(allMaterials);

    // Setup event handlers for buttons
    const modalContent = document.getElementById('warehouse-sell-content');
    if (modalContent) {
        modalContent.onclick = (e) => {
            const btn = e.target.closest('.warehouse-sell-option');
            if (!btn) return;

            const action = btn.dataset.action;
            if (action) {
                executeBulkSell(action);
                closeModal('warehouse-sell-modal');
            }
        };
    }

    openModal('warehouse-sell-modal');
}

/**
 * Execute bulk sell based on action type
 */
function executeBulkSell(action) {
    const tradeBonus = 1 + getResearchLevel('trading') * RESEARCH_TRADING_BONUS;
    const smelterInputMaterials = new Set();
    const craftableMaterials = new Set(); // Materials that can be crafted (outputs of recipes)
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
        }
        if (task.inputs && Array.isArray(task.inputs)) {
            task.inputs.forEach(input => smelterInputMaterials.add(input.material));
        }
    }
    let totalGold = 0;
    let totalItems = 0;
    const soldMaterials = [];

    for (const m of materials) {
        const id = m.id;
        const count = materialsStock[id] || 0;
        if (count <= 0) continue;

        let shouldSell = false;
        const materialType = m.type || '';

        switch (action) {
            case 'sell-loose':
                shouldSell = materialType.startsWith('Loose');
                break;
            case 'sell-stones':
                shouldSell = materialType.startsWith('Stone');
                break;
            case 'sell-ores':
                shouldSell = materialType.startsWith('Ore');
                break;
            case 'sell-non-craftables':
                shouldSell = !craftableMaterials.has(id)
                    && !smelterInputMaterials.has(id)
                    && !materialType.startsWith('Gem');
                break;
            case 'sell-ingots':
                shouldSell = materialType.startsWith('Ingot');
                break;
            case 'sell-heating':
                shouldSell = materialType.startsWith('Special');
                break;
            case 'sell-all':
                shouldSell = true;
                break;
        }

        if (shouldSell) {
            const value = count * m.worth * tradeBonus;
            totalGold += value;
            totalItems += count;
            soldMaterials.push(`${count}x ${m.name}`);
            logTransaction('income', value, `Sold ${count}x ${m.name}`);
            materialsStock[id] = 0;
        }
    }

    if (totalItems > 0) {
        gold += totalGold;
        console.log(`Bulk sell (${action}): ${totalItems} items for ${formatNumber(totalGold, 'gold')} gold`);

        // Update worker
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: { gold, materialsStock }
            });
        }

        // Update UI
        updateGoldDisplay();
        updateMaterialsPanel();
        saveGame();
    }
}

/**
 * Sells all materials in the warehouse
 */
function sellAllMaterials() {
    // Calculate total gold from all materials
    const betterTrading = researchtree.find(r => r.id === 'trading');
    const tradeBonus = betterTrading ? 1 + (betterTrading.level || 0) * 0.03 : 1;

    // First calculate totals for confirmation
    let previewGold = 0;
    let previewItems = 0;
    for (const m of materials) {
        const count = (typeof materialsStock !== 'undefined' && materialsStock[m.id] != null) ? materialsStock[m.id] : 0;
        if (count > 0) {
            previewGold += count * m.worth * tradeBonus;
            previewItems += count;
        }
    }

    if (previewItems === 0) return;

    // Confirmation dialog
    if (!confirm(`Sell ALL materials?\n\n${formatNumber(previewItems, 'material')} items for ${formatNumber(previewGold, 'gold')} gold`)) {
        return;
    }

    let totalGold = 0;
    let totalItems = 0;

    for (const m of materials) {
        const id = m.id;
        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        if (count > 0) {
            const goldForThisMaterial = count * m.worth * tradeBonus;
            totalGold += goldForThisMaterial;
            totalItems += count;

            // Log individual material transaction
            logTransaction('income', goldForThisMaterial, `Sold ${count}x ${m.name}`);

            materialsStock[id] = 0;
        }
    }

    if (totalItems > 0) {
        gold += totalGold;
        console.log(`Sold all materials (${totalItems} items) for ${formatNumber(totalGold, 'gold')} gold`);

        // Update worker with new gold amount
        gameWorker.postMessage({
            type: 'update-state',
            data: { gold, materialsStock }
        });

        // Update displays
        updateGoldDisplay();
        updateMaterialsPanel();

        // Save game
        saveGame();
    }
}

/**
 * Sells only non-craftable materials (excludes smelter inputs and ingots)
 */
function sellNotCraftableMaterials() {
    // Get materials that are used as smelter inputs
    const smelterInputMaterials = new Set();
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
        }
        if (task.inputs && Array.isArray(task.inputs)) {
            task.inputs.forEach(input => smelterInputMaterials.add(input.material));
        }
    }

    // Calculate trade bonus
    const betterTrading = researchtree.find(r => r.id === 'trading');
    const tradeBonus = betterTrading ? 1 + (betterTrading.level || 0) * 0.03 : 1;

    // First calculate totals for confirmation
    let previewGold = 0;
    let previewItems = 0;
    for (const m of materials) {
        // Skip materials that are used as smelter inputs or forge inputs (ingots)
        if (smelterInputMaterials.has(m.id)) continue;
        if (m.type === 'Ingot') continue;

        const count = (typeof materialsStock !== 'undefined' && materialsStock[m.id] != null) ? materialsStock[m.id] : 0;
        if (count > 0) {
            previewGold += count * m.worth * tradeBonus;
            previewItems += count;
        }
    }

    if (previewItems === 0) return;

    // Confirmation dialog
    if (!confirm(`Sell non-craftable materials?\n(Excludes smelter inputs and forge materials)\n\n${formatNumber(previewItems, 'material')} items for ${formatNumber(previewGold, 'gold')} gold`)) {
        return;
    }

    let totalGold = 0;
    let totalItems = 0;

    for (const m of materials) {
        const id = m.id;
        // Skip materials that are used as smelter inputs or forge inputs (ingots)
        if (smelterInputMaterials.has(id)) continue;
        if (m.type === 'Ingot') continue;

        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        if (count > 0) {
            const goldForThisMaterial = count * m.worth * tradeBonus;
            totalGold += goldForThisMaterial;
            totalItems += count;

            // Log individual material transaction
            logTransaction('income', goldForThisMaterial, `Sold ${count}x ${m.name}`);

            materialsStock[id] = 0;
        }
    }

    if (totalItems > 0) {
        gold += totalGold;
        console.log(`Sold not-craftable materials (${totalItems} items) for ${formatNumber(totalGold, 'gold')} gold`);

        // Update worker with new gold amount
        gameWorker.postMessage({
            type: 'update-state',
            data: { gold, materialsStock }
        });

        // Update displays
        updateGoldDisplay();
        updateMaterialsPanel();

        // Save game
        saveGame();
    }
}
