
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
    if (!tool) return 3;
    
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
                
                const displayHardness = rawHardness.toFixed(1);
                // show current hardness value inside the cell with one decimal
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

                    // show smelter icon if this is the smelter cell
                    if (typeof smelter === 'object' && smelter !== null && smelter.x === gx && smelter.y === gy) {
                        cell.style.cursor = 'pointer';
                        cell.dataset.clickAction = 'open-smelter';
                        
                        // Add smelter icon
                        const smelterIcon = document.createElement('span');
                        smelterIcon.className = 'drop-off-marker smelter';
                        smelterIcon.textContent = '♨️';
                        smelterIcon.title = 'Smelter';
                        cell.appendChild(smelterIcon);
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
                    // (Disabled - visual clutter with warehouse icon)
                    /*
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
                    */

                    rowEl.appendChild(cell);
                }
                tb.appendChild(rowEl);
            }
        }

        // Don't call updateMaterialsPanel here - it recreates buttons too frequently
        // Only update it when materials actually change (in sellMaterial function)
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

function openSmelter() {
    openModal('smelter-modal');
    populateSmelter();
}

function openTransactions() {
    openModal('transactions-modal');
    populateTransactions();
    
    // Set up auto-refresh every 2 seconds
    if (window.transactionRefreshInterval) {
        clearInterval(window.transactionRefreshInterval);
    }
    window.transactionRefreshInterval = setInterval(() => {
        // Only refresh if modal is still open
        const modal = document.getElementById('transactions-modal');
        if (modal && modal.getAttribute('aria-hidden') === 'false') {
            populateTransactions();
        } else {
            // Modal closed, stop refreshing
            clearInterval(window.transactionRefreshInterval);
            window.transactionRefreshInterval = null;
        }
    }, 2000);
}

function logTransaction(type, amount, description) {
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    transactionLog.unshift({
        type: type, // 'income' or 'expense'
        amount: amount,
        description: description,
        timestamp: timestamp,
        balance: gold
    });
    
    // Keep only last 100 transactions
    if (transactionLog.length > 100) {
        transactionLog = transactionLog.slice(0, 100);
    }
}

function populateTransactions() {
    const container = document.getElementById('transactions-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (transactionLog.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No transactions yet.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse;';
    
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Time</th><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Description</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Amount</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Balance</th></tr>';
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    for (const transaction of transactionLog) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';
        
        const timeTd = document.createElement('td');
        timeTd.style.padding = '8px';
        timeTd.textContent = transaction.timestamp;
        
        const descTd = document.createElement('td');
        descTd.style.padding = '8px';
        descTd.textContent = transaction.description;
        
        const amountTd = document.createElement('td');
        amountTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';
        amountTd.style.color = transaction.type === 'income' ? '#4ade80' : '#ff6b6b';
        amountTd.textContent = (transaction.type === 'income' ? '+' : '-') + transaction.amount.toFixed(5);
        
        const balanceTd = document.createElement('td');
        balanceTd.style.cssText = 'padding: 8px; text-align: right;';
        balanceTd.textContent = transaction.balance.toFixed(5);
        
        tr.appendChild(timeTd);
        tr.appendChild(descTd);
        tr.appendChild(amountTd);
        tr.appendChild(balanceTd);
        tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
}

function populateSmelter() {
    const container = document.getElementById('smelter-content');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; color: #9fbfe0; padding: 20px;">Smelter functionality coming soon...</p>';
}

function populateResearch() {
    const container = document.getElementById('research-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    //console.log('Populating research, researchtree has', researchtree.length, 'items:', researchtree.map(r => r.id));
    
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
            researchBtn.dataset.researchId = researchItem.id;
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
        upgradeBtn.dataset.toolId = toolInstance.id;
        
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
    
    // Log transaction
    logTransaction('expense', upgradeCost, `Upgraded ${toolInstance.type} to level ${toolInstance.level}`);
    
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
    openModal('settings-modal');
}

function openAbout() {
    openModal('about-modal');
    loadVersionInfo();
}

async function loadVersionInfo() {
    const container = document.getElementById('about-content');
    if (!container) return;
    
    try {
        const response = await fetch('version.html');
        if (response.ok) {
            const html = await response.text();
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p style="color: #ff6b6b;">Failed to load version information.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p style="color: #ff6b6b;">Error loading version information.</p>';
        console.error('Error loading version info:', error);
    }
}

function triggerCritAnimation(x, y) {
    // Find the cell in the main grid
    const cell = document.querySelector(`#digging-grid .cell[data-col="${x}"][data-row="${y}"]`);
    if (!cell) {
        console.warn(`❌ Critical hit animation failed: cell not found at (${x}, ${y})`);
        return;
    }
    
    console.log(`✨ Applying crit-hit class to cell at (${x}, ${y})`);
    
    // Add critical hit class
    cell.classList.add('crit-hit');
    
    // Remove class after animation completes
    setTimeout(() => {
        cell.classList.remove('crit-hit');
        console.log(`✅ Removed crit-hit class from cell at (${x}, ${y})`);
    }, 600);
}

function openModal(modalname) {
    const modal = document.getElementById(modalname);
    if (!modal) return;
    
    // Pause game when opening settings modal
    if (modalname === 'settings-modal' && !gamePaused) {
        gamePaused = true;
        if (gameWorker) {
            gameWorker.postMessage({ type: 'set-pause', paused: true });
        }
    }
    
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
        // Resume game when closing settings modal
        if (modalName === 'settings-modal' && gamePaused) {
            gamePaused = false;
            if (gameWorker) {
                gameWorker.postMessage({ type: 'set-pause', paused: false });
            }
        }
        // If we just closed the dwarfs modal, stop live updates
        if (modalName === 'dwarfs-modal') stopDwarfsLiveUpdate();
        // If we just closed the transactions modal, stop refresh interval
        if (modalName === 'transactions-modal' && window.transactionRefreshInterval) {
            clearInterval(window.transactionRefreshInterval);
            window.transactionRefreshInterval = null;
        }
        return;
    }
    // close any open modal
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
        const id = m.id;
        
        m.setAttribute('aria-hidden','true');
        m.style.display = 'none';
        if (id === 'dwarfs-modal') stopDwarfsLiveUpdate();
        if (id === 'transactions-modal' && window.transactionRefreshInterval) {
            clearInterval(window.transactionRefreshInterval);
            window.transactionRefreshInterval = null;
        }
        // Resume game when closing settings modal
        if (id === 'settings-modal' && gamePaused) {
            gamePaused = false;
            if (gameWorker) {
                gameWorker.postMessage({ type: 'set-pause', paused: false });
            }
        }
    });
}

// Switch the materials panel to show dwarfs overview
function openDwarfs() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Mark panel as showing dwarfs view
    panel.dataset.view = 'dwarfs';
    
    // Remove Sell All button from header
    const sellAllBtn = document.getElementById('sell-all-header-btn');
    if (sellAllBtn) sellAllBtn.remove();
    
    // Update header
    const header = panel.querySelector('.materials-panel-header h3');
    if (header) header.textContent = 'Dwarfs';
    
    // Set grid layout for dwarfs
    const list = document.getElementById('materials-list');
    if (list) list.setAttribute('data-view', 'dwarfs');
    
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
    
    // Remove grid layout for warehouse
    const list = document.getElementById('materials-list');
    if (list) list.removeAttribute('data-view');
    
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
            levelUpBtn.dataset.dwarfName = d.name;
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
    
    // Sort dwarfs: those who can level up first, then by name
    const sortedDwarfs = [...dwarfs].sort((a, b) => {
        const aXP = a.xp || 0;
        const aLevel = a.level || 1;
        const aNeeded = 250 * aLevel;
        const aCanLevelUp = aXP >= aNeeded;
        
        const bXP = b.xp || 0;
        const bLevel = b.level || 1;
        const bNeeded = 250 * bLevel;
        const bCanLevelUp = bXP >= bNeeded;
        
        if (aCanLevelUp !== bCanLevelUp) {
            return bCanLevelUp ? 1 : -1; // Can level up first
        }
        return a.name.localeCompare(b.name);
    });
    
    // Create a compact list of dwarfs in two columns
    for (const d of sortedDwarfs) {
        const row = document.createElement('div');
        row.className = 'dwarf-row';
        
        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = 250 * currentLevel;
        const canLevelUp = currentXP >= xpNeeded;
        
        if (canLevelUp) {
            row.classList.add('can-level-up');
        }
        
        // Header with name and level up button
        const header = document.createElement('div');
        header.className = 'dwarf-header';
        
        const name = document.createElement('div');
        name.className = 'dwarf-name';
        name.textContent = d.name;
        header.appendChild(name);
        
        // Add level up button next to name if XP threshold reached
        if (canLevelUp) {
            const levelUpBtn = document.createElement('button');
            levelUpBtn.className = 'btn-levelup btn-levelup-small';
            levelUpBtn.textContent = '⭐ Lvl Up';
            levelUpBtn.dataset.dwarfName = d.name;
            header.appendChild(levelUpBtn);
        }
        
        // Calculate digging power (matching game-worker.js calculation)
        const baseDwarfPower = 3;
        let totalPower = baseDwarfPower;
        
        if (d.toolId) {
            const tool = toolsInventory.find(t => t.id === d.toolId);
            if (tool) {
                const toolDef = getToolByType(tool.type);
                if (toolDef) {
                    const toolBonus = 1 + (tool.level - 1) * 0.1;
                    const dwarfBonus = 1 + (d.digPower || 0) * 0.1;
                    const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
                    const researchBonus = improvedDigging ? 1 + (improvedDigging.level || 0) * 0.01 : 1;
                    totalPower = baseDwarfPower + (toolDef.power * toolBonus * dwarfBonus * researchBonus);
                }
            }
        }
        
        // Calculate bucket fill
        const bucketTotal = d.bucket ? Object.values(d.bucket).reduce((a, b) => a + b, 0) : 0;
        // Apply bucket research bonus (1 capacity per level)
        const bucketResearch = researchtree.find(r => r.id === 'buckets');
        const bucketBonus = bucketResearch ? (bucketResearch.level || 0) : 0;
        const dwarfCapacity = bucketCapacity + bucketBonus + (d.strength || 0);
        
        // Get tool name for display
        const toolName = d.toolId ? (() => {
            const tool = toolsInventory.find(t => t.id === d.toolId);
            return tool ? tool.type : 'None';
        })() : 'None';
        
        const info = document.createElement('div');
        info.className = 'dwarf-info';
        
        // Create level display with XP tooltip
        const levelSpan = `<span title="${currentXP}/${xpNeeded} XP">⭐ ${currentLevel}</span>`;
        
        // Calculate wage using same logic as game-worker.js
        const baseWage = 0.01;
        const wageOptimization = researchtree.find(r => r.id === 'wage-optimization');
        const researchLevel = wageOptimization ? (wageOptimization.level || 0) : 0;
        const baseIncreaseRate = 0.25;
        const researchReduction = researchLevel * 0.01;
        const increaseRate = Math.max(0.05, baseIncreaseRate - researchReduction);
        const dwarfLevel = (currentLevel || 1) - 1;
        const wage = baseWage * (1 + dwarfLevel * increaseRate);
        
        info.innerHTML = `${levelSpan} | 💰 ${wage.toFixed(4)} | 💼 ${d.status || 'idle'}<br>🧺 ${bucketTotal}/${dwarfCapacity} | ⚡${Math.round(d.energy || 0)}/${d.maxEnergy || 100}<br>⛏️ ${totalPower.toFixed(1)} (${toolName})`;
        
        row.appendChild(header);
        row.appendChild(info);
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
    digPowerBtn.dataset.upgradeType = 'digPower';
    digPowerBtn.dataset.dwarfName = dwarf.name;
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
    energyBtn.dataset.upgradeType = 'maxEnergy';
    energyBtn.dataset.dwarfName = dwarf.name;
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
    strengthBtn.dataset.upgradeType = 'strength';
    strengthBtn.dataset.dwarfName = dwarf.name;
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
    wisdomBtn.dataset.upgradeType = 'wisdom';
    wisdomBtn.dataset.dwarfName = dwarf.name;
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
        nextBtn.dataset.dwarfName = nextDwarf.name;
        nextBtn.dataset.action = 'next-levelup';
        
        nextBtnContainer.appendChild(nextBtn);
        content.appendChild(nextBtnContainer);
    }
    
    // Show modal
    openModal('levelup-modal');
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
    
    // Check if this dwarf can level up again
    const newXP = actualDwarf.xp || 0;
    const newLevel = actualDwarf.level || 1;
    const newXPNeeded = 250 * newLevel;
    
    if (newXP >= newXPNeeded) {
        // Can level up again, refresh the modal with new level
        openLevelUpModal(actualDwarf);
    } else {
        // Check if there are other dwarfs that can level up
        const dwarfsCanLevelUp = dwarfs.filter(d => {
            const currentXP = d.xp || 0;
            const currentLevel = d.level || 1;
            const xpNeeded = 250 * currentLevel;
            return currentXP >= xpNeeded;
        });
        
        if (dwarfsCanLevelUp.length > 0) {
            // Show next dwarf who can level up
            openLevelUpModal(dwarfsCanLevelUp[0]);
        } else {
            // No more dwarfs to level up, close modal
            closeModal('levelup-modal');
        }
    }
    
    console.log(`${actualDwarf.name} leveled up to ${actualDwarf.level}! Chose ${upgradeType}`);
}

// ---- live-update for the dwarfs panel/modal ----
// Update is now handled every 10th tick instead of on an interval
let _dwarfsModalRefreshId = null;
function startDwarfsLiveUpdate(intervalMs = 1000) {
    // No longer using interval-based updates
    // Updates happen every 10th tick in the worker message handler
    // Just do an immediate update when switching to dwarfs view
    populateDwarfsInPanel();
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
        case 'open-smelter':
            openSmelter();
            break;
    }
});

// Delegated event handler for sell buttons
document.addEventListener('click', (ev) => {
    const sellBtn = ev.target.closest('.btn-sell, .btn-sell-all');
    if (!sellBtn) return;
    
    const materialId = sellBtn.dataset.materialId;
    const sellAmount = parseInt(sellBtn.dataset.sellAmount, 10);
    
    if (materialId && !isNaN(sellAmount)) {
        console.log(`Sell button clicked: ${materialId} x${sellAmount}`);
        sellMaterial(materialId, sellAmount);
    }
});

// Delegated event handler for upgrade buttons
document.addEventListener('click', (ev) => {
    const upgradeBtn = ev.target.closest('.btn-upgrade');
    if (!upgradeBtn || upgradeBtn.disabled) return;
    
    const toolId = parseInt(upgradeBtn.dataset.toolId, 10);
    if (!isNaN(toolId)) {
        console.log(`Upgrade button clicked for tool ${toolId}`);
        upgradeTool(toolId);
    }
});

// Delegated event handler for research buttons
document.addEventListener('click', (ev) => {
    const researchBtn = ev.target.closest('.btn-research');
    if (!researchBtn || researchBtn.disabled) return;
    
    const researchId = researchBtn.dataset.researchId;
    if (researchId) {
        console.log(`Research button clicked: ${researchId}`);
        startResearch(researchId);
    }
});

// Delegated event handler for level up buttons
document.addEventListener('click', (ev) => {
    const levelUpBtn = ev.target.closest('.btn-levelup');
    if (!levelUpBtn) return;
    
    const dwarfName = levelUpBtn.dataset.dwarfName;
    if (dwarfName) {
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            console.log(`Level up button clicked for ${dwarfName}`);
            openLevelUpModal(dwarf);
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

// Delegated event handler for next dwarf button in level up modal
document.addEventListener('click', (ev) => {
    const nextBtn = ev.target.closest('.btn-primary[data-action="next-levelup"]');
    if (!nextBtn) return;
    
    const dwarfName = nextBtn.dataset.dwarfName;
    if (dwarfName) {
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            console.log(`Next level up: ${dwarfName}`);
            openLevelUpModal(dwarf);
        }
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
    
    // Log transaction
    logTransaction('income', earnings, `Sold ${amount}x ${material.name}`);
    
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
    updateGoldDisplay();
    updateMaterialsPanel(); // Refresh warehouse panel after selling
    
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
    
    // Calculate total stock value
    let totalStockValue = 0;
    const materialsWithStock = [];
    
    for (const m of materials) {
        const count = (typeof materialsStock !== 'undefined' && materialsStock[m.id] != null) ? materialsStock[m.id] : 0;
        if (count > 0) {
            const actualWorth = m.worth * tradeBonus;
            totalStockValue += count * actualWorth;
            materialsWithStock.push({ material: m, count, actualWorth });
        }
    }
    
    // Sort by value per piece (low to high)
    materialsWithStock.sort((a, b) => a.actualWorth - b.actualWorth);
    
    const hasAnyMaterials = materialsWithStock.length > 0;
    
    // Update or create Sell All button and total value in header
    let sellAllHeaderBtn = document.getElementById('sell-all-header-btn');
    let totalValueSpan = document.getElementById('total-stock-value');
    const header = panel.querySelector('.materials-panel-header');
    const isWarehouseView = !panel || panel.dataset.view !== 'dwarfs';
    
    if (header && isWarehouseView) {
        // Update or create total value display
        if (!totalValueSpan) {
            totalValueSpan = document.createElement('span');
            totalValueSpan.id = 'total-stock-value';
            totalValueSpan.style.cssText = 'font-size: 13px; color: #ffd700; font-weight: 600; margin-left: auto;';
            header.appendChild(totalValueSpan);
        }
        totalValueSpan.textContent = hasAnyMaterials ? `💰 ${Math.round(totalStockValue)}` : '';
        
        if (hasAnyMaterials) {
            if (!sellAllHeaderBtn) {
                sellAllHeaderBtn = document.createElement('button');
                sellAllHeaderBtn.id = 'sell-all-header-btn';
                sellAllHeaderBtn.className = 'btn-sell-all-global';
                sellAllHeaderBtn.textContent = 'Sell All';
                sellAllHeaderBtn.onclick = sellAllMaterials;
                header.appendChild(sellAllHeaderBtn);
            }
        } else if (sellAllHeaderBtn) {
            sellAllHeaderBtn.remove();
        }
    }
    
    list.innerHTML = '';
    
    // Add table container for warehouse view
    if (hasAnyMaterials) {
        const container = document.createElement('div');
        container.className = 'warehouse-table-container';
        
        const tableHeader = document.createElement('div');
        tableHeader.className = 'warehouse-table-header';
        tableHeader.innerHTML = `
            <span class="wh-col-name">MATERIAL</span>
            <span class="wh-col-price">PRICE</span>
            <span class="wh-col-count">STOCK</span>
            <span class="wh-col-total">VALUE</span>
            <span class="wh-col-actions">SELL</span>
        `;
        container.appendChild(tableHeader);
        list.appendChild(container);
    }
    
    for (const { material: m, count, actualWorth } of materialsWithStock) {
        const id = m.id;
        
        const row = document.createElement('div');
        row.className = 'warehouse-row';
        // Set material color as background using CSS variable
        row.style.setProperty('--material-color', m.color || '#888');
        
        const name = document.createElement('span');
        name.className = 'wh-col-name';
        name.textContent = m.name;
        
        const worth = document.createElement('span');
        worth.className = 'wh-col-price';
        worth.textContent = actualWorth.toFixed(2);
        worth.title = tradeBonus > 1 ? `Base: ${m.worth.toFixed(2)} gold (${tradeBonus.toFixed(2)}x bonus)` : `${m.worth.toFixed(2)} gold each`;
        
        const cnt = document.createElement('span');
        cnt.className = 'wh-col-count';
        cnt.textContent = String(count);
        
        const totalValue = document.createElement('span');
        totalValue.className = 'wh-col-total';
        totalValue.textContent = `💰 ${Math.round(count * actualWorth)}`;
        
        const buttons = document.createElement('span');
        buttons.className = 'wh-col-actions';
        
        const sell1Btn = document.createElement('button');
        sell1Btn.className = 'btn-sell';
        sell1Btn.textContent = '1';
        sell1Btn.title = `Sell 1 ${m.name} for ${actualWorth.toFixed(2)} gold`;
        sell1Btn.dataset.materialId = id;
        sell1Btn.dataset.sellAmount = '1';
        
        const sellAllBtn = document.createElement('button');
        sellAllBtn.className = 'btn-sell-all';
        sellAllBtn.textContent = 'all';
        sellAllBtn.title = `Sell all ${count} ${m.name} for ${(count * actualWorth).toFixed(2)} gold`;
        sellAllBtn.dataset.materialId = id;
        sellAllBtn.dataset.sellAmount = count.toString();
        
        buttons.appendChild(sell1Btn);
        buttons.appendChild(sellAllBtn);
        
        row.appendChild(name);
        row.appendChild(worth);
        row.appendChild(cnt);
        row.appendChild(totalValue);
        row.appendChild(buttons);
        
        // Append to container instead of list
        const container = list.querySelector('.warehouse-table-container');
        if (container) {
            container.appendChild(row);
        } else {
            list.appendChild(row);
        }
    }
}

function sellAllMaterials() {
    // Calculate total gold from all materials
    const betterTrading = researchtree.find(r => r.id === 'trading');
    const tradeBonus = betterTrading ? 1 + (betterTrading.level || 0) * 0.03 : 1;
    
    let totalGold = 0;
    let totalItems = 0;
    
    for (const m of materials) {
        const id = m.id;
        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        if (count > 0) {
            const goldForThisMaterial = count * m.worth * tradeBonus;
            totalGold += goldForThisMaterial;
            totalItems += count;
            materialsStock[id] = 0;
        }
    }
    
    if (totalItems > 0) {
        gold += totalGold;
        console.log(`Sold all materials (${totalItems} items) for ${totalGold.toFixed(2)} gold`);
        
        // Log transaction
        logTransaction('income', totalGold, `Sold all materials (${totalItems} items)`);
        
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
    const rawHardness = Number(cellData.hardness) || 0;
    const hardness = Math.max(0, rawHardness).toFixed(1);
    const isDugOut = rawHardness <= 0;
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
let tickCounter = 0; // Track ticks for periodic updates
let cheatModeEnabled = false; // Track if cheat mode is available

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
                
                // Check if materialsStock changed to update warehouse panel
                let stockChanged = false;
                for (const key in data.materialsStock) {
                    if (materialsStock[key] !== data.materialsStock[key]) {
                        stockChanged = true;
                    }
                    materialsStock[key] = data.materialsStock[key];
                }
                
                // Update gold
                if (data.gold !== undefined) {
                    gold = data.gold;
                }
                
                // Process transactions from worker
                if (data.transactions && Array.isArray(data.transactions)) {
                    for (const transaction of data.transactions) {
                        if (transaction.type === 'crit-hit') {
                            // Trigger critical hit animation
                            console.log(`💥 Critical hit at (${transaction.x}, ${transaction.y})`);
                            triggerCritAnimation(transaction.x, transaction.y);
                        } else {
                            logTransaction(transaction.type, transaction.amount, transaction.description);
                        }
                    }
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
                    // Merge research progress from worker with current definitions
                    for (const workerResearch of data.researchtree) {
                        const currentResearch = researchtree.find(r => r.id === workerResearch.id);
                        if (currentResearch) {
                            currentResearch.level = workerResearch.level || 0;
                            currentResearch.progress = workerResearch.progress || 0;
                        }
                    }
                }
                
                // Update UI to reflect new state
                updateGridDisplay();
                
                // Update warehouse panel if materials stock changed
                if (stockChanged) {
                    updateMaterialsPanel();
                }
                
                // Update dwarf panel every 10th tick if in dwarfs view
                tickCounter++;
                if (tickCounter >= 10) {
                    tickCounter = 0;
                    const panel = document.getElementById('materials-panel');
                    if (panel && panel.dataset.view === 'dwarfs') {
                        populateDwarfsInPanel();
                    }
                }
                
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
    
    // Start the worker's internal game loop
    gameWorker.postMessage({ type: 'start-loop', interval: 250 });
}

function tick() {
    // Send tick request to worker (worker will handle pause state)
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({ type: 'tick', paused: gamePaused });
    } else {
        console.warn('Worker not ready yet');
    }
}

function togglePause() {
    gamePaused = !gamePaused;
    const btn = document.getElementById('pause-button');
    if (btn) {
        btn.textContent = gamePaused ? '▶' : '⏸';
        btn.title = gamePaused ? 'Resume game' : 'Pause game';
    }
    // Notify worker of pause state change
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({ type: 'set-pause', paused: gamePaused });
    }
    console.log(gamePaused ? 'Game paused' : 'Game resumed');
}

function saveGame() {
    // Don't save when game is paused (e.g., settings modal is open)
    if (gamePaused) return;
    
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
            transactionLog: transactionLog,
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
        
        // Restore research tree - merge saved progress with current definitions
        if (gameState.researchtree) {
            // Update existing research items with saved progress
            for (const savedResearch of gameState.researchtree) {
                const currentResearch = researchtree.find(r => r.id === savedResearch.id);
                if (currentResearch) {
                    currentResearch.level = savedResearch.level || 0;
                    currentResearch.progress = savedResearch.progress || 0;
                }
            }
        }
        
        // Restore active research
        if (gameState.activeResearch) {
            activeResearch = gameState.activeResearch;
        }
        
        // Restore transaction log
        if (gameState.transactionLog) {
            transactionLog = gameState.transactionLog;
        }
        
        console.log('Game loaded from', new Date(gameState.timestamp));
        return true;
    } catch (e) {
        console.error('Failed to load game:', e);
        return false;
    }
}

window.deleteSave = function() {
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

window.activateCheat = function activateCheat() {
    if (!cheatModeEnabled) {
        console.warn('Cheat mode not enabled');
        return;
    }
    
    // Double the current depth (startX)
    startX = startX * 2;
    
    // Reset all dwarfs to home location
    for (const dwarf of dwarfs) {
        if (house) {
            dwarf.x = house.x;
            dwarf.y = house.y;
        }
        dwarf.status = 'idle';
        dwarf.moveTarget = null;
        
        // Give XP for one level (250 * current level)
        const xpForLevel = 250 * (dwarf.level || 1);
        dwarf.xp = (dwarf.xp || 0) + xpForLevel;
    }
    
    // Add 5000 gold
    gold += 5000;
    
    // Log transaction
    logTransaction('income', 5000, 'Cheat code activated');
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                startX: startX,
                dwarfs: dwarfs,
                gold: gold
            }
        });
    }
    
    // Update UI
    updateGridDisplay();
    updateGoldDisplay();
    populateDwarfsInPanel();
    
    // Save game
    saveGame();
    
    console.log(`Cheat activated! Depth: ${startX}, Gold: +5000, Dwarfs: reset to home with XP`);
    alert(`Cheat activated!\n\nDepth doubled to: ${startX}\nGold +5000\nAll dwarfs reset to home with XP bonus`);
}

function initializeGame() {
    initWorker();
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
    updateMaterialsPanel(); // Initialize materials panel on load
}

// Check for cheat mode in URL
function checkCheatMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('cheat')) {
        cheatModeEnabled = true;
        const cheatSection = document.getElementById('settings-cheat-section');
        const cheatButton = document.getElementById('settings-cheat-button');
        if (cheatSection) cheatSection.style.display = 'block';
        if (cheatButton) cheatButton.style.display = 'inline-block';
        console.log('🎮 Cheat mode enabled');
    }
}

// Start the game
checkCheatMode();
initGame();