// Track last known count of dwarfs ready to level up for badge update
let lastDwarfsLevelUpCount = 0;

function updateDwarfsLevelUpBadge() {
    const badge = document.getElementById('dwarfs-levelup-badge');
    if (!badge) return;
    const dwarfsCanLevelUp = dwarfs.filter(d => {
        const currentXP = d.xp || 0;
        const currentLevel = d.level || 1;
        const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
    for (const task of smelterTasks) {
        if (task.id === 'do-nothing') continue;
        if (!isSmelterTaskUnlocked(task)) continue;

        // Check for gem cutting tasks
        if (task.type === 'gem-cutting') {
            const hasGemsToPolish = gems.some(g => g.markedForCutting && !g.polished);
            if (hasGemsToPolish) {
                count++;
            }
        } else if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                count++;
            }
        }
    }
    return count;
}

// Check if the smelter's top task is "do nothing"
function isSmelterPaused() {
    return smelterTasks.length > 0 && smelterTasks[0].id === 'do-nothing';
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

function openForge() {
    openModal('forge-modal');
    populateForge();
}

async function startForging() {
    // Validate we have material selected
    if (!forgeState.baseMaterial) {
        alert('Please select a base material first!');
        return;
    }
    
    // Check stock
    const stockAmount = materialsStock[forgeState.baseMaterial] || 0;
    if (stockAmount < forgeState.retryCount) {
        alert(`Not enough ${forgeState.baseMaterial} in stock! Need ${forgeState.retryCount}, have ${stockAmount}.`);
        return;
    }
    
    // Calculate costs for validation
    const coolingCost = forgeState.coolingOilQuality === 1 ? 0 : FORGE_COOLING_BASE_COST * Math.pow(FORGE_COOLING_COST_MULTIPLIER, forgeState.coolingOilQuality - 2);
    const handleCost = FORGE_HANDLE_BASE_COST * Math.pow(FORGE_HANDLE_COST_MULTIPLIER, forgeState.handleQuality - 1);
    const totalCost = coolingCost + handleCost;
    
    // Check gold upfront
    if (gold < totalCost) {
        alert(`Not enough gold! Need ${formatNumber(totalCost, 'gold')}, have ${formatNumber(gold, 'gold')}.`);
        return;
    }
    
    // Costs will be deducted during the forging process:
    // - Cooling cost after successful hammering
    // - Handle cost before mounting handle
    
    // Close forge modal and show animation modal
    closeModal('forge-modal');
    openModal('forging-animation-modal');
    
    const animationContent = document.getElementById('forging-animation-content');
    animationContent.innerHTML = '<div class="forging-anvil">🔨</div><div class="forging-message">Forging...</div>';
    
    // Try forging up to retryCount times
    let success = false;
    let finalQuality = 0;
    let attemptsUsed = 0;
    
    for (let attempt = 0; attempt < forgeState.retryCount; attempt++) {
        attemptsUsed++;
        
        // Check if we have material
        if ((materialsStock[forgeState.baseMaterial] || 0) <= 0) {
            break;
        }
        
        // Consume material immediately
        materialsStock[forgeState.baseMaterial]--;
        
        // Update UI and sync immediately
        updateStockDisplay();
        saveGame();
        
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: {
                    materialsStock: materialsStock
                }
            });
        }
        
        // Calculate quality components
        const material = materials.find(m => m.id === forgeState.baseMaterial);
        const materialHardness = material ? material.hardness : 0;
        const baseQuality = FORGE_BASE_QUALITY;
        const hammeringBonus = forgeState.hammeringCount * FORGE_HAMMERING_BONUS_PER_ITERATION;
        const coolingBonus = forgeState.coolingOilQuality * FORGE_COOLING_BONUS_PER_QUALITY;
        const handleBonus = forgeState.handleQuality * FORGE_HANDLE_BONUS_PER_QUALITY;
        
        let currentQuality = baseQuality + materialHardness;
        
        // Animate hammering
        const hammeringSteps = forgeState.hammeringCount;
        let hammeringFailed = false;
        for (let i = 0; i < hammeringSteps; i++) {
            animationContent.innerHTML = `<div class="forging-anvil shake">🔨</div><div class="forging-message">Hammering... (${i + 1}/${hammeringSteps})</div>`;
            await sleep(1200);
            
            // Check if material destroyed during hammering
            if (Math.random() > FORGE_HAMMERING_SUCCESS_RATE) {
                animationContent.innerHTML = `<div class="forging-anvil">💥</div><div class="forging-message forging-failure">Material destroyed during hammering!</div>`;
                await sleep(2000);
                hammeringFailed = true;
                break;
            }
            
            // Show completion of this hammer strike with quality
            const strikeQuality = Math.round(currentQuality + (i + 1) * FORGE_HAMMERING_BONUS_PER_ITERATION);
            animationContent.innerHTML = `<div class="forging-anvil">🔨</div><div class="forging-message">Hammering complete (${i + 1}/${hammeringSteps})</div><div class="forging-quality">Current Power: ${strikeQuality}</div>`;
            await sleep(800);
        }
        
        // Check if we broke during hammering
        if (hammeringFailed) {
            continue; // Try next attempt
        }
        
        currentQuality += hammeringBonus;
        
        // Show hammering success
        animationContent.innerHTML = `<div class="forging-anvil">✅</div><div class="forging-message forging-success">Hammering successful!</div><div class="forging-quality">Current Power: ${Math.round(currentQuality)}</div>`;
        await sleep(1000);
        
        // Deduct cooling cost (only after successful hammering)
        const coolingCost = forgeState.coolingOilQuality === 1 ? 0 : FORGE_COOLING_BASE_COST * Math.pow(FORGE_COOLING_COST_MULTIPLIER, forgeState.coolingOilQuality - 2);
        if (coolingCost > 0) {
            gold -= coolingCost;
            updateGoldDisplay();
            logTransaction('expense', coolingCost, 'Cooling oil for forging');
            saveGame();
            if (gameWorker && workerInitialized) {
                gameWorker.postMessage({
                    type: 'update-state',
                    data: { gold: gold }
                });
            }
        }
        
        // Cooling step
        animationContent.innerHTML = `<div class="forging-anvil shake">💧</div><div class="forging-message">Cooling...</div>`;
        await sleep(1800);
        
        const coolingBrittleChance = Math.max(0, FORGE_COOLING_BASE_BRITTLE_CHANCE - (forgeState.coolingOilQuality - 1) * FORGE_COOLING_BRITTLE_REDUCTION_PER_QUALITY);
        if (Math.random() < coolingBrittleChance) {
            animationContent.innerHTML = `<div class="forging-anvil">💔</div><div class="forging-message forging-failure">Material became brittle during cooling!</div>`;
            await sleep(2000);
            continue; // Try next attempt
        }
        
        currentQuality += coolingBonus;
        
        // Show cooling success
        animationContent.innerHTML = `<div class="forging-anvil">❄️</div><div class="forging-message forging-success">Cooling successful!</div><div class="forging-quality">Current Power: ${Math.round(currentQuality)}</div>`;
        await sleep(1200);
        
        // Deduct handle cost before mounting
        const handleCost = FORGE_HANDLE_BASE_COST * Math.pow(FORGE_HANDLE_COST_MULTIPLIER, forgeState.handleQuality - 1);
        gold -= handleCost;
        updateGoldDisplay();
        logTransaction('expense', handleCost, 'Handle for forging');
        saveGame();
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: { gold: gold }
            });
        }
        
        // Handle mounting step
        animationContent.innerHTML = `<div class="forging-anvil shake">🪓</div><div class="forging-message">Mounting handle...</div>`;
        await sleep(1800);
        
        currentQuality += handleBonus;
        
        // Show handle mounting success
        animationContent.innerHTML = `<div class="forging-anvil">✅</div><div class="forging-message forging-success">Handle mounted!</div><div class="forging-quality">Current Power: ${Math.round(currentQuality)}</div>`;
        await sleep(1200);
        
        // Sharpening step - 3 iterations
        let sharpeningQuality = currentQuality;
        const sharpeningIterations = FORGE_SHARPENING_ITERATIONS;
        
        for (let i = 0; i < sharpeningIterations; i++) {
            animationContent.innerHTML = `<div class="forging-anvil shake">✨</div><div class="forging-message">Sharpening... (${i + 1}/${sharpeningIterations})</div>`;
            await sleep(1200);
            
            // Apply percentage-based sharpening variance: -5% to +20% of current quality
            const variancePercent = (Math.random() * (FORGE_SHARPENING_MAX_VARIANCE - FORGE_SHARPENING_MIN_VARIANCE)) + FORGE_SHARPENING_MIN_VARIANCE;
            const iterationVariance = sharpeningQuality * variancePercent;
            sharpeningQuality += iterationVariance;
            
            // Show completion of this sharpening pass
            const changePercent = (variancePercent * 100).toFixed(1);
            const changeSign = variancePercent >= 0 ? '+' : '';
            animationContent.innerHTML = `<div class="forging-anvil">✨</div><div class="forging-message">Sharpening pass ${i + 1} complete (${changeSign}${changePercent}%)</div><div class="forging-quality">Current Power: ${Math.round(sharpeningQuality)}</div>`;
            await sleep(800);
        }
        
        // Calculate final quality
        finalQuality = Math.max(1, Math.round(sharpeningQuality));
        
        // Show final sharpening completion
        animationContent.innerHTML = `<div class="forging-anvil">✨</div><div class="forging-message forging-success">Sharpening complete!</div><div class="forging-quality">Final Power: ${finalQuality}</div>`;
        await sleep(1200);
        
        success = true;
        break;
    }
    
    // Show result
    if (success) {
        // Create new tool with material name in type
        const material = materials.find(m => m.id === forgeState.baseMaterial);
        const materialName = material ? material.name.replace(' Ingot', '') : 'Unknown';
        const newToolId = Math.max(...toolsInventory.map(t => t.id), 0) + 1;
        const newTool = {
            id: newToolId,
            type: `${materialName} Pickaxe`,
            level: finalQuality,
            power: finalQuality
        };
        toolsInventory.push(newTool);
        
        // Build dwarf options with current tool info
        const dwarfOptions = dwarfs.map(d => {
            let label = d.name;
            if (d.toolId) {
                const currentTool = toolsInventory.find(t => t.id === d.toolId);
                if (currentTool) {
                    const currentPower = currentTool.power || currentTool.level || 0;
                    label += ` (⚒️ ${currentPower})`;
                }
            } else {
                label += ' (no tool)';
            }
            return `<option value="${d.name}">${label}</option>`;
        }).join('');
        
        animationContent.innerHTML = `
            <div class="forging-anvil">⚒️</div>
            <div class="forging-message forging-success">Success!</div>
            <div class="forging-result">
                <p><strong>${materialName} Pickaxe #${newToolId}</strong></p>
                <p>Power: ${finalQuality}</p>
                <p>Attempts used: ${attemptsUsed}</p>
            </div>
            <div class="forging-assign">
                <label>Name your tool:</label>
                <input type="text" id="forge-name-input" class="forge-name-input" placeholder="${materialName} Pickaxe" maxlength="30">
            </div>
            <div class="forging-assign">
                <label>Assign to dwarf:</label>
                <select id="forge-assign-select" class="assign-select-small">
                    <option value="">-- Don't assign --</option>
                    ${dwarfOptions}
                </select>
            </div>
            <button class="btn-primary" onclick="closeForging(${newToolId}, '${materialName} Pickaxe')">Done</button>
        `;
        
        logTransaction('income', 0, `Forged new tool with quality ${finalQuality}`);
    } else {
        animationContent.innerHTML = `
            <div class="forging-anvil">💀</div>
            <div class="forging-message forging-failure">All forging attempts failed!</div>
            <div class="forging-result">
                <p>Used ${attemptsUsed} materials</p>
                <p>No tool created</p>
            </div>
            <button class="btn-primary" onclick="closeForging()">Return to Forge</button>
        `;
    }
    
    // Final save and sync after forging completes
    updateStockDisplay();
    saveGame();
    
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                gold: gold,
                materialsStock: materialsStock,
                toolsInventory: toolsInventory
            }
        });
    }
}

function closeForging(newToolId, defaultName) {
    // Check if a custom name was entered
    const nameInput = document.getElementById('forge-name-input');
    if (nameInput && newToolId) {
        const customName = nameInput.value.trim();
        if (customName) {
            const tool = toolsInventory.find(t => t.id === newToolId);
            if (tool) {
                tool.name = customName;
            }
        }
    }
    
    // Check if a dwarf was selected for assignment
    const selectElement = document.getElementById('forge-assign-select');
    if (selectElement && selectElement.value && newToolId) {
        const dwarfName = selectElement.value;
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            dwarf.toolId = newToolId;
            logTransaction('income', 0, `Assigned tool #${newToolId} to ${dwarfName}`);
            
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
        }
    }
    
    closeModal('forging-animation-modal');
    updateStockDisplay(); // Update stock display
    openModal('forge-modal');
    populateForge(); // Refresh forge UI with updated stock
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Enchanting functions
function openEnchantModal(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        console.error('Tool not found:', toolId);
        return;
    }

    const enchantResearch = researchtree.find(r => r.id === 'tool-enchanting');
    const maxEnchantLevel = enchantResearch ? enchantResearch.level : 0;

    if (maxEnchantLevel === 0) {
        alert('You need to research Tool Enchanting first!');
        return;
    }

    openModal('enchant-modal');
    populateEnchantModal(tool, maxEnchantLevel);
}

function populateEnchantModal(tool, maxEnchantLevel) {
    const container = document.getElementById('enchant-content');
    if (!container) return;

    const toolName = tool.name || `${tool.type} #${tool.id}`;
    const toolPower = tool.power || tool.level || 0;

    container.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0;">🔨 ${toolName}</h3>
            <p style="margin: 0; color: #9fbfe0; font-size: 13px;">Current Power: ${toolPower}</p>
        </div>

        <div style="margin-bottom: 16px; padding: 12px; background: rgba(138, 43, 226, 0.1); border: 1px solid rgba(138, 43, 226, 0.3); border-radius: 6px;">
            <label for="enchant-level-slider" style="display: block; margin-bottom: 8px; font-weight: 600;">Enchantment Level:</label>
            <input type="range" id="enchant-level-slider" min="1" max="${maxEnchantLevel}" value="1"
                   style="width: 100%; margin-bottom: 8px;"
                   oninput="updateEnchantPreview()">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #9fbfe0;">
                <span>Level 1</span>
                <span id="enchant-level-display" style="font-weight: bold; color: #dda0ff;">Level 1</span>
                <span>Level ${maxEnchantLevel}</span>
            </div>
        </div>

        <div id="enchant-preview" style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <!-- Preview will be populated by updateEnchantPreview() -->
        </div>

        <button id="confirm-enchant-btn" class="btn-primary" style="width: 100%; padding: 10px; font-size: 14px; font-weight: bold;"
                onclick="confirmEnchant(${tool.id})">
            ✨ Enchant Tool
        </button>
    `;

    updateEnchantPreview();
}

function updateEnchantPreview() {
    const slider = document.getElementById('enchant-level-slider');
    const display = document.getElementById('enchant-level-display');
    const preview = document.getElementById('enchant-preview');

    if (!slider || !display || !preview) return;

    const enchantLevel = parseInt(slider.value);
    display.textContent = `Level ${enchantLevel}`;

    // Calculate cost using the formula: baseCost * (multiplier ^ (level - 1))
    const cost = Math.round(ENCHANT_BASE_COST * Math.pow(ENCHANT_COST_MULTIPLIER, enchantLevel - 1));
    const canAfford = gold >= cost;

    preview.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #e6eefc;">Enchantment Power:</span>
            <span style="color: #dda0ff; font-weight: bold;">+${enchantLevel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #e6eefc;">Gold Cost:</span>
            <span style="color: ${canAfford ? '#ffd700' : '#ff6b6b'}; font-weight: bold;">${cost} 💰</span>
        </div>
        ${!canAfford ? '<p style="color: #ff6b6b; margin: 8px 0 0 0; font-size: 12px;">⚠️ Not enough gold!</p>' : ''}
    `;

    // Update button state
    const btn = document.getElementById('confirm-enchant-btn');
    if (btn) {
        btn.disabled = !canAfford;
        btn.style.opacity = canAfford ? '1' : '0.5';
        btn.style.cursor = canAfford ? 'pointer' : 'not-allowed';
    }
}

function confirmEnchant(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        alert('Tool not found!');
        return;
    }

    const slider = document.getElementById('enchant-level-slider');
    if (!slider) return;

    const enchantLevel = parseInt(slider.value);
    const cost = Math.round(ENCHANT_BASE_COST * Math.pow(ENCHANT_COST_MULTIPLIER, enchantLevel - 1));

    if (gold < cost) {
        alert(`Not enough gold! Need ${formatNumber(cost, 'gold')}, have ${formatNumber(gold, 'gold')}.`);
        return;
    }

    // Deduct gold
    gold -= cost;
    logTransaction('expense', cost, `Enchanted ${tool.name || tool.type} to level ${enchantLevel}`);
    updateGoldDisplay();

    // Apply enchantment
    tool.enchantLevel = enchantLevel;

    // Sync to worker (include gold to ensure it's synced)
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gold }
        });
    }

    // Save game
    saveGame();

    // Close modal and refresh UI
    closeModal('enchant-modal');
    populateToolsInPanel(); // Refresh tools panel to show enchantment

    // Show success message
    alert(`✨ Tool enchanted to level ${enchantLevel}!\n\nThe tool now has +${enchantLevel} enchantment power.`);
}

// Gem Setting Modal Functions
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

            // Find an available gem of this type/carat that hasn't been used yet
            const availableGem = gems.find(g =>
                g.polished &&
                !g.assignedToTool &&
                g.type === type &&
                g.carat === caratNum &&
                !usedGemKeys.has(g.id)
            );

            if (availableGem) {
                availableGem.assignedToTool = true;
                gemsToKeep.add(availableGem.id);
                usedGemKeys.add(availableGem.id);
                usedTypes.add(type);
                newGems.push({
                    id: availableGem.id,
                    type: availableGem.type,
                    carat: availableGem.carat
                });
            }
        }
    }

    // Clear assignedToTool flag ONLY for gems that were previously assigned but are no longer kept
    if (tool.gems) {
        tool.gems.forEach(gemData => {
            if (!gemsToKeep.has(gemData.id)) {
                const gem = gems.find(g => g.id === gemData.id);
                if (gem) {
                    gem.assignedToTool = false;
                }
            }
        });
    }

    // Update tool with new gems
    tool.gems = newGems;

    // Sync to worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gems }
        });
    }

    // Save game
    saveGame();

    // Close modal and refresh UI
    closeModal('gem-modal');
    populateToolsInPanel(); // Refresh tools panel to show gems

    // Show success message
    if (newGems.length > 0) {
        alert(`💎 Successfully set ${newGems.length} gem${newGems.length > 1 ? 's' : ''} into the tool!`);
    } else {
        alert('💎 All gems removed from the tool.');
    }
}

function unsetGem(toolId, slotIndex) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool || !tool.gems || !tool.gems[slotIndex]) return;

    const gemToRemove = tool.gems[slotIndex];
    const gemName = `${gemToRemove.carat} carat ${gemToRemove.type}`;

    // Confirmation dialog with warning
    const confirmed = confirm(
        `⚠️ WARNING: This will permanently destroy the gem!\n\n` +
        `Are you sure you want to unset and destroy:\n${gemName}?\n\n` +
        `This action CANNOT be undone!`
    );

    if (!confirmed) return;

    // Find and remove the gem from the gems array
    const gemIndex = gems.findIndex(g => g.id === gemToRemove.id);
    if (gemIndex !== -1) {
        gems.splice(gemIndex, 1);
    }

    // Remove gem from tool
    tool.gems.splice(slotIndex, 1);

    // Sync to worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gems }
        });
    }

    // Save game
    saveGame();

    // Refresh the modal and tools panel
    const gemSettingResearch = researchtree.find(r => r.id === 'gem-setting');
    const maxGemSlots = gemSettingResearch ? gemSettingResearch.level : 0;
    populateGemModal(tool, maxGemSlots);
    populateToolsInPanel();

    // Show confirmation
    alert(`💎 Gem destroyed: ${gemName}`);
}

function openResearch() {
    openModal('research-modal');
    populateResearch();
    // Add event listener to refresh research modal when checkbox is toggled
    const hideCheckbox = document.getElementById('hide-endless-research');
    if (hideCheckbox && !hideCheckbox._diggyListenerAttached) {
        hideCheckbox.addEventListener('change', populateResearch);
        hideCheckbox._diggyListenerAttached = true;
    }
}

function openGemsModal() {
    openModal('gems-modal');
    populateGemsList();
}

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

        // Group gems by status (assigned/polished/rough) and carat
        const gemGroups = {};
        gemsOfType.forEach(gem => {
            const status = gem.assignedToTool ? 'assigned' : (gem.polished ? 'polished' : 'rough');
            const key = `${status}_${gem.carat}`;
            if (!gemGroups[key]) {
                gemGroups[key] = {
                    assigned: gem.assignedToTool || false,
                    polished: gem.polished,
                    carat: gem.carat,
                    count: 0,
                    totalValue: 0,
                    markedForCutting: false,
                    cuttingProgress: 0,
                    maxProgress: 0
                };
            }
            gemGroups[key].count++;
            const valueMultiplier = gem.polished ? GEM_CUTTING_VALUE_MULTIPLIER : 1;
            gemGroups[key].totalValue += gemBaseValue * gem.carat * valueMultiplier;

            // Track cutting status - if any gem in the group is marked for cutting
            if (gem.markedForCutting) {
                gemGroups[key].markedForCutting = true;
                // Get the ticksRequired from the gem cutting task definition
                const gemCuttingTask = smelterTasks.find(t => t.type === 'gem-cutting');
                gemGroups[key].maxProgress = gemCuttingTask ? gemCuttingTask.ticksRequired : 250;
                // Track the highest cutting progress in this group
                const currentProgress = gem.cuttingProgress || 0;
                if (currentProgress > gemGroups[key].cuttingProgress) {
                    gemGroups[key].cuttingProgress = currentProgress;
                }
            }
        });

        // Sort groups: assigned first, then polished, then rough; within each status sort by carat descending
        const sortedGroups = Object.values(gemGroups).sort((a, b) => {
            if (a.assigned !== b.assigned) return a.assigned ? -1 : 1; // Assigned first
            if (a.polished !== b.polished) return a.polished ? -1 : 1; // Then polished
            return b.carat - a.carat; // Then by carat descending
        });

        // Create gem items for each group
        sortedGroups.forEach(group => {
            // Check if gem cutting is researched
            const gemCuttingResearch = researchtree.find(r => r.id === 'gem-cutting');
            const hasGemCutting = gemCuttingResearch && gemCuttingResearch.level > 0;

            // Build status badge with cut button or progress
            let statusSection = '';
            if (group.assigned) {
                statusSection = '<span class="gem-assigned-badge">💎 Assigned</span>';
            } else if (group.polished) {
                statusSection = '<span class="gem-polished-badge">✨ Polished</span>';
            } else if (group.markedForCutting) {
                // Show cutting progress
                const progressPercent = (group.maxProgress > 0)
                    ? Math.round((group.cuttingProgress / group.maxProgress) * 100)
                    : 0;
                statusSection = `
                    <span class="gem-unpolished-badge">Rough</span>
                    <span class="gem-cutting-progress">Cutting: ${progressPercent}%</span>
                `;
            } else if (hasGemCutting) {
                // Show rough badge with cut button
                statusSection = `
                    <span class="gem-unpolished-badge">Rough</span>
                    <button class="gem-cut-btn" data-type="${type}" data-carat="${group.carat}" title="Mark all ${group.carat}ct rough gems for cutting and polishing">Cut</button>
                `;
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
                    <span class="gem-item-count">×${group.count}</span>
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

function openSmelter() {
    openModal('smelter-modal');
    populateSmelter();
}

function openTransactions() {
    openModal('transactions-modal');

    // Default to summary tab
    if (!window.currentFinancesTab) {
        window.currentFinancesTab = 'summary';
    }

    switchFinancesTab(window.currentFinancesTab);
    
    // Set up auto-refresh
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
    }, AUTO_REFRESH_INTERVAL);
}

function switchFinancesTab(tab) {
    window.currentFinancesTab = tab;
    
    // Update tab button styles
    const summaryTab = document.getElementById('finances-tab-summary');
    const recentTab = document.getElementById('finances-tab-recent');
    
    if (tab === 'summary') {
        summaryTab.className = 'finances-tab active';
        summaryTab.style.cssText = 'flex: 1; padding: 10px; background: #4a5f7a; border: none; color: #fff; cursor: pointer; border-bottom: 3px solid #ffd700; font-weight: bold;';
        recentTab.className = 'finances-tab';
        recentTab.style.cssText = 'flex: 1; padding: 10px; background: #2a3f5a; border: none; color: #9fbfe0; cursor: pointer; border-bottom: 3px solid transparent;';
    } else {
        recentTab.className = 'finances-tab active';
        recentTab.style.cssText = 'flex: 1; padding: 10px; background: #4a5f7a; border: none; color: #fff; cursor: pointer; border-bottom: 3px solid #ffd700; font-weight: bold;';
        summaryTab.className = 'finances-tab';
        summaryTab.style.cssText = 'flex: 1; padding: 10px; background: #2a3f5a; border: none; color: #9fbfe0; cursor: pointer; border-bottom: 3px solid transparent;';
    }
    
    // Populate content based on selected tab
    populateTransactions();
}

function logTransaction(type, amount, description) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-GB', { hour12: false });
    
    transactionLog.unshift({
        type: type, // 'income' or 'expense'
        amount: amount,
        description: description,
        timestamp: timestamp,
        timestampMs: now.getTime(),
        balance: gold
    });
    
    // Initialize current hour if not set
    if (currentHourTimestamp === null) {
        currentHourTimestamp = getHourTimestamp(now);
    }
    
    // Check if we need to roll up to a new hour
    const currentHour = getHourTimestamp(now);
    if (currentHour !== currentHourTimestamp) {
        processHourlyRollup();
        currentHourTimestamp = currentHour;
    }
}

// Get timestamp for the start of the hour
function getHourTimestamp(date) {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d.getTime();
}

// Process hourly rollup: aggregate transactions and clean up old detailed log
function processHourlyRollup() {
    if (transactionLog.length === 0) return;
    
    // Group transactions by description for the completed hour
    const hourlyData = {};
    
    for (const transaction of transactionLog) {
        const desc = transaction.description;
        
        if (!hourlyData[desc]) {
            hourlyData[desc] = { income: 0, expense: 0, count: 0 };
        }
        
        if (transaction.type === 'income') {
            hourlyData[desc].income += transaction.amount;
        } else {
            hourlyData[desc].expense += transaction.amount;
        }
        hourlyData[desc].count++;
    }
    
    // Add the hourly summary to history
    transactionHistory.push({
        hour: currentHourTimestamp,
        transactions: hourlyData
    });
    
    // Clear the detailed transaction log for the completed hour
    transactionLog = [];
}

function populateTransactions() {
    const container = document.getElementById('transactions-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    const tab = window.currentFinancesTab || 'summary';
    
    if (tab === 'summary') {
        populateSummaryTab(container);
    } else {
        populateRecentTab(container);
    }
}

function populateSummaryTab(container) {
    // Check if we're viewing hour details
    if (window.viewingHourDetails) {
        populateHourDetails(container, window.viewingHourDetails);
        return;
    }
    
    // Calculate current hour totals (if any transactions exist)
    let currentHourIncome = 0;
    let currentHourExpense = 0;
    let currentHourCount = 0;
    
    for (const transaction of transactionLog) {
        if (transaction.type === 'income') {
            currentHourIncome += transaction.amount;
        } else {
            currentHourExpense += transaction.amount;
        }
        currentHourCount++;
    }
    
    const hasCurrentHour = currentHourCount > 0;
    const hasHistory = transactionHistory.length > 0;
    
    if (!hasCurrentHour && !hasHistory) {
        container.innerHTML = '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No financial data yet.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; padding-right: 10px;';
    
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Hour</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Income</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Expense</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Net</th><th style="text-align: center; padding: 8px; border-bottom: 2px solid #5b6d7a;">Actions</th></tr>';
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // Add current hour first (if exists)
    if (hasCurrentHour) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';
        tr.style.background = '#2d3f52';
        
        const hourTd = document.createElement('td');
        hourTd.style.padding = '8px';
        hourTd.style.fontWeight = 'bold';
        hourTd.textContent = 'Current Hour';
        
        const incomeTd = document.createElement('td');
        incomeTd.style.cssText = 'padding: 8px; text-align: right; color: #4ade80; font-weight: bold;';
        incomeTd.textContent = '+' + formatNumber(currentHourIncome, 'gold');

        const expenseTd = document.createElement('td');
        expenseTd.style.cssText = 'padding: 8px; text-align: right; color: #ff6b6b; font-weight: bold;';
        expenseTd.textContent = '-' + formatNumber(currentHourExpense, 'gold');

        const netTd = document.createElement('td');
        const net = currentHourIncome - currentHourExpense;
        netTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';
        netTd.style.color = net >= 0 ? '#4ade80' : '#ff6b6b';
        netTd.textContent = (net >= 0 ? '+' : '') + formatNumber(net, 'gold');
        
        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'padding: 8px; text-align: center;';
        const detailsBtn = document.createElement('button');
        detailsBtn.textContent = 'Details';
        detailsBtn.className = 'btn-secondary';
        detailsBtn.style.cssText = 'padding: 4px 12px; font-size: 12px;';
        detailsBtn.onclick = () => showHourDetails('current');
        actionTd.appendChild(detailsBtn);
        
        tr.appendChild(hourTd);
        tr.appendChild(incomeTd);
        tr.appendChild(expenseTd);
        tr.appendChild(netTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }
    
    // Add historical hours (most recent first)
    const sortedHistory = [...transactionHistory].reverse();
    
    for (const hourData of sortedHistory) {
        const hourDate = new Date(hourData.hour);
        const hourStr = hourDate.toLocaleString('en-GB', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        // Calculate totals for this hour
        let hourIncome = 0;
        let hourExpense = 0;
        
        for (const desc in hourData.transactions) {
            hourIncome += hourData.transactions[desc].income;
            hourExpense += hourData.transactions[desc].expense;
        }
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';
        
        const hourTd = document.createElement('td');
        hourTd.style.padding = '8px';
        hourTd.textContent = hourStr;
        
        const incomeTd = document.createElement('td');
        incomeTd.style.cssText = 'padding: 8px; text-align: right; color: #4ade80;';
        incomeTd.textContent = '+' + formatNumber(hourIncome, 'gold');

        const expenseTd = document.createElement('td');
        expenseTd.style.cssText = 'padding: 8px; text-align: right; color: #ff6b6b;';
        expenseTd.textContent = '-' + formatNumber(hourExpense, 'gold');

        const netTd = document.createElement('td');
        const net = hourIncome - hourExpense;
        netTd.style.cssText = 'padding: 8px; text-align: right;';
        netTd.style.color = net >= 0 ? '#4ade80' : '#ff6b6b';
        netTd.textContent = (net >= 0 ? '+' : '') + formatNumber(net, 'gold');
        
        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'padding: 8px; text-align: center;';
        const detailsBtn = document.createElement('button');
        detailsBtn.textContent = 'Details';
        detailsBtn.className = 'btn-secondary';
        detailsBtn.style.cssText = 'padding: 4px 12px; font-size: 12px;';
        detailsBtn.onclick = () => showHourDetails(hourData.hour);
        actionTd.appendChild(detailsBtn);
        
        tr.appendChild(hourTd);
        tr.appendChild(incomeTd);
        tr.appendChild(expenseTd);
        tr.appendChild(netTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
}

function showHourDetails(hourIdentifier) {
    window.viewingHourDetails = hourIdentifier;
    populateTransactions();
}

function populateHourDetails(container, hourIdentifier) {
    // Back button - fixed position, doesn't scroll
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Summary';
    backBtn.className = 'btn-secondary';
    backBtn.style.cssText = 'margin-bottom: 15px; position: sticky; top: 0; z-index: 10; background: #2a3f5a;';
    backBtn.onclick = () => {
        window.viewingHourDetails = null;
        populateTransactions();
    };
    container.appendChild(backBtn);
    
    // Header
    const header = document.createElement('h3');
    header.style.cssText = 'color: #ffd700; margin-bottom: 10px; font-size: 16px;';
    
    let transactionData = {};
    
    if (hourIdentifier === 'current') {
        header.textContent = 'Current Hour - Transaction Details';
        
        // Aggregate current transactions by description
        for (const transaction of transactionLog) {
            const desc = transaction.description;
            if (!transactionData[desc]) {
                transactionData[desc] = { income: 0, expense: 0, count: 0 };
            }
            if (transaction.type === 'income') {
                transactionData[desc].income += transaction.amount;
            } else {
                transactionData[desc].expense += transaction.amount;
            }
            transactionData[desc].count++;
        }
    } else {
        // Find the historical hour
        const hourData = transactionHistory.find(h => h.hour === hourIdentifier);
        if (hourData) {
            const hourDate = new Date(hourData.hour);
            const hourStr = hourDate.toLocaleString('en-GB', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            header.textContent = `${hourStr} - Transaction Details`;
            transactionData = hourData.transactions;
        }
    }
    
    container.appendChild(header);
    
    if (Object.keys(transactionData).length === 0) {
        container.innerHTML += '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No transactions for this hour.</p>';
        return;
    }
    
    // Create details table
    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; padding-right: 10px;';
    
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Description</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Amount</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Count</th></tr>';
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // Sort by absolute value descending
    const descriptions = Object.keys(transactionData).sort((a, b) => {
        const amountA = Math.max(transactionData[a].income, transactionData[a].expense);
        const amountB = Math.max(transactionData[b].income, transactionData[b].expense);
        return amountB - amountA;
    });
    
    for (const desc of descriptions) {
        const data = transactionData[desc];
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';
        
        const descTd = document.createElement('td');
        descTd.style.padding = '8px';
        descTd.textContent = desc;
        
        const amountTd = document.createElement('td');
        amountTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';
        
        if (data.income > 0) {
            amountTd.style.color = '#4ade80';
            amountTd.textContent = '+' + formatNumber(data.income, 'gold');
        } else if (data.expense > 0) {
            amountTd.style.color = '#ff6b6b';
            amountTd.textContent = '-' + formatNumber(data.expense, 'gold');
        } else {
            amountTd.textContent = '-';
        }
        
        const countTd = document.createElement('td');
        countTd.style.cssText = 'padding: 8px; text-align: right;';
        countTd.textContent = data.count;
        
        tr.appendChild(descTd);
        tr.appendChild(amountTd);
        tr.appendChild(countTd);
        tbody.appendChild(tr);
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
}

function populateRecentTab(container) {
    if (transactionLog.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No recent transactions.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; padding-right: 10px;';
    
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
        amountTd.textContent = (transaction.type === 'income' ? '+' : '-') + formatNumber(transaction.amount, 'gold');

        const balanceTd = document.createElement('td');
        balanceTd.style.cssText = 'padding: 8px; text-align: right;';
        balanceTd.textContent = formatNumber(transaction.balance, 'gold');
        
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
    
    container.innerHTML = '';
    
    // Header description
    const headerDesc = document.createElement('p');
    headerDesc.className = 'smelter-description';
    headerDesc.textContent = 'Set the priority of smelter tasks. The smelter will work on tasks from top to bottom.';
    container.appendChild(headerDesc);
    
    // Task list container
    const taskList = document.createElement('div');
    taskList.className = 'smelter-task-list';
    taskList.id = 'smelter-task-list';
    
    // Find if there's a "do-nothing" task and track if we're below it
    const doNothingIndex = smelterTasks.findIndex(t => t.id === 'do-nothing');
    
    // Render each task
    smelterTasks.forEach((task, index) => {
        const taskRow = document.createElement('div');
        taskRow.className = 'smelter-task-row';
        taskRow.dataset.taskId = task.id;
        
        // Check if this task is unreachable (below "do-nothing")
        const isUnreachable = doNothingIndex >= 0 && index > doNothingIndex && task.id !== 'do-nothing';
        
        // Check if this task requires research
        let isUnlocked = true;
        let requiredResearchName = null;
        if (task.requires) {
            const requiredResearch = researchtree.find(r => r.id === task.requires);
            if (requiredResearch) {
                isUnlocked = (requiredResearch.level || 0) >= 1;
                requiredResearchName = requiredResearch.name;
            }
        }
        
        // Check if this task is actionable (has enough materials)
        let isActionable = false;
        let stockAmount = 0;
        if (task.id === 'do-nothing') {
            isActionable = true; // "Do nothing" is always "actionable"
        } else if (task.type === 'gem-cutting' && isUnlocked) {
            // For gem cutting tasks, check if there are any gems marked for cutting
            const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
            isActionable = !!gemToProcess;
        } else if (isUnlocked && task.input && task.input.material && task.input.amount) {
            stockAmount = materialsStock[task.input.material] || 0;
            // For heating tasks, only actionable if temp is below min and below max
            if (task.type === 'heating') {
                // Heating is actionable if enough materials and temperature is below max (hysteresis)
                isActionable = (stockAmount >= task.input.amount) && (smelterTemperature < smelterMaxTemp);
            } else if (task.minTemp) {
                // For smelting tasks with temp requirements, check both materials and temperature
                isActionable = (stockAmount >= task.input.amount) && (smelterTemperature >= task.minTemp);
            } else {
                isActionable = stockAmount >= task.input.amount;
            }
        }
        
        // Add actionable/blocked/locked class
        if (task.id !== 'do-nothing') {
            if (isUnreachable) {
                taskRow.classList.add('smelter-task-unreachable');
            } else if (!isUnlocked) {
                taskRow.classList.add('smelter-task-locked');
            } else {
                taskRow.classList.add(isActionable ? 'smelter-task-actionable' : 'smelter-task-blocked');
            }
        }
        
        // Priority number
        const priorityNum = document.createElement('span');
        priorityNum.className = 'smelter-task-priority';
        priorityNum.textContent = `${index + 1}.`;
        taskRow.appendChild(priorityNum);
        
        // Status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'smelter-task-status';
        if (task.id === 'do-nothing') {
            statusIndicator.textContent = '⏸️';
            statusIndicator.title = 'Idle task';
        } else if (isUnreachable) {
            statusIndicator.textContent = '🚫';
            statusIndicator.title = 'Unreachable - will never execute (below "Do Nothing")';
        } else if (!isUnlocked) {
            statusIndicator.textContent = '🔒';
            statusIndicator.title = `Locked - requires ${requiredResearchName}`;
        } else if (isActionable) {
            statusIndicator.textContent = '✅';
            statusIndicator.title = 'Ready - materials available';
        } else {
            // Determine why task is blocked
            if (task.minTemp && smelterTemperature < task.minTemp) {
                statusIndicator.textContent = '🌡️';
                statusIndicator.title = `Temperature too low - need ${task.minTemp}°, current ${Math.round(smelterTemperature)}°`;
            } else if (task.type === 'gem-cutting') {
                statusIndicator.textContent = '❌';
                statusIndicator.title = `Blocked - no gems marked for cutting`;
            } else if (task.input && task.input.amount) {
                statusIndicator.textContent = '❌';
                statusIndicator.title = `Blocked - need ${task.input.amount}x, have ${formatNumber(stockAmount, 'material')}x`;
            } else {
                statusIndicator.textContent = '❌';
                statusIndicator.title = `Blocked`;
            }
        }
        taskRow.appendChild(statusIndicator);
        
        // Task info
        const taskInfo = document.createElement('div');
        taskInfo.className = 'smelter-task-info';
        
        const taskName = document.createElement('span');
        taskName.className = 'smelter-task-name';
        taskName.textContent = task.name;
        taskInfo.appendChild(taskName);
        
        const taskDesc = document.createElement('span');
        taskDesc.className = 'smelter-task-desc';
        taskDesc.textContent = task.description;
        taskInfo.appendChild(taskDesc);
        
        // Show input/output if applicable (compact, no stock info)
        if (task.input && task.output) {
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputMat = getMaterialById(task.input.material);
            const outputMat = getMaterialById(task.output.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const outputName = outputMat ? outputMat.name : task.output.material;
            const tempReq = task.minTemp ? ` @ ${task.minTemp}°` : '';
            taskRecipe.textContent = `${task.input.amount}x ${inputName} → ${task.output.amount}x ${outputName}${tempReq}`;
            if (!isUnlocked) {
                taskRecipe.classList.add('recipe-locked');
            } else {
                taskRecipe.classList.add(isActionable ? 'recipe-ready' : 'recipe-blocked');
            }
            taskInfo.appendChild(taskRecipe);
        } else if (task.input && task.type === 'heating') {
            // Show heating task info with temperature display (compact, no stock info)
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputMat = getMaterialById(task.input.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            taskRecipe.textContent = `${task.input.amount}x ${inputName} → +${task.heatGain}° Heat`;
            if (!isUnlocked) {
                taskRecipe.classList.add('recipe-locked');
            } else {
                taskRecipe.classList.add(isActionable ? 'recipe-ready' : 'recipe-blocked');
            }
            taskInfo.appendChild(taskRecipe);
            // Add temperature display and controls inside the heating task
            const tempControls = document.createElement('div');
            tempControls.style.cssText = 'margin-top: 10px; padding: 10px; background: #1a2a3a; border-radius: 3px; border: 1px solid #3a4a5a;';
            // Current temperature with bar
            const tempValue = Math.round(smelterTemperature);
            const tempColor = tempValue > 1000 ? '#ff4444' : tempValue > 500 ? '#ff8800' : tempValue > 100 ? '#ffbb00' : '#88ccff';
            const tempDisplay = document.createElement('div');
            tempDisplay.style.cssText = 'margin-bottom: 8px; font-size: 14px;';
            tempDisplay.innerHTML = `<strong>Current:</strong> <span style="color: ${tempColor}">${tempValue}°</span>`;
            tempControls.appendChild(tempDisplay);
            // Temperature bar
            const tempBarContainer = document.createElement('div');
            tempBarContainer.style.cssText = 'width: 100%; height: 12px; background: #0a1a2a; border: 1px solid #3a4a5a; border-radius: 2px; overflow: hidden; margin-bottom: 10px;';
            const tempBar = document.createElement('div');
            const tempPercent = Math.min(100, (smelterTemperature / 1500) * 100);
            tempBar.style.cssText = `width: ${tempPercent}%; height: 100%; background: linear-gradient(to right, #4488ff, #ff8800, #ff4444); transition: width 0.3s;`;
            tempBarContainer.appendChild(tempBar);
            tempControls.appendChild(tempBarContainer);
            // Temperature range controls
            const rangeControls = document.createElement('div');
            rangeControls.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;';
            // Min temperature control
            const minControl = document.createElement('div');
            minControl.innerHTML = `
                <label style="display: block; margin-bottom: 3px; color: #9fbfe0; font-size: 11px;">Min: ${smelterMinTemp}°</label>
                <div style="display: flex; gap: 3px;">
                    <button class="temp-btn" onclick="adjustMinTemp(-25)" style="flex: 1; padding: 3px; font-size: 11px; background: #2a3a4a; border: 1px solid #3a4a5a; color: #fff; cursor: pointer; border-radius: 2px;">-25°</button>
                    <button class="temp-btn" onclick="adjustMinTemp(25)" style="flex: 1; padding: 3px; font-size: 11px; background: #2a3a4a; border: 1px solid #3a4a5a; color: #fff; cursor: pointer; border-radius: 2px;">+25°</button>
                </div>
            `;
            rangeControls.appendChild(minControl);
            // Max temperature control
            const maxControl = document.createElement('div');
            maxControl.innerHTML = `
                <label style="display: block; margin-bottom: 3px; color: #9fbfe0; font-size: 11px;">Max: ${smelterMaxTemp}°</label>
                <div style="display: flex; gap: 3px;">
                    <button class="temp-btn" onclick="adjustMaxTemp(-25)" style="flex: 1; padding: 3px; font-size: 11px; background: #2a3a4a; border: 1px solid #3a4a5a; color: #fff; cursor: pointer; border-radius: 2px;">-25°</button>
                    <button class="temp-btn" onclick="adjustMaxTemp(25)" style="flex: 1; padding: 3px; font-size: 11px; background: #2a3a4a; border: 1px solid #3a4a5a; color: #fff; cursor: pointer; border-radius: 2px;">+25°</button>
                </div>
            `;
            rangeControls.appendChild(maxControl);
            tempControls.appendChild(rangeControls);
            taskInfo.appendChild(tempControls);
        }
        
        taskRow.appendChild(taskInfo);
        
        // Move buttons container
        const btnContainer = document.createElement('div');
        btnContainer.className = 'smelter-task-buttons';
        
        // Move up button
        const upBtn = document.createElement('button');
        upBtn.className = 'smelter-btn-move';
        upBtn.innerHTML = '⬆';
        upBtn.title = 'Move up (higher priority)';
        upBtn.disabled = index === 0;
        upBtn.onclick = () => moveSmelterTask(index, -1);
        btnContainer.appendChild(upBtn);
        
        // Move to top button
        const topBtn = document.createElement('button');
        topBtn.className = 'smelter-btn-move';
        topBtn.innerHTML = '⤊';
        topBtn.title = 'Move to top (highest priority)';
        topBtn.disabled = index === 0;
        topBtn.onclick = () => moveSmelterTaskToTop(index);
        btnContainer.appendChild(topBtn);
        
        // Move down button
        const downBtn = document.createElement('button');
        downBtn.className = 'smelter-btn-move';
        downBtn.innerHTML = '⬇';
        downBtn.title = 'Move down (lower priority)';
        downBtn.disabled = index === smelterTasks.length - 1;
        downBtn.onclick = () => moveSmelterTask(index, 1);
        btnContainer.appendChild(downBtn);
        
        // Deactivate button (move to end)
        const deactivateBtn = document.createElement('button');
        deactivateBtn.className = 'smelter-btn-move';
        deactivateBtn.innerHTML = '⤋';
        deactivateBtn.title = 'Deactivate (move to bottom)';
        deactivateBtn.disabled = index === smelterTasks.length - 1;
        deactivateBtn.onclick = () => moveSmelterTaskToBottom(index);
        btnContainer.appendChild(deactivateBtn);
        
        taskRow.appendChild(btnContainer);
        taskList.appendChild(taskRow);
    });
    
    container.appendChild(taskList);
}

// Efficiently update just the temperature display in smelter (not full rebuild)
function updateSmelterTemperatureDisplay() {
    // Find the heating task row
    const taskList = document.getElementById('smelter-task-list');
    if (!taskList) return;
    
    const heatingTaskRow = taskList.querySelector('[data-task-id="heat-furnace"]');
    if (!heatingTaskRow) return;
    
    // Update temperature display within the heating task
    const tempValue = Math.round(smelterTemperature);
    const tempColor = tempValue > 1000 ? '#ff4444' : tempValue > 500 ? '#ff8800' : tempValue > 100 ? '#ffbb00' : '#88ccff';
    
    // Update current temperature text
    const tempDisplays = heatingTaskRow.querySelectorAll('div[style*="margin-bottom: 8px"]');
    if (tempDisplays.length > 0) {
        tempDisplays[0].innerHTML = `<strong>Current:</strong> <span style="color: ${tempColor}">${tempValue}°</span>`;
    }
    
    // Update temperature bar
    const tempBars = heatingTaskRow.querySelectorAll('div[style*="background: linear-gradient"]');
    if (tempBars.length > 0) {
        const tempPercent = Math.min(100, (smelterTemperature / 1500) * 100);
        tempBars[0].style.width = `${tempPercent}%`;
    }
    
    // Update task actionability based on temperature
    const task = smelterTasks.find(t => t.id === 'heat-furnace');
    if (task) {
        const stockAmount = materialsStock[task.input.material] || 0;
        const isUnlocked = !task.requires || (researchtree.find(r => r.id === task.requires)?.level || 0) >= 1;
        const isActionable = isUnlocked && (stockAmount >= task.input.amount) && (smelterTemperature < smelterMinTemp) && (smelterTemperature < smelterMaxTemp);
        
        // Update row class
        heatingTaskRow.classList.remove('smelter-task-actionable', 'smelter-task-blocked');
        heatingTaskRow.classList.add(isActionable ? 'smelter-task-actionable' : 'smelter-task-blocked');
        
        // Update status indicator
        const statusIndicator = heatingTaskRow.querySelector('.smelter-task-status');
        if (statusIndicator && isUnlocked) {
            if (isActionable) {
                statusIndicator.textContent = '✅';
                statusIndicator.title = 'Ready - materials available and temperature below minimum';
            } else {
                statusIndicator.textContent = '❌';
                statusIndicator.title = `Blocked - need ${task.input.amount}x, have ${formatNumber(stockAmount, 'material')}x`;
            }
        }
        
        // Update recipe stock info
        const recipeSpan = heatingTaskRow.querySelector('.smelter-task-recipe');
        if (recipeSpan) {
            const inputMat = getMaterialById(task.input.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const stockInfo = `(${formatNumber(stockAmount, 'material')}/${task.input.amount})`;
            recipeSpan.textContent = `${task.input.amount}x ${inputName} ${stockInfo} → +${task.heatGain}° Heat`;
        }
    }
}

// Move a smelter task to the top of the priority list
function moveSmelterTaskToTop(index) {
    // Already at top
    if (index === 0) return;
    
    // Remove task from current position and insert at top
    const task = smelterTasks.splice(index, 1)[0];
    smelterTasks.unshift(task);
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterTasks: smelterTasks
            }
        });
    }
    
    // Save the new order
    saveGame();
    
    // Re-render the list
    populateSmelter();
}

// Move a smelter task to the bottom of the priority list (deactivate)
function moveSmelterTaskToBottom(index) {
    // Already at bottom
    if (index === smelterTasks.length - 1) return;
    
    // Remove task from current position and append at end
    const task = smelterTasks.splice(index, 1)[0];
    smelterTasks.push(task);
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterTasks: smelterTasks
            }
        });
    }
    
    // Save the new order
    saveGame();
    
    // Re-render the list
    populateSmelter();
}

// Move a smelter task up or down in the priority list
function moveSmelterTask(index, direction) {
    const newIndex = index + direction;
    
    // Bounds check
    if (newIndex < 0 || newIndex >= smelterTasks.length) return;
    
    // Swap tasks
    const temp = smelterTasks[index];
    smelterTasks[index] = smelterTasks[newIndex];
    smelterTasks[newIndex] = temp;
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterTasks: smelterTasks
            }
        });
    }
    
    // Save the new order
    saveGame();
    
    // Re-render the list
    populateSmelter();
}

// Adjust minimum temperature setting
window.adjustMinTemp = function(amount) {
    smelterMinTemp = Math.max(25, Math.min(1500, smelterMinTemp + amount));
    // Ensure min doesn't exceed max
    if (smelterMinTemp > smelterMaxTemp) {
        smelterMinTemp = smelterMaxTemp;
    }
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterMinTemp: smelterMinTemp
            }
        });
    }
    
    saveGame();
    populateSmelter();
}

// Adjust maximum temperature setting
window.adjustMaxTemp = function(amount) {
    smelterMaxTemp = Math.max(25, Math.min(1500, smelterMaxTemp + amount));
    // Ensure max doesn't go below min
    if (smelterMaxTemp < smelterMinTemp) {
        smelterMaxTemp = smelterMinTemp;
    }
    
    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterMaxTemp: smelterMaxTemp
            }
        });
    }
    
    saveGame();
    populateSmelter();
}

// Check if research requirements are met
function checkResearchRequirements(researchItem) {
    // No requirements - always available
    if (!researchItem.requires || researchItem.requires.length === 0) {
        return { met: true };
    }
    
    const missingReqs = [];
    
    for (const req of researchItem.requires) {
        // Each requirement is an object like {'material-science': 1}
        for (const [reqId, reqLevel] of Object.entries(req)) {
            const requiredResearch = researchtree.find(r => r.id === reqId);
            if (!requiredResearch) {
                missingReqs.push(`Unknown research: ${reqId}`);
                continue;
            }
            
            const currentLevel = requiredResearch.level || 0;
            if (currentLevel < reqLevel) {
                missingReqs.push(`${requiredResearch.name} level ${reqLevel}`);
            }
        }
    }
    
    if (missingReqs.length > 0) {
        return { 
            met: false, 
            reason: `Requires: ${missingReqs.join(', ')}`
        };
    }
    
    return { met: true };
}

function populateResearch() {
    const container = document.getElementById('research-content');
    if (!container) return;
    
    container.innerHTML = '';

    const hideEndless = document.getElementById('hide-endless-research').checked;
    
    //console.log('Populating research, researchtree has', researchtree.length, 'items:', researchtree.map(r => r.id));
    
    // Show active research if any
    if (activeResearch) {
        const activeDiv = document.createElement('div');
        activeDiv.className = 'active-research';
        const progress = activeResearch.progress || 0;
        // Calculate actual cost using formula: baseCost * (1.15^(targetLevel-1))
        const currentLevel = activeResearch.level || 0;
        const targetLevel = currentLevel + 1;
        const actualCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        const actualGoldCost = Math.round(activeResearch.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        const progressPercent = Math.floor((progress / actualCost) * 100);
        activeDiv.innerHTML = `
            <h3>🔬 Currently Researching</h3>
            <p><strong>${activeResearch.name}</strong> (Level ${targetLevel}) • ${progressPercent}% complete</p>
            <p style="font-size: 12px; opacity: 0.9;">${activeResearch.description}</p>
            <p><small>Progress: ${progress} / ${actualCost} 🔬 • Gold paid: ${actualGoldCost} 💰</small></p>
            <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
                <div class="progress-bar" style="flex: 1; margin-top: 0;"><div class="progress-fill" style="width: ${progressPercent}%"></div></div>
                <button class="btn-cancel-research" style="padding: 6px 10px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; white-space: nowrap; flex-shrink: 0;">✖ Cancel</button>
            </div>
        `;

        // Add cancel button click handler
        const cancelBtn = activeDiv.querySelector('.btn-cancel-research');
        cancelBtn.onmouseover = () => { cancelBtn.style.background = '#ff5252'; };
        cancelBtn.onmouseout = () => { cancelBtn.style.background = '#ff6b6b'; };
        cancelBtn.onclick = () => {
            if (confirm(`Cancel research on ${activeResearch.name}?\n\nProgress will be lost, but ${actualGoldCost} 💰 will be refunded.`)) {
                cancelResearch();
            }
        };
        
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

        // Skip if min_depth not reached
        if (researchItem.min_depth && startX < researchItem.min_depth) {
            continue;
        }

        if (hideEndless && (researchItem.maxlevel === Infinity || !researchItem.maxlevel)) {
            continue;
        }
        
        const tr = document.createElement('tr');
        
        const nameTd = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.innerHTML = `<strong>${researchItem.name}</strong><br><small>${researchItem.description}</small>`;
        nameTd.appendChild(nameDiv);
        
        const levelTd = document.createElement('td');
        levelTd.textContent = `${currentLevel} / ${maxLevel === Infinity ? '∞' : maxLevel}`;
        
        const costTd = document.createElement('td');
        // Calculate actual cost for next level using formula: baseCost * (1.15^(targetLevel-1))
        const targetLevel = currentLevel + 1;
        const actualCost = Math.round(researchItem.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        const actualGoldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        costTd.textContent = `${actualCost} 🔬 / ${actualGoldCost} 💰`;
        costTd.title = 'Research points / Gold required';
        
        const actionTd = document.createElement('td');
        const researchBtn = document.createElement('button');
        
        // Check if this research is already active
        const isActive = activeResearch && activeResearch.id === researchItem.id;
        
        // Check if requirements are met
        const requirementsMet = checkResearchRequirements(researchItem);

        // Check if player has enough gold
        const hasEnoughGold = gold >= actualGoldCost;

        if (isActive) {
            researchBtn.className = 'btn-research active';
            researchBtn.textContent = 'Active';
            researchBtn.disabled = true;
        } else if (!requirementsMet.met) {
            // Requirements not met - gray out
            researchBtn.className = 'btn-research disabled';
            researchBtn.textContent = 'Locked';
            researchBtn.disabled = true;
            researchBtn.title = requirementsMet.reason;
        } else if (!hasEnoughGold) {
            // Not enough gold
            researchBtn.className = 'btn-research disabled';
            researchBtn.textContent = 'Research';
            researchBtn.disabled = true;
            researchBtn.title = `Not enough gold! Required: ${formatNumber(actualGoldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`;
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
    
    // Show completed researches section
    const completedResearches = researchtree.filter(r => {
        const currentLevel = r.level || 0;
        const maxLevel = r.maxlevel || Infinity;
        return currentLevel >= maxLevel && maxLevel !== Infinity;
    });
    
    if (completedResearches.length > 0) {
        const completedSection = document.createElement('div');
        completedSection.className = 'completed-research-section';
        completedSection.innerHTML = '<h3 style="color: #4CAF50; margin: 20px 0 10px 0;">✓ Completed Researches</h3>';
        
        const completedTable = document.createElement('table');
        completedTable.className = 'research-table completed';
        
        const completedThead = document.createElement('thead');
        completedThead.innerHTML = '<tr><th>Research</th><th>Level</th><th>Status</th></tr>';
        completedTable.appendChild(completedThead);
        
        const completedTbody = document.createElement('tbody');
        
        for (const researchItem of completedResearches) {
            const tr = document.createElement('tr');
            tr.style.opacity = '0.7';
            
            const nameTd = document.createElement('td');
            const nameDiv = document.createElement('div');
            nameDiv.innerHTML = `<strong>${researchItem.name}</strong><br><small>${researchItem.description}</small>`;
            nameTd.appendChild(nameDiv);
            
            const levelTd = document.createElement('td');
            levelTd.textContent = `${researchItem.level} / ${researchItem.maxlevel}`;
            
            const statusTd = document.createElement('td');
            statusTd.innerHTML = '<span style="color: #4CAF50; font-weight: bold;">✓ Maxed</span>';
            
            tr.appendChild(nameTd);
            tr.appendChild(levelTd);
            tr.appendChild(statusTd);
            completedTbody.appendChild(tr);
        }
        
        completedTable.appendChild(completedTbody);
        completedSection.appendChild(completedTable);
        container.appendChild(completedSection);
    }
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

    // Calculate gold cost for next level
    const currentLevel = researchItem.level || 0;
    const targetLevel = currentLevel + 1;
    const goldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));

    // Check if player has enough gold
    if (gold < goldCost) {
        console.error(`Not enough gold to start research. Required: ${goldCost}, Available: ${gold}`);
        alert(`Not enough gold! Required: ${formatNumber(goldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`);
        return;
    }

    // Deduct gold cost
    gold -= goldCost;
    logTransaction('expense', goldCost, `Started research: ${researchItem.name} (Level ${targetLevel})`);

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
                researchtree: researchtree,
                gold: gold
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

    // Refund gold cost
    const currentLevel = activeResearch.level || 0;
    const targetLevel = currentLevel + 1;
    const goldCost = Math.round(activeResearch.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
    gold += goldCost;
    logTransaction('income', goldCost, `Cancelled research: ${researchName} (Level ${targetLevel}) - refund`);

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
                dwarfs: dwarfs,
                gold: gold
            }
        });
    }
    
    // Update displays
    populateResearch();
    saveGame();
    
    console.log(`Cancelled research: ${researchName}`);
}

function populateForge() {
    const container = document.getElementById('forge-content');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create forge interface directly (no tabs)
    createForgeInterface(container);
}

// Forge state - tracks the current forging process
let forgeState = {
    baseMaterial: null,      // Selected ingot material
    hammeringCount: 1,       // 1-10 iterations
    coolingOilQuality: 1,    // 1-25 quality
    handleQuality: 1,        // 1-100 quality
    retryCount: 1            // 1-stock amount
};

function createForgeInterface(container) {
    // Expected outcomes section at the top
    const outcomes = document.createElement('div');
    outcomes.className = 'forge-outcomes forge-outcomes-top';
    outcomes.innerHTML = `
        <h3>Expected Outcomes</h3>
        <div class="outcome-row">
            <span class="outcome-label">Total Cost:</span>
            <span id="total-forge-cost" class="outcome-value">0 💰</span>
        </div>
        <div class="outcome-row">
            <span class="outcome-label">Success Probability:</span>
            <span id="success-probability" class="outcome-value">0%</span>
        </div>
        <div class="outcome-row">
            <span class="outcome-label">Expected Quality (if successful):</span>
            <span id="expected-quality" class="outcome-value">-</span>
        </div>
    `;
    container.appendChild(outcomes);
    
    // Step 1: Heat Material
    const step1 = document.createElement('div');
    step1.className = 'forge-step';
    step1.innerHTML = `
        <h3>Step 1: Heat Material</h3>
        <label for="base-material">Select Base Material (Ingot):</label>
        <select id="base-material">
            <option value="">-- Select Ingot --</option>
        </select>
    `;
    container.appendChild(step1);
    
    // Populate ingot dropdown with hardness and stock info
    const materialSelect = step1.querySelector('#base-material');
    const ingots = materials.filter(m => m.type === 'Ingot');
    for (const ingot of ingots) {
        const stockAmount = materialsStock[ingot.id] || 0;
        const option = document.createElement('option');
        option.value = ingot.id;
        option.textContent = `${ingot.name} (Hardness: ${ingot.hardness}, Stock: ${stockAmount})`;
        option.dataset.hardness = ingot.hardness;
        option.disabled = stockAmount <= 0;
        if (stockAmount <= 0) {
            option.textContent += ' - OUT OF STOCK';
        }
        materialSelect.appendChild(option);
    }
    
    // Step 2: Hammering
    const step2 = document.createElement('div');
    step2.className = 'forge-step';
    step2.innerHTML = `
        <h3>Step 2: Hammering</h3>
        <label for="hammering-slider">Hammering Iterations: <span id="hammering-value">1</span></label>
        <input type="range" id="hammering-slider" min="1" max="${FORGE_HAMMERING_MAX_ITERATIONS}" value="1" step="1">
        <p class="forge-warning">⚠️ There is a ${((1 - FORGE_HAMMERING_SUCCESS_RATE) * 100).toFixed(0)}% chance to destroy the material during each iteration, but the outcome quality will improve with more iterations.</p>
    `;
    container.appendChild(step2);
    
    // Step 3: Cooling
    const step3 = document.createElement('div');
    step3.className = 'forge-step';
    step3.innerHTML = `
        <h3>Step 3: Cooling</h3>
        <label for="cooling-slider">Cooling Oil Quality: <span id="cooling-value">1</span> (Cost: <span id="cooling-cost">0</span> 💰) <span id="cooling-affordable" class="affordability-indicator"></span></label>
        <input type="range" id="cooling-slider" min="1" max="${FORGE_COOLING_MAX_QUALITY}" value="1" step="1">
        <p class="forge-warning">⚠️ ${(FORGE_COOLING_BASE_BRITTLE_CHANCE * 100).toFixed(0)}% chance the material will become brittle when cooling. Better coolant will decrease this probability.</p>
    `;
    container.appendChild(step3);
    
    // Step 4: Sharpening
    const step4 = document.createElement('div');
    step4.className = 'forge-step';
    step4.innerHTML = `
        <h3>Step 4: Sharpening</h3>
        <p class="forge-info">This will improve the sharpness of the item - or make it worse, good luck!</p>
    `;
    container.appendChild(step4);
    
    // Step 5: Mount Handle
    const step5 = document.createElement('div');
    step5.className = 'forge-step';
    step5.innerHTML = `
        <h3>Step 5: Mount Handle</h3>
        <label for="handle-slider">Handle Quality: <span id="handle-value">1</span> (Cost: <span id="handle-cost">${FORGE_HANDLE_BASE_COST}</span> 💰) <span id="handle-affordable" class="affordability-indicator"></span></label>
        <input type="range" id="handle-slider" min="1" max="${FORGE_HANDLE_MAX_QUALITY}" value="1" step="1">
        <p class="forge-info">The handle determines comfort and durability. Better handles improve the overall tool quality.</p>
    `;
    container.appendChild(step5);
    
    // Step 6: Retries
    const step6 = document.createElement('div');
    step6.className = 'forge-step';
    step6.innerHTML = `
        <h3>Step 6: Retry Attempts</h3>
        <label for="retry-slider">Number of Retries: <span id="retry-value">1</span> (Max: <span id="retry-max">1</span> based on stock)</label>
        <input type="range" id="retry-slider" min="1" max="1" value="1" step="1">
        <p class="forge-info">If forging fails, automatically retry with another ingot. Limited by available stock.</p>
    `;
    container.appendChild(step6);
    
    // Forge button
    const forgeAction = document.createElement('div');
    forgeAction.className = 'forge-action';
    forgeAction.innerHTML = `
        <button id="forge-button" class="btn-primary" disabled>Forge Tool</button>
    `;
    container.appendChild(forgeAction);
    
    // Wire up event listeners
    setupForgeListeners();
}

function setupForgeListeners() {
    const materialSelect = document.getElementById('base-material');
    const hammeringSlider = document.getElementById('hammering-slider');
    const coolingSlider = document.getElementById('cooling-slider');
    const handleSlider = document.getElementById('handle-slider');
    const retrySlider = document.getElementById('retry-slider');
    
    if (materialSelect) {
        materialSelect.addEventListener('change', updateForgeState);
    }
    if (hammeringSlider) {
        hammeringSlider.addEventListener('input', updateForgeState);
    }
    if (coolingSlider) {
        coolingSlider.addEventListener('input', updateForgeState);
    }
    if (handleSlider) {
        handleSlider.addEventListener('input', updateForgeState);
    }
    if (retrySlider) {
        retrySlider.addEventListener('input', updateForgeState);
    }
}

function updateForgeState() {
    // Get current selections
    const materialSelect = document.getElementById('base-material');
    const hammeringSlider = document.getElementById('hammering-slider');
    const coolingSlider = document.getElementById('cooling-slider');
    const handleSlider = document.getElementById('handle-slider');
    const retrySlider = document.getElementById('retry-slider');
    
    // Update forge state
    if (materialSelect) {
        forgeState.baseMaterial = materialSelect.value;
        
        // Update retry slider max based on stock
        if (retrySlider && forgeState.baseMaterial) {
            const stockAmount = materialsStock[forgeState.baseMaterial] || 0;
            const maxRetries = Math.max(1, stockAmount);
            retrySlider.max = maxRetries;
            const retryMax = document.getElementById('retry-max');
            if (retryMax) {
                retryMax.textContent = maxRetries;
            }
            // Reset retry value if it exceeds new max
            if (parseInt(retrySlider.value) > maxRetries) {
                retrySlider.value = maxRetries;
            }
        }
    }
    
    if (hammeringSlider) {
        forgeState.hammeringCount = parseInt(hammeringSlider.value);
        const hammeringValue = document.getElementById('hammering-value');
        if (hammeringValue) {
            hammeringValue.textContent = forgeState.hammeringCount;
        }
    }
    
    if (coolingSlider) {
        forgeState.coolingOilQuality = parseInt(coolingSlider.value);
        const coolingValue = document.getElementById('cooling-value');
        const coolingCost = document.getElementById('cooling-cost');
        const coolingAffordable = document.getElementById('cooling-affordable');
        if (coolingValue) {
            coolingValue.textContent = forgeState.coolingOilQuality;
        }
        if (coolingCost) {
            // Calculate cooling oil cost: level 1 = 0, level 2 = 500, increasing by 25% each level
            const cost = forgeState.coolingOilQuality === 1 ? 0 : 500 * Math.pow(1.25, forgeState.coolingOilQuality - 2);
            coolingCost.textContent = formatNumber(cost, 'gold');
            
            // Show affordability indicator
            if (coolingAffordable) {
                if (gold >= cost) {
                    coolingAffordable.textContent = '✓';
                    coolingAffordable.className = 'affordability-indicator affordable';
                } else {
                    coolingAffordable.textContent = '✗';
                    coolingAffordable.className = 'affordability-indicator not-affordable';
                }
            }
        }
    }
    
    if (handleSlider) {
        forgeState.handleQuality = parseInt(handleSlider.value);
        const handleValue = document.getElementById('handle-value');
        const handleCost = document.getElementById('handle-cost');
        const handleAffordable = document.getElementById('handle-affordable');
        if (handleValue) {
            handleValue.textContent = forgeState.handleQuality;
        }
        if (handleCost) {
            // Calculate handle cost: level 1 = 100, increasing by 15% each level
            const cost = 100 * Math.pow(1.15, forgeState.handleQuality - 1);
            handleCost.textContent = formatNumber(cost, 'gold');
            
            // Show affordability indicator
            if (handleAffordable) {
                if (gold >= cost) {
                    handleAffordable.textContent = '✓';
                    handleAffordable.className = 'affordability-indicator affordable';
                } else {
                    handleAffordable.textContent = '✗';
                    handleAffordable.className = 'affordability-indicator not-affordable';
                }
            }
        }
    }
    
    if (retrySlider) {
        forgeState.retryCount = parseInt(retrySlider.value);
        const retryValue = document.getElementById('retry-value');
        if (retryValue) {
            retryValue.textContent = forgeState.retryCount;
        }
    }
    
    // Calculate and display total cost
    const totalCostDisplay = document.getElementById('total-forge-cost');
    const forgeButton = document.getElementById('forge-button');
    
    if (totalCostDisplay) {
        const coolingCost = forgeState.coolingOilQuality === 1 ? 0 : FORGE_COOLING_BASE_COST * Math.pow(FORGE_COOLING_COST_MULTIPLIER, forgeState.coolingOilQuality - 2);
        const handleCost = FORGE_HANDLE_BASE_COST * Math.pow(FORGE_HANDLE_COST_MULTIPLIER, forgeState.handleQuality - 1);
        const totalCost = coolingCost + handleCost;
        totalCostDisplay.textContent = `${formatNumber(totalCost, 'gold')} 💰`;
        
        // Calculate success probability
        // Base: 90% chance to survive hammering per iteration
        const hammeringSuccessRate = Math.pow(FORGE_HAMMERING_SUCCESS_RATE, forgeState.hammeringCount);
        
        // Cooling: 70% base success rate, improved by coolant quality
        // Each level reduces brittleness chance by ~1.2%
        const coolingBrittleChance = Math.max(0, FORGE_COOLING_BASE_BRITTLE_CHANCE - (forgeState.coolingOilQuality - 1) * FORGE_COOLING_BRITTLE_REDUCTION_PER_QUALITY);
        const coolingSuccessRate = 1 - coolingBrittleChance;
        
        // Overall success probability
        const totalSuccessRate = hammeringSuccessRate * coolingSuccessRate;
        
        // Calculate expected quality (simplified model)
        // Quality improves with: base material hardness, hammering iterations, cooling oil quality, handle quality
        const baseQuality = FORGE_BASE_QUALITY;
        let materialHardness = 0;
        if (forgeState.baseMaterial) {
            const material = materials.find(m => m.id === forgeState.baseMaterial);
            materialHardness = material ? material.hardness : 0;
        }
        const hammeringBonus = forgeState.hammeringCount * FORGE_HAMMERING_BONUS_PER_ITERATION;
        const coolingBonus = forgeState.coolingOilQuality * FORGE_COOLING_BONUS_PER_QUALITY;
        const handleBonus = forgeState.handleQuality * FORGE_HANDLE_BONUS_PER_QUALITY;
        const expectedQuality = baseQuality + materialHardness + hammeringBonus + coolingBonus + handleBonus;
        
        // Update success probability display
        const successProbDisplay = document.getElementById('success-probability');
        if (successProbDisplay) {
            successProbDisplay.textContent = `${(totalSuccessRate * 100).toFixed(1)}%`;
            if (totalSuccessRate >= FORGE_SUCCESS_RATE_HIGH_THRESHOLD) {
                successProbDisplay.className = 'outcome-value success-high';
            } else if (totalSuccessRate >= FORGE_SUCCESS_RATE_MEDIUM_THRESHOLD) {
                successProbDisplay.className = 'outcome-value success-medium';
            } else {
                successProbDisplay.className = 'outcome-value success-low';
            }
        }
        
        // Update expected quality display
        const qualityDisplay = document.getElementById('expected-quality');
        if (qualityDisplay) {
            if (forgeState.baseMaterial) {
                qualityDisplay.textContent = formatNumber(expectedQuality, 'material');
            } else {
                qualityDisplay.textContent = '-';
            }
        }
        
        // Enable/disable forge button
        if (forgeButton) {
            if (forgeState.baseMaterial && gold >= totalCost) {
                forgeButton.disabled = false;
            } else {
                forgeButton.disabled = true;
            }
        }
    }
}

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
        if ((modalName === 'settings-modal') && gamePaused) {
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
    
    // Update tab button states
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === 'dwarfs') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Remove Sell All button from header
    const sellAllBtn = document.getElementById('sell-all-header-btn');
    if (sellAllBtn) sellAllBtn.remove();
    
    // Remove Warehouse Sell button
    const warehouseSellBtn = document.getElementById('warehouse-sell-btn');
    if (warehouseSellBtn) warehouseSellBtn.remove();
    
    // Remove Sell Non-Craftables button from header
    const sellNotCraftableBtn = document.getElementById('sell-not-craftable-btn');
    if (sellNotCraftableBtn) sellNotCraftableBtn.remove();

    // Remove Gems button from header
    const gemsBtn = document.getElementById('gems-header-btn');
    if (gemsBtn) gemsBtn.remove();

    // Remove total stock value from header
    const totalValueSpan = document.getElementById('total-stock-value');
    if (totalValueSpan) totalValueSpan.remove();
    
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
        header.innerHTML = `
            <span class="tool-name">${displayName}</span>
            <span class="tool-power">⚒️ ${toolPower}</span>
        `;
        
        const actions = document.createElement('div');
        actions.className = 'tool-card-actions';
        
        // Rename button
        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn-secondary btn-tiny';
        renameBtn.textContent = '✏️';
        renameBtn.title = 'Rename tool';
        renameBtn.onclick = () => renameToolFromPanel(tool.id);
        actions.appendChild(renameBtn);
        
        // Dropdown for assigning (shows current assignment or allows selection)
        const select = document.createElement('select');
        select.id = `panel-assign-select-${tool.id}`;
        select.className = 'assign-select-small';
        select.innerHTML = `<option value="">-- Unassigned --</option>` + 
            dwarfs.map(d => `<option value="${d.name}"${d.name === (assignedDwarf?.name || '') ? ' selected' : ''}>${d.name}</option>`).join('');
        select.onchange = () => assignToolFromPanel(tool.id, toolPower);
        actions.appendChild(select);
        
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
            const gemInfo = document.createElement('span');
            gemInfo.style.cssText = 'padding: 4px 8px; background: rgba(102, 204, 255, 0.2); border: 1px solid rgba(102, 204, 255, 0.4); border-radius: 4px; color: #66ccff; font-size: 11px; font-weight: bold; white-space: nowrap;';
            gemInfo.textContent = `💎 ${tool.gems.length} Gem${tool.gems.length > 1 ? 's' : ''}`;
            gemInfo.title = `${tool.gems.length} gem${tool.gems.length > 1 ? 's' : ''} set`;
            gemInfo.style.cursor = 'pointer';
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
        const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
        const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
            const bucketTotal = d.bucket ? Object.values(d.bucket).reduce((a, b) => {
                if (Array.isArray(b)) return a + b.length;
                if (typeof b === 'object' && b !== null) return a + 1; // Gem object counts as 1
                return a + b;
            }, 0) : 0;
            const bucketResearch = researchtree.find(r => r.id === 'buckets');
            const bucketBonus = bucketResearch ? (bucketResearch.level || 0) : 0;
            const dwarfCapacity = bucketCapacity + bucketBonus + (d.strength || 0);

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
            const newHTML = `${levelSpan} | 💰 ${formatNumber(wage, 'gold')} | 💼 ${d.status || 'idle'}<br>🧺 ${bucketTotal}/${dwarfCapacity} | ⚡${Math.round(d.energy || 0)}/${d.maxEnergy || 100}<br>⛏️ ${formatNumber(totalPower, 'material')} (${toolName})`;

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
        const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
        
        // Calculate bucket fill
        const bucketTotal = d.bucket ? Object.values(d.bucket).reduce((a, b) => {
            if (Array.isArray(b)) return a + b.length;
            if (typeof b === 'object' && b !== null) return a + 1; // Gem object counts as 1
            return a + b;
        }, 0) : 0;
        // Apply bucket research bonus (1 capacity per level)
        const bucketResearch = researchtree.find(r => r.id === 'buckets');
        const bucketBonus = bucketResearch ? (bucketResearch.level || 0) : 0;
        const dwarfCapacity = bucketCapacity + bucketBonus + (d.strength || 0);
        
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
        
        info.innerHTML = `${levelSpan} | 💰 ${formatNumber(wage, 'gold')} | 💼 ${d.status || 'idle'}<br>🧺 ${bucketTotal}/${dwarfCapacity} | ⚡${Math.round(d.energy || 0)}/${d.maxEnergy || 100}<br>⛏️ ${formatNumber(totalPower, 'material')} (${toolName})`;

        row.appendChild(header);
        row.appendChild(info);

        // Make row clickable to open dwarf detail modal
        row.style.cursor = 'pointer';
        row.dataset.dwarfName = d.name;
        row.classList.add('dwarf-clickable');

        list.appendChild(row);
    }
}

// Open dwarf detail modal
function openDwarfDetailModal(dwarf) {
    const modal = document.getElementById('levelup-modal');
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
    openModal('levelup-modal');
}

// Populate the dwarf switcher dropdown
function populateDwarfSwitcher(currentDwarfName) {
    const switcher = document.getElementById('dwarf-switcher');
    if (!switcher) return;

    switcher.innerHTML = '<option value="">Switch to...</option>';

    // Sort dwarfs: those who can level up first, then by name
    const sortedDwarfs = [...dwarfs].sort((a, b) => {
        const aXP = a.xp || 0;
        const aLevel = a.level || 1;
        const aNeeded = DWARF_XP_PER_LEVEL * aLevel;
        const aCanLevelUp = aXP >= aNeeded;

        const bXP = b.xp || 0;
        const bLevel = b.level || 1;
        const bNeeded = DWARF_XP_PER_LEVEL * bLevel;
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
            const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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

// Populate the static template with dwarf data (full population on open)
function populateDwarfDetailTemplate(dwarf, includeToolSelector = true) {
    const currentXP = dwarf.xp || 0;
    const currentLevel = dwarf.level || 1;
    const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;

    // Calculate bucket info (gems can be objects, arrays, or regular materials are numbers)
    const bucketTotal = dwarf.bucket ? Object.values(dwarf.bucket).reduce((a, b) => {
        if (Array.isArray(b)) {
            return a + b.length; // Gems as array: count array length
        }
        if (typeof b === 'object' && b !== null) {
            return a + 1; // Gem object: counts as 1
        }
        return a + b; // Regular materials: add count
    }, 0) : 0;
    const bucketResearch = researchtree.find(r => r.id === 'buckets');
    const bucketBonus = bucketResearch ? (bucketResearch.level || 0) : 0;
    const dwarfCapacity = bucketCapacity + bucketBonus + (dwarf.strength || 0);

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
    document.getElementById('dwarf-bucket-header').textContent = `🪣 Bucket (${bucketTotal}/${dwarfCapacity})`;
    const bucketContents = document.getElementById('dwarf-bucket-contents');
    if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0 && bucketTotal > 0) {
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
        <div>× Level Bonus: ${formatNumber(levelBonus, 'percent')} (${baseDigPowerPoints} skill points)</div>
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
        card.innerHTML = `
            <h4 style="margin: 0 0 6px 0; font-size: 13px;">${icon} ${name}</h4>
            <p style="font-size: 16px; font-weight: bold; margin: 6px 0;">Skill Points invested: ${level}</p>
            <p style="font-size: 13px; opacity: 0.8; margin: 0;">${description}</p>
        `;
        if (hasEnoughXP) {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = '⭐ Invest Point';
            btn.dataset.upgradeType = upgradeType;
            btn.dataset.dwarfName = dwarf.name;
            btn.style.cssText = 'margin-top: 8px; width: 100%; padding: 6px; font-size: 12px;';
            card.appendChild(btn);
        }
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
    const digPowerDesc = `+${(baseDigPower * 10).toFixed(1)}% power<br />${diamondBonus}`;

    const energyDesc = `Maximum Energy: ${dwarf.maxEnergy || 100}${rubyEnergyChance > 0 ? `<br />💎Ruby: ${formatNumber(rubyEnergyChance, 'percent')}% chance to prevent energy consumption` : ''}`;

    const baseStrength = dwarf.strength || 0;
    const modifiedStrength = getSapphireModifiedStrength(dwarf, baseStrength);
    const effectiveStrength = Math.floor(modifiedStrength);
    const sapphireBonusPercent = modifiedStrength > baseStrength ? ((modifiedStrength - baseStrength) / baseStrength * 100) : 0;
    const sapphireBonus = modifiedStrength > baseStrength ? ` (effective: ${effectiveStrength}, +${formatNumber(sapphireBonusPercent, 'percent')}% from 💎Sapphire)` : '';
    const strengthDesc = `Bucket Capacity: ${dwarfCapacity}<br />${sapphireBonus}`;

    const baseWisdom = dwarf.wisdom || 0;
    const baseResearchPoints = baseWisdom + 1;
    const modifiedResearchPoints = getAmethystModifiedResearchPoints(dwarf, baseResearchPoints);
    const amethystBonusPercent = modifiedResearchPoints > baseResearchPoints ? ((modifiedResearchPoints - baseResearchPoints) / baseResearchPoints * 100) : 0;
    const amethystBonus = modifiedResearchPoints > baseResearchPoints ? ` (+${formatNumber(amethystBonusPercent, 'percent')}% from 💎Amethyst)` : '';
    const wisdomDesc = `Research and Smelting Speed<br />${amethystBonus}`;

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

// Refresh dwarf detail modal with updated information (lightweight, no UI blocking)
function refreshDwarfDetailModal(dwarf, forceFullUpdate = false) {
    const modal = document.getElementById('levelup-modal');
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
    const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;

    // Calculate bucket info (gems can be objects, arrays, or regular materials are numbers)
    const bucketTotal = dwarf.bucket ? Object.values(dwarf.bucket).reduce((a, b) => {
        if (Array.isArray(b)) {
            return a + b.length; // Gems as array: count array length
        }
        if (typeof b === 'object' && b !== null) {
            return a + 1; // Gem object: counts as 1
        }
        return a + b; // Regular materials: add count
    }, 0) : 0;
    const bucketResearch = researchtree.find(r => r.id === 'buckets');
    const bucketBonus = bucketResearch ? (bucketResearch.level || 0) : 0;
    const dwarfCapacity = bucketCapacity + bucketBonus + (dwarf.strength || 0);

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
    document.getElementById('dwarf-bucket-header').textContent = `🪣 Bucket (${bucketTotal}/${dwarfCapacity})`;
    const bucketContents = document.getElementById('dwarf-bucket-contents');
    if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0 && bucketTotal > 0) {
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

// Apply the chosen level up upgrade
function applyLevelUp(dwarf, upgradeType) {
    const xpNeeded = DWARF_XP_PER_LEVEL * dwarf.level;
    
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
            actualDwarf.strength = oldStrength + DWARF_LEVELUP_STRENGTH_BONUS;
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
        totalXP += DWARF_XP_PER_LEVEL * i;
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

// Delegated event handler for forge button
document.addEventListener('click', (ev) => {
    const forgeBtn = ev.target.closest('#forge-button');
    if (!forgeBtn || forgeBtn.disabled) return;
    
    startForging();
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

/**
 * Open the sell modal for a specific material
 * @param {string} materialId - The material ID to sell
 */
function openSellModal(materialId) {
    const material = getMaterialById(materialId);
    const availableStock = materialsStock[materialId] || 0;

    if (!material || availableStock === 0) {
        console.warn(`Cannot sell ${materialId}: not found or no stock`);
        return;
    }

    // Calculate trade bonus
    const betterTrading = getResearchLevel('trading');
    const tradeBonus = 1 + betterTrading * RESEARCH_TRADING_BONUS;
    const unitPrice = material.worth * tradeBonus;

    // Update modal title
    const title = document.getElementById('sell-modal-title');
    if (title) title.textContent = `💰 Sell ${material.name}`;

    // Update info fields
    const availableEl = document.getElementById('sell-available');
    if (availableEl) availableEl.textContent = formatNumber(availableStock, 'material');

    const unitPriceEl = document.getElementById('sell-unit-price');
    if (unitPriceEl) unitPriceEl.textContent = formatNumber(unitPrice, 'gold');

    const tradeBonusEl = document.getElementById('sell-trade-bonus');
    if (tradeBonusEl) tradeBonusEl.textContent = `+${Math.round((tradeBonus - 1) * 100)}%`;

    // Setup slider
    const slider = document.getElementById('sell-amount-slider');
    const amountDisplay = document.getElementById('sell-amount-display');
    const sliderMax = document.getElementById('sell-slider-max');
    const totalValueEl = document.getElementById('sell-total-value');
    const totalContainer = totalValueEl?.parentElement;

    if (slider) {
        slider.min = '1';
        slider.max = availableStock.toString();
        slider.value = '1';

        if (sliderMax) sliderMax.textContent = formatNumber(availableStock, 'material');

        // Set material color as background for total value
        if (totalContainer) {
            totalContainer.style.background = `linear-gradient(135deg, ${material.color}, ${material.color}dd)`;
        }

        // Update display function - gets current slider value from DOM
        const updateDisplay = () => {
            const currentSlider = document.getElementById('sell-amount-slider');
            const amount = parseInt(currentSlider.value, 10);
            if (amountDisplay) amountDisplay.textContent = formatNumber(amount, 'material');
            if (totalValueEl) {
                const totalValue = unitPrice * amount;
                totalValueEl.textContent = formatNumber(totalValue, 'gold') + ' 💰';
            }
        };

        // Remove old event listeners by cloning
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);

        // Add event listener to the new slider
        newSlider.addEventListener('input', updateDisplay);

        // Initial update
        updateDisplay();
    }

    // Setup button handler
    const sellSelectedBtn = document.getElementById('sell-selected-btn');

    if (sellSelectedBtn) {
        sellSelectedBtn.onclick = () => {
            const amount = parseInt(document.getElementById('sell-amount-slider').value, 10);
            sellMaterial(materialId, amount);
            closeModal('sell-modal');
        };
    }

    // Open modal
    openModal('sell-modal');
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
    const betterTrading = getResearchLevel('trading');
    const tradeBonus = 1 + betterTrading * RESEARCH_TRADING_BONUS;
    
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
    
    console.log(`Sold ${amount} ${material.name} for ${formatNumber(earnings, 'gold')} gold (${formatNumber(tradeBonus, 'material')}x bonus)`);
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
    const sortedMaterials = [...materials].sort((a, b) => b.worth - a.worth);
    
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
    
    // Get materials that are used as smelter inputs
    const smelterInputMaterials = new Set();
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
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
        const m = materials.find(mat => mat.id === id);
        if (!m) continue;

        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        const actualWorth = m.worth * tradeBonus;

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
            worthSpan.title = tradeBonus > 1 ? `Base: ${formatNumber(m.worth, 'gold')} gold (${formatNumber(tradeBonus, 'material')}x bonus)` : `${formatNumber(m.worth, 'gold')} gold each`;

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
        // Create or update Gems button (always visible, on the left)
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
        if (task.output && task.output.material) {
            craftableMaterials.add(task.output.material);
        }
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

            // Loose materials (not in smelter inputs, not ingots)
            if (m.type.startsWith('Loose') && value > 0) {
                looseValue += value;
                looseMaterials.push({ name: m.name, count });
            }

            // Stones
            if (m.type.startsWith('Stone') && value > 0) {
                stonesValue += value;
                stonesMaterials.push({ name: m.name, count });
            }

            // Ores
            if (m.type.startsWith('Ore') && value > 0) {
                oresValue += value;
                oresMaterials.push({ name: m.name, count });
            }

            // Non-craftables (raw materials that cannot be crafted - not outputs of recipes)
            if (!craftableMaterials.has(id) && !smelterInputMaterials.has(id) && value > 0) {
                nonCraftablesValue += value;
                nonCraftablesMaterials.push({ name: m.name, count });
            }

            // Ingots
            if (m.type.startsWith('Ingot') && value > 0) {
                ingotsValue += value;
                ingotsMaterials.push({ name: m.name, count });
            }

            // Heating materials
            if (m.type.startsWith('Special') && value > 0) {
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
        if (task.output && task.output.material) {
            craftableMaterials.add(task.output.material);
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

        switch (action) {
            case 'sell-loose':
                shouldSell = !smelterInputMaterials.has(id) && m.type !== 'Ingot';
                break;
            case 'sell-stones':
                shouldSell = m.type && m.type.startsWith('Stone');
                break;
            case 'sell-ores':
                shouldSell = m.type && (m.type === 'Ore' || m.type.startsWith('Ore '));
                break;
            case 'sell-non-craftables':
                shouldSell = !craftableMaterials.has(id);
                break;
            case 'sell-ingots':
                shouldSell = m.type === 'Ingot';
                break;
            case 'sell-heating':
                shouldSell = m.type === 'Heating';
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

function sellNotCraftableMaterials() {
    // Get materials that are used as smelter inputs
    const smelterInputMaterials = new Set();
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
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
                if (data.smelterMinTemp !== undefined) smelterMinTemp = data.smelterMinTemp;
                if (data.smelterMaxTemp !== undefined) smelterMaxTemp = data.smelterMaxTemp;
                if (data.smelterHeatingMode !== undefined) smelterHeatingMode = data.smelterHeatingMode;
                
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
                const levelupModal = document.getElementById('levelup-modal');
                if (levelupModal && levelupModal.getAttribute('aria-hidden') === 'false') {
                    const dwarfName = levelupModal.dataset.dwarfName;
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
                
                // Update research modal if it's open and research state changed
                const researchModal = document.getElementById('research-modal');
                if (researchModal && researchModal.getAttribute('aria-hidden') === 'false' && researchStateChanged) {
                    populateResearch();
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
            dropGridStartX,
            gold,
            toolsInventory,
            activeResearch,
            researchtree,
            smelterTemperature,
            smelterMinTemp,
            smelterMaxTemp
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
            transactionLog: transactionLog,
            transactionHistory: transactionHistory,
            currentHourTimestamp: currentHourTimestamp,
            smelterTasks: smelterTasks,
            smelterTemperature: smelterTemperature,
            smelterMinTemp: smelterMinTemp,
            smelterMaxTemp: smelterMaxTemp,
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
        dwarfs = gameState.dwarfs || [];

        // Sanitize dwarf buckets - fix any corrupted gem data
        for (const dwarf of dwarfs) {
            if (dwarf.bucket) {
                const sanitizedBucket = {};
                for (const [key, value] of Object.entries(dwarf.bucket)) {
                    // If value is an object (corrupted gem data), convert to 1
                    // If value is a number, keep it
                    // If value is a string like "[object Object]11", extract the number or default to 1
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        sanitizedBucket[key] = 1;
                    } else if (typeof value === 'string') {
                        // Try to extract number from corrupted string like "[object Object]11"
                        const match = value.match(/\d+$/);
                        sanitizedBucket[key] = match ? parseInt(match[0]) : 1;
                    } else if (Array.isArray(value)) {
                        sanitizedBucket[key] = value.length;
                    } else if (typeof value === 'number') {
                        sanitizedBucket[key] = value;
                    } else {
                        sanitizedBucket[key] = 1;
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
                materialsStock[key] = gameState.materialsStock[key];
            }
        }

        // Restore gems array
        if (gameState.gems) {
            gems = gameState.gems;
        }
        if (gameState.nextGemId !== undefined) {
            nextGemId = gameState.nextGemId;
        }

        // Restore tools inventory
        if (gameState.toolsInventory) {
            toolsInventory.length = 0;
            toolsInventory.push(...gameState.toolsInventory);
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
            // Reorder smelterTasks based on saved order
            const savedOrder = gameState.smelterTasks.map(t => t.id);
            smelterTasks.sort((a, b) => {
                const indexA = savedOrder.indexOf(a.id);
                const indexB = savedOrder.indexOf(b.id);
                // Tasks not in saved order go to the end
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }
        
        // Restore smelter temperature state
        if (gameState.smelterTemperature !== undefined) smelterTemperature = gameState.smelterTemperature;
        if (gameState.smelterMinTemp !== undefined) smelterMinTemp = gameState.smelterMinTemp;
        if (gameState.smelterMaxTemp !== undefined) smelterMaxTemp = gameState.smelterMaxTemp;
        if (gameState.smelterHeatingMode !== undefined) smelterHeatingMode = gameState.smelterHeatingMode;
        
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
        const xpForLevel = DWARF_XP_PER_LEVEL * (dwarf.level || 1);
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
    for (const material of materials) {
        materialsStock[material.id] = (materialsStock[material.id] || 0) + 5;
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
    forgeLink.innerHTML = '<span class="icon">🔨</span><span>Forge</span>';
    forgeLink.onclick = (e) => {
        e.preventDefault();
        openForge();
    };
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

// Start the game
checkCheatMode();
initGame();