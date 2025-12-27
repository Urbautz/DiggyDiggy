// Track last known count of dwarfs ready to level up for badge update
let lastDwarfsLevelUpCount = 0;

function updateDwarfsLevelUpBadge() {
    const badge = document.getElementById('dwarfs-levelup-badge');
    if (!badge) return;
    const dwarfsCanLevelUp = dwarfs.filter(d => {
        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = getDwarfXpForLevel(currentLevel);
        return currentXP >= xpNeeded;
    });
    if (dwarfsCanLevelUp.length !== lastDwarfsLevelUpCount) {
        lastDwarfsLevelUpCount = dwarfsCanLevelUp.length;
        if (dwarfsCanLevelUp.length > 0) {
            badge.textContent = `(⭐${dwarfsCanLevelUp.length})`;
            badge.classList.add('visible');
        } else {
            badge.textContent = '';
            badge.classList.remove('visible');
        }
    }
}
const GAME_LOOP_INTERVAL_MS = 300;
const activeCritFlashes = new Map();

// Note: randomMaterial and getMaterialById are now in utils.js

/**
 * Unified number formatting for display throughout the GUI
 * Materials: 0-100: one decimal (90.1), 100-100000: integer (95000), >100000: k suffix (950k)
 * Money: 0-1: four decimals (0.0017), 1-100000: two decimals (95123.14), >100000: k suffix (950k)
 * XP: 0-100000: integer (95000), >100000: k suffix (550k)
 */
function formatNumber(value, type = 'material') {
    const num = typeof value === 'number' ? value : parseFloat(value);

    if (isNaN(num)) return value;

    if (type == 'money' || type == 'gold') {
        // Money formatting
        if (num < 0) {
            return '-' + formatNumber(Math.abs(num), type);
        }
        if (num === 0) {
            return num.toFixed(2);
        }
        if (num < 1) {
            return num.toFixed(4);
        }
        if (num < 100000) {
            return num.toFixed(2);
        }
        // > 100000: use k suffix
        return Math.round(num / 1000) + ' k';
    } else if (type == 'percent'){
        // Percent formatting
        if (num < 0) {
            return '-' + formatNumber(Math.abs(num), type);
        }
        return num.toFixed(2);
    }
    else if (type == 'xp'){
        // XP formatting
        if (num < 0) {
            return '-' + formatNumber(Math.abs(num), type);
        }
        if (num === 0) {
            return num.toFixed(2);
        }
        if (num <= 100000) {
            return Math.round(num).toString();
        }
        // > 100000: use k suffix
        return Math.round(num / 1000) + ' k';
    } else {
        // Material formatting (default)
        if (num < 0) {
            return '-' + formatNumber(Math.abs(num), type);
        }
        if (num === 0) {
            return num.toFixed(2);
        }
        if (num < 100) {
            return num.toFixed(1);
        }
        if (num < 100000) {
            return Math.round(num).toString();
        }
        // > 100000: use k suffix
        return Math.round(num / 1000) + ' k';
    }
}

// Note: isSmelterTaskUnlocked is now in utils.js

// Count how many smelter tasks are currently actionable
function countActionableSmelterTasks() {
    let count = 0;
    for (const taskId of smelterTasks) {
        if (taskId === 'do-nothing') break; // Stop at "do nothing" (matches worker logic)
        const task = smelterTasksData[taskId];
        if (!isSmelterTaskUnlocked(task)) continue;

        // For heating tasks, check temperature requirements and materials
        if (task.type === 'heating') {
            // Check if heating is needed
            let heatingNeeded = false;
            if (task.heatGain === 'dynamic') {
                // Magma: only heat when below min temp
                heatingNeeded = smelterTemperature < smelterMagmaMinTemp;
            } else {
                // Coal: check if we need heating (simplified hysteresis check)
                // Heat if below min, or if already heating and below max
                if (smelterTemperature < smelterCoalMinTemp) {
                    heatingNeeded = true;
                } else if (smelterTemperature < smelterCoalMaxTemp && smelterHeatingMode) {
                    heatingNeeded = true;
                }
            }

            if (!heatingNeeded) {
                continue;
            }

            // Check if materials are available for heating
            if (task.input && task.input.material && task.input.amount) {
                const stockAmount = materialsStock[task.input.material] || 0;
                if (stockAmount >= task.input.amount) {
                    count++;
                }
            }
            continue;
        }

        // Check temperature requirements for smelting tasks
        if (task.minTemp && smelterTemperature < task.minTemp) {
            continue;
        }

        // Check for gem cutting tasks
        if (task.type === 'gem-cutting') {
            const hasGemsToPolish = gems.some(g => g.markedForCutting && !g.polished);
            if (hasGemsToPolish) {
                count++;
            }
            continue;
        }

        // Check for single input (legacy format)
        if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                count++;
            }
        }

        // Check for multiple inputs (alloy format)
        if (task.inputs && Array.isArray(task.inputs)) {
            const hasAllInputs = task.inputs.every(input => {
                const stock = materialsStock[input.material] || 0;
                return stock >= input.amount;
            });
            if (hasAllInputs) {
                count++;
            }
        }
    }
    return count;
}

// Check if the smelter's top task is "do nothing"
function isSmelterPaused() {
    return smelterTasks.length > 0 && smelterTasks[0] === 'do-nothing';
}

function getToolByType(toolType) {
    return tools.find(t => t.name === toolType) || null;
}

function getToolPower(toolType, toolLevel = 1) {
    const tool = getToolByType(toolType);
    if (!tool) return DWARF_BASE_POWER;
    
    // Each level gives bonus: power * (1 + (level - 1) * TOOL_LEVEL_BONUS)
    return tool.power * (1 + (toolLevel - 1) * TOOL_LEVEL_BONUS);
}

function getToolUpgradeCost(toolType, toolLevel = 1) {
    const tool = getToolByType(toolType);
    if (!tool) return 0;
    
    // Cost multiplies with each level
    return tool.upgradecost * Math.pow(TOOL_UPGRADE_COST_MULTIPLIER, toolLevel - 1);
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

    const now = Date.now();
    for (const [key, expires] of activeCritFlashes) {
        if (expires <= now) {
            activeCritFlashes.delete(key);
        }
    }

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

            const critKey = `${c}:${r}`;
            const critData = activeCritFlashes.get(critKey);
            if (critData) {
                cell.classList.add(critData.isOneHit ? 'one-hit' : 'crit-hit');
            }

            // Show gem icon if this cell has a gem
            if (cellData.gemId) {
                const gem = gems.find(g => g.id === cellData.gemId);
                if (gem) {
                    const gemMat = getMaterialById(gem.type);
                    const gemName = gemMat ? gemMat.name : gem.type;
                    const gemColor = gemMat ? gemMat.color : '#ffffff';

                    const gemMarker = document.createElement('div');
                    gemMarker.className = 'gem-marker';
                    gemMarker.textContent = '💎';
                    gemMarker.style.setProperty('--gem-color', gemColor);
                    gemMarker.title = `${gemName}\n${gem.carat.toFixed(2)} carat\n${gem.polished ? 'Polished' : 'Unpolished'}`;
                    cell.appendChild(gemMarker);
                }
            }

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
                
                const displayHardness = formatNumber(rawHardness, 'material');
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
                        
                        // Show number of dwarfs currently resting in the house
                        const dwarfsResting = dwarfs.filter(d => d.status === 'resting' && d.x === gx && d.y === gy);
                        if (dwarfsResting.length > 0) {
                            bed.title = `House (${dwarfsResting.length} dwarf(s) resting)`;
                            // Add notification badge for resting dwarfs
                            const badge = document.createElement('span');
                            badge.className = 'notification-badge';
                            badge.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #4a90e2; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 2px solid white;';
                            badge.textContent = dwarfsResting.length;
                            bed.appendChild(badge);
                        } else {
                            bed.title = 'House (open dwarfs overview)';
                        }
                        
                        iconContainer.appendChild(bed);
                        cell.appendChild(iconContainer);
                    }

                    // show forge icon if this is the forge cell and forge research is unlocked
                    if (typeof forge === 'object' && forge !== null && forge.x === gx && forge.y === gy) {
                        const forgeResearch = researchtree.find(r => r.id === 'forge');
                        const isForgeUnlocked = forgeResearch && (forgeResearch.level || 0) >= 1;
                        
                        if (isForgeUnlocked) {
                            cell.style.cursor = 'pointer';
                            cell.dataset.clickAction = 'open-forge';
                            
                            // Create container for icon and badge with absolute positioning
                            const iconContainer = document.createElement('span');
                            iconContainer.style.cssText = 'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3;';
                            
                            const bench = document.createElement('span');
                            bench.style.cssText = 'position: relative; display: inline-block; font-size: 18px; opacity: 0.95;';
                            bench.textContent = '🔨';
                            bench.title = 'Forge (craft new tools)';
                            
                            iconContainer.appendChild(bench);
                            cell.appendChild(iconContainer);
                        } else {
                            // Show locked icon
                            const lockedIcon = document.createElement('span');
                            lockedIcon.style.cssText = 'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; font-size: 18px; opacity: 0.5;';
                            lockedIcon.textContent = '🔒';
                            lockedIcon.title = 'Forge (requires Forge research)';
                            cell.appendChild(lockedIcon);
                        }
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
                            const currentLevel = activeResearch.level || 0;
                            const targetLevel = currentLevel + 1;
                            const actualCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
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
                        
                        // Create container for icon and badge with absolute positioning
                        const iconContainer = document.createElement('span');
                        iconContainer.style.cssText = 'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3;';
                        
                        // Add smelter icon
                        const smelterIcon = document.createElement('span');
                        smelterIcon.style.cssText = 'position: relative; display: inline-block; font-size: 18px; opacity: 0.95;';
                        smelterIcon.textContent = '♨️';
                        
                        // Add status badge
                        const smelterBadge = document.createElement('span');
                        smelterBadge.className = 'smelter-badge';
                        
                        if (isSmelterPaused()) {
                            smelterBadge.textContent = '⏸';
                            smelterBadge.classList.add('smelter-badge-paused');
                            smelterIcon.title = 'Smelter (Paused - Do Nothing is top task)';
                        } else {
                            const actionableCount = countActionableSmelterTasks();
                            smelterBadge.textContent = actionableCount;
                            if (actionableCount > 0) {
                                smelterBadge.classList.add('smelter-badge-active');
                                smelterIcon.title = `Smelter (${actionableCount} task${actionableCount !== 1 ? 's' : ''} ready)`;
                            } else {
                                smelterBadge.classList.add('smelter-badge-idle');
                                smelterIcon.title = 'Smelter (No tasks ready)';
                            }
                        }
                        smelterIcon.appendChild(smelterBadge);
                        iconContainer.appendChild(smelterIcon);
                        cell.appendChild(iconContainer);

                        // Add temperature progress bar
                        const tempValue = Math.round(smelterTemperature);
                        const furnaceTemp = researchtree.find(r => r.id === 'furnace-temperature');
                        const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
                        const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);
                        const tempPercent = Math.min(100, (smelterTemperature / maxTempLimit) * 100);

                        const tempContainer = document.createElement('div');
                        tempContainer.className = 'smelter-temp-container';
                        tempContainer.style.cssText = 'position: absolute; bottom: 2px; left: 2px; right: 2px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 2px; overflow: hidden;';

                        const tempBar = document.createElement('div');
                        tempBar.className = 'smelter-temp-bar';
                        tempBar.style.cssText = `height: 100%; background: linear-gradient(90deg, #ff4500, #ff8c00); width: ${tempPercent}%; transition: width 0.3s ease;`;

                        tempContainer.appendChild(tempBar);
                        cell.appendChild(tempContainer);

                        // Update title with temperature info
                        smelterIcon.title = `${smelterIcon.title}\nTemperature: ${tempValue}°/${maxTempLimit}° (${Math.round(tempPercent)}%)`;
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
        updateDwarfsLevelUpBadge();
        refreshTooltipAfterRedraw();
}

    // dwarf-status UI removed from header; the Dwarfs modal shows this information when requested

// Forge modal code (openForge, startForging, closeForging, sleep) moved to modals/forge-modal.js

// Gem modal code (openGemModal, populateGemModal, confirmGemSetting, unsetGem,
// openGemsModal, populateGemsList, markGemsForCutting, sellGems) moved to modals/gem-modal.js

function openSmelter() {
    openModal('smelter-modal');
    populateSmelter();
}

// Transaction/Finances modal UI functions (openTransactions, populateTransactions, logTransaction, etc.) moved to modals/transaction-modal.js

// Smelter and Task Details UI functions (populateSmelter, openTaskDetailsModal, etc.) moved to modals/smelter-modal.js

// Forge UI functions (populateForge, createForgeInterface, setupForgeListeners, updateForgeState) moved to modals/forge-modal.js

function createInventoryInterface(container) {
    container.innerHTML = '';
    
    const inventoryList = document.createElement('div');
    inventoryList.className = 'inventory-list';
    
    if (toolsInventory.length === 0) {
        inventoryList.innerHTML = '<p class="empty-message">No tools in inventory. Forge some tools first!</p>';
    } else {
        // Sort tools by quality/power descending
        const sortedTools = [...toolsInventory].sort((a, b) => {
            const powerA = a.power || a.level || 0;
            const powerB = b.power || b.level || 0;
            return powerB - powerA;
        });
        
        sortedTools.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.className = 'tool-card';
            
            // Check if tool is assigned to a dwarf
            const assignedDwarf = dwarfs.find(d => d.toolId === tool.id);
            const isAssigned = !!assignedDwarf;
            
            toolCard.innerHTML = `
                <div class="tool-header">
                    <h4>${tool.type} #${tool.id}</h4>
                    <span class="tool-power">⚒️ ${tool.power || tool.level}</span>
                </div>
                <div class="tool-details">
                    ${isAssigned 
                        ? `<div class="tool-assigned">📌 Assigned to: <strong>${assignedDwarf.name}</strong></div>`
                        : `<div class="tool-unassigned">🔓 Not assigned</div>`
                    }
                </div>
                <div class="tool-actions">
                    ${isAssigned 
                        ? `<div class="tool-assigned-note">Tool is equipped and in use</div>`
                        : `<select id="assign-select-${tool.id}" class="assign-select">
                            <option value="">-- Assign to Dwarf --</option>
                            ${dwarfs.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
                        </select>
                        <button class="btn-primary btn-small" onclick="assignToolToDwarf(${tool.id})">Assign</button>`
                    }
                    <button class="btn-danger btn-small" onclick="scrapTool(${tool.id})" ${isAssigned ? 'disabled title="Cannot scrap assigned tool"' : ''}>🗑️ Scrap</button>
                </div>
            `;
            
            inventoryList.appendChild(toolCard);
        });
    }
    
    container.appendChild(inventoryList);
}

function assignToolToDwarf(toolId) {
    const selectElement = document.getElementById(`assign-select-${toolId}`);
    if (!selectElement || !selectElement.value) {
        alert('Please select a dwarf first!');
        return;
    }
    
    const dwarfName = selectElement.value;
    const dwarf = dwarfs.find(d => d.name === dwarfName);
    
    if (!dwarf) {
        alert('Dwarf not found!');
        return;
    }
    
    // Check if dwarf already has a tool
    if (dwarf.toolId) {
        const confirm = window.confirm(`${dwarfName} already has a tool. Replace it with this one?`);
        if (!confirm) return;
    }
    
    // Assign the tool
    dwarf.toolId = toolId;
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                dwarfs: dwarfs,
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Trigger autosave
    saveGame();
    
    // Refresh the inventory display
    const inventoryContainer = document.getElementById('forge-inventory-tab');
    if (inventoryContainer) {
        createInventoryInterface(inventoryContainer);
    }
    
    logTransaction('income', 0, `Assigned tool #${toolId} to ${dwarfName}`);
}

function scrapTool(toolId) {
    // Check if tool is assigned
    const assignedDwarf = dwarfs.find(d => d.toolId === toolId);
    if (assignedDwarf) {
        alert(`Cannot scrap tool #${toolId} - it is assigned to ${assignedDwarf.name}. Unassign it first!`);
        return;
    }
    
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        alert('Tool not found!');
        return;
    }
    
    const confirm = window.confirm(`Scrap ${tool.type} #${toolId}? This cannot be undone!`);
    if (!confirm) return;
    
    // Remove tool from inventory
    const index = toolsInventory.findIndex(t => t.id === toolId);
    if (index !== -1) {
        toolsInventory.splice(index, 1);
    }
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Refresh the inventory display
    const inventoryContainer = document.getElementById('forge-inventory-tab');
    if (inventoryContainer) {
        createInventoryInterface(inventoryContainer);
    }
    
    logTransaction('income', 0, `Scrapped tool #${toolId}`);
    
    // Trigger autosave
    saveGame();
}

function triggerCritAnimation(x, y, isOneHit = false) {
    const critKey = `${x}:${y}`;
    const expiresAt = Date.now() + (isOneHit ? ONE_HIT_ANIMATION_DURATION : CRITICAL_HIT_ANIMATION_DURATION);
    activeCritFlashes.set(critKey, { expiresAt, isOneHit });

    const scheduleCleanup = () => {
        const tracked = activeCritFlashes.get(critKey);
        if (tracked && tracked.expiresAt > expiresAt) {
            return;
        }

        activeCritFlashes.delete(critKey);
        const currentCell = document.querySelector(`#digging-grid .cell[data-col="${x}"][data-row="${y}"]`);
        if (currentCell) {
            currentCell.classList.remove('crit-hit');
            currentCell.classList.remove('one-hit');
        }
    };

    setTimeout(scheduleCleanup, isOneHit ? (ONE_HIT_ANIMATION_DURATION + 200) : (CRITICAL_HIT_ANIMATION_DURATION + 200));

    // Find the cell in the main grid
    const cell = document.querySelector(`#digging-grid .cell[data-col="${x}"][data-row="${y}"]`);
    if (!cell) {
        console.warn(`❌ Critical hit animation failed: cell not found at (${x}, ${y})`);
        return;
    }
    
    const animClass = isOneHit ? 'one-hit' : 'crit-hit';
    //console.log(`✨ Applying ${animClass} class to cell at (${x}, ${y})`);
    
    // If animation is already running, don't restart it
    if (cell.classList.contains('crit-hit') || cell.classList.contains('one-hit')) {
        return;
    }

    // Add animation class
    cell.classList.add(animClass);
}

function triggerGemSpawnAnimation(x, y, gemName) {
    const GEM_SPAWN_ANIMATION_DURATION = 1500;
    const gemKey = `${x}:${y}:gem`;
    const expiresAt = Date.now() + GEM_SPAWN_ANIMATION_DURATION;

    // Find the cell in the main grid
    const cell = document.querySelector(`#digging-grid .cell[data-col="${x}"][data-row="${y}"]`);
    if (!cell) {
        console.warn(`❌ Gem spawn animation failed: cell not found at (${x}, ${y})`);
        return;
    }

    // Add gem spawn animation class
    cell.classList.add('gem-spawn');

    // Create sparkle effect
    const sparkle = document.createElement('div');
    sparkle.className = 'gem-sparkle';
    sparkle.textContent = '💎';
    sparkle.style.position = 'absolute';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.fontSize = '24px';
    sparkle.style.animation = 'gem-float 1.5s ease-out';
    cell.style.position = 'relative';
    cell.appendChild(sparkle);

    // Cleanup after animation
    setTimeout(() => {
        cell.classList.remove('gem-spawn');
        if (sparkle.parentNode === cell) {
            cell.removeChild(sparkle);
        }
    }, GEM_SPAWN_ANIMATION_DURATION);
}

function openModal(modalname) {
    const modal = document.getElementById(modalname);
    if (!modal) return;

    // Pause game when opening settings modal
    if ((modalname === 'settings-modal') && !gamePaused) {
        gamePaused = true;
        const pauseBtn = document.getElementById('pause-button');
        if (pauseBtn) pauseBtn.classList.add('paused');
        if (gameWorker) {
            gameWorker.postMessage({ type: 'set-pause', paused: true });
        }
    }

    // Handle z-index stacking for modals that open on top of other modals
    // Task details modal should appear above the smelter modal
    if (modalname === 'task-details-modal') {
        const smelterModal = document.getElementById('smelter-modal');
        if (smelterModal && smelterModal.getAttribute('aria-hidden') === 'false') {
            modal.style.zIndex = '2001'; // Higher than default 2000
        } else {
            modal.style.zIndex = '2000'; // Default z-index
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
        if ((modalName === 'settings-modal') && gamePaused) {
            gamePaused = false;
            const pauseBtn = document.getElementById('pause-button');
            if (pauseBtn) pauseBtn.classList.remove('paused');
            if (gameWorker) {
                gameWorker.postMessage({ type: 'set-pause', paused: false });
            }
        }
        // If we just closed the transactions modal, stop refresh interval
        if (modalName === 'transactions-modal' && window.transactionRefreshInterval) {
            clearInterval(window.transactionRefreshInterval);
            window.transactionRefreshInterval = null;
        }
        // If we just closed the task details modal, reopen the smelter modal
        if (modalName === 'task-details-modal') {
            if (window.taskDetailRefreshInterval) {
                clearInterval(window.taskDetailRefreshInterval);
                window.taskDetailRefreshInterval = null;
            }
            openModal('smelter-modal');
        }
        return;
    }
    // close any open modal
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
        const id = m.id;
        
        m.setAttribute('aria-hidden','true');
        m.style.display = 'none';
        if (id === 'transactions-modal' && window.transactionRefreshInterval) {
            clearInterval(window.transactionRefreshInterval);
            window.transactionRefreshInterval = null;
        }
        // Resume game when closing settings modal
        if (id === 'settings-modal' && gamePaused) {
            gamePaused = false;
            const pauseBtn = document.getElementById('pause-button');
            if (pauseBtn) pauseBtn.classList.remove('paused');
            if (gameWorker) {
                gameWorker.postMessage({ type: 'set-pause', paused: false });
            }
        }
    });
}

// Switch the materials panel to show dwarfs overview

// Switch back to warehouse view
function showWarehousePanel() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Mark panel as showing warehouse view
    panel.dataset.view = 'warehouse';
    
    // Reset initialized flag and clear content so warehouse structure gets rebuilt
    const list = document.getElementById('materials-list');
    if (list) {
        list.dataset.initialized = 'false';
        list.innerHTML = '';
        list.removeAttribute('data-view');
    }
    
    // Update tab button states
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === 'warehouse') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const header = panel.querySelector('.materials-panel-header h3');
    if (header) header.textContent = 'Warehouse';
    
    // Show warehouse content
    stopDwarfsLiveUpdate();
    updateMaterialsPanel();
}

// Show tools inventory in the materials panel
function showToolsPanel() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Mark panel as showing tools view
    panel.dataset.view = 'tools';
    
    // Stop dwarfs live update
    stopDwarfsLiveUpdate();
    
    // Remove header buttons that are specific to warehouse
    const sellAllHeaderBtn = document.getElementById('sell-all-header-btn');
    if (sellAllHeaderBtn) sellAllHeaderBtn.remove();

    // Remove Warehouse Sell button
    const warehouseSellBtn = document.getElementById('warehouse-sell-btn');
    if (warehouseSellBtn) warehouseSellBtn.remove();

    const sellNotCraftableBtn = document.getElementById('sell-not-craftable-btn');
    if (sellNotCraftableBtn) sellNotCraftableBtn.remove();

    const gemsBtn = document.getElementById('gems-header-btn');
    if (gemsBtn) gemsBtn.remove();
    
    const totalValueSpan = document.getElementById('total-stock-value');
    if (totalValueSpan) totalValueSpan.remove();
    
    // Clear and populate tools
    const list = document.getElementById('materials-list');
    if (list) {
        list.dataset.initialized = 'false';
        list.innerHTML = '';
        list.setAttribute('data-view', 'tools');
    }
    
    populateToolsInPanel();
}

// Populate tools inventory in the materials panel
function populateToolsInPanel() {
    const list = document.getElementById('materials-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (toolsInventory.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.innerHTML = '<p>No tools in inventory.</p><p>Open the Forge to create tools!</p>';
        list.appendChild(emptyMsg);
        return;
    }
    
    // Sort tools by quality/power descending
    const sortedTools = [...toolsInventory].sort((a, b) => {
        const powerA = a.power || a.level || 0;
        const powerB = b.power || b.level || 0;
        return powerB - powerA;
    });
    
    sortedTools.forEach(tool => {
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card-panel';
        
        // Check if tool is assigned to a dwarf
        const assignedDwarf = dwarfs.find(d => d.toolId === tool.id);
        const isAssigned = !!assignedDwarf;
        const toolPower = tool.power || tool.level || 0;
        
        const header = document.createElement('div');
        header.className = 'tool-card-header';
        const displayName = tool.name || `${tool.type} #${tool.id}`;

        // Tool name span (will be replaced with input when editing)
        const toolNameSpan = document.createElement('span');
        toolNameSpan.className = 'tool-name';
        toolNameSpan.id = `tool-name-${tool.id}`;
        toolNameSpan.textContent = displayName;

                // Rename button next to name
        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn-secondary btn-tiny';
        renameBtn.style.cssText = 'margin-left: 8px; padding: 2px 6px; font-size: 11px; vertical-align: left;';
        renameBtn.textContent = '✏️';
        renameBtn.title = 'Rename tool';
        renameBtn.onclick = () => startInlineRename(tool.id);
        toolNameSpan.appendChild(renameBtn);


        header.appendChild(toolNameSpan);


        // Tool power
        const toolPowerSpan = document.createElement('span');
        toolPowerSpan.className = 'tool-power';
        toolPowerSpan.textContent = `⚒️ ${toolPower}`;
        header.appendChild(toolPowerSpan);

        const actions = document.createElement('div');
        actions.className = 'tool-card-actions';
        
        // Dropdown for assigning (shows current assignment or allows selection)
        const select = document.createElement('select');
        select.id = `panel-assign-select-${tool.id}`;
        select.className = 'assign-select-small';
        select.innerHTML = `<option value="">-- Unassigned --</option>` + 
            dwarfs.map(d => `<option value="${d.name}"${d.name === (assignedDwarf?.name || '') ? ' selected' : ''}>${d.name}</option>`).join('');
        select.onchange = () => assignToolFromPanel(tool.id, toolPower);
        actions.appendChild(select);

        // Plating info (before enchant button)
        if (tool.plating && platingEffects[tool.plating]) {
            const platingEffect = platingEffects[tool.plating];
            const platingMaterial = materials[tool.plating];
            const platingColor = platingMaterial ? platingMaterial.color : '#888888';

            const platingInfo = document.createElement('span');
            platingInfo.style.cssText = `padding: 4px 6px; background: ${platingColor}; border: 1px solid ${platingColor}dd; border-radius: 3px; color: #ffffff; font-size: 11px; white-space: nowrap; text-shadow: 0 2px 3px rgba(0,0,0,0.5); cursor: help; line-height: 1;`;
            platingInfo.textContent = platingEffect.name;
            platingInfo.title = platingEffect.description;
            actions.appendChild(platingInfo);
        }

        // Enchant button
        const enchantResearch = researchtree.find(r => r.id === 'tool-enchanting');
        const enchantLevel = enchantResearch ? enchantResearch.level : 0;
        const isEnchanted = tool.enchantLevel && tool.enchantLevel > 0;

        if (isEnchanted) {
            // Show enchantment level instead of button
            const enchantInfo = document.createElement('span');
            enchantInfo.style.cssText = 'padding: 4px 8px; background: rgba(138, 43, 226, 0.2); border: 1px solid rgba(138, 43, 226, 0.4); border-radius: 4px; color: #dda0ff; font-size: 11px; font-weight: bold; white-space: nowrap;';
            enchantInfo.textContent = `✨ Enchant +${tool.enchantLevel}`;
            enchantInfo.title = `Enchanted to level ${tool.enchantLevel}`;
            actions.appendChild(enchantInfo);
        } else {
            const enchantBtn = document.createElement('button');
            enchantBtn.className = 'btn-secondary btn-tiny';
            enchantBtn.textContent = '✨ Enchant';

            if (enchantLevel > 0) {
                enchantBtn.title = 'Have your tool enchanted by a wizard';
                enchantBtn.onclick = () => openEnchantModal(tool.id);
            } else {
                enchantBtn.title = 'Have your tool enchanted by a wizard';
                enchantBtn.style.opacity = '0.5';
                enchantBtn.style.cursor = 'not-allowed';
                enchantBtn.disabled = true;
            }
            actions.appendChild(enchantBtn);
        }

        // Gems button
        const gemSettingResearch = researchtree.find(r => r.id === 'gem-setting');
        const gemSettingLevel = gemSettingResearch ? gemSettingResearch.level : 0;
        const hasGems = tool.gems && tool.gems.length > 0;

        if (hasGems) {
            // Show gem info instead of button
            const gemInfo = document.createElement('button');
            gemInfo.style.cssText = 'padding: 4px 8px; background: rgba(102, 204, 255, 0.2); border: 1px solid rgba(102, 204, 255, 0.4); border-radius: 4px; color: #66ccff; font-size: 10px; ';
            gemInfo.textContent = `💎 ${tool.gems.length} Gem${tool.gems.length > 1 ? 's' : ''}`;
            gemInfo.title = `${tool.gems.length} gem${tool.gems.length > 1 ? 's' : ''} set`;
            gemInfo.style.cursor = 'pointer';
            gemInfo.className = 'btn-secondary btn-tiny';
            gemInfo.onclick = () => openGemModal(tool.id);
            actions.appendChild(gemInfo);
        } else {
            const gemsBtn = document.createElement('button');
            gemsBtn.className = 'btn-secondary btn-tiny';
            gemsBtn.textContent = '💎 Gems';

            if (gemSettingLevel > 0) {
                gemsBtn.title = 'Set gems into this tool';
                gemsBtn.onclick = () => openGemModal(tool.id);
            } else {
                gemsBtn.title = 'Requires Gem Setting research';
                gemsBtn.style.opacity = '0.5';
                gemsBtn.style.cursor = 'not-allowed';
                gemsBtn.disabled = true;
            }
            actions.appendChild(gemsBtn);
        }
        
        // Sell button
        const sellBtn = document.createElement('button');
        sellBtn.className = 'btn-sell btn-tiny';
        sellBtn.textContent = `💰 Sell (${toolPower})`;
        sellBtn.title = isAssigned ? 'Cannot sell assigned tool' : `Sell for ${toolPower} gold`;
        sellBtn.disabled = isAssigned;
        sellBtn.onclick = () => sellToolFromPanel(tool.id);
        actions.appendChild(sellBtn);
        
        toolCard.appendChild(header);
        toolCard.appendChild(actions);
        
        list.appendChild(toolCard);
    });
}

// Assign tool from tools panel
function assignToolFromPanel(toolId, newToolPower) {
    const selectElement = document.getElementById(`panel-assign-select-${toolId}`);
    if (!selectElement) return;
    
    const dwarfName = selectElement.value;
    
    // If selecting "Unassigned", remove tool from any dwarf that has it
    if (!dwarfName) {
        const currentOwner = dwarfs.find(d => d.toolId === toolId);
        if (currentOwner) {
            currentOwner.toolId = null;
            
            // Sync with worker
            if (gameWorker && workerInitialized) {
                gameWorker.postMessage({
                    type: 'update-state',
                    data: {
                        dwarfs: dwarfs,
                        toolsInventory: toolsInventory
                    }
                });
            }
            
            saveGame();
            populateToolsInPanel();
            logTransaction('income', 0, `Unassigned tool #${toolId} from ${currentOwner.name}`);
        }
        return;
    }
    
    const dwarf = dwarfs.find(d => d.name === dwarfName);
    
    if (!dwarf) {
        alert('Dwarf not found!');
        return;
    }
    
    // Check if dwarf already has a tool with higher power
    if (dwarf.toolId) {
        const currentTool = toolsInventory.find(t => t.id === dwarf.toolId);
        const currentPower = currentTool ? (currentTool.power || currentTool.level || 0) : 0;
        
        if (currentPower > newToolPower) {
            const confirm = window.confirm(`${dwarfName} has a better tool (⚒️ ${currentPower}). Replace with this weaker one (⚒️ ${newToolPower})?`);
            if (!confirm) {
                // Reset dropdown to previous value
                populateToolsInPanel();
                return;
            }
        }
    }
    
    // Remove tool from previous owner if any
    const previousOwner = dwarfs.find(d => d.toolId === toolId);
    if (previousOwner && previousOwner.name !== dwarfName) {
        previousOwner.toolId = null;
    }
    
    // Assign the tool
    dwarf.toolId = toolId;
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                dwarfs: dwarfs,
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Trigger autosave
    saveGame();
    
    // Refresh the tools panel
    populateToolsInPanel();
    
    logTransaction('income', 0, `Assigned tool #${toolId} to ${dwarfName}`);
}

// Rename tool from tools panel
// Start inline rename of a tool
function startInlineRename(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) return;

    const nameSpan = document.getElementById(`tool-name-${toolId}`);
    if (!nameSpan) return;

    const currentName = tool.name || `${tool.type} #${tool.id}`;

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.maxLength = 20;
    input.style.cssText = 'padding: 2px 4px; font-size: 12px; width: 150px; border: 1px solid #555; border-radius: 3px; background-color: #2a2a2a; color: #fff;';
    input.className = 'tool-name-input';

    let isSaving = false;

    // Function to save the name
    const saveName = () => {
        if (isSaving) return; // Prevent double-saving
        isSaving = true;

        const trimmedName = input.value.trim();
        if (trimmedName === '') {
            // Clear custom name, revert to default
            delete tool.name;
        } else {
            tool.name = trimmedName.substring(0, 20); // Enforce max length
        }

        // Sync with worker and save
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: { toolsInventory: toolsInventory }
            });
        }
        saveGame();

        // Refresh the tools panel to show the new name
        populateToolsPanel();
    };

    // Handle Enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            input.blur(); // This will trigger saveName via blur event
        } else if (e.key === 'Escape') {
            e.preventDefault();
            isSaving = true; // Prevent blur from saving
            // Cancel editing, restore original
            populateToolsPanel();
        }
    });

    // Handle blur (losing focus)
    input.addEventListener('blur', () => {
        saveName();
    });

    // Replace the span with the input
    nameSpan.replaceWith(input);
    input.focus();
    input.select();
}

function renameToolFromPanel(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        alert('Tool not found!');
        return;
    }

    const currentName = tool.name || `${tool.type} #${tool.id}`;
    const newName = prompt('Enter a new name for this tool:', currentName);

    if (newName === null) return; // Cancelled

    const trimmedName = newName.trim();
    if (trimmedName === '') {
        // Clear custom name, revert to default
        delete tool.name;
    } else {
        tool.name = trimmedName;
    }
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Trigger autosave
    saveGame();
    
    // Refresh the tools panel
    populateToolsInPanel();
}

// Sell tool from tools panel
function sellToolFromPanel(toolId) {
    // Check if tool is assigned
    const assignedDwarf = dwarfs.find(d => d.toolId === toolId);
    if (assignedDwarf) {
        alert(`Cannot sell tool #${toolId} - it is assigned to ${assignedDwarf.name}.`);
        return;
    }
    
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        alert('Tool not found!');
        return;
    }
    
    const toolPower = tool.power || tool.level || 0;
    const sellValue = toolPower;
    
    const confirmSell = window.confirm(`Sell ${tool.type} #${toolId} for ${sellValue} gold?`);
    if (!confirmSell) return;
    
    // Add gold
    gold += sellValue;
    
    // Remove tool from inventory
    const index = toolsInventory.findIndex(t => t.id === toolId);
    if (index !== -1) {
        toolsInventory.splice(index, 1);
    }
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                gold: gold,
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Update gold display
    updateGoldDisplay();
    
    // Trigger autosave
    saveGame();
    
    // Refresh the tools panel
    populateToolsInPanel();
    
    logTransaction('income', sellValue, `Sold ${tool.type} #${toolId}`);
}

// Dwarf modal code moved to modals/dwarf-detail-modal.js

/**
 * Populate the dwarfs modal with a compact table showing state for each dwarf
 */
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
        const xpNeeded = getDwarfXpForLevel(currentLevel);
        xpTd.textContent = `${formatNumber(currentXP, 'xp')} / ${formatNumber(xpNeeded, 'xp')}`;

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

// Efficiently update dwarf info in the panel without rebuilding the whole thing
function updateDwarfsInPanel() {
    const list = document.getElementById('materials-list');
    if (!list) return;

    // This function will be called every tick. It should not re-sort to avoid elements jumping around.
    for (const d of dwarfs) {
        const row = document.getElementById(`dwarf-row-${d.name}`);
        if (!row) {
            // Dwarf is new since the panel was opened. For now, we'll let populateDwarfsInPanel handle this
            // by re-running when the tab is re-opened. This avoids complexity of inserting into a sorted list.
            continue;
        }

        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = getDwarfXpForLevel(currentLevel);
        const canLevelUp = currentXP >= xpNeeded;

        // Update level up highlight and class
        row.classList.toggle('can-level-up', canLevelUp);

        // Update XP display in header
        const header = document.getElementById(`dwarf-header-${d.name}`);
        if (header) {
            const xpDisplay = header.querySelector('.dwarf-xp-display');
            if (xpDisplay) {
                if (canLevelUp) {
                    // Show star when ready to level up
                    xpDisplay.textContent = '⭐';
                    xpDisplay.title = `Ready to level up! (${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')} XP)`;
                    xpDisplay.style.cursor = 'pointer';
                    xpDisplay.style.fontSize = '16px';
                    xpDisplay.style.color = '';
                    xpDisplay.style.opacity = '';
                } else {
                    // Show XP progress
                    xpDisplay.textContent = `(${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')} XP)`;
                    xpDisplay.title = '';
                    xpDisplay.style.cursor = '';
                    xpDisplay.style.fontSize = '10px';
                    xpDisplay.style.color = '#9fbfe0';
                    xpDisplay.style.opacity = '0.7';
                }
            }
        }

        // Update info panel
        const info = document.getElementById(`dwarf-info-${d.name}`);
        if (info) {
            const bucketWeight = calculateBucketWeight(d.bucket);
            const dwarfCapacity = calculateDwarfBucketCapacity(d);

            const wageOptimization = researchtree.find(r => r.id === 'wage-optimization');
            const researchLevel = wageOptimization ? (wageOptimization.level || 0) : 0;
            const researchReduction = researchLevel * RESEARCH_WAGE_OPTIMIZATION_REDUCTION;
            const increaseRate = Math.max(DWARF_WAGE_INCREASE_MIN, DWARF_WAGE_INCREASE_RATE - researchReduction);
            const dwarfLevel = (d.level || 1) - 1;
            const wage = DWARF_BASE_WAGE * (1 + dwarfLevel * increaseRate);

            const baseDwarfPower = 3;
            let totalPower = baseDwarfPower;
            let toolName = 'None';
            if (d.toolId) {
                const tool = toolsInventory.find(t => t.id === d.toolId);
                if (tool) {
                    toolName = tool.name || tool.type;
                    const levelBonus = 1 + (d.digPower || 0) * 0.1;
                    const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
                    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * 0.01 : 0);
                    let toolPower;
                    if (tool.power !== undefined) {
                        toolPower = tool.power / 100;
                    } else {
                        const toolDef = getToolByType(tool.type);
                        toolPower = toolDef ? toolDef.power / 100 : 1.0;
                    }
                    totalPower = (baseDwarfPower * levelBonus) * researchBonus * toolPower;
                }
            }

            const levelSpan = `<span title="${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')} XP">⭐ ${d.level || 1}</span>`;
            const newHTML = `${levelSpan} | 💰 ${formatNumber(wage, 'gold')} | 💼 ${d.status || 'idle'}<br>🧺 ${bucketWeight}kg/${dwarfCapacity}kg | ⚡${Math.round(d.energy || 0)}/${d.maxEnergy || 100}<br>⛏️ ${formatNumber(totalPower, 'material')} (${toolName})`;

            if (info.innerHTML !== newHTML) {
                info.innerHTML = newHTML;
            }
        }
    }
}

// Populate dwarfs in the materials panel (not modal)
function populateDwarfsInPanel() {
    const list = document.getElementById('materials-list');
    if (!list) return;
    list.innerHTML = '';

    // Sort dwarfs alphabetically by name
    const sortedDwarfs = [...dwarfs].sort((a, b) => {
        return a.name.localeCompare(b.name);
    });

    // Create a compact list of dwarfs in two columns
    for (const d of sortedDwarfs) {
        const row = document.createElement('div');
        row.className = 'dwarf-row';
        row.id = `dwarf-row-${d.name}`;

        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = getDwarfXpForLevel(currentLevel);
        const canLevelUp = currentXP >= xpNeeded;

        if (canLevelUp) {
            row.classList.add('can-level-up');
        }

        // Header with name and level indicator/XP display
        const header = document.createElement('div');
        header.className = 'dwarf-header';
        header.id = `dwarf-header-${d.name}`;

        const name = document.createElement('div');
        name.className = 'dwarf-name';
        name.textContent = d.name;
        header.appendChild(name);

        // Add star icon or XP display
        const xpDisplay = document.createElement('div');
        xpDisplay.className = 'dwarf-xp-display';
        if (canLevelUp) {
            // Show star when ready to level up
            xpDisplay.textContent = '⭐';
            xpDisplay.title = `Ready to level up! (${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')} XP)`;
            xpDisplay.style.cursor = 'pointer';
            xpDisplay.style.fontSize = '16px';
        } else {
            // Show XP progress
            xpDisplay.textContent = `(${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')} XP)`;
            xpDisplay.style.fontSize = '10px';
            xpDisplay.style.color = '#9fbfe0';
            xpDisplay.style.opacity = '0.7';
        }
        header.appendChild(xpDisplay);

        // Calculate digging power (matching game-worker.js calculation)
        const baseDwarfPower = 3;
        let totalPower = baseDwarfPower;

        if (d.toolId) {
            const tool = toolsInventory.find(t => t.id === d.toolId);
            if (tool) {
                const levelBonus = 1 + (d.digPower || 0) * 0.1;
                const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
                const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * 0.01 : 0);

                // Check if tool has custom power (forged tools) or use base definition
                let toolPower;
                if (tool.power !== undefined) {
                    // Forged tool with custom power
                    toolPower = tool.power / 100;
                } else {
                    // Base tool - look up definition
                    const toolDef = getToolByType(tool.type);
                    if (toolDef) {
                        toolPower = toolDef.power / 100;
                    } else {
                        toolPower = 1.0; // Fallback
                    }
                }

                totalPower = (baseDwarfPower * levelBonus) * researchBonus * toolPower;
            }
        }

        // Calculate bucket fill (weight-based)
        const bucketWeight = calculateBucketWeight(d.bucket);
        const dwarfCapacity = calculateDwarfBucketCapacity(d);

        // Get tool name for display
        const toolName = d.toolId ? (() => {
            const tool = toolsInventory.find(t => t.id === d.toolId);
            return tool ? (tool.name || tool.type) : 'None';
        })() : 'None';

        const info = document.createElement('div');
        info.className = 'dwarf-info';
        info.id = `dwarf-info-${d.name}`;

        // Create level display with XP tooltip
        const levelSpan = `<span title="${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')} XP">⭐ ${currentLevel}</span>`;

        // Calculate wage using same logic as game-worker.js
        const wageOptimization = researchtree.find(r => r.id === 'wage-optimization');
        const researchLevel = wageOptimization ? (wageOptimization.level || 0) : 0;
        const researchReduction = researchLevel * RESEARCH_WAGE_OPTIMIZATION_REDUCTION;
        const increaseRate = Math.max(DWARF_WAGE_INCREASE_MIN, DWARF_WAGE_INCREASE_RATE - researchReduction);
        const dwarfLevel = (currentLevel || 1) - 1;
        const wage = DWARF_BASE_WAGE * (1 + dwarfLevel * increaseRate);

        info.innerHTML = `${levelSpan} | 💰 ${formatNumber(wage, 'gold')} | 💼 ${d.status || 'idle'}<br>🧺 ${bucketWeight}kg/${dwarfCapacity}kg | ⚡${Math.round(d.energy || 0)}/${d.maxEnergy || 100}<br>⛏️ ${formatNumber(totalPower, 'material')} (${toolName})`;

        row.appendChild(header);
        row.appendChild(info);

        // Make row clickable to open dwarf detail modal
        row.style.cursor = 'pointer';
        row.dataset.dwarfName = d.name;
        row.classList.add('dwarf-clickable');

        list.appendChild(row);
    }
}

// clicking on any element with data-action="close-modal" closes modals
document.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el) return;
    if (el.dataset && el.dataset.action === 'close-modal') {
        // Find which modal this close button belongs to
        const modal = el.closest('.modal');
        if (modal && modal.id) {
            closeModal(modal.id);
        } else {
            closeModal();
        }
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
        case 'open-forge':
            openForge();
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
    const sellBtn = ev.target.closest('.btn-sell');
    if (!sellBtn) return;

    const materialId = sellBtn.dataset.materialId;
    if (materialId) {
        openSellModal(materialId);
    }
});

// Forge button event listener moved to modals/forge-modal.js

// Dwarf modal event listeners moved to modals/dwarf-modal.js


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
        goldAmount.textContent = formatNumber(gold, 'gold');
    }
}

// Initialize the materials panel structure once (called on game load)
function initMaterialsPanel() {
    const list = document.getElementById('materials-list');
    if (!list || list.dataset.initialized === 'true') return;
    
    list.innerHTML = '';
    
    // Get materials that are used as smelter inputs and outputs
    const smelterInputMaterials = new Set();
    const smelterOutputMaterials = new Set();
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
        }
        if (task.inputs && Array.isArray(task.inputs)) {
            task.inputs.forEach(input => smelterInputMaterials.add(input.material));
        }
        if (task.output && task.output.material) {
            smelterOutputMaterials.add(task.output.material);
        }
    }
    
    // Create container and header
    const container = document.createElement('div');
    container.className = 'warehouse-table-container';
    
    const tableHeader = document.createElement('div');
    tableHeader.className = 'warehouse-table-header';
    tableHeader.innerHTML = `
        <span class="wh-col-name">MATERIAL</span>
        <span class="wh-col-price">PRICE</span>
        <span class="wh-col-count">STOCK</span>
        <span class="wh-col-total">VALUE</span>
        <span class="wh-col-icons"></span>
        <span class="wh-col-actions">SELL</span>
    `;
    container.appendChild(tableHeader);
    
    // Sort materials by worth (high to low) for consistent display order
    // Filter out gems - they have their own panel
    const sortedMaterials = Object.entries(materials)
        .filter(([id, m]) => m.type !== 'Gem')
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => b.worth - a.worth);

    // Create a row for each material (hidden by default)
    for (const m of sortedMaterials) {
        const id = m.id;
        
        const row = document.createElement('div');
        row.className = 'warehouse-row';
        row.dataset.materialId = id;
        row.style.display = 'none'; // Hidden by default
        row.style.setProperty('--material-color', m.color || '#888');
        
        const name = document.createElement('span');
        name.className = 'wh-col-name';
        name.textContent = m.name;
        
        const worth = document.createElement('span');
        worth.className = 'wh-col-price';
        worth.dataset.baseWorth = m.worth;
        
        const cnt = document.createElement('span');
        cnt.className = 'wh-col-count';
        
        const totalValue = document.createElement('span');
        totalValue.className = 'wh-col-total';
        
        // Recipe usage icons column
        const icons = document.createElement('span');
        icons.className = 'wh-col-icons';
        const isInput = smelterInputMaterials.has(id);
        const isOutput = smelterOutputMaterials.has(id);
        const isForgeInput = m.type === 'Ingot';
        
        let iconsText = '';
        const tooltipParts = [];
        if (isInput) {
            iconsText = '🪨';
            tooltipParts.push('Used in smelter recipes');
        }
        if (isOutput) {
            iconsText = '♨️';
            tooltipParts.push('Produced by smelter');
        }
        if (isForgeInput) {
            iconsText = '🔩';
            tooltipParts.push('Used in forge');
        }
        icons.textContent = iconsText;
        if (tooltipParts.length > 0) {
            icons.title = tooltipParts.join(' | ');
        }
        
        const buttons = document.createElement('span');
        buttons.className = 'wh-col-actions';

        const sellBtn = document.createElement('button');
        sellBtn.className = 'btn-sell';
        sellBtn.textContent = 'Sell';
        sellBtn.dataset.materialId = id;

        buttons.appendChild(sellBtn);
        
        row.appendChild(name);
        row.appendChild(worth);
        row.appendChild(cnt);
        row.appendChild(totalValue);
        row.appendChild(icons);
        row.appendChild(buttons);
        
        container.appendChild(row);
    }
    
    list.appendChild(container);
    list.dataset.initialized = 'true';
}

function updateMaterialsPanel() {
    const panel = document.getElementById('materials-panel');
    // Only update if we're in warehouse view (not dwarfs or tools)
    if (panel && (panel.dataset.view === 'dwarfs' || panel.dataset.view === 'tools')) return;
    
    const list = document.getElementById('materials-list');
    if (!list) return;
    
    // Initialize structure if needed
    if (list.dataset.initialized !== 'true') {
        initMaterialsPanel();
    }
    
    // Calculate trade bonus once for display
    const betterTrading = getResearchLevel('trading');
    const tradeBonus = 1 + betterTrading * RESEARCH_TRADING_BONUS;

    // Apply price negotiations bonus (1% per wisdom level of highest wisdom dwarf)
    const priceNegotiationsLevel = getResearchLevel('price-negotiations');
    const negotiationsBonus = priceNegotiationsLevel > 0 ? (1 + getHighestDwarfWisdom() * RESEARCH_PRICE_NEGOTIATIONS_BONUS) : 1;

    const totalTradeBonus = tradeBonus * negotiationsBonus;

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
    
    // Calculate total stock value and update rows
    let totalStockValue = 0;
    let totalNonCraftableValue = 0;
    let hasAnyMaterials = false;
    let hasNotCraftableMaterials = false;

    const rows = list.querySelectorAll('.warehouse-row');
    for (const row of rows) {
        const id = row.dataset.materialId;
        const m = materials[id];
        if (!m) continue;

        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        const actualWorth = m.worth * totalTradeBonus;

        if (count > 0) {
            hasAnyMaterials = true;
            totalStockValue += count * actualWorth;

            if (!smelterInputMaterials.has(id) && m.type !== 'Ingot') {
                hasNotCraftableMaterials = true;
                totalNonCraftableValue += count * actualWorth;
            }
            
            // Show row and update values
            row.style.display = '';
            
            const worthSpan = row.querySelector('.wh-col-price');
            worthSpan.textContent = formatNumber(actualWorth, 'gold');
            worthSpan.title = totalTradeBonus > 1 ? `Base: ${formatNumber(m.worth, 'gold')} gold (${formatNumber(totalTradeBonus, 'material')}x bonus)` : `${formatNumber(m.worth, 'gold')} gold each`;

            row.querySelector('.wh-col-count').textContent = formatNumber(count, 'material');
            row.querySelector('.wh-col-total').textContent = formatNumber(count * actualWorth, 'gold');

            // Update sell button tooltip
            const sellBtn = row.querySelector('.btn-sell');
            if (sellBtn) {
                sellBtn.title = `Sell ${m.name}`;
            }
        } else {
            // Hide row
            row.style.display = 'none';
        }
    }
    
    // Show/hide header based on whether we have materials
    const tableHeader = list.querySelector('.warehouse-table-header');
    if (tableHeader) {
        tableHeader.style.display = hasAnyMaterials ? '' : 'none';
    }
    
    // Update header buttons
    const header = panel.querySelector('.materials-panel-header');
    let sellAllHeaderBtn = document.getElementById('sell-all-header-btn');
    let sellNotCraftableBtn = document.getElementById('sell-not-craftable-btn');
    let gemsBtn = document.getElementById('gems-header-btn');

    if (header) {
        // Create or update Gems button (only visible when player has gems)
        const hasGems = gems && gems.length > 0;
        if (hasGems) {
            if (!gemsBtn) {
                gemsBtn = document.createElement('button');
                gemsBtn.id = 'gems-header-btn';
                gemsBtn.className = 'btn-gems';
                gemsBtn.textContent = '💎 Gems';
                gemsBtn.title = 'Manage gems (coming soon)';
                gemsBtn.onclick = openGemsModal;
                // Insert at the beginning
                header.querySelector('.tab-buttons').insertAdjacentElement('afterend', gemsBtn);
            }
        } else if (gemsBtn) {
            gemsBtn.remove();
        }

        // Create or update Warehouse Sell button (on the right)
        let warehouseSellBtn = document.getElementById('warehouse-sell-btn');
        if (hasAnyMaterials) {
            if (!warehouseSellBtn) {
                warehouseSellBtn = document.createElement('button');
                warehouseSellBtn.id = 'warehouse-sell-btn';
                warehouseSellBtn.className = 'btn-sell-all-global';
                warehouseSellBtn.textContent = '💰 Sell';
                warehouseSellBtn.onclick = openWarehouseSellModal;
                warehouseSellBtn.style.marginLeft = 'auto';
                header.appendChild(warehouseSellBtn);
            }
        } else if (warehouseSellBtn) {
            warehouseSellBtn.remove();
        }

        // Remove old buttons if they still exist
        if (sellAllHeaderBtn) sellAllHeaderBtn.remove();
        if (sellNotCraftableBtn) sellNotCraftableBtn.remove();
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
    const hardness = formatNumber(Math.max(0, rawHardness), 'material');
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
let smelterRefreshCounter = 0; // Track ticks for smelter refresh rate
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
                
                // Update dwarfs while preserving toolId assignments (managed by main thread)
                if (data.dwarfs) {
                    data.dwarfs.forEach((workerDwarf, index) => {
                        if (dwarfs[index]) {
                            // Preserve toolId from main thread
                            const toolId = dwarfs[index].toolId;
                            dwarfs[index] = workerDwarf;
                            if (toolId !== undefined) {
                                dwarfs[index].toolId = toolId;
                            }
                        } else {
                            dwarfs[index] = workerDwarf;
                        }
                    });
                }
                
                startX = data.startX;

                // Update gems array
                if (data.gems) {
                    gems = data.gems;
                }
                if (data.nextGemId !== undefined) {
                    nextGemId = data.nextGemId;
                }

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
                            triggerCritAnimation(transaction.x, transaction.y, false);
                        } else if (transaction.type === 'one-hit') {
                            // Trigger one-hit animation (stronger effect)
                            console.log(`⚡ ONE-HIT at (${transaction.x}, ${transaction.y}) - ${transaction.material} destroyed!`);
                            triggerCritAnimation(transaction.x, transaction.y, true);
                        } else if (transaction.type === 'gem-spawn') {
                            // Trigger gem spawn animation
                            const caratText = transaction.carat ? ` (${transaction.carat.toFixed(2)}ct)` : '';
                            console.log(`💎 GEM FOUND! ${transaction.dwarf} discovered a ${transaction.gem}${caratText} at (${transaction.x}, ${transaction.y})!`);
                            triggerGemSpawnAnimation(transaction.x, transaction.y, transaction.gem);
                        } else {
                            logTransaction(transaction.type, transaction.amount, transaction.description);
                        }
                    }
                }
                
                // Check if we need to roll up transactions to a new hour
                if (currentHourTimestamp !== null) {
                    const currentHour = getHourTimestamp(new Date());
                    if (currentHour !== currentHourTimestamp) {
                        processHourlyRollup();
                        currentHourTimestamp = currentHour;
                    }
                }
                
                // Note: toolsInventory is managed by main thread (forge interface)
                // Worker does not modify toolsInventory, so we don't sync it back
                
                // Update research state from worker
                let researchStateChanged = false;
                if (data.activeResearch !== undefined) {
                    if (activeResearch !== data.activeResearch) {
                        researchStateChanged = true;
                    }
                    activeResearch = data.activeResearch;
                }
                if (data.researchQueue !== undefined) {
                    if (JSON.stringify(researchQueue) !== JSON.stringify(data.researchQueue)) {
                        researchStateChanged = true;
                        console.log('[MAIN] Research queue changed from worker:', data.researchQueue);
                    }
                    researchQueue = data.researchQueue;
                }
                if (data.researchtree) {
                    // Merge research progress from worker with current definitions
                    for (const workerResearch of data.researchtree) {
                        const currentResearch = researchtree.find(r => r.id === workerResearch.id);
                        if (currentResearch) {
                            if (currentResearch.level !== workerResearch.level) {
                                researchStateChanged = true;
                            }
                            currentResearch.level = workerResearch.level || 0;
                            currentResearch.progress = workerResearch.progress || 0;
                        }
                    }
                }
                
                // Update smelter temperature state from worker
                if (data.smelterTemperature !== undefined) smelterTemperature = data.smelterTemperature;
                if (data.smelterCoalMinTemp !== undefined) smelterCoalMinTemp = data.smelterCoalMinTemp;
                if (data.smelterCoalMaxTemp !== undefined) smelterCoalMaxTemp = data.smelterCoalMaxTemp;
                if (data.smelterMagmaMinTemp !== undefined) smelterMagmaMinTemp = data.smelterMagmaMinTemp;
                if (data.smelterHeatingMode !== undefined) smelterHeatingMode = data.smelterHeatingMode;

                // Update smelter tasks data from worker (includes progress)
                if (data.smelterTasksData !== undefined) {
                    // Merge progress from worker into main thread's task data
                    for (const taskId in data.smelterTasksData) {
                        if (smelterTasksData[taskId]) {
                            smelterTasksData[taskId].progress = data.smelterTasksData[taskId].progress;
                        }
                    }
                }

                // Update UI to reflect new state
                updateGridDisplay();
                
                // Update warehouse panel if materials stock changed
                if (stockChanged) {
                    updateMaterialsPanel();
                }
                
                // Update dwarf panel every tick if in dwarfs view
                const panel = document.getElementById('materials-panel');
                if (panel && panel.dataset.view === 'dwarfs') {
                    updateDwarfsInPanel();
                }

                // Update dwarf detail modal if it's open
                const dwarfDetailModal = document.getElementById('dwarf-detail-modal');
                if (dwarfDetailModal && dwarfDetailModal.getAttribute('aria-hidden') === 'false') {
                    const dwarfName = dwarfDetailModal.dataset.dwarfName;
                    const dwarf = dwarfs.find(d => d.name === dwarfName);
                    if (dwarf) {
                        refreshDwarfDetailModal(dwarf);
                    }
                }

                // Update smelter panel every 5 ticks if it's open (for temperature display)
                const smelterModal = document.getElementById('smelter-modal');
                if (smelterModal && smelterModal.getAttribute('aria-hidden') === 'false') {
                    smelterRefreshCounter++;
                    if (smelterRefreshCounter >= 5) {
                        updateSmelterTemperatureDisplay();
                        smelterRefreshCounter = 0;
                    }
                }
                
                // Update research modal if it's open
                const researchModal = document.getElementById('research-modal');
                if (researchModal && researchModal.getAttribute('aria-hidden') === 'false') {
                    if (researchStateChanged) {
                        // Full redraw when state changes (new research, queue changes, etc.)
                        populateResearch();
                    } else {
                        // Lightweight updates without full redraw
                        if (activeResearch) {
                            updateResearchProgress();
                        }
                        // Update button states only when they actually change
                        updateResearchButtons();
                    }
                }

                // Update forge function link when research state changes (e.g., forge unlocked)
                if (researchStateChanged) {
                    updateForgeFunctionLink();
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
            gems,
            nextGemId,
            bucketCapacity,
            dropOff,
            house,
            research,
            smelter,
            smelterTasks,
            smelterTasksData,
            dropGridStartX,
            gold,
            toolsInventory,
            activeResearch,
            researchQueue,
            researchtree,
            smelterTemperature,
            smelterCoalMinTemp,
            smelterCoalMaxTemp,
            smelterMagmaMinTemp
        }
    });
    
    // Start the worker's internal game loop
    gameWorker.postMessage({ type: 'start-loop', interval: GAME_LOOP_INTERVAL_MS });
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
        // Add/remove paused class for visual styling
        if (gamePaused) {
            btn.classList.add('paused');
        } else {
            btn.classList.remove('paused');
        }
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
            gems: gems,
            nextGemId: nextGemId,
            toolsInventory: toolsInventory,
            gold: gold,
            researchtree: researchtree,
            activeResearch: activeResearch,
            researchQueue: researchQueue,
            transactionLog: transactionLog,
            transactionHistory: transactionHistory,
            currentHourTimestamp: currentHourTimestamp,
            smelterTasks: smelterTasks,
            smelterTemperature: smelterTemperature,
            smelterCoalMinTemp: smelterCoalMinTemp,
            smelterCoalMaxTemp: smelterCoalMaxTemp,
            smelterMagmaMinTemp: smelterMagmaMinTemp,
            smelterHeatingMode: smelterHeatingMode,
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

        // Migrate old uppercase material IDs in grid to lowercase
        for (let row of grid) {
            if (row && Array.isArray(row)) {
                for (let cell of row) {
                    if (cell && cell.materialId) {
                        cell.materialId = cell.materialId.toLowerCase();
                    }
                }
            }
        }

        dwarfs = gameState.dwarfs || [];

        // Sanitize dwarf buckets - fix any corrupted gem data and migrate material IDs to lowercase
        for (const dwarf of dwarfs) {
            if (dwarf.bucket) {
                const sanitizedBucket = {};
                for (const [key, value] of Object.entries(dwarf.bucket)) {
                    // Migrate material ID key to lowercase
                    const lowercaseKey = key.toLowerCase();

                    // If value is an object (corrupted gem data), convert to 1
                    // If value is a number, keep it
                    // If value is a string like "[object Object]11", extract the number or default to 1
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        sanitizedBucket[lowercaseKey] = 1;
                    } else if (typeof value === 'string') {
                        // Try to extract number from corrupted string like "[object Object]11"
                        const match = value.match(/\d+$/);
                        sanitizedBucket[lowercaseKey] = match ? parseInt(match[0]) : 1;
                    } else if (Array.isArray(value)) {
                        sanitizedBucket[lowercaseKey] = value.length;
                    } else if (typeof value === 'number') {
                        sanitizedBucket[lowercaseKey] = value;
                    } else {
                        sanitizedBucket[lowercaseKey] = 1;
                    }
                }
                dwarf.bucket = sanitizedBucket;
            }
        }

        startX = gameState.startX || 0;
        gold = gameState.gold !== undefined ? gameState.gold : 1000;
        
        // Restore materials stock
        if (gameState.materialsStock) {
            for (const key in gameState.materialsStock) {
                // Migrate old uppercase material IDs to lowercase
                const lowercaseKey = key.toLowerCase();
                materialsStock[lowercaseKey] = gameState.materialsStock[key];
            }
        }

        // Restore gems array
        if (gameState.gems) {
            gems = gameState.gems;
            // Migrate old uppercase gem types to lowercase
            for (const gem of gems) {
                if (gem.type) {
                    gem.type = gem.type.toLowerCase();
                }
            }
        }
        if (gameState.nextGemId !== undefined) {
            nextGemId = gameState.nextGemId;
        }

        // Restore tools inventory
        if (gameState.toolsInventory) {
            toolsInventory.length = 0;
            // Migrate old uppercase plating material IDs and gem types to lowercase
            const migratedTools = gameState.toolsInventory.map(tool => {
                const migratedTool = { ...tool };
                if (migratedTool.plating) {
                    migratedTool.plating = migratedTool.plating.toLowerCase();
                }
                // Migrate gem types to lowercase
                if (migratedTool.gems && Array.isArray(migratedTool.gems)) {
                    migratedTool.gems = migratedTool.gems.map(gem => ({
                        ...gem,
                        type: gem.type ? gem.type.toLowerCase() : gem.type
                    }));
                }
                return migratedTool;
            });
            toolsInventory.push(...migratedTools);
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

        // Restore research queue
        if (gameState.researchQueue && Array.isArray(gameState.researchQueue)) {
            researchQueue = gameState.researchQueue;
        }

        // Restore transaction log
        if (gameState.transactionLog) {
            transactionLog = gameState.transactionLog;
        }
        
        // Restore transaction history
        if (gameState.transactionHistory) {
            transactionHistory = gameState.transactionHistory;
        }
        
        // Restore current hour timestamp
        if (gameState.currentHourTimestamp) {
            currentHourTimestamp = gameState.currentHourTimestamp;
        }
        
        // Restore smelter tasks order
        if (gameState.smelterTasks && Array.isArray(gameState.smelterTasks)) {
            // Check if saved data is old format (array of objects) or new format (array of IDs)
            if (gameState.smelterTasks.length > 0) {
                if (typeof gameState.smelterTasks[0] === 'object' && gameState.smelterTasks[0].id) {
                    // Old format: extract IDs and filter out any that don't exist in smelterTasksData
                    smelterTasks = gameState.smelterTasks
                        .map(t => t.id)
                        .filter(id => smelterTasksData[id]);
                } else {
                    // New format: use directly, but filter out any that don't exist in smelterTasksData
                    smelterTasks = gameState.smelterTasks.filter(id => smelterTasksData[id]);
                }
            }
        }
        
        // Restore smelter temperature state
        if (gameState.smelterTemperature !== undefined) smelterTemperature = gameState.smelterTemperature;
        if (gameState.smelterCoalMinTemp !== undefined) smelterCoalMinTemp = gameState.smelterCoalMinTemp;
        if (gameState.smelterCoalMaxTemp !== undefined) smelterCoalMaxTemp = gameState.smelterCoalMaxTemp;
        if (gameState.smelterMagmaMinTemp !== undefined) smelterMagmaMinTemp = gameState.smelterMagmaMinTemp;
        if (gameState.smelterHeatingMode !== undefined) smelterHeatingMode = gameState.smelterHeatingMode;

        // Backwards compatibility: if old variables exist but new ones don't, migrate them
        if (gameState.smelterMinTemp !== undefined && gameState.smelterCoalMinTemp === undefined) {
            smelterCoalMinTemp = gameState.smelterMinTemp;
            smelterMagmaMinTemp = gameState.smelterMinTemp;
        }
        if (gameState.smelterMaxTemp !== undefined && gameState.smelterCoalMaxTemp === undefined) {
            smelterCoalMaxTemp = gameState.smelterMaxTemp;
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
    
    // Multiply the current depth
    startX = startX * CHEAT_DEPTH_MULTIPLIER;
    
    // Reset all dwarfs to home location
    for (const dwarf of dwarfs) {
        if (house) {
            dwarf.x = house.x;
            dwarf.y = house.y;
        }
        dwarf.status = 'idle';
        dwarf.moveTarget = null;
        dwarf.bucket = {}; // Clear bucket

        // Give XP for one level
        const xpForLevel = getDwarfXpForLevel(dwarf.level || 1);
        dwarf.xp = (dwarf.xp || 0) + xpForLevel;
    }
    
    // Add gold bonus
    gold += CHEAT_GOLD_BONUS;
    
    // Log transaction
    logTransaction('income', CHEAT_GOLD_BONUS, 'Cheat code activated');
    
    // Set active research to 1 point before completion
    if (activeResearch) {
        const currentLevel = activeResearch.level || 0;
        const targetLevel = currentLevel + 1;
        const researchCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        activeResearch.progress = researchCost - 1;
        console.log(`Active research "${activeResearch.name}" set to 1 point before completion (${activeResearch.progress}/${researchCost})`);
    }
    
    // Give 5 of each material
    let materialsAdded = 0;
    for (const id in materials) {
        materialsStock[id] = (materialsStock[id] || 0) + 5;
        materialsAdded++;
    }
    console.log(`Added 5 of each material (${materialsAdded} materials)`);

    // Remove enchantments from all tools
    let enchantmentsRemoved = 0;
    for (const tool of toolsInventory) {
        if (tool.enchantLevel && tool.enchantLevel > 0) {
            delete tool.enchantLevel;
            enchantmentsRemoved++;
        }
    }
    if (enchantmentsRemoved > 0) {
        console.log(`Removed enchantments from ${enchantmentsRemoved} tool(s)`);
    }

    // Sync with worker - send ALL updated state
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                startX: startX,
                dwarfs: dwarfs,
                gold: gold,
                materialsStock: materialsStock,
                activeResearch: activeResearch,
                researchtree: researchtree,
                toolsInventory: toolsInventory
            }
        });
    }
    
    // Update UI
    updateGridDisplay();
    updateGoldDisplay();
    populateDwarfsInPanel();
    updateStockPanel();
    populateResearch();
    populateToolsInPanel(); // Refresh tools panel to show removed enchantments

    // Save game
    saveGame();

    console.log(`Cheat activated! Depth: ${startX}, Gold: +5000, Materials: +5 each, Dwarfs: reset to home with XP, Enchantments removed: ${enchantmentsRemoved}`);
    alert(`Cheat activated!\n\nDepth doubled to: ${startX}\nGold +5000\n+5 of each material\nActive research near completion\nAll dwarfs reset to home with XP bonus\nEnchantments removed from ${enchantmentsRemoved} tool(s)`);
}

function initializeGame() {
    initWorker();
    gamePaused = false; // Start with game running
    updateGameState();
}

// Populate the functions list with clickable links (static, won't be re-rendered)
function populateFunctionsList() {
    const list = document.getElementById('functions-list');
    if (!list) return;

    list.innerHTML = '';

    // Research function
    const researchLink = document.createElement('a');
    researchLink.href = '#';
    researchLink.className = 'function-link';
    researchLink.innerHTML = '<span class="icon">🔬</span><span>Research</span>';
    researchLink.onclick = (e) => {
        e.preventDefault();
        openResearch();
    };
    list.appendChild(researchLink);

    // Smelter function
    const smelterLink = document.createElement('a');
    smelterLink.href = '#';
    smelterLink.className = 'function-link';
    smelterLink.innerHTML = '<span class="icon">♨️</span><span>Smelter</span>';
    smelterLink.onclick = (e) => {
        e.preventDefault();
        openSmelter();
    };
    list.appendChild(smelterLink);

    // Forge function
    const forgeLink = document.createElement('a');
    forgeLink.href = '#';
    forgeLink.className = 'function-link';
    forgeLink.id = 'forge-function-link'; // Add ID for easy updates
    forgeLink.innerHTML = '<span class="icon">🔨</span><span>Forge</span>';
    forgeLink.onclick = (e) => {
        e.preventDefault();
        openForge();
    };

    // Check if forge is unlocked
    const forgeResearch = researchtree.find(r => r.id === 'forge');
    const isForgeUnlocked = forgeResearch && (forgeResearch.level || 0) >= 1;

    if (!isForgeUnlocked) {
        forgeLink.style.opacity = '0.5';
        forgeLink.style.cursor = 'not-allowed';
        forgeLink.title = 'Requires Forge research';
    }

    list.appendChild(forgeLink);

    // Automation function (placeholder for future) - last position
    const automationLink = document.createElement('a');
    automationLink.href = '#';
    automationLink.className = 'function-link';
    automationLink.innerHTML = '<span class="icon">⚙️</span><span>Automation</span>';
    automationLink.onclick = (e) => {
        e.preventDefault();
        // TODO: Open automation modal
    };
    automationLink.style.opacity = '0.5';
    automationLink.style.cursor = 'not-allowed';
    automationLink.title = 'Coming soon';
    list.appendChild(automationLink);
}

// Update forge function link state without rebuilding the entire list
function updateForgeFunctionLink() {
    const forgeLink = document.getElementById('forge-function-link');
    if (!forgeLink) return;

    // Check if forge is unlocked
    const forgeResearch = researchtree.find(r => r.id === 'forge');
    const isForgeUnlocked = forgeResearch && (forgeResearch.level || 0) >= 1;

    if (isForgeUnlocked) {
        // Only update if state actually changed
        if (forgeLink.style.opacity === '0.5') {
            forgeLink.style.opacity = '1';
            forgeLink.style.cursor = 'pointer';
            forgeLink.title = '';
        }
    } else {
        // Only update if state actually changed
        if (forgeLink.style.opacity !== '0.5') {
            forgeLink.style.opacity = '0.5';
            forgeLink.style.cursor = 'not-allowed';
            forgeLink.title = 'Requires Forge research';
        }
    }
}

// Switch between Warehouse and Dwarfs tabs in the materials panel
function switchMaterialsTab(tab) {
    // Update tab button states
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Switch content based on tab
    if (tab === 'warehouse') {
        showWarehousePanel();
    } else if (tab === 'dwarfs') {
        openDwarfs();
    } else if (tab === 'tools') {
        showToolsPanel();
    }
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
    populateFunctionsList(); // Initialize functions list (one time, won't be re-rendered)
}

// Check for cheat mode in URL or localhost
function checkCheatMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';

    if (urlParams.has('cheat') || isLocalhost) {
        cheatModeEnabled = true;
        const cheatSection = document.getElementById('settings-cheat-section');
        const cheatButton = document.getElementById('settings-cheat-button');
        if (cheatSection) cheatSection.classList.add('visible');
        if (cheatButton) cheatButton.classList.add('visible');
        console.log('🎮 Cheat mode enabled' + (isLocalhost ? ' (localhost)' : ''));
    }
}

// Listen for modals loaded event to re-check cheat mode (in case elements weren't available initially)
window.addEventListener('modalsLoaded', () => {
    if (cheatModeEnabled) {
        const cheatSection = document.getElementById('settings-cheat-section');
        const cheatButton = document.getElementById('settings-cheat-button');
        if (cheatSection) cheatSection.classList.add('visible');
        if (cheatButton) cheatButton.classList.add('visible');
    }
});

// Start the game
checkCheatMode();
initGame();