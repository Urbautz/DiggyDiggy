/**
 * Dwarf Detail Modal
 * Handles dwarf panel, dwarf detail modal, level up system, and dwarf management
 */

/**
 * Opens the dwarfs panel view
 */
function openDwarfs() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;

    // Mark panel as showing dwarfs view
    panel.dataset.view = 'dwarfs';

    // Update tab button states
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === 'dwarfs') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });


    // Remove Warehouse Sell button
    const warehouseSellBtn = document.getElementById('warehouse-sell-btn');
    if (warehouseSellBtn) warehouseSellBtn.remove();


    // Remove Gems button from header
    const gemsBtn = document.getElementById('gems-header-btn');
    if (gemsBtn) gemsBtn.remove();

    // Set grid layout for dwarfs
    const list = document.getElementById('materials-list');
    if (list) list.setAttribute('data-view', 'dwarfs');

    // Populate dwarfs content in the materials-list container
    populateDwarfsInPanel();
    startDwarfsLiveUpdate();
}

/**
 * Closes the dwarfs panel view
 */
function closeDwarfs() {
    stopDwarfsLiveUpdate();
    showWarehousePanel();
}

// Note: populateDwarfsOverview(), updateDwarfsInPanel() and populateDwarfsInPanel() are in main.js
// as they are part of the panel system, not the modal system

/**
 * Open dwarf detail modal
 */
function openDwarfDetailModal(dwarf) {
    const modal = document.getElementById('dwarf-detail-modal');
    if (!modal) {
        console.error('Dwarf detail modal not found');
        return;
    }

    // Store the dwarf being viewed
    modal.dataset.dwarfName = dwarf.name;

    // Update modal header
    const modalHeader = modal.querySelector('.modal-header h2');
    modalHeader.textContent = `👷 ${dwarf.name}`;

    // Populate the template with dwarf data
    populateDwarfDetailTemplate(dwarf);

    // Populate dwarf switcher dropdown
    populateDwarfSwitcher(dwarf.name);

    // Show modal
    openModal('dwarf-detail-modal');
}

/**
 * Populate the dwarf switcher dropdown
 */
function populateDwarfSwitcher(currentDwarfName) {
    const switcher = document.getElementById('dwarf-switcher');
    if (!switcher) return;

    switcher.innerHTML = '<option value="">Switch to...</option>';

    // Sort dwarfs: those who can level up first, then by name
    const sortedDwarfs = [...dwarfs].sort((a, b) => {
        const aXP = a.xp || 0;
        const aLevel = a.level || 1;
        const aNeeded = getDwarfXpForLevel(aLevel);
        const aCanLevelUp = aXP >= aNeeded;

        const bXP = b.xp || 0;
        const bLevel = b.level || 1;
        const bNeeded = getDwarfXpForLevel(bLevel);
        const bCanLevelUp = bXP >= bNeeded;

        if (aCanLevelUp !== bCanLevelUp) {
            return bCanLevelUp ? 1 : -1; // Can level up first
        }
        return a.name.localeCompare(b.name);
    });

    sortedDwarfs.forEach(d => {
        if (d.name !== currentDwarfName) {
            const currentXP = d.xp || 0;
            const currentLevel = d.level || 1;
            const xpNeeded = getDwarfXpForLevel(currentLevel);
            const canLevelUp = currentXP >= xpNeeded;
            const levelUpIndicator = canLevelUp ? ' ⭐' : '';

            const option = document.createElement('option');
            option.value = d.name;
            option.textContent = `${d.name}${levelUpIndicator}`;
            switcher.appendChild(option);
        }
    });

    // Add change event listener
    switcher.onchange = (e) => {
        if (e.target.value) {
            const selectedDwarf = dwarfs.find(d => d.name === e.target.value);
            if (selectedDwarf) {
                openDwarfDetailModal(selectedDwarf);
            }
        }
    };
}

/**
 * Populate the static template with dwarf data (full population on open)
 */
function populateDwarfDetailTemplate(dwarf, includeToolSelector = true) {
    const currentXP = dwarf.xp || 0;
    const currentLevel = dwarf.level || 1;
    const xpNeeded = getDwarfXpForLevel(currentLevel);

    // Calculate bucket info (weight-based)
    const bucketWeight = calculateBucketWeight(dwarf.bucket);
    const dwarfCapacity = calculateDwarfBucketCapacity(dwarf);

    // Calculate dig power components
    const baseDwarfPower = 3;
    const currentTool = dwarf.toolId ? toolsInventory.find(t => t.id === dwarf.toolId) : null;
    let toolPower = 1.0;
    let toolName = 'None';
    let enchantLevel = 0;
    if (currentTool) {
        toolName = currentTool.name || currentTool.type;
        enchantLevel = currentTool.enchantLevel || 0;
        if (currentTool.power !== undefined) {
            toolPower = currentTool.power / 100;
        } else {
            const toolDef = getToolByType(currentTool.type);
            if (toolDef) {
                toolPower = toolDef.power / 100;
            }
        }
    }
    // Apply Diamond gem bonus to dig power skill points
    const baseDigPowerPoints = dwarf.digPower || 0;
    const modifiedDigPowerPoints = getDiamondModifiedDigPower(dwarf, baseDigPowerPoints);
    const levelBonus = 1 + modifiedDigPowerPoints * 0.1;

    const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * 0.01 : 0);
    const enchantBonus = 1 + enchantLevel * ENCHANT_POWER_BONUS;

    // Apply gem bonus (5% per carat for each gem)

    const totalDigPower = (baseDwarfPower * levelBonus) * researchBonus * toolPower * enchantBonus;

    // Populate basic stats
    document.getElementById('dwarf-level').textContent = `⭐ ${currentLevel}`;
    document.getElementById('dwarf-xp').textContent = `${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')}`;
    document.getElementById('dwarf-energy').textContent = `⚡ ${Math.round(dwarf.energy || 0)}/${dwarf.maxEnergy || 100}`;
    document.getElementById('dwarf-status').textContent = `💼 ${dwarf.status || 'idle'}`;

    // Populate bucket
    document.getElementById('dwarf-bucket-header').textContent = `🪣 Bucket (${bucketWeight}kg/${dwarfCapacity}kg)`;
    const bucketContents = document.getElementById('dwarf-bucket-contents');
    if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0 && bucketWeight > 0) {
        const bucketGrid = document.createElement('div');
        bucketGrid.className = 'dwarf-bucket-grid';

        for (const [materialId, count] of Object.entries(dwarf.bucket)) {
            // Handle both regular materials (count is a number) and gems (count might be an object)
            let displayCount = count;
            let displayName = materialId;

            if (typeof count === 'object' && count !== null) {
                // This is a gem object with properties like {id, type, carat, polished}
                displayCount = 1;
                const gemType = count.type || materialId;
                const mat = getMaterialById(gemType);
                displayName = mat ? `${mat.name} (${count.carat}ct)` : `${gemType} (${count.carat}ct)`;
            } else if (count > 0) {
                const mat = getMaterialById(materialId);
                displayName = mat ? mat.name : materialId;
            } else {
                continue;
            }

            const item = document.createElement('div');
            item.className = 'dwarf-bucket-item';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'dwarf-bucket-item-name';
            nameDiv.textContent = displayName;

            const countDiv = document.createElement('div');
            countDiv.className = 'dwarf-bucket-item-count';
            countDiv.textContent = displayCount;

            item.appendChild(nameDiv);
            item.appendChild(countDiv);
            bucketGrid.appendChild(item);
        }

        bucketContents.innerHTML = '';
        bucketContents.appendChild(bucketGrid);
    } else {
        const emptyP = document.createElement('p');
        emptyP.className = 'dwarf-bucket-empty';
        emptyP.textContent = 'Empty';
        bucketContents.innerHTML = '';
        bucketContents.appendChild(emptyP);
    }

    // Populate dig power
    document.getElementById('dwarf-digpower-total').textContent = formatNumber(totalDigPower, 'percent');
    const enchantLine = enchantLevel > 0 ? `<div style="color: #b19cd9;">× Enchantment: ${formatNumber(enchantBonus, 'percent')} (+${enchantLevel})</div>` : '';
    const diamondBonusPercent = ((modifiedDigPowerPoints - baseDigPowerPoints) / baseDigPowerPoints * 100);
    const diamondBonusLine = modifiedDigPowerPoints > baseDigPowerPoints
        ? `<div style="color: #66ccff; margin-left: 10px;">💎 (Diamond: +${formatNumber(diamondBonusPercent, 'percent')}% to Level)</div>`
        : '';
    document.getElementById('dwarf-digpower-calc').innerHTML = `
        <div>Base: ${baseDwarfPower}</div>
        <div>× Level Bonus: ${formatNumber(levelBonus, 'percent')}</div>
        ${diamondBonusLine}
        <div>× Research: ${formatNumber(researchBonus, 'percent')} (${improvedDigging ? improvedDigging.level : 0})</div>
        <div>× Tool Power: ${formatNumber(toolPower, 'percent')}</div>
        ${enchantLine}
    `;

    // Calculate and populate wage
    const wageOptimization = researchtree.find(r => r.id === 'wage-optimization');
    const wageResearchLevel = wageOptimization ? (wageOptimization.level || 0) : 0;
    const researchReduction = wageResearchLevel * RESEARCH_WAGE_OPTIMIZATION_REDUCTION;
    const increaseRate = Math.max(DWARF_WAGE_INCREASE_MIN, DWARF_WAGE_INCREASE_RATE - researchReduction);
    const currentWage = DWARF_BASE_WAGE * (1 + currentLevel * increaseRate);
    const nextLevelWage = DWARF_BASE_WAGE * (1 + (currentLevel + 1) * increaseRate);
    const levelMultiplier = 1 + currentLevel * increaseRate;

    document.getElementById('dwarf-wage-current').textContent = formatNumber(currentWage, 'gold');
    document.getElementById('dwarf-wage-calc').innerHTML = `
        <div>Base: ${formatNumber(DWARF_BASE_WAGE, 'gold')}</div>
        <div>× Level-Factor: ${formatNumber(levelMultiplier, 'material')}</div>
        <div id="dwarf-wage-next" style="margin-top: 6px; font-size: 11px; color: #FFD700;">Next level: ${formatNumber(nextLevelWage, 'gold')}</div>
    `;

    // Populate current tool
    const toolCurrent = document.getElementById('dwarf-tool-current');
    toolCurrent.innerHTML = '';

    if (currentTool) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'dwarf-tool-name';
        nameSpan.textContent = toolName;

        const powerSpan = document.createElement('span');
        powerSpan.className = 'dwarf-tool-power';
        powerSpan.textContent = `(${formatNumber(toolPower, 'material')})`;

        toolCurrent.appendChild(nameSpan);
        toolCurrent.appendChild(powerSpan);
    } else {
        const noneP = document.createElement('p');
        noneP.className = 'dwarf-tool-none';
        noneP.textContent = 'No tool';
        toolCurrent.appendChild(noneP);
    }

    // Populate tool badges (enchantment and gems) in separate container
    const toolBadges = document.getElementById('dwarf-tool-badges');
    toolBadges.innerHTML = '';

    if (currentTool) {
        // Add enchantment badge if tool is enchanted
        if (enchantLevel > 0) {
            const enchantSpan = document.createElement('span');
            enchantSpan.style.cssText = 'margin-right: 6px; padding: 2px 6px; background: rgba(138, 43, 226, 0.2); border: 1px solid rgba(138, 43, 226, 0.4); border-radius: 3px; color: #dda0ff; font-size: 10px; font-weight: bold;';
            enchantSpan.textContent = `✨+${enchantLevel}`;
            toolBadges.appendChild(enchantSpan);
        }

        // Add gem display if tool has gems
        if (currentTool.gems && currentTool.gems.length > 0) {
            // Group gems by type and sum carats
            const gemsByType = {};
            currentTool.gems.forEach(gem => {
                if (!gemsByType[gem.type]) {
                    gemsByType[gem.type] = 0;
                }
                gemsByType[gem.type] += gem.carat;
            });

            // Create a span for each gem type
            Object.entries(gemsByType).forEach(([type, carats]) => {
                const gemSpan = document.createElement('span');
                gemSpan.style.cssText = 'margin-right: 6px; padding: 2px 6px; background: rgba(102, 204, 255, 0.15); border: 1px solid rgba(102, 204, 255, 0.4); border-radius: 3px; color: #66ccff; font-size: 10px; font-weight: bold;';
                gemSpan.textContent = `💎 ${type} ${carats}ct`;
                gemSpan.title = `${carats} carat ${type}`;
                toolBadges.appendChild(gemSpan);
            });
        }
    }

    // Populate tool selector (only on initial open, not on refresh)
    if (includeToolSelector) {
        const toolSelect = document.getElementById('dwarf-tool-select');
        toolSelect.dataset.dwarfName = dwarf.name;
        toolSelect.innerHTML = '';

        // Add "None" option
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = 'None';
        toolSelect.appendChild(noneOption);

        // Show only tools that are not assigned to other dwarfs
        toolsInventory.forEach(tool => {
            const tPower = tool.power !== undefined ? (tool.power / 100) : ((getToolByType(tool.type)?.power || 100) / 100);
            const tName = tool.name || tool.type;

            // Check if this tool is assigned to any other dwarf
            const assignedToOtherDwarf = dwarfs.some(d => d.name !== dwarf.name && d.toolId == tool.id);
            if (assignedToOtherDwarf) {
                return; // Don't show this tool
            }

            // Create option element safely
            const option = document.createElement('option');
            option.value = tool.id;
            option.textContent = `${tName} (${formatNumber(tPower, 'material')})`;

            // Check if this tool is selected
            if (dwarf.toolId && tool.id && dwarf.toolId == tool.id) {
                option.selected = true;
            }

            toolSelect.appendChild(option);
        });
    }

    // Populate stats grid
    const hasEnoughXP = currentXP >= xpNeeded;
    const statsGrid = document.getElementById('dwarf-stats-grid');
    statsGrid.innerHTML = '';

    // Helper to create stat card
    const createStatCard = (icon, name, level, description, upgradeType) => {
        const card = document.createElement('div');
        card.className = 'levelup-option';
        card.style.padding = '10px';

        const headerEl = document.createElement('h4');
        headerEl.style.cssText = 'margin: 0 0 6px 0; font-size: 13px;';
        headerEl.textContent = `${icon} ${name}`;
        card.appendChild(headerEl);

        const skillPointsEl = document.createElement('p');
        skillPointsEl.style.cssText = 'font-size: 16px; font-weight: bold; margin: 6px 0; display: flex; align-items: center; justify-content: center; gap: 6px;';
        skillPointsEl.innerHTML = `Skill Points invested: ${level}`;

        if (hasEnoughXP) {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = '+1';
            btn.dataset.upgradeType = upgradeType;
            btn.dataset.dwarfName = dwarf.name;
            btn.style.cssText = 'padding: 2px 8px; font-size: 11px; margin: 0; min-width: auto; background: linear-gradient(135deg, #ffd700, #ffa726); border-color: #ffa726;';
            skillPointsEl.appendChild(btn);
        }

        card.appendChild(skillPointsEl);

        const descEl = document.createElement('p');
        descEl.style.cssText = 'font-size: 13px; opacity: 0.8; margin: 0; white-space: pre-line;';
        descEl.textContent = description;
        card.appendChild(descEl);

        return card;
    };

    const energyLevel = Math.round(Math.log((dwarf.maxEnergy || 100) / 100) / Math.log(DWARF_LEVELUP_ENERGY_MULTIPLIER));

    // Calculate Ruby energy prevention chance for display
    let rubyEnergyChance = 0;
    if (dwarf.toolId) {
        const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
        if (toolInstance && toolInstance.gems && toolInstance.gems.length > 0) {
            const totalRubyCarat = toolInstance.gems
                .filter(gem => gem.type === 'Ruby')
                .reduce((sum, gem) => sum + gem.carat, 0);
            if (totalRubyCarat > 0) {
                rubyEnergyChance = calculateRubyEnergyPreventionChance(totalRubyCarat);
            }
        }
    }

    // Calculate gem bonuses for display
    const baseDigPower = dwarf.digPower || 0;
    const modifiedDigPower = getDiamondModifiedDigPower(dwarf, baseDigPower);
    const diamondDigPowerPercent = modifiedDigPower > baseDigPower ? ((modifiedDigPower - baseDigPower) / baseDigPower * 100) : 0;
    const diamondBonus = modifiedDigPower > baseDigPower ? ` (+${formatNumber(diamondDigPowerPercent, 'percent')}% from 💎Diamond)` : '';
    const digPowerDesc = `+${(baseDigPower * 10).toFixed(1)}% power\n${diamondBonus}`;

    const energyDesc = `Maximum Energy: ${dwarf.maxEnergy || 100}${rubyEnergyChance > 0 ? `\n💎Ruby: ${formatNumber(rubyEnergyChance, 'percent')}% chance to prevent energy consumption` : ''}`;

    const baseStrength = dwarf.strength || 0;
    const modifiedStrength = getSapphireModifiedStrength(dwarf, baseStrength);
    const effectiveStrength = Math.floor(modifiedStrength);
    const sapphireBonusPercent = modifiedStrength > baseStrength ? ((modifiedStrength - baseStrength) / baseStrength * 100) : 0;
    const sapphireBonus = modifiedStrength > baseStrength ? ` +${formatNumber(sapphireBonusPercent, 'percent')}% from 💎Sapphire)` : '';
    const strengthDesc = `+5kg per strength point${sapphireBonus}`;

    const amethystReduction = getAmethystHardnessReduction(dwarf);
    const amethystBonus = amethystReduction > 0 ? ` (-${amethystReduction.toFixed(2)} hardness from 💎Amethyst)` : '';
    const wisdomDesc = `Research success probability and Smelting Speed\n${amethystBonus}`;

    statsGrid.appendChild(createStatCard('⛏️', 'Dig Power', dwarf.digPower || 0, digPowerDesc, 'digPower'));
    statsGrid.appendChild(createStatCard('⚡', 'Max Energy', energyLevel, energyDesc, 'maxEnergy'));
    statsGrid.appendChild(createStatCard('💪', 'Strength', dwarf.strength || 0, strengthDesc, 'strength'));
    statsGrid.appendChild(createStatCard('🧠', 'Wisdom', dwarf.wisdom || 0, wisdomDesc, 'wisdom'));

    // Populate rename input
    const renameInput = document.getElementById('dwarf-rename-input');
    renameInput.value = dwarf.name;
    const renameBtn = document.getElementById('dwarf-rename-btn');
    renameBtn.dataset.dwarfName = dwarf.name;

    // Set reset button dataset and cost
    const resetBtn = document.getElementById('dwarf-reset-btn');
    resetBtn.dataset.dwarfName = dwarf.name;
    const resetCost = (dwarf.level || 1) * DWARF_RESET_COST_PER_LEVEL;
    document.getElementById('dwarf-reset-cost').textContent = resetCost;
}

/**
 * Refresh dwarf detail modal with updated information (lightweight, no UI blocking)
 */
function refreshDwarfDetailModal(dwarf, forceFullUpdate = false) {
    const modal = document.getElementById('dwarf-detail-modal');
    if (!modal || modal.getAttribute('aria-hidden') !== 'false') {
        // Modal is not open, do nothing
        return;
    }

    // Check if this is the currently displayed dwarf
    if (modal.dataset.dwarfName !== dwarf.name) {
        return;
    }

    // If full update requested (e.g., after level up), repopulate everything except tool selector
    if (forceFullUpdate) {
        populateDwarfDetailTemplate(dwarf, false); // false = don't rebuild tool selector
        return;
    }

    // Only update dynamic data that changes frequently (no tool selector, no stats grid rebuild)
    const currentXP = dwarf.xp || 0;
    const currentLevel = dwarf.level || 1;
    const xpNeeded = getDwarfXpForLevel(currentLevel);

    // Calculate bucket info (weight-based)
    const bucketWeight = calculateBucketWeight(dwarf.bucket);
    const dwarfCapacity = calculateDwarfBucketCapacity(dwarf);

    // Calculate dig power
    const baseDwarfPower = 3;
    const currentTool = dwarf.toolId ? toolsInventory.find(t => t.id === dwarf.toolId) : null;
    let toolPower = 1.0;
    if (currentTool) {
        if (currentTool.power !== undefined) {
            toolPower = currentTool.power / 100;
        } else {
            const toolDef = getToolByType(currentTool.type);
            if (toolDef) {
                toolPower = toolDef.power / 100;
            }
        }
    }
    const levelBonus = 1 + (dwarf.digPower || 0) * 0.1;
    const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * 0.01 : 0);
    const totalDigPower = (baseDwarfPower * levelBonus) * researchBonus * toolPower;

    // Update only the dynamic text content (fast, non-blocking)
    document.getElementById('dwarf-level').textContent = `⭐ ${currentLevel}`;
    document.getElementById('dwarf-xp').textContent = `${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')}`;
    document.getElementById('dwarf-energy').textContent = `⚡ ${Math.round(dwarf.energy || 0)}/${dwarf.maxEnergy || 100}`;
    document.getElementById('dwarf-status').textContent = `💼 ${dwarf.status || 'idle'}`;

    // Update bucket header and contents
    document.getElementById('dwarf-bucket-header').textContent = `🧺 Bucket (${bucketWeight}kg/${dwarfCapacity}kg)`;
    const bucketContents = document.getElementById('dwarf-bucket-contents');
    if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0 && bucketWeight > 0) {
        let bucketHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 4px;">';
        for (const [materialId, count] of Object.entries(dwarf.bucket)) {
            // Handle both regular materials (count is a number) and gems (count might be an object)
            let displayCount = count;
            let displayName = materialId;

            if (typeof count === 'object' && count !== null) {
                // This is a gem object with properties like {id, type, carat, polished}
                displayCount = 1;
                const gemType = count.type || materialId;
                const mat = getMaterialById(gemType);
                displayName = mat ? `${mat.name} (${count.carat}ct)` : `${gemType} (${count.carat}ct)`;
            } else if (count > 0) {
                const mat = getMaterialById(materialId);
                displayName = mat ? mat.name : materialId;
            } else {
                continue;
            }

            bucketHTML += `
                <div style="padding: 4px; background: rgba(255,255,255,0.1); border-radius: 3px; text-align: center;">
                    <div style="font-size: 9px; font-weight: bold;">${displayName}</div>
                    <div style="font-size: 12px; margin-top: 1px;">${displayCount}</div>
                </div>
            `;
        }
        bucketHTML += '</div>';
        bucketContents.innerHTML = bucketHTML;
    } else {
        bucketContents.innerHTML = '<p style="opacity: 0.6; text-align: center; margin: 4px 0; font-size: 11px;">Empty</p>';
    }

    document.getElementById('dwarf-digpower-total').textContent = formatNumber(totalDigPower, 'material');
}

/**
 * Apply the chosen level up upgrade
 */
function applyLevelUp(dwarf, upgradeType) {
    const xpNeeded = getDwarfXpForLevel(dwarf.level);

    if (dwarf.xp < xpNeeded) {
        console.error('Not enough XP to level up');
        return;
    }

    // Find the actual dwarf in the main dwarfs array
    const actualDwarf = dwarfs.find(d => d.name === dwarf.name);
    if (!actualDwarf) {
        console.error('Dwarf not found in main array');
        return;
    }

    // Deduct XP and increase level
    actualDwarf.xp -= xpNeeded;
    actualDwarf.level += 1;

    // Apply the chosen upgrade
    switch(upgradeType) {
        case 'digPower':
            actualDwarf.digPower = (actualDwarf.digPower || 0) + 1;
            console.log(`Leveled up dig power: ${actualDwarf.digPower}`);
            break;
        case 'maxEnergy':
            actualDwarf.maxEnergy = Math.floor((actualDwarf.maxEnergy || 100) * DWARF_LEVELUP_ENERGY_MULTIPLIER);
            actualDwarf.energy = Math.min(actualDwarf.energy, actualDwarf.maxEnergy); // Cap current energy
            console.log(`Leveled up max energy: ${actualDwarf.maxEnergy}`);
            break;
        case 'strength':
            const oldStrength = actualDwarf.strength || 0;
            actualDwarf.strength = oldStrength + 1;
            console.log(`Leveled up strength: ${oldStrength} -> ${actualDwarf.strength}`);
            break;
        case 'wisdom':
            const oldWisdom = actualDwarf.wisdom || 0;
            actualDwarf.wisdom = oldWisdom + 1;
            console.log(`Leveled up wisdom: ${oldWisdom} -> ${actualDwarf.wisdom}`);
            break;
    }

    // Don't reset status or position - let the dwarf continue what they were doing
    // Only clear move target if they were specifically moving somewhere
    if (actualDwarf.status === 'moving') {
        actualDwarf.status = 'idle';
        actualDwarf.moveTarget = null;
    }

    // Sync state with worker
    gameWorker.postMessage({
        type: 'update-state',
        data: { dwarfs }
    });

    // Save game
    saveGame();

    // Refresh dwarf display
    populateDwarfsOverview();
    populateDwarfsInPanel();

    // Refresh the modal with updated dwarf info (force full update to rebuild stats grid)
    refreshDwarfDetailModal(actualDwarf, true);

    console.log(`${actualDwarf.name} leveled up to ${actualDwarf.level}! Chose ${upgradeType}`);
}

/**
 * Reset dwarf skill points
 */
function resetDwarfPoints(dwarf) {
    const currentLevel = dwarf.level || 1;
    const resetCost = currentLevel * DWARF_RESET_COST_PER_LEVEL;

    // Check if can afford
    if (gold < resetCost) {
        alert(`Not enough gold! Need ${formatNumber(resetCost, 'gold')}, have ${formatNumber(gold, 'gold')}.`);
        return;
    }

    // Calculate XP to return (all earned XP)
    let totalXP = dwarf.xp || 0;
    for (let i = 1; i < currentLevel; i++) {
        totalXP += getDwarfXpForLevel(i);
    }

    // Find actual dwarf and reset
    const actualDwarf = dwarfs.find(d => d.name === dwarf.name);
    if (!actualDwarf) return;

    // Deduct gold
    gold -= resetCost;
    logTransaction('expense', resetCost, `Reset points for ${actualDwarf.name}`);
    updateGoldDisplay();

    // Reset stats
    actualDwarf.level = 1;
    actualDwarf.xp = totalXP;
    actualDwarf.digPower = 0;
    actualDwarf.strength = 0;
    actualDwarf.wisdom = 0;
    actualDwarf.maxEnergy = 100;
    actualDwarf.energy = Math.min(actualDwarf.energy, 100);

    // Sync to worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { dwarfs, gold }
        });
    }

    saveGame();
    populateDwarfsOverview();
    populateDwarfsInPanel();
    refreshDwarfDetailModal(actualDwarf, true);

    console.log(`${actualDwarf.name} reset to level 1 with ${formatNumber(totalXP, 'xp')} XP for ${formatNumber(resetCost, 'gold')} gold`);
}

/**
 * Start live updates for dwarfs panel/modal
 */
let _dwarfsModalRefreshId = null;
function startDwarfsLiveUpdate(intervalMs = 1000) {

    populateDwarfsInPanel();
}

/**
 * Stop live updates for dwarfs panel/modal
 */
function stopDwarfsLiveUpdate() {
    if (!_dwarfsModalRefreshId) return;
    clearInterval(_dwarfsModalRefreshId);
    _dwarfsModalRefreshId = null;
}

// ============================================================================
// Event Listeners
// ============================================================================

// Delegated event handler for clicking on dwarf rows to open detail modal
document.addEventListener('click', (ev) => {
    const dwarfRow = ev.target.closest('.dwarf-clickable');
    if (!dwarfRow) return;

    const dwarfName = dwarfRow.dataset.dwarfName;
    if (dwarfName) {
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            console.log(`Dwarf row clicked for ${dwarfName}`);
            openDwarfDetailModal(dwarf);
        }
    }
});

// Delegated event handler for level up upgrade choices
document.addEventListener('click', (ev) => {
    const upgradeChoiceBtn = ev.target.closest('.btn-primary[data-upgrade-type]');
    if (!upgradeChoiceBtn || upgradeChoiceBtn.disabled) return;

    const dwarfName = upgradeChoiceBtn.dataset.dwarfName;
    const upgradeType = upgradeChoiceBtn.dataset.upgradeType;

    if (dwarfName && upgradeType) {
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            console.log(`Level up choice: ${dwarfName} -> ${upgradeType}`);
            applyLevelUp(dwarf, upgradeType);
        }
    }
});

// Delegated event handler for next dwarf button in detail modal
document.addEventListener('click', (ev) => {
    const nextBtn = ev.target.closest('.btn-primary[data-action="next-levelup"]');
    if (!nextBtn) return;

    const dwarfName = nextBtn.dataset.dwarfName;
    if (dwarfName) {
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            console.log(`Next dwarf: ${dwarfName}`);
            openDwarfDetailModal(dwarf);
        }
    }
});

// Delegated event handler for renaming dwarfs
document.addEventListener('click', (ev) => {
    const renameBtn = ev.target.closest('[data-action="rename-dwarf"]');
    if (!renameBtn) return;

    const oldName = renameBtn.dataset.dwarfName;
    const input = document.getElementById('dwarf-rename-input');
    if (!input) return;

    const newName = input.value.trim();
    if (!newName || newName === oldName) {
        console.log('No name change');
        return;
    }

    // Check name length
    if (newName.length > 25) {
        alert('Dwarf name must be 25 characters or less!');
        return;
    }

    // Check if name already exists
    if (dwarfs.some(d => d.name === newName && d.name !== oldName)) {
        alert(`A dwarf named "${newName}" already exists!`);
        return;
    }

    // Find and rename the dwarf
    const dwarf = dwarfs.find(d => d.name === oldName);
    if (dwarf) {
        console.log(`Renaming dwarf from ${oldName} to ${newName}`);

        // Update tool assignments
        toolsInventory.forEach(t => {
            if (t.assignedTo === oldName) {
                t.assignedTo = newName;
            }
        });

        // Reset dwarf to house - release all reservations and reset status
        dwarf.status = 'idle';
        dwarf.moveTarget = null;
        dwarf.action = null;
        dwarf.digTarget = null;

        // Find house position
        const housePos = {row: 0, col: 0}; // Default house position
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < gridWidth; c++) {
                if (grid[r][c].type === 'house') {
                    housePos.row = r;
                    housePos.col = c;
                    break;
                }
            }
        }
        dwarf.row = housePos.row;
        dwarf.col = housePos.col;

        // Rename the dwarf
        dwarf.name = newName;

        // Sync with worker - send full dwarf state and tool inventory
        gameWorker.postMessage({
            type: 'update-state',
            data: { dwarfs, toolsInventory }
        });

        // Refresh the modal with updated info
        refreshDwarfDetailModal(dwarf);

        // Update the dwarfs panel and grid display
        updateDwarfsInPanel();
        updateGridDisplay();

        // Save the game
        saveGame();
    }
});

// Delegated event handler for resetting dwarf points
document.addEventListener('click', (ev) => {
    const resetBtn = ev.target.closest('[data-action="reset-dwarf"]');
    if (!resetBtn) return;

    const dwarfName = resetBtn.dataset.dwarfName;
    const dwarf = dwarfs.find(d => d.name === dwarfName);
    if (!dwarf) return;

    const currentLevel = dwarf.level || 1;
    const resetCost = currentLevel * DWARF_RESET_COST_PER_LEVEL;

    // Confirm before resetting
    const confirmMsg = `Reset ${dwarf.name}'s points?\n\nCost: ${resetCost} gold\nCurrent level: ${currentLevel}\nAll stat points will be reset to 0\nXP will be returned`;
    if (!confirm(confirmMsg)) return;

    resetDwarfPoints(dwarf);
});

// Delegated event handler for tool dropdown change - auto-assign on selection
document.addEventListener('change', (ev) => {
    const select = ev.target;
    if (select.id !== 'dwarf-tool-select') return;

    const dwarfName = select.dataset.dwarfName;
    const newToolId = select.value ? parseInt(select.value) : null; // Convert to number
    const dwarf = dwarfs.find(d => d.name === dwarfName);
    if (!dwarf) {
        console.error(`Dwarf ${dwarfName} not found`);
        return;
    }

    console.log(`Assigning tool ${newToolId} to ${dwarfName}`, { oldToolId: dwarf.toolId, toolsInventory });

    // Unassign old tool
    if (dwarf.toolId) {
        const oldTool = toolsInventory.find(t => t.id === dwarf.toolId);
        if (oldTool) {
            console.log(`Unassigning old tool ${oldTool.id} from ${dwarfName}`);
            delete oldTool.assignedTo;
        }
    }

    // Assign new tool
    if (newToolId !== null) {
        const newTool = toolsInventory.find(t => t.id === newToolId);
        if (newTool) {
            console.log(`Assigning new tool ${newTool.id} (${newTool.type}) to ${dwarfName}`);
            newTool.assignedTo = dwarfName;
            dwarf.toolId = newToolId;
        } else {
            console.error(`Tool ${newToolId} not found in inventory`);
        }
    } else {
        // Unassign tool
        console.log(`Unassigning all tools from ${dwarfName}`);
        delete dwarf.toolId;
    }

    console.log(`After assignment:`, { dwarfToolId: dwarf.toolId, tool: toolsInventory.find(t => t.id === newToolId) });

    // Sync with worker
    gameWorker.postMessage({
        type: 'update-state',
        data: { dwarfs, toolsInventory }
    });

    // Refresh the modal with updated info (force full update to rebuild tool selector)
    refreshDwarfDetailModal(dwarf, true);

    // Update the dwarfs panel
    updateDwarfsInPanel();

    // Save the game
    saveGame();
});
