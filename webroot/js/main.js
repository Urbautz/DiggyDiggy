
// pick a random material from the registry based on depth level and probability (probability)
function randomMaterial(depthLevel = 0) {
    // Filter materials that are valid for this depth level
    const validMaterials = materials.filter(m => 
        depthLevel >= (m.minlevel || 0) && depthLevel <= (m.maxlevel || Infinity)
    );
    
    if (validMaterials.length === 0) {
        // Fallback to first material if none match
        return materials[0];
    }
    
    // Calculate total probability for probability distribution
    const totalProbability = validMaterials.reduce((sum, m) => sum + (m.probability || 1), 0);
    
    // Random selection weighted by probability
    let random = Math.random() * totalProbability;
    for (const mat of validMaterials) {
        random -= (mat.probability || 1);
        if (random <= 0) {
            return mat;
        }
    }
    
    // Fallback to last valid material
    return validMaterials[validMaterials.length - 1];
}

function getMaterialById(id) {
    return materials.find(m => m.id === id) || null;
}

function getToolByType(toolType) {
    return tools.find(t => t.name === toolType) || null;
}

function getToolPower(toolType, toolLevel = 1) {
    const tool = getToolByType(toolType);
    if (!tool) return 0.5;
    
    // Each level gives 10% bonus: power * (1 + (level - 1) * 0.1)
    return tool.power * (1 + (toolLevel - 1) * 0.1);
}

function getToolUpgradeCost(toolType, toolLevel = 1) {
    const tool = getToolByType(toolType);
    if (!tool) return 0;
    
    // Cost doubles with each level
    return tool.upgradecost * Math.pow(2, toolLevel - 1);
}



// Update the grid display in the UI (renders into #digging-grid tbody)
function updateGridDisplay() {
    const table = document.getElementById("digging-grid");
    if (!table) {
        console.warn('digging-grid element not found');
        return;
    }
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    }
    tbody.innerHTML = '';

    // Render only visibleDepth rows, showing depth label as first column
    for (let r = 0; r < Math.min(visibleDepth, grid.length); r++) {
        const rowEl = document.createElement('tr');

        // first column = depth label (1-based depth for readability)
        const depthCell = document.createElement('td');
        depthCell.className = 'depth-cell';
        // show depth offset using startX (startX + 1 = top visible level)
        const depthLabel = (typeof startX === 'number') ? (startX + r + 1) : (r + 1);
        depthCell.textContent = String(depthLabel);
        depthCell.setAttribute('aria-label', `Depth ${r + 1}`);
        rowEl.appendChild(depthCell);

        for (let c = 0; c < gridWidth; c++) {
            const cellData = grid[r][c];
            const mat = getMaterialById(cellData.materialId);

            const cell = document.createElement('td');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Render empty (dug-out) cells differently: skyblue background and no "0" text
            const rawHardness = Number(cellData.hardness || 0);
            // find dwarfs at this location (may be none) and separate moving vs standing
            const dwarfsHere = Array.isArray(dwarfs) ? dwarfs.filter(d => d.x === c && d.y === r) : [];
            const movingHere = dwarfsHere.filter(d => d.status === 'moving');
            const standingHere = dwarfsHere.filter(d => d.status !== 'moving');
            const diggersHere = dwarfsHere.filter(d => d.status === 'digging');

            if (rawHardness <= 0) {
                // dug-out / empty
                cell.style.background = 'skyblue';
                // show dwarf markers even in empty (dug-out) cells
                if (standingHere.length > 0) {
                    // mark the cell as occupied — the CSS background pseudo-element will show the emoji
                    cell.classList.add('has-dwarf');
                    cell.textContent = '';
                    cell.setAttribute('aria-label', `row ${r} col ${c} dwarfs ${standingHere.map(d => d.name).join(', ')}`);
                    // if any of the standing dwarfs are actively digging, show digging marker
                    if (diggersHere.length > 0) {
                        cell.classList.add('is-digging');
                        const digMarker = document.createElement('span');
                        digMarker.className = 'digging-marker strike';
                        digMarker.textContent = '⛏️';
                        cell.appendChild(digMarker);
                    } else {
                        cell.classList.remove('is-digging');
                    }
                } else {
                    cell.classList.remove('has-dwarf');
                    cell.textContent = '';
                    cell.setAttribute('aria-label', `row ${r} col ${c} empty`);
                }

                // moving dwarfs are shown with a running icon (may be behind the dig marker)
                if (movingHere.length > 0) {
                    const mover = document.createElement('span');
                    mover.className = 'moving-marker';
                    mover.textContent = '🏃';
                    cell.appendChild(mover);
                }

                // show strike marker when dwarf is striking here
                const strikersHere = dwarfsHere.filter(d => d.status === 'striking');
                if (strikersHere.length > 0) {
                    const strike = document.createElement('span');
                    strike.className = 'striking-marker';
                    strike.textContent = '🪧';
                    strike.title = 'On strike - not enough gold!';
                    cell.appendChild(strike);
                }

                // show drop-off marker (global drop-off location) if this cell matches
                    if (typeof dropOff === 'object' && dropOff !== null && dropOff.x === c && dropOff.y === r) {
                        cell.classList.add('drop-off');
                        cell.dataset.clickAction = 'focus-materials';
                        const box = document.createElement('span');
                        // warehouse icon
                        box.className = 'drop-off-marker warehouse';
                        box.textContent = '🏭';
                        box.title = 'Warehouse (drop-off)';
                        cell.appendChild(box);
                        cell.style.cursor = 'pointer';
                    }
            } else {
                // color indicates material; title shows name + rounded-up hardness
                if (mat) cell.style.background = mat.color;
                
                const displayHardness = Math.ceil(rawHardness);
                // show current hardness value inside the cell (rounded up for clarity)
                if (standingHere.length > 0) {
                    // mark the cell with the background emoji and render hardness text normally
                    cell.classList.add('has-dwarf');
                    cell.textContent = '';
                    cell.setAttribute('aria-label', `row ${r} col ${c} hardness ${displayHardness} dwarfs ${standingHere.map(d => d.name).join(', ')}`);
                    if (diggersHere.length > 0) {
                        cell.classList.add('is-digging');
                        const digMarker = document.createElement('span');
                        digMarker.className = 'digging-marker strike';
                        digMarker.textContent = '⛏️';
                        cell.appendChild(digMarker);
                    } else {
                        cell.classList.remove('is-digging');
                    }
                } else {
                    cell.classList.remove('has-dwarf');
                    cell.textContent = '';
                    cell.setAttribute('aria-label', `row ${r} col ${c} hardness ${displayHardness}`);
                }

                if (movingHere.length > 0) {
                    const mover = document.createElement('span');
                    mover.className = 'moving-marker';
                    mover.textContent = '🏃';
                    cell.appendChild(mover);
                }

                // show strike marker when dwarf is striking here
                const strikersHere = dwarfsHere.filter(d => d.status === 'striking');
                if (strikersHere.length > 0) {
                    const strike = document.createElement('span');
                    strike.className = 'striking-marker';
                    strike.textContent = '🪧';
                    strike.title = 'On strike - not enough gold!';
                    cell.appendChild(strike);
                }
            }

            rowEl.appendChild(cell);
        }
        tbody.appendChild(rowEl);
    }
        // dwarf status cards removed from main view — status is available in the Dwarfs modal
        // Update visible stock counts too
        // render the small drop-off grid (if present)
        const dropTable = document.getElementById('drop-grid');
        if (dropTable && typeof dropGridStartX === 'number' && typeof dropGridWidth === 'number' && typeof dropGridHeight === 'number') {
            let tb = dropTable.querySelector('tbody');
            if (!tb) { tb = document.createElement('tbody'); dropTable.appendChild(tb); }
            tb.innerHTML = '';
            for (let rr = 0; rr < dropGridHeight; rr++) {
                const rowEl = document.createElement('tr');
                for (let cc = 0; cc < dropGridWidth; cc++) {
                    const gx = dropGridStartX + cc;
                    const gy = rr;
                    const cell = document.createElement('td');
                    cell.className = 'cell';
                    cell.dataset.row = rr;
                    cell.dataset.col = cc;
                    // find dwarfs at this location
                    const dwarfsHere = Array.isArray(dwarfs) ? dwarfs.filter(d => d.x === gx && d.y === gy) : [];
                    const movingHere = dwarfsHere.filter(d => d.status === 'moving');
                    const standingHere = dwarfsHere.filter(d => d.status !== 'moving');
                    const diggersHere = dwarfsHere.filter(d => d.status === 'digging');

                    // drop-grid is intentionally empty for now — show dwarfs or markers
                    if (standingHere.length > 0) {
                        cell.classList.add('has-dwarf');
                        cell.textContent = '';
                        cell.title = `${standingHere.map(d => d.name).join(', ')}`;
                        if (diggersHere.length > 0) {
                            cell.classList.add('is-digging');
                            const digMarker = document.createElement('span');
                            digMarker.className = 'digging-marker strike';
                            digMarker.textContent = '⛏️';
                            cell.appendChild(digMarker);
                        }
                    } else {
                        cell.textContent = '';
                    }

                    if (movingHere.length > 0) {
                        const mover = document.createElement('span');
                        mover.className = 'moving-marker';
                        mover.textContent = '🏃';
                        cell.appendChild(mover);
                    }

                    // show drop-off marker if this is the configured dropOff
                    if (typeof dropOff === 'object' && dropOff !== null && dropOff.x === gx && dropOff.y === gy) {
                        cell.classList.add('drop-off');
                        cell.dataset.clickAction = 'focus-materials';
                        const box = document.createElement('span');
                        box.className = 'drop-off-marker warehouse';
                        box.textContent = '🏭';
                        box.title = 'Warehouse (drop-off)';
                        cell.appendChild(box);
                        cell.style.cursor = 'pointer';
                    }

                    // show house / bed icon if this is the house cell
                    if (typeof house === 'object' && house !== null && house.x === gx && house.y === gy) {
                        cell.style.cursor = 'pointer';
                        cell.dataset.clickAction = 'open-dwarfs';
                        
                        // Create container for icon and badge with absolute positioning
                        const iconContainer = document.createElement('span');
                        iconContainer.style.cssText = 'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3;';
                        
                        const bed = document.createElement('span');
                        bed.style.cssText = 'position: relative; display: inline-block; font-size: 18px; opacity: 0.95;';
                        bed.textContent = '🏠';
                        
                        // Check if any dwarf can level up
                        const dwarfsCanLevelUp = dwarfs.filter(d => {
                            const currentXP = d.xp || 0;
                            const currentLevel = d.level || 1;
                            const xpNeeded = 250 * currentLevel;
                            return currentXP >= xpNeeded;
                        });
                        
                        if (dwarfsCanLevelUp.length > 0) {
                            bed.title = `House (${dwarfsCanLevelUp.length} dwarf(s) ready to level up!)`;
                            // Add notification badge
                            const badge = document.createElement('span');
                            badge.className = 'notification-badge';
                            badge.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #ff6b6b; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 2px solid white; animation: pulse 1.5s ease-in-out infinite;';
                            badge.textContent = dwarfsCanLevelUp.length;
                            bed.appendChild(badge);
                        } else {
                            bed.title = 'House (open dwarfs overview)';
                        }
                        
                        iconContainer.appendChild(bed);
                        cell.appendChild(iconContainer);
                    }

                    // show workbench icon if this is the workbench cell
                    if (typeof workbench === 'object' && workbench !== null && workbench.x === gx && workbench.y === gy) {
                        cell.style.cursor = 'pointer';
                        cell.dataset.clickAction = 'open-workbench';
                        
                        // Create container for icon and badge with absolute positioning
                        const iconContainer = document.createElement('span');
                        iconContainer.style.cssText = 'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3;';
                        
                        const bench = document.createElement('span');
                        bench.style.cssText = 'position: relative; display: inline-block; font-size: 18px; opacity: 0.95;';
                        bench.textContent = '🔨';
                        
                        // Check if any tool can be upgraded
                        const toolsCanUpgrade = toolsInventory.filter(toolInstance => {
                            const upgradeCost = getToolUpgradeCost(toolInstance.type, toolInstance.level);
                            return gold >= upgradeCost;
                        });
                        
                        if (toolsCanUpgrade.length > 0) {
                            bench.title = `Workbench (${toolsCanUpgrade.length} tool(s) can be upgraded!)`;
                            // Add notification badge
                            const badge = document.createElement('span');
                            badge.className = 'notification-badge';
                            badge.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #4CAF50; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 2px solid white; animation: pulse 1.5s ease-in-out infinite;';
                            badge.textContent = toolsCanUpgrade.length;
                            bench.appendChild(badge);
                        } else {
                            bench.title = 'Workbench (craft tools)';
                        }
                        
                        iconContainer.appendChild(bench);
                        cell.appendChild(iconContainer);
                    }

                    // show research icon if this is the research cell
                    if (typeof research === 'object' && research !== null && research.x === gx && research.y === gy) {
                        cell.style.cursor = 'pointer';
                        cell.dataset.clickAction = 'open-research';
                        
                        // Add research icon
                        const researchIcon = document.createElement('span');
                        researchIcon.className = 'drop-off-marker research';
                        researchIcon.textContent = '🔬';
                        researchIcon.title = 'Research Lab';
                        cell.appendChild(researchIcon);
                        
                        // Add progress bar if research is active
                        if (activeResearch) {
                            const progress = activeResearch.progress || 0;
                            const actualCost = activeResearch.cost * Math.pow(2, activeResearch.level || 0);
                            const progressPercent = Math.min(100, Math.floor((progress / actualCost) * 100));
                            
                            const progressContainer = document.createElement('div');
                            progressContainer.className = 'research-progress-container';
                            progressContainer.style.cssText = 'position: absolute; bottom: 2px; left: 2px; right: 2px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 2px; overflow: hidden;';
                            
                            const progressBar = document.createElement('div');
                            progressBar.className = 'research-progress-bar';
                            progressBar.style.cssText = `height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); width: ${progressPercent}%; transition: width 0.3s ease;`;
                            
                            progressContainer.appendChild(progressBar);
                            cell.appendChild(progressContainer);
                            
                            // Update title with progress info
                            researchIcon.title = `Research Lab\n${activeResearch.name}: ${progress}/${actualCost} (${progressPercent}%)`;
                        }
                    }

                    // show resting marker when dwarf is resting here
                    const restersHere = dwarfsHere.filter(d => d.status === 'resting');
                    if (restersHere.length > 0) {
                        const sleep = document.createElement('span');
                        sleep.className = 'resting-marker';
                        sleep.textContent = '😴';
                        cell.appendChild(sleep);
                    }

                    // show researching marker when dwarf is researching here
                    const researchersHere = dwarfsHere.filter(d => d.status === 'researching');
                    if (researchersHere.length > 0) {
                        const researchMarker = document.createElement('span');
                        researchMarker.className = 'researching-marker';
                        researchMarker.textContent = '📚';
                        researchMarker.title = 'Researching';
                        cell.appendChild(researchMarker);
                    }

                    // show strike marker when dwarf is striking here
                    const strikersHere = dwarfsHere.filter(d => d.status === 'striking');
                    if (strikersHere.length > 0) {
                        const strike = document.createElement('span');
                        strike.className = 'striking-marker';
                        strike.textContent = '🪧';
                        strike.title = 'On strike - not enough gold!';
                        cell.appendChild(strike);
                    }

                    // Show unloading animation when dwarf is unloading here
                    const unloadersHere = dwarfsHere.filter(d => d.status === 'unloading');
                    if (unloadersHere.length > 0) {
                        const anim = document.createElement('span');
                        anim.className = 'unloading-marker';
                        const crate = document.createElement('span');
                        crate.className = 'crate';
                        crate.textContent = '📦';
                        anim.appendChild(crate);
                        cell.appendChild(anim);
                    }

                    rowEl.appendChild(cell);
                }
                tb.appendChild(rowEl);
            }
        }

        updateMaterialsPanel();
        updateStockDisplay();
        updateGoldDisplay();
        refreshTooltipAfterRedraw();
}

    // dwarf-status UI removed from header; the Dwarfs modal shows this information when requested

function openWorkbench() {
    openModal('workbench-modal');
    populateWorkbench();
}

function openResearch() {
    openModal('research-modal');
    populateResearch();
}

function populateResearch() {
    const container = document.getElementById('research-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Show active research if any
    if (activeResearch) {
        const activeDiv = document.createElement('div');
        activeDiv.className = 'active-research';
        const progress = activeResearch.progress || 0;
        // Calculate actual cost for current level (doubles each level)
        const actualCost = activeResearch.cost * Math.pow(2, activeResearch.level || 0);
        const progressPercent = Math.floor((progress / actualCost) * 100);
        activeDiv.innerHTML = `
            <h3>🔬 Currently Researching</h3>
            <p><strong>${activeResearch.name}</strong></p>
            <p>${activeResearch.description}</p>
            <p>Progress: ${progress} / ${actualCost} (${progressPercent}%)</p>
            <div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div>
        `;
        
        // Add cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel-research';
        cancelBtn.textContent = '✖ Cancel Research';
        cancelBtn.style.cssText = 'margin-top: 10px; width: 100%; padding: 8px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
        cancelBtn.onmouseover = () => { cancelBtn.style.background = '#ff5252'; };
        cancelBtn.onmouseout = () => { cancelBtn.style.background = '#ff6b6b'; };
        cancelBtn.onclick = () => {
            if (confirm(`Cancel research on ${activeResearch.name}? Progress will be lost.`)) {
                cancelResearch();
            }
        };
        activeDiv.appendChild(cancelBtn);
        
        container.appendChild(activeDiv);
    }
    
    const researchTable = document.createElement('table');
    researchTable.className = 'research-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Research</th><th>Level</th><th>Cost</th><th>Action</th></tr>';
    researchTable.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // Show all researchable items
    for (const researchItem of researchtree) {
        const currentLevel = researchItem.level || 0;
        const maxLevel = researchItem.maxlevel || Infinity;
        
        // Skip if max level reached
        if (currentLevel >= maxLevel) continue;
        
        const tr = document.createElement('tr');
        
        const nameTd = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.innerHTML = `<strong>${researchItem.name}</strong><br><small>${researchItem.description}</small>`;
        nameTd.appendChild(nameDiv);
        
        const levelTd = document.createElement('td');
        levelTd.textContent = `${currentLevel} / ${maxLevel === Infinity ? '∞' : maxLevel}`;
        
        const costTd = document.createElement('td');
        // Calculate actual cost for next level (doubles each level)
        const actualCost = researchItem.cost * Math.pow(2, currentLevel);
        costTd.textContent = `${actualCost} 🔬`;
        costTd.title = 'Research points required';
        
        const actionTd = document.createElement('td');
        const researchBtn = document.createElement('button');
        
        // Check if this research is already active
        const isActive = activeResearch && activeResearch.id === researchItem.id;
        
        if (isActive) {
            researchBtn.className = 'btn-research active';
            researchBtn.textContent = 'Active';
            researchBtn.disabled = true;
        } else if (activeResearch) {
            // Another research is active
            researchBtn.className = 'btn-research disabled';
            researchBtn.textContent = 'Research';
            researchBtn.disabled = true;
            researchBtn.title = 'Another research is in progress';
        } else {
            researchBtn.className = 'btn-research';
            researchBtn.textContent = 'Research';
            researchBtn.onclick = () => startResearch(researchItem.id);
        }
        
        actionTd.appendChild(researchBtn);
        
        tr.appendChild(nameTd);
        tr.appendChild(levelTd);
        tr.appendChild(costTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }
    
    researchTable.appendChild(tbody);
    container.appendChild(researchTable);
}

function startResearch(researchId) {
    const researchItem = researchtree.find(r => r.id === researchId);
    if (!researchItem) {
        console.error('Research not found:', researchId);
        return;
    }
    
    // Check if another research is active
    if (activeResearch) {
        console.error('Another research is already active');
        return;
    }
    
    // Initialize progress if not set
    if (researchItem.progress === undefined) {
        researchItem.progress = 0;
    }
    
    // Set as active
    activeResearch = researchItem;
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: activeResearch,
                researchtree: researchtree
            }
        });
    }
    
    // Update displays
    populateResearch();
    saveGame();
    
    console.log(`Started researching: ${researchItem.name}`);
}

function cancelResearch() {
    if (!activeResearch) {
        console.warn('No active research to cancel');
        return;
    }
    
    const researchName = activeResearch.name;
    
    // Clear active research
    activeResearch = null;
    
    // Make all researching dwarfs idle
    for (const dwarf of dwarfs) {
        if (dwarf.status === 'researching') {
            dwarf.status = 'idle';
        }
    }
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: null,
                dwarfs: dwarfs
            }
        });
    }
    
    // Update displays
    populateResearch();
    saveGame();
    
    console.log(`Cancelled research: ${researchName}`);
}

function populateWorkbench() {
    const container = document.getElementById('workbench-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    const toolsTable = document.createElement('table');
    toolsTable.className = 'workbench-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Dwarf</th><th>Tool</th><th>Quality</th><th>Power</th><th>Upgrade Cost</th><th>Action</th></tr>';
    toolsTable.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // Show each individual tool in inventory
    for (const toolInstance of toolsInventory) {
        const tr = document.createElement('tr');
        
        // Find which dwarf has this tool
        const dwarf = dwarfs.find(d => d.toolId === toolInstance.id);
        const dwarfTd = document.createElement('td');
        dwarfTd.textContent = dwarf ? dwarf.name : 'Unassigned';
        dwarfTd.className = 'dwarf-name';
        
        const nameTd = document.createElement('td');
        nameTd.textContent = `${toolInstance.type} #${toolInstance.id}`;
        nameTd.className = 'tool-name';
        
        const levelTd = document.createElement('td');
        levelTd.textContent = toolInstance.level;
        levelTd.className = 'tool-level';
        
        const powerTd = document.createElement('td');
        const power = getToolPower(toolInstance.type, toolInstance.level);
        powerTd.textContent = power.toFixed(2);
        powerTd.className = 'tool-power';
        
        const costTd = document.createElement('td');
        const upgradeCost = getToolUpgradeCost(toolInstance.type, toolInstance.level);
        costTd.textContent = `${upgradeCost.toFixed(0)} 💰`;
        costTd.className = 'tool-cost';
        
        const actionTd = document.createElement('td');
        const upgradeBtn = document.createElement('button');
        upgradeBtn.className = 'btn-upgrade';
        upgradeBtn.textContent = `Upgrade`;
        const newPower = getToolPower(toolInstance.type, toolInstance.level + 1);
        upgradeBtn.title = `Upgrade to quality ${toolInstance.level + 1}\nNew power: ${newPower.toFixed(2)}`;
        upgradeBtn.onclick = () => upgradeTool(toolInstance.id);
        
        if (gold < upgradeCost) {
            upgradeBtn.disabled = true;
            upgradeBtn.classList.add('disabled');
        }
        
        actionTd.appendChild(upgradeBtn);
        
        tr.appendChild(dwarfTd);
        tr.appendChild(nameTd);
        tr.appendChild(levelTd);
        tr.appendChild(powerTd);
        tr.appendChild(costTd);
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
    }
    
    if (tbody.children.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'No tools in inventory';
        td.style.textAlign = 'center';
        td.style.padding = '20px';
        td.style.opacity = '0.6';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
    
    toolsTable.appendChild(tbody);
    container.appendChild(toolsTable);
}

function upgradeTool(toolId) {
    const toolInstance = toolsInventory.find(t => t.id === toolId);
    if (!toolInstance) {
        console.warn('Tool not found in inventory', toolId);
        return;
    }
    
    const upgradeCost = getToolUpgradeCost(toolInstance.type, toolInstance.level);
    
    if (gold < upgradeCost) {
        console.warn('Not enough gold to upgrade', toolInstance.type);
        return;
    }
    
    // Deduct gold and increase level
    gold -= upgradeCost;
    toolInstance.level += 1;
    
    // Update worker state
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                gold: gold,
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Update UI
    updateGoldDisplay();
    populateWorkbench();
    
    // Save game
    saveGame();
    
    const newPower = getToolPower(toolInstance.type, toolInstance.level);
    console.log(`Upgraded ${toolInstance.type} #${toolId} to level ${toolInstance.level} (power: ${newPower.toFixed(2)})`);
}

function openSettings() {
    // Pause game when opening settings
    if (!gamePaused) {
        togglePause();
    }
    // Open the settings modal
    openModal('settings-modal');
}

function openModal(modalname) {
    const modal = document.getElementById(modalname);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
}

function closeModal(modalName) {
    // If a modalName is provided, close that specific modal; otherwise close all open modals
    if (modalName) {
        const m = document.getElementById(modalName);
        if (m) {
            m.setAttribute('aria-hidden', 'true');
            m.style.display = 'none';
        }
        // If we just closed the dwarfs modal, stop live updates
        if (modalName === 'dwarfs-modal') stopDwarfsLiveUpdate();
        return;
    }
    // close any open modal
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
        const id = m.id;
        m.setAttribute('aria-hidden','true');
        m.style.display = 'none';
        if (id === 'dwarfs-modal') stopDwarfsLiveUpdate();
    });
}

// Switch the materials panel to show dwarfs overview
function openDwarfs() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Mark panel as showing dwarfs view
    panel.dataset.view = 'dwarfs';
    
    // Update header
    const header = panel.querySelector('.materials-panel-header h3');
    if (header) header.textContent = 'Dwarfs';
    
    // Populate dwarfs content in the materials-list container
    populateDwarfsInPanel();
    startDwarfsLiveUpdate();
}

function closeDwarfs() {
    stopDwarfsLiveUpdate();
    showWarehousePanel();
}

// Switch back to warehouse view
function showWarehousePanel() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Mark panel as showing warehouse view
    panel.dataset.view = 'warehouse';
    
    // Update header
    const header = panel.querySelector('.materials-panel-header h3');
    if (header) header.textContent = 'Warehouse';
    
    // Show warehouse content
    stopDwarfsLiveUpdate();
    updateMaterialsPanel();
}

// Populate the dwarfs modal with a compact table showing state for each dwarf
function populateDwarfsOverview() {
    const container = document.getElementById('dwarfs-list');
    if (!container) return;
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'dwarfs-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Name</th><th>Level</th><th>XP</th><th>Tool</th><th>Status</th><th>Energy</th><th>Action</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const d of dwarfs) {
        const tr = document.createElement('tr');

        // create cells manually so bucket can render one resource per line
        const nameTd = document.createElement('td'); nameTd.textContent = d.name;
        const levelTd = document.createElement('td'); levelTd.textContent = d.level ?? '-';
        
        // XP display with progress to next level
        const xpTd = document.createElement('td');
        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = 250 * currentLevel;
        xpTd.textContent = `${currentXP} / ${xpNeeded}`;
        
        // Find the tool assigned to this dwarf
        const toolTd = document.createElement('td');
        if (d.toolId) {
            const toolInstance = toolsInventory.find(t => t.id === d.toolId);
            if (toolInstance) {
                toolTd.textContent = `${toolInstance.type} (Q${toolInstance.level})`;
            } else {
                toolTd.textContent = `Tool #${d.toolId}`;
            }
        } else {
            toolTd.textContent = '-';
        }
        
        const statusTd = document.createElement('td'); statusTd.textContent = d.status ?? 'idle';
        const energyTd = document.createElement('td'); energyTd.textContent = (typeof d.energy === 'number') ? d.energy : '-';
        
        // Action column - show level up button if XP threshold reached
        const actionTd = document.createElement('td');
        if (currentXP >= xpNeeded) {
            const levelUpBtn = document.createElement('button');
            levelUpBtn.className = 'btn-levelup';
            levelUpBtn.textContent = 'Level Up!';
            levelUpBtn.onclick = () => openLevelUpModal(d);
            actionTd.appendChild(levelUpBtn);
        }

        tr.appendChild(nameTd);
        tr.appendChild(levelTd);
        tr.appendChild(xpTd);
        tr.appendChild(toolTd);
        tr.appendChild(statusTd);
        tr.appendChild(energyTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

// Populate dwarfs in the materials panel (not modal)
function populateDwarfsInPanel() {
    const list = document.getElementById('materials-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Create a compact list of dwarfs
    for (const d of dwarfs) {
        const row = document.createElement('div');
        row.className = 'dwarf-row';
        
        const name = document.createElement('div');
        name.className = 'dwarf-name';
        name.textContent = d.name;
        
        const infoContainer = document.createElement('div');
        infoContainer.className = 'dwarf-info-container';
        
        const info = document.createElement('div');
        info.className = 'dwarf-info';
        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = 250 * currentLevel;
        info.textContent = `Lvl. ${currentLevel} (${currentXP}/${xpNeeded} XP) •⚡${d.energy || 0} • ${d.status || 'idle'}`;
        
        infoContainer.appendChild(info);
        
        // Add level up button if XP threshold reached
        if (currentXP >= xpNeeded) {
            const levelUpBtn = document.createElement('button');
            levelUpBtn.className = 'btn-levelup btn-levelup-small';
            levelUpBtn.textContent = 'Level Up!';
            levelUpBtn.onclick = () => openLevelUpModal(d);
            infoContainer.appendChild(levelUpBtn);
        }
        
        row.appendChild(name);
        row.appendChild(infoContainer);
        list.appendChild(row);
    }
}

// Open level up modal for a dwarf
function openLevelUpModal(dwarf) {
    const modal = document.getElementById('levelup-modal');
    if (!modal) {
        console.error('Level up modal not found');
        return;
    }
    
    // Store the dwarf being leveled up
    modal.dataset.dwarfName = dwarf.name;
    
    // Populate level up options
    const content = document.getElementById('levelup-content');
    content.innerHTML = '';
    
    const title = document.createElement('h3');
    const xpNeeded = 250 * dwarf.level;
    const currentXP = dwarf.xp || 0;
    const hasEnoughXP = currentXP >= xpNeeded;
    title.textContent = `${dwarf.name} - Level ${dwarf.level} → ${dwarf.level + 1}`;
    content.appendChild(title);
    
    // Show XP status
    const xpStatus = document.createElement('p');
    xpStatus.style.textAlign = 'center';
    xpStatus.style.fontSize = '14px';
    xpStatus.style.marginBottom = '15px';
    if (hasEnoughXP) {
        xpStatus.textContent = `XP: ${currentXP} / ${xpNeeded} ✓`;
        xpStatus.style.color = '#4CAF50';
    } else {
        xpStatus.textContent = `XP: ${currentXP} / ${xpNeeded} (Not enough XP)`;
        xpStatus.style.color = '#ff6b6b';
    }
    content.appendChild(xpStatus);
    
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'levelup-options';
    
    // Option 1: Dig Power
    const digPowerOption = document.createElement('div');
    digPowerOption.className = 'levelup-option';
    digPowerOption.innerHTML = `
        <h4>⛏️ Dig Power</h4>
        <p>Increases digging power by 10%</p>
        <p class="levelup-stats">Current: +${(dwarf.digPower || 0) * 10}% → New: +${((dwarf.digPower || 0) + 1) * 10}%</p>
    `;
    const digPowerBtn = document.createElement('button');
    digPowerBtn.className = 'btn-primary';
    digPowerBtn.textContent = 'Choose Dig Power';
    digPowerBtn.onclick = () => applyLevelUp(dwarf, 'digPower');
    if (!hasEnoughXP) {
        digPowerBtn.disabled = true;
        digPowerBtn.classList.add('disabled');
    }
    digPowerOption.appendChild(digPowerBtn);
    
    // Option 2: Max Energy
    const energyOption = document.createElement('div');
    energyOption.className = 'levelup-option';
    energyOption.innerHTML = `
        <h4>⚡ Max Energy</h4>
        <p>Increases maximum energy by 20%</p>
        <p class="levelup-stats">Current: ${dwarf.maxEnergy || 100} → New: ${Math.floor((dwarf.maxEnergy || 100) * 1.2)}</p>
    `;
    const energyBtn = document.createElement('button');
    energyBtn.className = 'btn-primary';
    energyBtn.textContent = 'Choose Max Energy';
    energyBtn.onclick = () => applyLevelUp(dwarf, 'maxEnergy');
    if (!hasEnoughXP) {
        energyBtn.disabled = true;
        energyBtn.classList.add('disabled');
    }
    energyOption.appendChild(energyBtn);
    
    // Option 3: Strength
    const strengthOption = document.createElement('div');
    strengthOption.className = 'levelup-option';
    strengthOption.innerHTML = `
        <h4>💪 Strength</h4>
        <p>Increases bucket capacity by 1</p>
        <p class="levelup-stats">Current: ${4 + (dwarf.strength || 0)} → New: ${4 + (dwarf.strength || 0) + 1}</p>
    `;
    const strengthBtn = document.createElement('button');
    strengthBtn.className = 'btn-primary';
    strengthBtn.textContent = 'Choose Strength';
    strengthBtn.onclick = () => applyLevelUp(dwarf, 'strength');
    if (!hasEnoughXP) {
        strengthBtn.disabled = true;
        strengthBtn.classList.add('disabled');
    }
    strengthOption.appendChild(strengthBtn);
    
    // Option 4: Wisdom
    const wisdomOption = document.createElement('div');
    wisdomOption.className = 'levelup-option';
    wisdomOption.innerHTML = `
        <h4>🧠 Wisdom</h4>
        <p>Increases research speed by +1 per tick</p>
        <p class="levelup-stats">Current: +${1 + (dwarf.wisdom || 0)}/tick → New: +${1 + (dwarf.wisdom || 0) + 1}/tick</p>
    `;
    const wisdomBtn = document.createElement('button');
    wisdomBtn.className = 'btn-primary';
    wisdomBtn.textContent = 'Choose Wisdom';
    wisdomBtn.onclick = () => applyLevelUp(dwarf, 'wisdom');
    if (!hasEnoughXP) {
        wisdomBtn.disabled = true;
        wisdomBtn.classList.add('disabled');
    }
    wisdomOption.appendChild(wisdomBtn);
    
    optionsDiv.appendChild(digPowerOption);
    optionsDiv.appendChild(energyOption);
    optionsDiv.appendChild(strengthOption);
    optionsDiv.appendChild(wisdomOption);
    content.appendChild(optionsDiv);
    
    // Add Next button if there are more dwarfs that can level up
    const dwarfsCanLevelUp = dwarfs.filter(d => {
        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = 250 * currentLevel;
        return currentXP >= xpNeeded;
    });
    
    if (dwarfsCanLevelUp.length > 1) {
        const currentIndex = dwarfsCanLevelUp.findIndex(d => d.name === dwarf.name);
        const nextDwarf = dwarfsCanLevelUp[(currentIndex + 1) % dwarfsCanLevelUp.length];
        
        const nextBtnContainer = document.createElement('div');
        nextBtnContainer.style.cssText = 'margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;';
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary';
        nextBtn.textContent = `Next: ${nextDwarf.name} →`;
        nextBtn.style.cssText = 'background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); padding: 10px 20px;';
        nextBtn.onclick = () => openLevelUpModal(nextDwarf);
        
        nextBtnContainer.appendChild(nextBtn);
        content.appendChild(nextBtnContainer);
    }
    
    // Show modal
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
}

// Apply the chosen level up upgrade
function applyLevelUp(dwarf, upgradeType) {
    const xpNeeded = 250 * dwarf.level;
    
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
            break;
        case 'maxEnergy':
            actualDwarf.maxEnergy = Math.floor((actualDwarf.maxEnergy || 100) * 1.2);
            actualDwarf.energy = Math.min(actualDwarf.energy, actualDwarf.maxEnergy); // Cap current energy
            break;
        case 'strength':
            actualDwarf.strength = (actualDwarf.strength || 0) + 1;
            break;
        case 'wisdom':
            actualDwarf.wisdom = (actualDwarf.wisdom || 0) + 1;
            break;
    }
    
    // Reset dwarf position and status after leveling up to prevent getting stuck
    actualDwarf.status = 'idle';
    actualDwarf.moveTarget = null;
    // Move dwarf to house location to ensure valid position
    if (typeof house === 'object' && house !== null) {
        actualDwarf.x = house.x;
        actualDwarf.y = house.y;
    }
    
    // Sync state with worker
    gameWorker.postMessage({
        type: 'update-state',
        data: { dwarfs }
    });
    
    // Save game
    saveGame();
    
    // Close the modal after successful level up
    closeModal('levelup-modal');
    
    // Refresh dwarf display
    populateDwarfsOverview();
    populateDwarfsInPanel();
    
    console.log(`${actualDwarf.name} leveled up to ${actualDwarf.level}! Chose ${upgradeType}`);
}

// ---- live-update for the dwarfs panel/modal ----
let _dwarfsModalRefreshId = null;
function startDwarfsLiveUpdate(intervalMs = 1000) {
    if (_dwarfsModalRefreshId) return;
    // Refresh immediately and then on an interval while view is active
    _dwarfsModalRefreshId = setInterval(() => {
        const panel = document.getElementById('materials-panel');
        // Check if we're still in dwarfs view
        if (panel && panel.dataset.view === 'dwarfs') {
            populateDwarfsInPanel();
        } else {
            // If not in dwarfs view, stop the interval
            stopDwarfsLiveUpdate();
        }
    }, intervalMs);
}

function stopDwarfsLiveUpdate() {
    if (!_dwarfsModalRefreshId) return;
    clearInterval(_dwarfsModalRefreshId);
    _dwarfsModalRefreshId = null;
}

// clicking on any element with data-action="close-modal" closes modals
document.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el) return;
    if (el.dataset && el.dataset.action === 'close-modal') {
        closeModal();
    }
});

// Delegated event handler for grid cell clicks (prevents adding listeners on every render)
document.addEventListener('click', (ev) => {
    const cell = ev.target.closest('td.cell[data-click-action]');
    if (!cell) return;
    
    const action = cell.dataset.clickAction;
    ev.stopPropagation();
    
    switch(action) {
        case 'focus-materials':
            focusMaterialsPanel();
            break;
        case 'open-dwarfs':
            openDwarfs();
            break;
        case 'open-workbench':
            openWorkbench();
            break;
        case 'open-research':
            openResearch();
            break;
    }
});

function initUI() {
    createGrid(10); // Initialize the grid with 10 rows
}

// Render the global materials stock into the header area
let materialsPanelHighlightTimer = null;

function updateStockDisplay() {
    const container = document.getElementById('stock-status');
    if (!container) return;
    // stock has moved into the inline panel — keep the header pill area empty
    container.innerHTML = '';
    container.style.display = 'none';
}

function updateGoldDisplay() {
    const goldAmount = document.querySelector('#gold-display .gold-amount');
    if (goldAmount && typeof gold === 'number') {
        goldAmount.textContent = gold.toFixed(2);
    }
}

function sellMaterial(materialId, amount) {
    console.log('sellMaterial called:', materialId, amount);
    if (!materialsStock[materialId] || materialsStock[materialId] < amount) {
        console.warn(`Not enough ${materialId} to sell`);
        return;
    }
    
    const material = getMaterialById(materialId);
    if (!material) {
        console.warn(`Material ${materialId} not found`);
        return;
    }
    
    // Apply better-trading research bonus (3% per level)
    const betterTrading = researchtree.find(r => r.id === 'trading');
    const tradeBonus = betterTrading ? 1 + (betterTrading.level || 0) * 0.03 : 1;
    
    // Calculate earnings with trade bonus
    const earnings = material.worth * amount * tradeBonus;
    
    // Update stock and gold
    materialsStock[materialId] -= amount;
    gold += earnings;
    
    // Update the worker's state with new values
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                materialsStock: materialsStock,
                gold: gold,
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Update UI
    updateMaterialsPanel();
    updateGoldDisplay();
    
    // Save game
    saveGame();
    
    console.log(`Sold ${amount} ${material.name} for ${earnings.toFixed(2)} gold (${tradeBonus.toFixed(2)}x bonus)`);
}

function updateMaterialsPanel() {
    const panel = document.getElementById('materials-panel');
    // Only update if we're in warehouse view (or view not set)
    if (panel && panel.dataset.view === 'dwarfs') return;
    
    // Calculate trade bonus once for display
    const betterTrading = researchtree.find(r => r.id === 'trading');
    const tradeBonus = betterTrading ? 1 + (betterTrading.level || 0) * 0.03 : 1;
    
    const list = document.getElementById('materials-list');
    if (!list) return;
    list.innerHTML = '';
    for (const m of materials) {
        const id = m.id;
        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        // Skip materials with 0 stock
        if (count === 0) continue;
        
        const row = document.createElement('div');
        row.className = 'warehouse-row';
        
        const info = document.createElement('div');
        info.className = 'warehouse-info';
        
        const name = document.createElement('span');
        name.className = 'warehouse-name';
        name.textContent = m.name;
        
        const worth = document.createElement('span');
        worth.className = 'warehouse-worth';
        const actualWorth = m.worth * tradeBonus;
        worth.textContent = `${actualWorth.toFixed(2)} 💰`;
        worth.title = tradeBonus > 1 ? `Base: ${m.worth.toFixed(2)} gold (${tradeBonus.toFixed(2)}x bonus)` : `Worth: ${m.worth.toFixed(2)} gold each`;
        
        const cnt = document.createElement('span');
        cnt.className = 'warehouse-count';
        cnt.textContent = String(count);
        
        info.appendChild(name);
        info.appendChild(worth);
        info.appendChild(cnt);
        
        const buttons = document.createElement('div');
        buttons.className = 'warehouse-buttons';
        
        const sell1Btn = document.createElement('button');
        sell1Btn.className = 'btn-sell';
        sell1Btn.textContent = 'Sell 1';
        sell1Btn.title = `Sell 1 ${m.name} for ${actualWorth.toFixed(2)} gold`;
        sell1Btn.onclick = () => {
            console.log('Sell 1 button clicked for', id);
            sellMaterial(id, 1);
        };
        
        const sellAllBtn = document.createElement('button');
        sellAllBtn.className = 'btn-sell-all';
        sellAllBtn.textContent = 'Sell All';
        sellAllBtn.title = `Sell all ${count} ${m.name} for ${(count * actualWorth).toFixed(2)} gold`;
        sellAllBtn.onclick = () => {
            console.log('Sell All button clicked for', id);
            sellMaterial(id, count);
        };
        
        buttons.appendChild(sell1Btn);
        buttons.appendChild(sellAllBtn);
        
        row.appendChild(info);
        row.appendChild(buttons);
        list.appendChild(row);
    }
}

function focusMaterialsPanel() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Switch to warehouse view if not already
    if (panel.dataset.view !== 'warehouse') {
        showWarehousePanel();
    }
    
    panel.classList.add('materials-panel--highlight');
    if (materialsPanelHighlightTimer) clearTimeout(materialsPanelHighlightTimer);
    materialsPanelHighlightTimer = setTimeout(() => {
        panel.classList.remove('materials-panel--highlight');
    }, 1000);
}

function createCellTooltipElement() {
    const tooltip = document.createElement('div');
    tooltip.id = 'cell-tooltip';
    tooltip.className = 'cell-tooltip';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.innerHTML = '<div class="tooltip-title"></div><div class="tooltip-hardness"></div><div class="tooltip-dwarfs" aria-live="polite"></div>';
    document.body.appendChild(tooltip);
    return tooltip;
}

const cellTooltipElement = createCellTooltipElement();
const cellTooltipTitle = cellTooltipElement.querySelector('.tooltip-title');
const cellTooltipHardness = cellTooltipElement.querySelector('.tooltip-hardness');
const cellTooltipDwarfs = cellTooltipElement.querySelector('.tooltip-dwarfs');
const tooltipState = { lastRow: null, lastCol: null, lastMouseX: 0, lastMouseY: 0 };

function hideCellTooltip() {
    cellTooltipElement.classList.remove('visible');
    cellTooltipElement.style.left = '';
    cellTooltipElement.style.top = '';
    if (cellTooltipDwarfs) {
        cellTooltipDwarfs.textContent = '';
        cellTooltipDwarfs.style.display = 'none';
    }
    tooltipState.lastRow = null;
    tooltipState.lastCol = null;
    tooltipState.lastMouseX = 0;
    tooltipState.lastMouseY = 0;
}

function showCellTooltipFromEvent(cell, event) {
    if (!cell || !cellTooltipTitle || !cellTooltipHardness) return;
    const rowIndex = Number(cell.dataset.row);
    const colIndex = Number(cell.dataset.col);
    if (!Number.isFinite(rowIndex) || !Number.isFinite(colIndex)) {
        hideCellTooltip();
        return;
    }

    const cellData = grid[rowIndex] && grid[rowIndex][colIndex];
    if (!cellData) {
        hideCellTooltip();
        return;
    }

    const mouseX = event && typeof event.clientX === 'number' ? event.clientX : tooltipState.lastMouseX;
    const mouseY = event && typeof event.clientY === 'number' ? event.clientY : tooltipState.lastMouseY;

    const material = getMaterialById(cellData.materialId);
    const hardness = Math.max(0, Math.ceil(Number(cellData.hardness) || 0));
    const isDugOut = hardness <= 0;
    const label = isDugOut ? 'Cleared' : (material ? material.name : 'Unknown');
    cellTooltipTitle.textContent = label;
    cellTooltipHardness.textContent = isDugOut ? 'Fully dug out' : `Hardness ${hardness}`;

    if (cellTooltipDwarfs) {
        const dwarfsHere = Array.isArray(dwarfs) ? dwarfs.filter(d => d.x === colIndex && d.y === rowIndex) : [];
        if (dwarfsHere.length > 0) {
            const statuses = dwarfsHere.map(d => {
                const state = d.status || 'idle';
                return `${d.name} (${state})`;
            });
            cellTooltipDwarfs.textContent = `Dwarfs: ${statuses.join(', ')}`;
            cellTooltipDwarfs.style.display = 'block';
        } else {
            cellTooltipDwarfs.textContent = '';
            cellTooltipDwarfs.style.display = 'none';
        }
    }

    cellTooltipElement.classList.add('visible');
    const offset = 12;
    const tooltipRect = cellTooltipElement.getBoundingClientRect();
    const maxLeft = window.innerWidth - tooltipRect.width - 8;
    const maxTop = window.innerHeight - tooltipRect.height - 8;
    const left = Math.min(maxLeft, mouseX + offset);
    const top = Math.min(maxTop, mouseY + offset);
    cellTooltipElement.style.left = `${Math.max(8, left)}px`;
    cellTooltipElement.style.top = `${Math.max(8, top)}px`;

    tooltipState.lastRow = rowIndex;
    tooltipState.lastCol = colIndex;
    tooltipState.lastMouseX = mouseX;
    tooltipState.lastMouseY = mouseY;
}

function handleGridTooltipMove(event) {
    const cell = event.target.closest('#digging-grid td.cell');
    if (!cell) {
        hideCellTooltip();
        return;
    }
    showCellTooltipFromEvent(cell, event);
}

function initGridTooltip() {
    const gridTable = document.getElementById('digging-grid');
    if (!gridTable) return;
    gridTable.addEventListener('mousemove', handleGridTooltipMove);
    gridTable.addEventListener('mouseleave', hideCellTooltip);
}

initGridTooltip();

function refreshTooltipAfterRedraw() {
    if (!cellTooltipElement.classList.contains('visible')) return;
    const { lastRow, lastCol, lastMouseX, lastMouseY } = tooltipState;
    if (lastRow === null || lastCol === null) return;
    const selector = `#digging-grid td.cell[data-row="${lastRow}"][data-col="${lastCol}"]`;
    const cell = document.querySelector(selector);
    if (!cell) {
        hideCellTooltip();
        return;
    }
    showCellTooltipFromEvent(cell, { clientX: lastMouseX, clientY: lastMouseY });
}

// Web Worker for game calculations
let gameWorker = null;
let workerInitialized = false;
let gameTickIntervalId = null;
let gamePaused = false;

function initWorker() {
    gameWorker = new Worker('js/game-worker.js');
    
    gameWorker.addEventListener('message', (e) => {
        const { type, data, error } = e.data;
        
        switch (type) {
            case 'init-complete':
                workerInitialized = true;
                console.log('Game worker initialized successfully');
                break;
                
            case 'tick-complete':
                // Update game state with worker results
                grid = data.grid;
                dwarfs = data.dwarfs;
                startX = data.startX;
                
                // Update materialsStock properties (can't reassign const)
                for (const key in data.materialsStock) {
                    materialsStock[key] = data.materialsStock[key];
                }
                
                // Update gold
                if (data.gold !== undefined) {
                    gold = data.gold;
                }
                
                // Update toolsInventory from worker (it might be modified during digging)
                if (data.toolsInventory) {
                    // Update the array in place to keep the reference
                    toolsInventory.length = 0;
                    toolsInventory.push(...data.toolsInventory);
                }
                
                // Update research state from worker
                if (data.activeResearch !== undefined) {
                    activeResearch = data.activeResearch;
                }
                if (data.researchtree) {
                    researchtree = data.researchtree;
                }
                
                // Update UI to reflect new state
                updateGridDisplay();
                
                // Autosave after each tick
                saveGame();
                break;
                
            case 'tick-error':
                console.error('Worker tick error:', error);
                break;
                
            default:
                console.warn('Unknown worker message type:', type);
        }
    });
    
    gameWorker.addEventListener('error', (e) => {
        console.error('Worker error:', e.message, e);
    });
    
    // Initialize worker with current game state
    gameWorker.postMessage({
        type: 'init',
        data: {
            grid,
            dwarfs,
            materials,
            tools,
            gridWidth,
            gridDepth,
            visibleDepth,
            startX,
            materialsStock,
            bucketCapacity,
            dropOff,
            house,
            research,
            dropGridStartX,
            gold,
            toolsInventory,
            activeResearch,
            researchtree
        }
    });
}

function tick() {
    // Don't tick if game is paused
    if (gamePaused) return;
    
    // Send tick request to worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({ type: 'tick' });
    } else {
        console.warn('Worker not ready yet');
    }
}

function togglePause() {
    gamePaused = !gamePaused;
    const btn = document.getElementById('pause-button');
    if (btn) {
        btn.textContent = gamePaused ? '▶️' : '⏸️';
        btn.title = gamePaused ? 'Resume game' : 'Pause game';
    }
    console.log(gamePaused ? 'Game paused' : 'Game resumed');
}

function saveGame() {
    try {
        const gameState = {
            grid: grid,
            dwarfs: dwarfs,
            startX: startX,
            materialsStock: materialsStock,
            toolsInventory: toolsInventory,
            gold: gold,
            researchtree: researchtree,
            activeResearch: activeResearch,
            timestamp: Date.now(),
            version: gameversion
        };
        localStorage.setItem('diggyDiggyGameState', JSON.stringify(gameState));
    } catch (e) {
        console.error('Failed to save game:', e);
    }
}

function loadGame() {
    try {
        const saved = localStorage.getItem('diggyDiggyGameState');
        if (!saved) {
            console.log('No saved game found');
            return false;
        }
        
        const gameState = JSON.parse(saved);
        
        // Check version - if mismatch, start new game
        if (gameState.version !== gameversion) {
            console.log(`Version mismatch: saved=${gameState.version}, current=${gameversion}. Starting new game.`);
            localStorage.removeItem('diggyDiggyGameState');
            return false;
        }
        
        // Restore game state
        grid = gameState.grid || [];
        dwarfs = gameState.dwarfs || [];
        startX = gameState.startX || 0;
        gold = gameState.gold !== undefined ? gameState.gold : 1000;
        
        // Restore materials stock
        if (gameState.materialsStock) {
            for (const key in gameState.materialsStock) {
                materialsStock[key] = gameState.materialsStock[key];
            }
        }
        
        // Restore tools inventory
        if (gameState.toolsInventory) {
            for (const key in gameState.toolsInventory) {
                toolsInventory[key] = gameState.toolsInventory[key];
            }
        }
        
        // Restore research tree
        if (gameState.researchtree) {
            researchtree = gameState.researchtree;
        }
        
        // Restore active research
        if (gameState.activeResearch) {
            activeResearch = gameState.activeResearch;
        }
        
        console.log('Game loaded from', new Date(gameState.timestamp));
        return true;
    } catch (e) {
        console.error('Failed to load game:', e);
        return false;
    }
}

function deleteSave() {
    if (confirm('Are you sure you want to delete your saved game? This cannot be undone.')) {
        try {
            localStorage.removeItem('diggyDiggyGameState');
            alert('Save deleted! The page will reload with a new game.');
            location.reload();
        } catch (e) {
            console.error('Failed to delete save:', e);
            alert('Failed to delete save.');
        }
    }
}

function initializeGame() {
    initWorker();
    gameTickIntervalId = setInterval(tick, 250); // Dwarfs dig every 250ms
    gamePaused = false; // Start with game running
    updateGameState();
}

// Initialize the game state
function initGame() {
    // Try to load saved game first
    const loaded = loadGame();
    
    if (!loaded) {
        // No saved game, generate new grid
        generateGrid();
    }
    
    updateGridDisplay();
    updateGoldDisplay();
}

// Start the game
initGame();