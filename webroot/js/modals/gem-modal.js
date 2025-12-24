/**
 * Gem Modal
 * Handles gem setting interface for tools and gem inventory management
 */

// ============================================================================
// Gem Setting Modal Functions (for setting gems on tools)
// ============================================================================

/**
 * Open gem setting modal for a tool
 * @param {number} toolId - The ID of the tool to set gems on
 */
function openGemModal(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        console.error('Tool not found:', toolId);
        return;
    }

    const gemSettingResearch = researchtree.find(r => r.id === 'gem-setting');
    const maxGemSlots = gemSettingResearch ? gemSettingResearch.level : 0;

    if (maxGemSlots === 0) {
        alert('You need to research Gem Setting first!');
        return;
    }

    openModal('gem-modal');
    populateGemModal(tool, maxGemSlots);
}

/**
 * Populate the gem setting modal
 * @param {Object} tool - The tool to set gems on
 * @param {number} maxGemSlots - Maximum number of gem slots available
 */
function populateGemModal(tool, maxGemSlots) {
    const container = document.getElementById('gem-content');
    if (!container) return;

    const toolName = tool.name || `${tool.type} #${tool.id}`;
    const toolPower = tool.power || tool.level || 0;

    // Initialize tool.gems if it doesn't exist
    if (!tool.gems) {
        tool.gems = [];
    }

    // Get available polished gems (including currently assigned ones for this tool)
    const currentlyAssignedIds = new Set(tool.gems.map(g => g.id));
    const availableGems = gems.filter(g => g.polished && (!g.assignedToTool || currentlyAssignedIds.has(g.id)));

    // Group gems by type and carat for display
    const gemGroups = {};
    availableGems.forEach(gem => {
        const key = `${gem.type}_${gem.carat}`;
        if (!gemGroups[key]) {
            gemGroups[key] = {
                type: gem.type,
                carat: gem.carat,
                gems: []
            };
        }
        gemGroups[key].gems.push(gem);
    });

    // Sort gem groups by carat (descending), then by type (alphabetically)
    const sortedGroups = Object.values(gemGroups).sort((a, b) => {
        if (b.carat !== a.carat) {
            return b.carat - a.carat; // Higher carat first
        }
        return a.type.localeCompare(b.type); // Alphabetical by type
    });

    // Get already assigned gem types to prevent duplicates
    const assignedTypes = new Set(tool.gems.map(g => g.type));

    let gemSlotsHTML = '';
    for (let i = 0; i < maxGemSlots; i++) {
        const currentGem = tool.gems[i];
        const slotLabel = i + 1;

        if (currentGem) {
            // Show fixed value with unset button
            const gemName = `${currentGem.carat} carat ${currentGem.type}`;
            gemSlotsHTML += `
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 600;">Gem Slot ${slotLabel}:</label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; padding: 8px; background: rgba(102, 204, 255, 0.2); border: 1px solid rgba(102, 204, 255, 0.4); border-radius: 4px; color: #66ccff; font-size: 13px;">
                            💎 ${gemName}
                        </div>
                        <button onclick="unsetGem(${tool.id}, ${i})" class="btn-sell btn-tiny" style="white-space: nowrap;">Unset</button>
                    </div>
                </div>
            `;
        } else {
            // Show dropdown for empty slot
            gemSlotsHTML += `
                <div style="margin-bottom: 12px;">
                    <label for="gem-slot-${i}" style="display: block; margin-bottom: 4px; font-weight: 600;">Gem Slot ${slotLabel}:</label>
                    <select id="gem-slot-${i}" class="gem-select" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #fff; font-size: 13px;">
                        <option value="">-- Empty --</option>
            `;

            // Add options for each gem group, excluding already assigned types
            sortedGroups.forEach(group => {
                if (!assignedTypes.has(group.type)) {
                    const gemName = `${group.carat} carat ${group.type}`;
                    const count = group.gems.length;
                    gemSlotsHTML += `<option value="${group.type}_${group.carat}">${gemName} (${count} available)</option>`;
                }
            });

            gemSlotsHTML += `
                    </select>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0;">🔨 ${toolName}</h3>
            <p style="margin: 0; color: #9fbfe0; font-size: 13px;">Current Power: ${toolPower}</p>
        </div>

        <div style="margin-bottom: 16px; padding: 12px; background: rgba(102, 204, 255, 0.1); border: 1px solid rgba(102, 204, 255, 0.3); border-radius: 6px;">
            <p style="margin: 0 0 12px 0; color: #66ccff; font-size: 13px;">
                Set polished gems into your tool to increase its power. You can set up to ${maxGemSlots} gem${maxGemSlots > 1 ? 's' : ''}.
            </p>
            <p>Ruby: Chance to consume no energy. Higher carat have higher chance, but diminishing returns</p>
            <p>Sapphire: Gives dwarfs option to overload their bucket. Gems do not count to the max bucket.</p>
            <p>Emerald: Gives tools a higher chance at a critical strike.</p>
            <p>Diamond: Gives tools 1% more dwarf dig power per carat.</p>
            <p>Amethyst: Gives the dwarf a chance to do more smelting and research in one tick.</p>
            ${gemSlotsHTML}
        </div>

        ${availableGems.length === 0 ? '<p style="color: #ff6b6b; font-size: 13px; text-align: center;">No polished gems available. Polish gems in the smelter first!</p>' : ''}
    `;

    // Update the confirm button
    const confirmBtn = document.getElementById('confirm-gem-btn');
    if (confirmBtn) {
        confirmBtn.onclick = () => confirmGemSetting(tool.id);
    }
}

/**
 * Confirm gem setting changes
 * @param {number} toolId - The ID of the tool to apply gem changes to
 */
function confirmGemSetting(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) return;

    const gemSettingResearch = researchtree.find(r => r.id === 'gem-setting');
    const maxGemSlots = gemSettingResearch ? gemSettingResearch.level : 0;

    // Collect new gem selections
    const newGems = [];
    const usedGemKeys = new Set();
    const usedTypes = new Set();
    const gemsToKeep = new Set(); // Track which gems we're keeping

    for (let i = 0; i < maxGemSlots; i++) {
        // Check if this slot already has a gem assigned (will be a fixed display, not a dropdown)
        const existingGem = tool.gems && tool.gems[i];

        if (existingGem) {
            // Keep the existing gem
            const gem = gems.find(g => g.id === existingGem.id);
            if (gem && gem.polished) {
                gemsToKeep.add(gem.id);
                usedGemKeys.add(gem.id);
                usedTypes.add(gem.type);
                newGems.push({
                    id: gem.id,
                    type: gem.type,
                    carat: gem.carat
                });
            }
        } else {
            // Check for a new selection in the dropdown
            const select = document.getElementById(`gem-slot-${i}`);
            if (!select || !select.value) continue;

            const [type, carat] = select.value.split('_');
            const caratNum = parseInt(carat);

            // Check if this type is already used
            if (usedTypes.has(type)) {
                alert(`⚠️ You can only set one ${type} gem per tool!`);
                return;
            }

            // Find a gem with this type and carat that is not already in use
            const availableGems = gems.filter(g => g.polished && (!g.assignedToTool || tool.gems.some(tg => tg.id === g.id)));
            const gem = availableGems.find(g => g.type === type && g.carat === caratNum && !usedGemKeys.has(g.id));

            if (gem) {
                usedGemKeys.add(gem.id);
                usedTypes.add(type);
                gemsToKeep.add(gem.id);
                newGems.push({
                    id: gem.id,
                    type: gem.type,
                    carat: gem.carat
                });
            }
        }
    }

    // Release old gems that are being removed (not in gemsToKeep)
    if (tool.gems) {
        tool.gems.forEach(oldGem => {
            if (!gemsToKeep.has(oldGem.id)) {
                // This gem is being removed from the tool
                const gem = gems.find(g => g.id === oldGem.id);
                if (gem) {
                    delete gem.assignedToTool;
                }
            }
        });
    }

    // Assign new gems to tool
    newGems.forEach(newGem => {
        const gem = gems.find(g => g.id === newGem.id);
        if (gem) {
            gem.assignedToTool = tool.id;
        }
    });

    // Update tool's gem array
    tool.gems = newGems;

    // Save and sync
    saveGame();
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gems }
        });
    }

    // Close gem modal and refresh tools panel
    closeModal('gem-modal');
    populateToolsInPanel();

    console.log(`Gems set for tool ${tool.id}:`, newGems);
}

/**
 * Unset a gem from a tool slot
 * @param {number} toolId - The ID of the tool
 * @param {number} slotIndex - The slot index to unset
 */
function unsetGem(toolId, slotIndex) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool || !tool.gems) return;

    const gemToRemove = tool.gems[slotIndex];
    if (!gemToRemove) return;

    // Find the gem and unassign it
    const gem = gems.find(g => g.id === gemToRemove.id);
    if (gem) {
        delete gem.assignedToTool;
    }

    // Remove from tool
    tool.gems.splice(slotIndex, 1);

    // Save and sync
    saveGame();
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gems }
        });
    }

    // Refresh the gem modal
    const gemSettingResearch = researchtree.find(r => r.id === 'gem-setting');
    const maxGemSlots = gemSettingResearch ? gemSettingResearch.level : 0;
    populateGemModal(tool, maxGemSlots);

    console.log(`Unset gem from tool ${toolId}, slot ${slotIndex}`);
}

// ============================================================================
// Gems Modal (different from gem setting - this is for viewing/managing gem inventory)
// ============================================================================

/**
 * Opens the gems inventory modal
 */
function openGemsModal() {
    openModal('gems-modal');
    populateGemsList();
}

/**
 * Populates the gems inventory list
 */
function populateGemsList() {
    const gemsList = document.getElementById('gems-list');
    if (!gemsList) return;

    // Store which gem types are currently expanded
    const expandedTypes = new Set();
    gemsList.querySelectorAll('.gem-type-header:not(.collapsed)').forEach(header => {
        const typeName = header.querySelector('.gem-type-name')?.textContent;
        if (typeName) expandedTypes.add(typeName);
    });

    // Clear existing content
    gemsList.innerHTML = '';

    // Check if there are any gems
    if (!gems || gems.length === 0) {
        gemsList.innerHTML = '<div class="gems-list-empty">No gems discovered yet. Keep digging to find precious gems!</div>';
        return;
    }

    // Group gems by type
    const gemsByType = {};
    gems.forEach(gem => {
        if (!gemsByType[gem.type]) {
            gemsByType[gem.type] = [];
        }
        gemsByType[gem.type].push(gem);
    });

    // Sort each group by carat (highest first)
    for (const type in gemsByType) {
        gemsByType[type].sort((a, b) => b.carat - a.carat);
    }

    // Get gem types sorted alphabetically
    const sortedTypes = Object.keys(gemsByType).sort();

    // Create sections for each gem type
    sortedTypes.forEach(type => {
        const gemMaterial = getMaterialById(type);
        const gemColor = gemMaterial ? gemMaterial.color : '#ffffff';
        const gemName = gemMaterial ? gemMaterial.name : type;
        const gemBaseValue = gemMaterial ? gemMaterial.worth : 0;
        const gemsOfType = gemsByType[type];

        // Calculate total value for this gem type (polished gems worth 50% more)
        const totalValue = gemsOfType.reduce((sum, gem) => {
            const valueMultiplier = gem.polished ? GEM_CUTTING_VALUE_MULTIPLIER : 1;
            return sum + (gemBaseValue * gem.carat * valueMultiplier);
        }, 0);

        // Calculate max carat for each status
        const maxCaratRough = Math.max(...gemsOfType.filter(g => !g.polished).map(g => g.carat), 0);
        const maxCaratPolished = Math.max(...gemsOfType.filter(g => g.polished).map(g => g.carat), 0);

        // Build status info string
        let statusInfo = '';
        if (maxCaratRough > 0) statusInfo += `Rough ${maxCaratRough}ct`;
        if (maxCaratPolished > 0) {
            if (statusInfo) statusInfo += ' • ';
            statusInfo += `Polished ${maxCaratPolished}ct`;
        }

        // Create collapsible section container
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'gem-type-section';

        // Create type header (clickable)
        const typeHeader = document.createElement('div');
        const isExpanded = expandedTypes.has(gemName);
        typeHeader.className = isExpanded ? 'gem-type-header' : 'gem-type-header collapsed';
        typeHeader.innerHTML = `
            <div class="gem-type-expand-icon">▶</div>
            <div class="gem-type-icon" style="background-color: ${gemColor}"></div>
            <span class="gem-type-name">${gemName}</span>
            <span class="gem-type-status-info">${statusInfo}</span>
            <span class="gem-type-count">(${gemsOfType.length})</span>
            <span class="gem-type-value">${formatNumber(totalValue, 'gold')}</span>
        `;

        // Create container for gem items (initially hidden unless expanded)
        const itemsContainer = document.createElement('div');
        itemsContainer.className = isExpanded ? 'gem-type-items' : 'gem-type-items collapsed';

        // Group gems by carat and status for compact display
        const gemGroupings = {};
        gemsOfType.forEach(gem => {
            const key = `${gem.carat}_${gem.polished}_${gem.markedForCutting}_${gem.assignedToTool ? 'assigned' : 'free'}`;
            if (!gemGroupings[key]) {
                gemGroupings[key] = {
                    carat: gem.carat,
                    polished: gem.polished,
                    markedForCutting: gem.markedForCutting,
                    assigned: !!gem.assignedToTool,
                    gems: [],
                    totalValue: 0
                };
            }
            gemGroupings[key].gems.push(gem);
            const valueMultiplier = gem.polished ? GEM_CUTTING_VALUE_MULTIPLIER : 1;
            gemGroupings[key].totalValue += gemBaseValue * gem.carat * valueMultiplier;
        });

        // Sort groups by carat (highest first)
        const sortedGroupings = Object.values(gemGroupings).sort((a, b) => b.carat - a.carat);

        // Create a compact gem item for each grouping
        sortedGroupings.forEach(group => {
            let statusSection;
            if (group.polished) {
                // Polished badge only
                statusSection = '<span class="gem-polished-badge">Polished</span>';
            } else if (group.markedForCutting) {
                // Cutting badge + rough badge
                statusSection = '<span class="gem-cutting-badge">Cutting...</span><span class="gem-unpolished-badge">Rough</span>';
            } else {
                // Just rough badge
                statusSection = '<span class="gem-unpolished-badge">Rough</span>';
            }

            const gemItem = document.createElement('div');
            gemItem.className = 'gem-item gem-item-compact';

            // Don't show sell buttons for assigned gems
            const sellButtonsHTML = group.assigned ? '' : `
                <div class="gem-item-actions">
                    <button class="gem-sell-one-btn" data-type="${type}" data-carat="${group.carat}" data-polished="${group.polished}">Sell 1</button>
                    <button class="gem-sell-lower-btn" data-type="${type}" data-carat="${group.carat}" data-polished="${group.polished}">Sell incl. lower carat</button>
                </div>
            `;

            gemItem.innerHTML = `
                <div class="gem-item-compact-content">
                    <span class="gem-item-carat">${group.carat} ct</span>
                    <div class="gem-item-status-column">
                        ${statusSection}
                    </div>
                    <span class="gem-item-count">×${group.gems.length}</span>
                    <span class="gem-item-value">💰 ${formatNumber(group.totalValue, 'gold')}</span>
                    ${sellButtonsHTML}
                </div>
            `;

            itemsContainer.appendChild(gemItem);
        });

        // Add click handler to toggle collapse
        typeHeader.addEventListener('click', () => {
            const isCollapsed = typeHeader.classList.contains('collapsed');
            if (isCollapsed) {
                typeHeader.classList.remove('collapsed');
                itemsContainer.classList.remove('collapsed');
            } else {
                typeHeader.classList.add('collapsed');
                itemsContainer.classList.add('collapsed');
            }
        });

        sectionContainer.appendChild(typeHeader);
        sectionContainer.appendChild(itemsContainer);
        gemsList.appendChild(sectionContainer);
    });

    // Add event listeners for sell buttons
    document.querySelectorAll('.gem-sell-one-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent collapse toggle
            const gemType = btn.dataset.type;
            const carat = parseInt(btn.dataset.carat);
            const polished = btn.dataset.polished === 'true';
            sellGems(gemType, carat, polished, false);
        });
    });

    document.querySelectorAll('.gem-sell-lower-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent collapse toggle
            const gemType = btn.dataset.type;
            const carat = parseInt(btn.dataset.carat);
            const polished = btn.dataset.polished === 'true';
            sellGems(gemType, carat, polished, true);
        });
    });

    // Add event listeners for cut buttons
    document.querySelectorAll('.gem-cut-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent collapse toggle
            const gemType = btn.dataset.type;
            const carat = parseInt(btn.dataset.carat);
            markGemsForCutting(gemType, carat);
        });
    });
}

/**
 * Mark gems for cutting in the smelter
 * @param {string} gemType - The type of gem
 * @param {number} carat - The carat value
 */
function markGemsForCutting(gemType, carat) {
    // Mark all rough gems of this type and carat for cutting
    let markedCount = 0;
    gems.forEach(gem => {
        if (gem.type === gemType && gem.carat === carat && !gem.polished && !gem.markedForCutting) {
            gem.markedForCutting = true;
            gem.cuttingProgress = 0;
            markedCount++;
        }
    });

    if (markedCount > 0) {
        // Sync to worker
        if (gameWorker) {
            gameWorker.postMessage({
                type: 'update-state',
                data: { gems: gems }
            });
        }

        // Save game
        saveGame();

        // Refresh the gems list
        populateGemsList();
    }
}

/**
 * Sell gems from inventory
 * @param {string} gemType - The type of gem
 * @param {number} carat - The carat value
 * @param {boolean} polished - Whether the gems are polished
 * @param {boolean} includeLower - Whether to include lower carat gems
 */
function sellGems(gemType, carat, polished, includeLower) {
    // Find gems to sell (exclude assigned gems)
    const gemsToSell = [];

    for (let i = gems.length - 1; i >= 0; i--) {
        const gem = gems[i];
        if (gem.type === gemType && gem.polished === polished && !gem.assignedToTool) {
            if (includeLower) {
                // Sell this carat and all lower carats with same polished status
                if (gem.carat <= carat) {
                    gemsToSell.push(gem);
                }
            } else {
                // Sell only one gem with exact carat match
                if (gem.carat === carat && gemsToSell.length === 0) {
                    gemsToSell.push(gem);
                }
            }
        }
    }

    if (gemsToSell.length === 0) {
        console.warn('No gems found to sell');
        return;
    }

    // Calculate total value (polished gems worth 50% more)
    const gemMaterial = getMaterialById(gemType);
    const baseValue = gemMaterial ? gemMaterial.worth : 0;
    let totalValue = 0;

    gemsToSell.forEach(gem => {
        const valueMultiplier = gem.polished ? GEM_CUTTING_VALUE_MULTIPLIER : 1;
        totalValue += baseValue * gem.carat * valueMultiplier;
    });

    // Remove gems from array
    gemsToSell.forEach(gem => {
        const index = gems.findIndex(g => g.id === gem.id);
        if (index !== -1) {
            gems.splice(index, 1);
        }
    });

    // Add gold
    gold += totalValue;
    updateGoldDisplay();

    // Log transaction
    const gemName = gemMaterial ? gemMaterial.name : gemType;
    const statusText = polished ? 'Polished' : 'Rough';
    const description = includeLower
        ? `Sold ${gemsToSell.length} ${statusText} ${gemName} (${carat}ct and lower)`
        : `Sold 1 ${statusText} ${gemName} (${carat}ct)`;

    logTransaction('income', totalValue, description);

    // Sync to worker
    if (gameWorker) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                gems: gems,
                gold: gold
            }
        });
    }

    // Save game
    saveGame();

    // Refresh the gems list
    populateGemsList();
}
