const GAME_LOOP_INTERVAL_MS = 300;
const activeCritFlashes = new Map();

// pick a random material from the registry based on depth level and probability (probability)
function randomMaterial(depthLevel = 0) {
    // Filter materials that are valid for this depth level and have probability > 0
    const validMaterials = materials.filter(m => 
        depthLevel >= (m.minlevel || 0) && depthLevel <= (m.maxlevel || Infinity) && (m.probability || 0) > 0
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

// Check if a smelter task is unlocked by research
function isSmelterTaskUnlocked(task) {
    if (!task.requires) return true;
    const requiredResearch = researchtree.find(r => r.id === task.requires);
    if (!requiredResearch) return true;
    return (requiredResearch.level || 0) >= 1;
}

// Count how many smelter tasks are currently actionable
function countActionableSmelterTasks() {
    let count = 0;
    for (const task of smelterTasks) {
        if (task.id === 'do-nothing') continue;
        if (!isSmelterTaskUnlocked(task)) continue;
        if (task.input && task.input.material && task.input.amount) {
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
                            const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
                            return currentXP >= xpNeeded;
                        });
                        
                        if (dwarfsCanLevelUp.length > 0) {
                            bed.title = `House (${dwarfsCanLevelUp.length} dwarf(s) ready to level up!)`;
                            // Add notification badge
                            const badge = document.createElement('span');
                            badge.className = 'notification-badge';
                            badge.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #ff6b6b; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 2px solid white;';
                            badge.textContent = dwarfsCanLevelUp.length;
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
        alert(`Not enough gold! Need ${totalCost.toFixed(0)}, have ${gold.toFixed(0)}.`);
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
        
        animationContent.innerHTML = `
            <div class="forging-anvil">⚒️</div>
            <div class="forging-message forging-success">Success!</div>
            <div class="forging-result">
                <p><strong>${materialName} Pickaxe #${newToolId}</strong></p>
                <p>Power: ${finalQuality}</p>
                <p>Attempts used: ${attemptsUsed}</p>
            </div>
            <button class="btn-primary" onclick="closeForging()">Return to Forge</button>
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

function closeForging() {
    closeModal('forging-animation-modal');
    updateStockDisplay(); // Update stock display
    openModal('forge-modal');
    populateForge(); // Refresh forge UI with updated stock
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        incomeTd.textContent = '+' + currentHourIncome.toFixed(2);
        
        const expenseTd = document.createElement('td');
        expenseTd.style.cssText = 'padding: 8px; text-align: right; color: #ff6b6b; font-weight: bold;';
        expenseTd.textContent = '-' + currentHourExpense.toFixed(2);
        
        const netTd = document.createElement('td');
        const net = currentHourIncome - currentHourExpense;
        netTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';
        netTd.style.color = net >= 0 ? '#4ade80' : '#ff6b6b';
        netTd.textContent = (net >= 0 ? '+' : '') + net.toFixed(2);
        
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
        incomeTd.textContent = '+' + hourIncome.toFixed(2);
        
        const expenseTd = document.createElement('td');
        expenseTd.style.cssText = 'padding: 8px; text-align: right; color: #ff6b6b;';
        expenseTd.textContent = '-' + hourExpense.toFixed(2);
        
        const netTd = document.createElement('td');
        const net = hourIncome - hourExpense;
        netTd.style.cssText = 'padding: 8px; text-align: right;';
        netTd.style.color = net >= 0 ? '#4ade80' : '#ff6b6b';
        netTd.textContent = (net >= 0 ? '+' : '') + net.toFixed(2);
        
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
            amountTd.textContent = '+' + data.income.toFixed(2);
        } else if (data.expense > 0) {
            amountTd.style.color = '#ff6b6b';
            amountTd.textContent = '-' + data.expense.toFixed(2);
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
            } else {
                statusIndicator.textContent = '❌';
                statusIndicator.title = `Blocked - need ${task.input.amount}x, have ${stockAmount.toFixed(1)}x`;
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
        
        // Show input/output if applicable
        if (task.input && task.output) {
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputMat = getMaterialById(task.input.material);
            const outputMat = getMaterialById(task.output.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const outputName = outputMat ? outputMat.name : task.output.material;
            // Show current stock vs required
            const stockInfo = `(${stockAmount.toFixed(1)}/${task.input.amount})`;
            // Add temperature requirement if present
            const tempReq = task.minTemp ? ` @ ${task.minTemp}°` : '';
            taskRecipe.textContent = `${task.input.amount}x ${inputName} ${stockInfo} → ${task.output.amount}x ${outputName}${tempReq}`;
            if (!isUnlocked) {
                taskRecipe.classList.add('recipe-locked');
            } else {
                taskRecipe.classList.add(isActionable ? 'recipe-ready' : 'recipe-blocked');
            }
            taskInfo.appendChild(taskRecipe);
        } else if (task.input && task.type === 'heating') {
            // Show heating task info with temperature display
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputMat = getMaterialById(task.input.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const stockInfo = `(${stockAmount.toFixed(1)}/${task.input.amount})`;
            taskRecipe.textContent = `${task.input.amount}x ${inputName} ${stockInfo} → +${task.heatGain}° Heat`;
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
                statusIndicator.title = `Blocked - need ${task.input.amount}x, have ${stockAmount.toFixed(1)}x`;
            }
        }
        
        // Update recipe stock info
        const recipeSpan = heatingTaskRow.querySelector('.smelter-task-recipe');
        if (recipeSpan) {
            const inputMat = getMaterialById(task.input.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const stockInfo = `(${stockAmount.toFixed(1)}/${task.input.amount})`;
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
        
        // Check if requirements are met
        const requirementsMet = checkResearchRequirements(researchItem);
        
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
            coolingCost.textContent = cost.toFixed(0);
            
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
            handleCost.textContent = cost.toFixed(0);
            
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
        totalCostDisplay.textContent = `${totalCost.toFixed(0)} 💰`;
        
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
                qualityDisplay.textContent = expectedQuality.toFixed(0);
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
    
    // Remove Sell Non-Craftables button from header
    const sellNotCraftableBtn = document.getElementById('sell-not-craftable-btn');
    if (sellNotCraftableBtn) sellNotCraftableBtn.remove();
    
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
    
    const sellNotCraftableBtn = document.getElementById('sell-not-craftable-btn');
    if (sellNotCraftableBtn) sellNotCraftableBtn.remove();
    
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
        header.innerHTML = `
            <span class="tool-name">${tool.type} #${tool.id}</span>
            <span class="tool-power">⚒️ ${toolPower}</span>
        `;
        
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
        
        // Enchant button (placeholder)
        const enchantBtn = document.createElement('button');
        enchantBtn.className = 'btn-secondary btn-tiny';
        enchantBtn.textContent = '✨ Enchant';
        enchantBtn.title = 'Enchant (coming soon)';
        enchantBtn.style.opacity = '0.5';
        enchantBtn.style.cursor = 'not-allowed';
        actions.appendChild(enchantBtn);
        
        // Gems button (placeholder)
        const gemsBtn = document.createElement('button');
        gemsBtn.className = 'btn-secondary btn-tiny';
        gemsBtn.textContent = '💎 Gems';
        gemsBtn.title = 'Add Gems (coming soon)';
        gemsBtn.style.opacity = '0.5';
        gemsBtn.style.cursor = 'not-allowed';
        actions.appendChild(gemsBtn);
        
        // Scrap button
        const scrapBtn = document.createElement('button');
        scrapBtn.className = 'btn-danger btn-tiny';
        scrapBtn.textContent = '🗑️ Destroy';
        scrapBtn.title = isAssigned ? 'Cannot scrap assigned tool' : 'Scrap tool';
        scrapBtn.disabled = isAssigned;
        scrapBtn.onclick = () => scrapToolFromPanel(tool.id);
        actions.appendChild(scrapBtn);
        
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

// Scrap tool from tools panel
function scrapToolFromPanel(toolId) {
    // Check if tool is assigned
    const assignedDwarf = dwarfs.find(d => d.toolId === toolId);
    if (assignedDwarf) {
        alert(`Cannot scrap tool #${toolId} - it is assigned to ${assignedDwarf.name}.`);
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
    
    // Trigger autosave
    saveGame();
    
    // Refresh the tools panel
    populateToolsInPanel();
    
    logTransaction('expense', 0, `Scrapped ${tool.type} #${toolId}`);
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
        const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
        const wageOptimization = researchtree.find(r => r.id === 'wage-optimization');
        const researchLevel = wageOptimization ? (wageOptimization.level || 0) : 0;
        const researchReduction = researchLevel * RESEARCH_WAGE_OPTIMIZATION_REDUCTION;
        const increaseRate = Math.max(DWARF_WAGE_INCREASE_MIN, DWARF_WAGE_INCREASE_RATE - researchReduction);
        const dwarfLevel = (currentLevel || 1) - 1;
        const wage = DWARF_BASE_WAGE * (1 + dwarfLevel * increaseRate);
        
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
    const xpNeeded = DWARF_XP_PER_LEVEL * dwarf.level;
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
        <p>Increases maximum energy by ${(DWARF_LEVELUP_ENERGY_MULTIPLIER - 1) * 100}%</p>
        <p class="levelup-stats">Current: ${dwarf.maxEnergy || 100} → New: ${Math.floor((dwarf.maxEnergy || 100) * DWARF_LEVELUP_ENERGY_MULTIPLIER)}</p>
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
        <p>Increases bucket capacity by ${DWARF_LEVELUP_STRENGTH_BONUS}</p>
        <p class="levelup-stats">Current: ${4 + (dwarf.strength || 0)} → New: ${4 + (dwarf.strength || 0) + DWARF_LEVELUP_STRENGTH_BONUS}</p>
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
        const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
            break;
        case 'maxEnergy':
            actualDwarf.maxEnergy = Math.floor((actualDwarf.maxEnergy || 100) * DWARF_LEVELUP_ENERGY_MULTIPLIER);
            actualDwarf.energy = Math.min(actualDwarf.energy, actualDwarf.maxEnergy); // Cap current energy
            break;
        case 'strength':
            actualDwarf.strength = (actualDwarf.strength || 0) + DWARF_LEVELUP_STRENGTH_BONUS;
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
    const newXPNeeded = DWARF_XP_PER_LEVEL * newLevel;
    
    if (newXP >= newXPNeeded) {
        // Can level up again, refresh the modal with new level
        openLevelUpModal(actualDwarf);
    } else {
        // Check if there are other dwarfs that can level up
        const dwarfsCanLevelUp = dwarfs.filter(d => {
            const currentXP = d.xp || 0;
            const currentLevel = d.level || 1;
            const xpNeeded = DWARF_XP_PER_LEVEL * currentLevel;
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
    const sellBtn = ev.target.closest('.btn-sell, .btn-sell-all');
    if (!sellBtn) return;
    
    const materialId = sellBtn.dataset.materialId;
    const sellAmount = parseInt(sellBtn.dataset.sellAmount, 10);
    
    if (materialId && !isNaN(sellAmount)) {
        console.log(`Sell button clicked: ${materialId} x${sellAmount}`);
        sellMaterial(materialId, sellAmount);
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
        
        let iconsText = '';
        const tooltipParts = [];
        if (isInput) {
            iconsText += '🔧';
            tooltipParts.push('Used in smelter recipes');
        }
        if (isOutput) {
            iconsText += '♨️';
            tooltipParts.push('Produced by smelter');
        }
        icons.textContent = iconsText;
        if (tooltipParts.length > 0) {
            icons.title = tooltipParts.join(' | ');
        }
        
        const buttons = document.createElement('span');
        buttons.className = 'wh-col-actions';
        
        const sell1Btn = document.createElement('button');
        sell1Btn.className = 'btn-sell';
        sell1Btn.textContent = '1';
        sell1Btn.dataset.materialId = id;
        sell1Btn.dataset.sellAmount = '1';
        
        const sellAllBtn = document.createElement('button');
        sellAllBtn.className = 'btn-sell-all';
        sellAllBtn.textContent = 'all';
        sellAllBtn.dataset.materialId = id;
        
        buttons.appendChild(sell1Btn);
        buttons.appendChild(sellAllBtn);
        
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
    const betterTrading = researchtree.find(r => r.id === 'trading');
    const tradeBonus = betterTrading ? 1 + (betterTrading.level || 0) * 0.03 : 1;
    
    // Get materials that are used as smelter inputs
    const smelterInputMaterials = new Set();
    for (const task of smelterTasks) {
        if (task.input && task.input.material) {
            smelterInputMaterials.add(task.input.material);
        }
    }
    
    // Calculate total stock value and update rows
    let totalStockValue = 0;
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
            
            if (!smelterInputMaterials.has(id)) {
                hasNotCraftableMaterials = true;
            }
            
            // Show row and update values
            row.style.display = '';
            
            const worthSpan = row.querySelector('.wh-col-price');
            worthSpan.textContent = actualWorth.toFixed(2);
            worthSpan.title = tradeBonus > 1 ? `Base: ${m.worth.toFixed(2)} gold (${tradeBonus.toFixed(2)}x bonus)` : `${m.worth.toFixed(2)} gold each`;
            
            row.querySelector('.wh-col-count').textContent = count.toFixed(1);
            row.querySelector('.wh-col-total').textContent = Math.round(count * actualWorth).toString();
            
            // Update sell button tooltips and data
            const sell1Btn = row.querySelector('.btn-sell');
            sell1Btn.title = `Sell 1 ${m.name} for ${actualWorth.toFixed(2)} gold`;
            
            const sellAllBtn = row.querySelector('.btn-sell-all');
            sellAllBtn.title = `Sell all ${count} ${m.name} for ${(count * actualWorth).toFixed(2)} gold`;
            sellAllBtn.dataset.sellAmount = count.toString();
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
    
    // Update header buttons and total value
    const header = panel.querySelector('.materials-panel-header');
    let sellAllHeaderBtn = document.getElementById('sell-all-header-btn');
    let sellNotCraftableBtn = document.getElementById('sell-not-craftable-btn');
    let totalValueSpan = document.getElementById('total-stock-value');
    
    if (header) {
        // Update or create total value display
        if (!totalValueSpan) {
            totalValueSpan = document.createElement('span');
            totalValueSpan.id = 'total-stock-value';
            totalValueSpan.style.cssText = 'font-size: 13px; color: #ffd700; font-weight: 600; margin-left: auto;';
            header.appendChild(totalValueSpan);
        }
        totalValueSpan.textContent = hasAnyMaterials ? `💰 ${Math.round(totalStockValue)}` : '';
        
        // Create or update Sell All button
        if (hasAnyMaterials) {
            if (!sellAllHeaderBtn) {
                sellAllHeaderBtn = document.createElement('button');
                sellAllHeaderBtn.id = 'sell-all-header-btn';
                sellAllHeaderBtn.className = 'btn-sell-all-global';
                sellAllHeaderBtn.textContent = 'Sell All';
                sellAllHeaderBtn.onclick = sellAllMaterials;
                header.insertBefore(sellAllHeaderBtn, totalValueSpan);
            }
        } else if (sellAllHeaderBtn) {
            sellAllHeaderBtn.remove();
        }
        
        // Create or update Sell Non-Craftables button
        if (hasNotCraftableMaterials) {
            if (!sellNotCraftableBtn) {
                sellNotCraftableBtn = document.createElement('button');
                sellNotCraftableBtn.id = 'sell-not-craftable-btn';
                sellNotCraftableBtn.className = 'btn-sell-all-global';
                sellNotCraftableBtn.textContent = 'Sell Non-Craftables';
                sellNotCraftableBtn.title = 'Sell all materials that cannot be used in the smelter';
                sellNotCraftableBtn.onclick = sellNotCraftableMaterials;
                header.insertBefore(sellNotCraftableBtn, totalValueSpan);
            }
        } else if (sellNotCraftableBtn) {
            sellNotCraftableBtn.remove();
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
            
            // Log individual material transaction
            logTransaction('income', goldForThisMaterial, `Sold ${count}x ${m.name}`);
            
            materialsStock[id] = 0;
        }
    }
    
    if (totalItems > 0) {
        gold += totalGold;
        console.log(`Sold all materials (${totalItems} items) for ${totalGold.toFixed(2)} gold`);
        
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
    
    let totalGold = 0;
    let totalItems = 0;
    
    for (const m of materials) {
        const id = m.id;
        // Skip materials that are used as smelter inputs
        if (smelterInputMaterials.has(id)) continue;
        
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
        console.log(`Sold not-craftable materials (${totalItems} items) for ${totalGold.toFixed(2)} gold`);
        
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
                    populateDwarfsInPanel();
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
                
                // Update research modal if it's open and research is active
                const researchModal = document.getElementById('research-modal');
                if (researchModal && researchModal.getAttribute('aria-hidden') === 'false' && activeResearch) {
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
        const researchCost = activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, activeResearch.level);
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
                researchtree: researchtree
            }
        });
    }
    
    // Update UI
    updateGridDisplay();
    updateGoldDisplay();
    populateDwarfsInPanel();
    updateStockPanel();
    populateResearch();
    
    // Save game
    saveGame();
    
    console.log(`Cheat activated! Depth: ${startX}, Gold: +5000, Materials: +5 each, Dwarfs: reset to home with XP`);
    alert(`Cheat activated!\n\nDepth doubled to: ${startX}\nGold +5000\n+5 of each material\nActive research near completion\nAll dwarfs reset to home with XP bonus`);
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