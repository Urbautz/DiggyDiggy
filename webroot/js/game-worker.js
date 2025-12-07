// Web Worker for game tick calculations
// This worker handles all the heavy computation for the game tick,
// preventing UI blocking during dwarf actions and grid updates.

const DEFAULT_LOOP_INTERVAL_MS = 400;

let grid = [];
let dwarfs = [];
let materials = [];
let tools = [];
let gridWidth = 10;
let gridDepth = 11;
let visibleDepth = 10;
let startX = 0;
let materialsStock = {};
let bucketCapacity = 4;
let dropOff = null;
let house = null;
let research = null;
let smelter = null;
let smelterTasks = [];
let dropGridStartX = 10;
let gold = 1000;
let toolsInventory = [];
let activeResearch = null;
let researchtree = [];
let pendingTransactions = []; // Queue of transactions to send to main thread

// Reservation maps (coordinate -> dwarf name who reserved the cell)
const reservedDigBy = new Map();
let researchReservedBy = null; // Track which dwarf name has reserved the research cell
let smelterReservedBy = null; // Track which dwarf name has reserved the smelter

// Stuck detection tracking
const stuckTracking = new Map(); // dwarf -> { x, y, hardness, ticks }

// Failsafe tick counter
let failsafeTickCounter = 0;

// Game loop state
let gameLoopIntervalId = null;
let gamePaused = false;

function coordKey(x, y) {
    return `${x},${y}`;
}

function isCellOccupiedByStanding(x, y) {
    return dwarfs.some(d => d.x === x && d.y === y && d.status !== 'moving');
}

function isReservedForDig(x, y) {
    return reservedDigBy.has(coordKey(x, y));
}

function getMaterialById(id) {
    return materials.find(m => m.id === id) || null;
}

// Check if a smelter task is unlocked by research
function isSmelterTaskUnlocked(task) {
    if (!task.requires) return true; // No requirement, always unlocked
    const requiredResearch = researchtree.find(r => r.id === task.requires);
    if (!requiredResearch) return true; // Research not found, assume unlocked
    return (requiredResearch.level || 0) >= 1;
}

// Check if the smelter has any actionable work (not "do nothing" as first task, and has materials)
function smelterHasWork() {
    if (!smelterTasks || smelterTasks.length === 0) return false;
    
    // Check each task in priority order
    for (const task of smelterTasks) {
        if (task.id === 'do-nothing') {
            // If "do nothing" is encountered, stop checking
            return false;
        }
        // Check if task is unlocked
        if (!isSmelterTaskUnlocked(task)) {
            continue; // Skip locked tasks
        }
        if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                return true; // Found a task with enough materials
            }
        }
    }
    return false;
}

// Find the first actionable smelter task
function findActionableSmelterTask() {
    if (!smelterTasks || smelterTasks.length === 0) return null;
    
    for (const task of smelterTasks) {
        if (task.id === 'do-nothing') {
            return null; // Stop at "do nothing"
        }
        // Check if task is unlocked
        if (!isSmelterTaskUnlocked(task)) {
            continue; // Skip locked tasks
        }
        if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                return task;
            }
        }
    }
    return null;
}

function getDwarfToolPower(dwarf) {
    const baseDwarfPower = 3; // dwarf's base damage
    
    if (!dwarf.toolId) return baseDwarfPower; // default power if no tool
    
    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance) return baseDwarfPower;
    
    const toolDef = tools.find(t => t.name === toolInstance.type);
    if (!toolDef) return baseDwarfPower;
    
    // Calculate power: base dwarf power + tool power with bonuses
    const toolBonus = 1 + (toolInstance.level - 1) * 0.1;
    const dwarfBonus = 1 + (dwarf.digPower || 0) * 0.1;
    
    // Apply improved-digging research bonus (1% per level)
    const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
    const researchBonus = improvedDigging ? 1 + (improvedDigging.level || 0) * 0.01 : 1;
    
    return baseDwarfPower + (toolDef.power * toolBonus * dwarfBonus * researchBonus);
}

function calculateWage(dwarf) {
    // Base wage is 0.01 gold per dig
    const baseWage = 0.01;
    
    // Get wage optimization research level (reduces increase by 1% per level)
    const wageOptimization = researchtree.find(r => r.id === 'wage-optimization');
    const researchLevel = wageOptimization ? (wageOptimization.level || 0) : 0;
    
    // Calculate wage increase rate: starts at 25%, reduced by 1% per research level (minimum 5%)
    const baseIncreaseRate = 0.25;
    const researchReduction = researchLevel * 0.01;
    const increaseRate = Math.max(0.05, baseIncreaseRate - researchReduction);
    
    // Calculate wage based on dwarf level: baseWage * (1 + level * increaseRate)
    const dwarfLevel = (dwarf.level || 1) - 1; // Level 1 has no increase, level 2 has 1x increase, etc.
    const wage = baseWage * (1 + dwarfLevel * increaseRate);
    
    return wage;
}

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

function scheduleMove(dwarf, targetX, targetY) {
    let finalY = targetY;
    if (typeof visibleDepth === 'number' && finalY >= visibleDepth) {
        let found = -1;
        for (let ry = 0; ry < Math.min(visibleDepth, grid.length); ry++) {
            const cell = grid[ry] && grid[ry][targetX];
            if (cell && cell.hardness > 0) {
                found = ry;
                break;
            }
        }
        if (found !== -1) {
            finalY = found;
            //console.log(`Adjusting move target to visible row ${finalY} for dwarf ${dwarf.name} (original ${targetY})`);
        } else {
            //console.log(`No visible target found in column ${targetX} for dwarf ${dwarf.name}; not scheduling`);
            return false;
        }
    }

    dwarf.moveTarget = { x: targetX, y: finalY };
    dwarf.status = 'moving';
    return true;
}

function checkAndShiftTopRows() {
    let removed = 0;
    while (grid.length > 0) {
        const top = grid[0];
        if (!top) break;
        const allEmpty = top.every(cell => !cell || Number(cell.hardness) <= 0);
        if (!allEmpty) break;

        grid.shift();
        removed += 1;

        const newRow = [];
        // Calculate the depth level for the new row at the bottom
        const newRowDepth = startX + grid.length + 1;
        for (let c = 0; c < gridWidth; c++) {
            let mat;
            
            // Check left tile (50% chance to use same material)
            if (c > 0 && Math.random() < 0.5) {
                const leftCell = newRow[c - 1];
                if (leftCell && leftCell.materialId) {
                    const leftMat = materials.find(m => m.id === leftCell.materialId);
                    if (leftMat) {
                        mat = leftMat;
                    }
                }
            }
            
            // Check above tile (50% chance to use same material if not air/empty)
            if (!mat && grid.length > 0 && Math.random() < 0.5) {
                const aboveCell = grid[grid.length - 1][c];
                if (aboveCell && aboveCell.materialId && aboveCell.hardness > 0) {
                    const aboveMat = materials.find(m => m.id === aboveCell.materialId);
                    if (aboveMat) {
                        mat = aboveMat;
                    }
                }
            }
            
            // If no clustering, use random based on depth
            if (!mat) {
                mat = randomMaterial(newRowDepth);
            }
            
            newRow.push({ materialId: mat.id, hardness: mat.hardness });
        }
        grid.push(newRow);

        if (typeof startX === 'number') startX += 1;

        for (const d of dwarfs) {
            d.y = Math.max(0, d.y - 1);
            if (d.moveTarget && typeof d.moveTarget.y === 'number') {
                d.moveTarget.y = Math.max(0, d.moveTarget.y - 1);
            }
        }

        const shiftMap = (map) => {
            const entries = Array.from(map.entries());
            map.clear();
            for (const [k, v] of entries) {
                const [kx, ky] = k.split(',').map(Number);
                const ny = ky - 1;
                if (ny >= 0) map.set(coordKey(kx, ny), v);
            }
        };
        shiftMap(reservedDigBy);
    }

    if (removed > 0) {
       // console.log(`checkAndShiftTopRows: removed ${removed} top row(s), new startX=${startX}`);
    }
    return removed > 0;
}

function attemptCollapse(x, y) {
    //console.log(`attemptColumnCollapse(${x},${y})`);

    const ux = x;
    let scanY = y - 1;
    if (scanY < 0) return;

    if (!grid[scanY]) return;
    const aboveCell = grid[scanY][x];
    if (!aboveCell || aboveCell.hardness <= 0) return;

    while (scanY >= 0) {
        const src = grid[scanY][ux];
        const dstY = scanY + 1;
        const dst = grid[dstY] && grid[dstY][ux];

        if (!src || src.hardness <= 0) break;
        if (!dst || dst.hardness > 0) break;

        //console.log(`Collapse: moving cell (${ux},${scanY}) down to (${ux},${dstY})`);
        grid[dstY][ux] = { materialId: src.materialId, hardness: src.hardness };
        grid[scanY][ux] = { materialId: src.materialId, hardness: 0 };

        for (const d of dwarfs) {
            if (d.x === ux && d.y === scanY) {
                d.y = dstY;
               // console.log(`Dwarf ${d.name} fell from (${ux},${scanY}) to (${ux},${dstY})`);
            }
        }

        const srcKey = coordKey(ux, scanY);
        if (reservedDigBy.get(srcKey)) reservedDigBy.delete(srcKey);

        scanY -= 1;
    }
}

function actForDwarf(dwarf) {
    attemptCollapse(dwarf.x, dwarf.y);
    if (!dwarf.status) dwarf.status = 'idle';
    if (typeof dwarf.energy !== 'number') dwarf.energy = 1000;
    if (!('moveTarget' in dwarf)) dwarf.moveTarget = null;

    // Check for stuck dwarf
    const cellHardness = (grid[dwarf.y] && grid[dwarf.y][dwarf.x]) ? grid[dwarf.y][dwarf.x].hardness : 0;
    const trackKey = dwarf.name; // Use name as unique key
    const tracked = stuckTracking.get(trackKey);
    
    if (tracked) {
        // Check if position or hardness changed
        if (tracked.x !== dwarf.x || tracked.y !== dwarf.y || tracked.hardness !== cellHardness) {
            // Dwarf moved or made progress, reset tracking
            stuckTracking.set(trackKey, { x: dwarf.x, y: dwarf.y, hardness: cellHardness, ticks: 0 });
        } else {
            // Same position and hardness, increment stuck counter
            tracked.ticks++;
            if (tracked.ticks >= 10) {
                // Stuck for 10 ticks! Teleport to house and reset
                console.log(`Dwarf ${dwarf.name} stuck for ${tracked.ticks} ticks, teleporting to house`);
                dwarf.x = house.x;
                dwarf.y = house.y;
                dwarf.status = 'idle';
                dwarf.moveTarget = null;
                // Clear any reservations
                for (const [key, val] of reservedDigBy.entries()) {
                    if (val === dwarf.name) reservedDigBy.delete(key);
                }
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                stuckTracking.delete(trackKey);
                return;
            }
        }
    } else {
        // First time tracking this dwarf
        stuckTracking.set(trackKey, { x: dwarf.x, y: dwarf.y, hardness: cellHardness, ticks: 0 });
    }

    //console.log(`Dwarf ${dwarf.name} is acting at (${dwarf.x}, ${dwarf.y}) status=${dwarf.status}`);

    // Failsafe: Release smelter reservation if dwarf is at house and not actively working
    if (typeof house === 'object' && house !== null && dwarf.x === house.x && dwarf.y === house.y) {
        if (dwarf.status !== 'resting' && dwarf.status !== 'idle' && smelterReservedBy === dwarf.name) {
            smelterReservedBy = null;
        }
    }

    // Low energy handling
    if (typeof house === 'object' && house !== null && typeof dwarf.energy === 'number' && dwarf.energy < 25) {
        if (dwarf.x === house.x && dwarf.y === house.y) {
            if (dwarf.status !== 'resting') {
                dwarf.status = 'resting';
            }
        }
        if (!(dwarf.x === house.x && dwarf.y === house.y)) {
            if (!dwarf.moveTarget || dwarf.moveTarget.x !== house.x || dwarf.moveTarget.y !== house.y) {
                // Release reservations if dwarf was heading elsewhere
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                scheduleMove(dwarf, house.x, house.y);
                dwarf.status = 'moving';
                return;
            }
        }
    }

    // Resting state
    if (dwarf.status === 'resting') {
        const maxEnergy = dwarf.maxEnergy || 100;
        // Apply better-housing research bonus with diminishing returns
        // Formula: bonus = level * 10% / (1 + level * 0.15)
        // This gives: lvl 1=8.7%, lvl 2=15.4%, lvl 3=20%, lvl 4=23.5%, lvl 5=26%, lvl 10=33%
        const betterHousing = researchtree.find(r => r.id === 'better-housing');
        const housingLevel = betterHousing ? (betterHousing.level || 0) : 0;
        const restBonus = housingLevel > 0 ? 1 + (housingLevel * 0.1) / (1 + housingLevel * 0.15) : 1;
        const restAmount = 25 * restBonus;
        dwarf.energy = Math.min(maxEnergy, (dwarf.energy || 0) + restAmount);
        if (dwarf.energy >= maxEnergy) {
            dwarf.status = 'idle';
            dwarf.energy = maxEnergy;
            
            // After resting, check for special tasks (50% chance, evenly split)
            const canResearch = activeResearch && !researchReservedBy && typeof research === 'object' && research !== null;
            const canSmelt = smelterHasWork() && !smelterReservedBy && typeof smelter === 'object' && smelter !== null;
            
            if ((canResearch || canSmelt) && Math.random() < 0.5) {
                if (canResearch && canSmelt) {
                    // Both available - 50/50 split
                    if (Math.random() < 0.5) {
                        researchReservedBy = dwarf.name;
                        scheduleMove(dwarf, research.x, research.y);
                        return;
                    } else {
                        smelterReservedBy = dwarf.name;
                        scheduleMove(dwarf, smelter.x, smelter.y);
                        return;
                    }
                } else if (canResearch) {
                    researchReservedBy = dwarf.name;
                    scheduleMove(dwarf, research.x, research.y);
                    return;
                } else {
                    smelterReservedBy = dwarf.name;
                    scheduleMove(dwarf, smelter.x, smelter.y);
                    return;
                }
            }
        }
        return;
    }

    // Researching state
    if (dwarf.status === 'researching') {
        // Check if at research location
        if (typeof research === 'object' && research !== null && dwarf.x === research.x && dwarf.y === research.y) {
            // Check if there's an active research
            if (!activeResearch) {
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                dwarf.status = 'idle';
                return;
            }
            
            // Check if dwarf has enough energy
            if (dwarf.energy < 10) {
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                dwarf.status = 'idle';
                return;
            }
            
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - strike chance reduced by union-busting research
                const unionBusting = researchtree.find(r => r.id === 'union-busting');
                const continueWorkChance = 0.1 + ((unionBusting ? unionBusting.level : 0) * 0.05);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            
            // Pay the dwarf, consume energy and generate research point
            gold = Math.max(0, gold - wage);
            pendingTransactions.push({ type: 'expense', amount: wage, description: 'Research wage for ' + dwarf.name });
            dwarf.energy = Math.max(0, dwarf.energy - 10);
            if (activeResearch.progress === undefined) {
                activeResearch.progress = 0;
            }
            // Base 1 point + wisdom bonus
            const researchPoints = 1 + (dwarf.wisdom || 0);
            activeResearch.progress += researchPoints;
            //console.log(`Dwarf ${dwarf.name} generated ${researchPoints} research points (wisdom: ${dwarf.wisdom || 0})`);
            
            // Check if research is complete (cost doubles each level)
            const actualCost = activeResearch.cost * Math.pow(2, activeResearch.level || 0);
            if (activeResearch.progress >= actualCost) {
                const completedResearch = activeResearch;
                completedResearch.level = (completedResearch.level || 0) + 1;
                completedResearch.progress = 0;
                
                // Find and update in researchtree
                const treeItem = researchtree.find(r => r.id === completedResearch.id);
                if (treeItem) {
                    treeItem.level = completedResearch.level;
                    treeItem.progress = 0;
                }
                
                // Clear active research and release reservation
                activeResearch = null;
                if (researchReservedBy === dwarf.name) {
                    researchReservedBy = null;
                    //console.log(`Research reservation released by ${dwarf.name}`);
                }
                dwarf.status = 'idle';
                console.log(`Research completed: ${completedResearch.name} (Level ${completedResearch.level})`);
            }
            return;
        } else {
            // Not at research location, release reservation and become idle
            if (researchReservedBy === dwarf.name) researchReservedBy = null;
            dwarf.status = 'idle';
        }
    }

    // Smelting state
    if (dwarf.status === 'smelting') {
        // Check if at smelter location
        if (typeof smelter === 'object' && smelter !== null && dwarf.x === smelter.x && dwarf.y === smelter.y) {
            // Check if dwarf has enough energy
            if (dwarf.energy < 10) {
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                dwarf.status = 'idle';
                return;
            }
            
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - strike chance reduced by union-busting research
                const unionBusting = researchtree.find(r => r.id === 'union-busting');
                const continueWorkChance = 0.1 + ((unionBusting ? unionBusting.level : 0) * 0.05);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            
            // Find an actionable task from the priority list
            const task = findActionableSmelterTask();
            if (!task) {
                // No work available, release smelter and become idle
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                dwarf.status = 'idle';
                return;
            }
            
            // Perform the smelting action
            const inputMaterial = task.input.material;
            const inputAmount = task.input.amount;
            const outputMaterial = task.output.material;
            const outputAmount = task.output.amount;
            
            // Consume input materials
            materialsStock[inputMaterial] = (materialsStock[inputMaterial] || 0) - inputAmount;
            
            // Check for break chance (for polishing tasks)
            let success = true;
            if (task.breakChance && task.breakChance > 0) {
                // Get stone polishing research level
                const stonePolishing = researchtree.find(r => r.id === 'stone-polishing');
                const polishingLevel = stonePolishing ? (stonePolishing.level || 0) : 0;
                
                // Calculate actual break chance: base 50% reduced by 8% per level
                const breakReduction = polishingLevel * 0.08;
                const actualBreakChance = Math.max(0, task.breakChance - breakReduction);
                
                // Roll for success
                success = Math.random() >= actualBreakChance;
            }
            
            // Produce output materials only if successful (or no break chance)
            if (success) {
                materialsStock[outputMaterial] = (materialsStock[outputMaterial] || 0) + outputAmount;
                //console.log(`Dwarf ${dwarf.name} successfully smelted ${inputAmount}x ${inputMaterial} into ${outputAmount}x ${outputMaterial}`);
            } else {
                //console.log(`Dwarf ${dwarf.name} broke ${inputAmount}x ${inputMaterial} while trying to polish it!`);
            }
            
            // Pay the dwarf, consume energy and award XP
            gold = Math.max(0, gold - wage);
            pendingTransactions.push({ type: 'expense', amount: wage, description: 'Smelter wage for ' + dwarf.name });
            dwarf.energy = Math.max(0, dwarf.energy - 10);
            dwarf.xp = (dwarf.xp || 0) + 1;
            
            //console.log(`Dwarf ${dwarf.name} smelted ${inputAmount}x ${inputMaterial} into ${outputAmount}x ${outputMaterial}`);
            return;
        } else {
            // Not at smelter location, release reservation and become idle
            if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
            dwarf.status = 'idle';
        }
    }

    // Striking state - dwarf refuses to work without pay
    if (dwarf.status === 'striking') {
        // Check if there's gold available now
        if (gold >= 0.01) {
            // Gold available, go back to idle and resume work
            dwarf.status = 'idle';
        }
        return;
    }

    // Full bucket handling
    const bucketTotal = dwarf.bucket ? Object.values(dwarf.bucket).reduce((a, b) => a + b, 0) : 0;
    // Apply bucket research bonus (1 capacity per level)
    const bucketResearch = researchtree.find(r => r.id === 'buckets');
    const bucketBonus = bucketResearch ? (bucketResearch.level || 0) : 0;
    const dwarfCapacity = bucketCapacity + bucketBonus + (dwarf.strength || 0);
    if (typeof bucketCapacity === 'number' && bucketTotal >= dwarfCapacity) {
        if (dwarf.x === dropOff.x && dwarf.y === dropOff.y) {
            if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0) {
                if (dwarf.status !== 'unloading') {
                    dwarf.status = 'unloading';
                    return;
                }

                for (const [mat, cnt] of Object.entries(dwarf.bucket)) {
                    materialsStock[mat] = (materialsStock[mat] || 0) + cnt;
                }
                //console.log(`Dwarf ${dwarf.name} finished unloading ${JSON.stringify(dwarf.bucket)} at drop-off`);
                dwarf.bucket = {};
                dwarf.status = 'idle';

                try {
                    if (Array.isArray(grid) && grid.length > 0) {
                        let rowIdx = Math.min(dwarf.y, grid.length - 1);
                        const row = grid[rowIdx] || [];
                        let chosen = -1;
                        for (let offset = 0; offset < row.length; offset++) {
                            const c = (Math.floor(row.length / 2) + offset) % row.length;
                            if (row[c] && row[c].hardness > 0 && (!reservedDigBy.get(coordKey(c, rowIdx)) || reservedDigBy.get(coordKey(c, rowIdx)) === dwarf.name)) {
                                chosen = c;
                                break;
                            }
                        }
                        if (chosen === -1) {
                            outer: for (let ry = 0; ry < grid.length; ry++) {
                                const r = grid[ry];
                                for (let cx = 0; cx < (r ? r.length : 0); cx++) {
                                    if (r && r[cx] && r[cx].hardness > 0 && (!reservedDigBy.get(coordKey(cx, ry)) || reservedDigBy.get(coordKey(cx, ry)) === dwarf.name)) {
                                        chosen = cx;
                                        rowIdx = ry;
                                        break outer;
                                    }
                                }
                            }
                        }
                        if (chosen !== -1) {
                            if (typeof dwarf.energy === 'number' && dwarf.energy < 25 && typeof house === 'object') {
                                scheduleMove(dwarf, house.x, house.y);
                                //console.log(`Dwarf ${dwarf.name} low energy after unload -> heading to house at (${house.x},${house.y})`);
                            } else {
                                // Determine available special tasks
                                const canResearch = activeResearch && !researchReservedBy && typeof research === 'object' && research !== null;
                                const canSmelt = smelterHasWork() && !smelterReservedBy && typeof smelter === 'object' && smelter !== null;
                                
                                // 50% chance to do special task if available, evenly split between research and smelting
                                if ((canResearch || canSmelt) && Math.random() < 0.5) {
                                    if (canResearch && canSmelt) {
                                        // Both available - 50/50 split
                                        if (Math.random() < 0.5) {
                                            researchReservedBy = dwarf.name;
                                            scheduleMove(dwarf, research.x, research.y);
                                            dwarf.status = 'moving';
                                        } else {
                                            smelterReservedBy = dwarf.name;
                                            scheduleMove(dwarf, smelter.x, smelter.y);
                                            dwarf.status = 'moving';
                                        }
                                    } else if (canResearch) {
                                        researchReservedBy = dwarf.name;
                                        scheduleMove(dwarf, research.x, research.y);
                                        dwarf.status = 'moving';
                                    } else {
                                        smelterReservedBy = dwarf.name;
                                        scheduleMove(dwarf, smelter.x, smelter.y);
                                        dwarf.status = 'moving';
                                    }
                                } else {
                                    scheduleMove(dwarf, chosen, rowIdx);
                                    //console.log(`Dwarf ${dwarf.name} returning from drop-off to (${chosen},${rowIdx})`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error scheduling return from drop-off', e);
                }
            }
            return;
        }

        if (!dwarf.moveTarget || dwarf.moveTarget.x !== dropOff.x || dwarf.moveTarget.y !== dropOff.y) {
            const scheduled = scheduleMove(dwarf, dropOff.x, dropOff.y);
            if (scheduled) {
                // Release research reservation if dwarf was heading there
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                // Release smelter reservation if dwarf was heading there
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                //console.log(`Dwarf ${dwarf.name} is full (bucket=${bucketTotal}) and heading to drop-off at (${dropOff.x},${dropOff.y})`);
                return;
            }
        }
    }

    // Guard: ensure grid is available
    if (!Array.isArray(grid) || grid.length === 0) {
        console.warn('Grid not initialized yet');
        return;
    }

    const rowIndex = dwarf.y;
    const originalX = dwarf.x;
    if (typeof rowIndex !== 'number' || rowIndex < 0 || rowIndex >= grid.length) {
        console.warn(`Dwarf ${dwarf.name} has invalid y=${rowIndex}`);
        return;
    }

    const power = getDwarfToolPower(dwarf);

    const row = grid[rowIndex];
    
    // Check if dwarf is at research location BEFORE accessing grid cells (research is outside main grid)
    if (dwarf.status === 'idle' && typeof research === 'object' && research !== null && 
        dwarf.x === research.x && dwarf.y === research.y && activeResearch && dwarf.energy >= 10) {
        // Only start researching if this dwarf has reserved it or it's not reserved
        if (researchReservedBy === dwarf.name || !researchReservedBy) {
            researchReservedBy = dwarf.name;
            dwarf.status = 'researching';
            //console.log(`Dwarf ${dwarf.name} started researching at (${dwarf.x},${dwarf.y})`);
            return;
        }
    }
    
    // Check if dwarf is at smelter location BEFORE accessing grid cells (smelter is outside main grid)
    if (dwarf.status === 'idle' && typeof smelter === 'object' && smelter !== null && 
        dwarf.x === smelter.x && dwarf.y === smelter.y && smelterHasWork() && dwarf.energy >= 10) {
        // Only start smelting if this dwarf has reserved it or it's not reserved
        if (smelterReservedBy === dwarf.name || !smelterReservedBy) {
            smelterReservedBy = dwarf.name;
            dwarf.status = 'smelting';
            //console.log(`Dwarf ${dwarf.name} started smelting at (${dwarf.x},${dwarf.y})`);
            return;
        }
    }
    
    const curCell = row[originalX];

    let movedDownByChance = false;
    let skipHorizontalScan = false;

    // Idle dwarf - check for special tasks (research or smelting)
    // Use a single random check, then evenly distribute between available tasks
    if (dwarf.status === 'idle' && dwarf.energy >= 10) {
        const canResearch = activeResearch && !researchReservedBy && typeof research === 'object' && research !== null;
        const canSmelt = smelterHasWork() && !smelterReservedBy && typeof smelter === 'object' && smelter !== null;
        
        // 50% chance to do special task if available
        if ((canResearch || canSmelt) && Math.random() < 0.5) {
            let chooseResearch = false;
            if (canResearch && canSmelt) {
                // Both available - 50/50 split
                chooseResearch = Math.random() < 0.5;
            } else {
                chooseResearch = canResearch;
            }
            
            if (chooseResearch) {
                // Check if already at research location
                if (dwarf.x !== research.x || dwarf.y !== research.y) {
                    if (!dwarf.moveTarget || dwarf.moveTarget.x !== research.x || dwarf.moveTarget.y !== research.y) {
                        researchReservedBy = dwarf.name;
                        scheduleMove(dwarf, research.x, research.y);
                        return;
                    }
                }
            } else if (canSmelt) {
                // Check if already at smelter location
                if (dwarf.x !== smelter.x || dwarf.y !== smelter.y) {
                    if (!dwarf.moveTarget || dwarf.moveTarget.x !== smelter.x || dwarf.moveTarget.y !== smelter.y) {
                        smelterReservedBy = dwarf.name;
                        scheduleMove(dwarf, smelter.x, smelter.y);
                        return;
                    }
                }
            }
        }
    }

    // Idle dwarf on cell with hardness - start digging (but not at research location if research is active)
    if (dwarf.status === 'idle' && curCell && curCell.hardness > 0 && 
        !(activeResearch && typeof research === 'object' && research !== null && dwarf.x === research.x && dwarf.y === research.y)) {
        const curKey = coordKey(dwarf.x, dwarf.y);
        if (!reservedDigBy.get(curKey) || reservedDigBy.get(curKey) === dwarf.name) {
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - strike chance reduced by union-busting research
                const unionBusting = researchtree.find(r => r.id === 'union-busting');
                const continueWorkChance = 0.1 + ((unionBusting ? unionBusting.level : 0) * 0.05);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            reservedDigBy.set(curKey, dwarf.name);
            dwarf.status = 'digging';
            const prev = curCell.hardness;
            dwarf.energy = Math.max(0, (typeof dwarf.energy === 'number' ? dwarf.energy : 1000) - 5);
            gold = Math.max(0, gold - wage); // Deduct payment for digging
            pendingTransactions.push({ type: 'expense', amount: wage, description: `Payment to ${dwarf.name}` });
            dwarf.xp = (dwarf.xp || 0) + 1; // Award 1 XP for digging
            
            // Check for critical hit (5% base + 5% per research level)
            const materialScience = researchtree.find(r => r.id === 'material-science');
            const critChance = 0.05 + ((materialScience ? materialScience.level : 0) * 0.05);
            const isCrit = Math.random() < critChance;
            let finalPower = isCrit ? power * 2 : power;
            
            // Check for expertise one-hit on critical
            if (isCrit) {
                const mat = materials.find(m => m.id === curCell.materialId);
                const matType = mat ? mat.type : '';
                const isStone = matType.startsWith('Stone');
                const isOre = matType.startsWith('Ore');
                
                const stoneExpertise = researchtree.find(r => r.id === 'expertise-stone');
                const oreExpertise = researchtree.find(r => r.id === 'expertise-ore');
                
                let oneHitChance = 0;
                let expertiseType = null;
                
                if (isStone && stoneExpertise && stoneExpertise.level > 0) {
                    oneHitChance = stoneExpertise.level * 0.02; // 2% per level
                    expertiseType = 'Stone';
                } else if (isOre && oreExpertise && oreExpertise.level > 0) {
                    oneHitChance = oreExpertise.level * 0.03; // 3% per level
                    expertiseType = 'Ore';
                }
                
                if (oneHitChance > 0 && Math.random() < oneHitChance) {
                    finalPower = curCell.hardness; // One-hit!
                    console.log(`💥 CRITICAL ONE-HIT! ${dwarf.name} used ${expertiseType} Expertise to instantly destroy ${mat ? mat.name : curCell.materialId}!`);
                    pendingTransactions.push({ type: 'one-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name, material: mat ? mat.name : curCell.materialId });
                } else {
                   // console.log(`⚡ Critical hit by ${dwarf.name} on ${mat ? mat.name : curCell.materialId} (type: ${matType})`);
                    pendingTransactions.push({ type: 'crit-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name });
                }
            }
            
            curCell.hardness = Math.max(0, curCell.hardness - finalPower);
            if (curCell.hardness === 0) {
                const matId = curCell.materialId;
                dwarf.bucket = dwarf.bucket || {};
                dwarf.bucket[matId] = (dwarf.bucket[matId] || 0) + 1;
                //console.log(`Dwarf ${dwarf.name} collected 1 ${matId} into bucket -> ${dwarf.bucket[matId]}`);
            }
            //console.log(`Dwarf ${dwarf.name} started digging at (${dwarf.x},${dwarf.y}) ${prev} -> ${curCell.hardness}`);
            if (curCell.hardness === 0) {
                if (reservedDigBy.get(curKey) === dwarf.name) reservedDigBy.delete(curKey);
                dwarf.status = 'idle';
            }
            return;
        }
    }

    // Moving state
    if (dwarf.status === 'moving' && dwarf.moveTarget) {
        const tx = dwarf.moveTarget.x, ty = dwarf.moveTarget.y;
        const dx = tx - dwarf.x, dy = ty - dwarf.y;
        const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        const nextX = dwarf.x + (stepX !== 0 ? stepX : 0);
        const nextY = dwarf.y + (stepX === 0 ? stepY : 0);

        if (!Array.isArray(grid) || dwarf.y < 0 || dwarf.y >= grid.length) {
            dwarf.moveTarget = null;
            dwarf.status = 'idle';
            // Release any reservations when movement fails
            if (researchReservedBy === dwarf.name) researchReservedBy = null;
            if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
        } else {
            dwarf.x = nextX;
            dwarf.y = nextY;
            dwarf.energy = Math.max(0, (typeof dwarf.energy === 'number' ? dwarf.energy : 1000) - 1);
            //console.log(`Dwarf ${dwarf.name} moved to (${dwarf.x},${dwarf.y})`);
            if (dwarf.x === tx && dwarf.y === ty) {
                dwarf.moveTarget = null;
                dwarf.status = 'idle';
                // Note: Don't release reservation here - dwarf arrived at destination
                // The reservation will be used when dwarf starts working or released if work not possible
            } else {
                dwarf.status = 'moving';
            }
            return;
        }
    }

    // Digging state
    if (dwarf.status === 'digging') {
        const curKeyDig = coordKey(dwarf.x, dwarf.y);
        if (!reservedDigBy.get(curKeyDig)) reservedDigBy.set(curKeyDig, dwarf.name);
        const curCellDig = grid[dwarf.y][dwarf.x];
        if (curCellDig && curCellDig.hardness > 0) {
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - strike chance reduced by union-busting research
                const unionBusting = researchtree.find(r => r.id === 'union-busting');
                const continueWorkChance = 0.1 + ((unionBusting ? unionBusting.level : 0) * 0.05);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            const prev = curCellDig.hardness;
            dwarf.energy = Math.max(0, (typeof dwarf.energy === 'number' ? dwarf.energy : 1000) - 5);
            gold = Math.max(0, gold - wage); // Deduct payment for digging
            pendingTransactions.push({ type: 'expense', amount: wage, description: `Payment to ${dwarf.name}` });
            dwarf.xp = (dwarf.xp || 0) + 1; // Award 1 XP for digging
            
            // Check for critical hit (5% base + 5% per research level)
            const materialScience = researchtree.find(r => r.id === 'material-science');
            const critChance = 0.05 + ((materialScience ? materialScience.level : 0) * 0.05);
            const isCrit = Math.random() < critChance;
            let finalPower = isCrit ? power * 2 : power;
            
            // Check for expertise one-hit on critical
            if (isCrit) {
                const mat = materials.find(m => m.id === curCellDig.materialId);
                const matType = mat ? mat.type : '';
                const isStone = matType.startsWith('Stone');
                const isOre = matType.startsWith('Ore');
                
                const stoneExpertise = researchtree.find(r => r.id === 'expertise-stone');
                const oreExpertise = researchtree.find(r => r.id === 'expertise-ore');
                
                let oneHitChance = 0;
                let expertiseType = null;
                
                if (isStone && stoneExpertise && stoneExpertise.level > 0) {
                    oneHitChance = stoneExpertise.level * 0.02; // 2% per level
                    expertiseType = 'Stone';
                } else if (isOre && oreExpertise && oreExpertise.level > 0) {
                    oneHitChance = oreExpertise.level * 0.03; // 3% per level
                    expertiseType = 'Ore';
                }
                
                if (oneHitChance > 0 && Math.random() < oneHitChance) {
                    finalPower = curCellDig.hardness; // One-hit!
                    console.log(`💥 CRITICAL ONE-HIT! ${dwarf.name} used ${expertiseType} Expertise to instantly destroy ${mat ? mat.name : curCellDig.materialId}!`);
                    pendingTransactions.push({ type: 'one-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name, material: mat ? mat.name : curCellDig.materialId });
                } else {
                    //console.log(`⚡ Critical hit by ${dwarf.name} on ${mat ? mat.name : curCellDig.materialId} (type: ${matType})`);
                    pendingTransactions.push({ type: 'crit-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name });
                }
            }
            
            curCellDig.hardness = Math.max(0, curCellDig.hardness - finalPower);
            if (curCellDig.hardness === 0) {
                const matId = curCellDig.materialId;
                dwarf.bucket = dwarf.bucket || {};
                dwarf.bucket[matId] = (dwarf.bucket[matId] || 0) + 1;
                //console.log(`Dwarf ${dwarf.name} collected 1 ${matId} into bucket -> ${dwarf.bucket[matId]}`);
            }
            //console.log(`Dwarf ${dwarf.name} continues digging at (${dwarf.x},${dwarf.y}) ${prev} -> ${curCellDig.hardness}`);
            if (curCellDig.hardness === 0) {
                if (reservedDigBy.get(curKeyDig) === dwarf.name) reservedDigBy.delete(curKeyDig);
                dwarf.status = 'idle';
            }
            return;
        } else {
            if (reservedDigBy.get(curKeyDig) === dwarf.name) reservedDigBy.delete(curKeyDig);
            dwarf.status = 'idle';
        }
    }

    // Try moving down if current cell is empty
    if (curCell && curCell.hardness <= 0) {
        const downChance = 0.3;
        if (Math.random() < downChance) {
            const downRowIndex = rowIndex + 1;
            if (downRowIndex < grid.length) {
                const downCell = grid[downRowIndex][originalX];
                const occupiedDown = isCellOccupiedByStanding(originalX, downRowIndex);
                const downKey = coordKey(originalX, downRowIndex);
                if (downCell && downCell.hardness > 0 && !occupiedDown && !isReservedForDig(originalX, downRowIndex)) {
                    if (scheduleMove(dwarf, originalX, downRowIndex)) {
                        //console.log(`Dwarf ${dwarf.name} decided to move down from (${originalX},${rowIndex}) to (${originalX},${downRowIndex})`);
                        return;
                    } else {
                        //console.log(`Dwarf ${dwarf.name} couldn't schedule move down to (${originalX},${downRowIndex})`);
                    }
                }
            }
        }
    }

    // Search for diggable column on current row
    let foundCol = -1;
    const dir = Math.random() < 0.5 ? 1 : -1;
    if (movedDownByChance) foundCol = originalX;
    if (!skipHorizontalScan) {
        for (let offset = 0; offset < row.length; offset++) {
            const c = (originalX + dir * offset + row.length) % row.length;
            if (!(row[c] && row[c].hardness > 0)) continue;
            if (isReservedForDig(c, rowIndex) && reservedDigBy.get(coordKey(c, rowIndex)) !== dwarf.name) continue;
            if (isCellOccupiedByStanding(c, rowIndex)) {
                console.log(`Cell (${c},${rowIndex}) is occupied by a standing dwarf — skipping`);
                continue;
            }
            foundCol = c;
            break;
        }
    }

    // If no column found, try row below
    if (foundCol === -1) {
        const nextRowIndex = rowIndex + 1;
        if (nextRowIndex >= grid.length) {
            console.log(`No diggable cell found on row ${rowIndex} and no row below for dwarf ${dwarf.name}`);
            return;
        }

        const nextRow = grid[nextRowIndex];
        let foundBelow = -1;

        for (let offset = 0; offset < nextRow.length; offset++) {
            const c = (originalX + dir * offset + nextRow.length) % nextRow.length;
            if (!(nextRow[c] && nextRow[c].hardness > 0)) continue;
            if (isReservedForDig(c, nextRowIndex) && reservedDigBy.get(coordKey(c, nextRowIndex)) !== dwarf.name) continue;
            if (isCellOccupiedByStanding(c, nextRowIndex)) continue;
            foundBelow = c;
            break;
        }

        if (foundBelow === -1) {
            console.log(`No diggable cell found on row ${rowIndex} or row ${nextRowIndex} for dwarf ${dwarf.name}`);
            return;
        }

        if (scheduleMove(dwarf, foundBelow, nextRowIndex)) {
            //console.log(`Dwarf ${dwarf.name} scheduled move to (${foundBelow},${nextRowIndex})`);
            foundCol = foundBelow;
            return;
        } else {
            console.log(`Dwarf ${dwarf.name} could not schedule move to (${foundBelow},${nextRowIndex})`);
            scheduleMove(dwarf, foundBelow + 1, nextRowIndex + 1);
            return;
        }
    }

    // Schedule horizontal move
    if (foundCol !== -1 && (foundCol !== originalX || dwarf.y !== rowIndex)) {
        if (!dwarf.moveTarget) {
            if (!scheduleMove(dwarf, foundCol, dwarf.y)) {
                console.log(`Dwarf ${dwarf.name} can't reserve (${foundCol},${dwarf.y}) — already reserved or not visible`);
                return;
            }
            //console.log(`Dwarf ${dwarf.name} planning move to (${foundCol},${dwarf.y})`);
            return;
        }
    }

    // Move up if horizontal move and above cell is undug
    const prevRowIndex = rowIndex;
    if (foundCol !== originalX && prevRowIndex > 0) {
        const aboveRowIndex = prevRowIndex - 1;
        const aboveCell = grid[aboveRowIndex] && grid[aboveRowIndex][foundCol];
        const occupiedAbove = dwarfs.some(other => other !== dwarf && other.x === foundCol && other.y === aboveRowIndex);
        if (aboveCell && aboveCell.hardness > 0 && !occupiedAbove) {
            if (Math.random() < 0.7) {
                dwarf.y = aboveRowIndex;
                //console.log(`Dwarf ${dwarf.name} moved up to (${foundCol},${aboveRowIndex}) after changing x (70% roll passed)`);
            } else {
                //console.log(`Dwarf ${dwarf.name} chose NOT to move up to (${foundCol},${aboveRowIndex}) (70% roll failed)`);
            }
        } else if (aboveCell && aboveCell.hardness > 0 && occupiedAbove) {
            console.log(`Dwarf ${dwarf.name} wanted to move up to (${foundCol},${aboveRowIndex}) but it's occupied; will dig current target instead.`);
        }
    }

    // Safety check for moving up
    if (dwarf.x !== originalX && prevRowIndex > 0) {
        const aboveRowIndex2 = prevRowIndex - 1;
        const aboveCell2 = grid[aboveRowIndex2] && grid[aboveRowIndex2][dwarf.x];
        const occupiedAbove2 = dwarfs.some(other => other !== dwarf && other.x === dwarf.x && other.y === aboveRowIndex2);
        if (aboveCell2 && aboveCell2.hardness > 0 && !occupiedAbove2) {
            if (Math.random() < 0.7) {
                dwarf.y = aboveRowIndex2;
                //console.log(`(Safety) Dwarf ${dwarf.name} moved up to (${dwarf.x},${aboveRowIndex2}) before digging (70% roll passed)`);
            } else {
                //console.log(`(Safety) Dwarf ${dwarf.name} chose NOT to move up to (${dwarf.x},${aboveRowIndex2}) before digging (70% roll failed)`);
            }
        } else if (aboveCell2 && aboveCell2.hardness > 0 && occupiedAbove2) {
            console.log(`(Safety) Dwarf ${dwarf.name} could not move up to (${dwarf.x},${aboveRowIndex2}) because another dwarf is present`);
        }
    }

    // Perform digging
    const targetRowIndex = dwarf.y;
    const target = grid[targetRowIndex][foundCol];
    const prev = target.hardness;
    const targetKey = coordKey(foundCol, targetRowIndex);
    if (!reservedDigBy.get(targetKey)) reservedDigBy.set(targetKey, dwarf);
    // Check if we can afford to pay the dwarf
    const wage = calculateWage(dwarf);
    if (gold < wage) {
        // Not enough gold - strike chance reduced by union-busting research
        const unionBusting = researchtree.find(r => r.id === 'union-busting');
        const continueWorkChance = 0.1 + ((unionBusting ? unionBusting.level : 0) * 0.05);
        if (Math.random() > continueWorkChance) {
            dwarf.status = 'striking';
            return;
        }
    }
    target.hardness = Math.max(0, target.hardness - power);
    dwarf.energy = Math.max(0, (typeof dwarf.energy === 'number' ? dwarf.energy : 1000) - 5);
    gold = Math.max(0, gold - wage); // Deduct payment for digging
    pendingTransactions.push({ type: 'expense', amount: wage, description: `Payment to ${dwarf.name}` });
    
    // Check for critical hit (5% base + 5% per research level)
    const materialScience = researchtree.find(r => r.id === 'material-science');
    const critChance = 0.05 + ((materialScience ? materialScience.level : 0) * 0.05);
    const isCrit = Math.random() < critChance;
    const finalPower = isCrit ? power * 2 : power;
    
    target.hardness = Math.max(0, target.hardness - finalPower);
    
    // Record critical hit for animation
    if (isCrit) {
        pendingTransactions.push({ type: 'crit-hit', x: foundCol, y: targetRowIndex, dwarf: dwarf.name });
    }
    if (target.hardness === 0) {
        const matId = target.materialId;
        dwarf.bucket = dwarf.bucket || {};
        dwarf.bucket[matId] = (dwarf.bucket[matId] || 0) + 1;
        //console.log(`Dwarf ${dwarf.name} collected 1 ${matId} into bucket -> ${dwarf.bucket[matId]}`);
    }
    //console.log(`Dwarf ${dwarf.name} moved to (${foundCol},${targetRowIndex}) and reduced hardness ${prev} -> ${target.hardness}`);
    if (target.hardness === 0) {
        if (reservedDigBy.get(targetKey) === dwarf.name) reservedDigBy.delete(targetKey);
        dwarf.status = 'idle';
    } else {
        dwarf.status = 'digging';
    }
}

function tick() {
    try {
        for (const d of dwarfs) {
            actForDwarf(d);
        }
        
        // Failsafe: Ensure smelter reservation is valid (run every 100 ticks)
        failsafeTickCounter++;
        if (failsafeTickCounter >= 100) {
            failsafeTickCounter = 0;
            
            // Release if reserved by a dwarf that's not heading to/at smelter or actively smelting
            if (smelterReservedBy) {
                const reservingDwarf = dwarfs.find(d => d.name === smelterReservedBy);
                if (reservingDwarf) {
                    const atSmelter = smelter && reservingDwarf.x === smelter.x && reservingDwarf.y === smelter.y;
                    const headingToSmelter = reservingDwarf.moveTarget && smelter && 
                        reservingDwarf.moveTarget.x === smelter.x && reservingDwarf.moveTarget.y === smelter.y;
                    const activelySmelting = reservingDwarf.status === 'smelting';
                    
                    if (!atSmelter && !headingToSmelter && !activelySmelting) {
                        console.log(`Failsafe: Releasing smelter reservation from ${smelterReservedBy} (at house or elsewhere)`);
                        smelterReservedBy = null;
                    }
                } else {
                    // Reserved by a dwarf that doesn't exist anymore
                    console.log(`Failsafe: Releasing smelter reservation from non-existent dwarf ${smelterReservedBy}`);
                    smelterReservedBy = null;
                }
            }
        }
        
        const shifted = checkAndShiftTopRows();
        
        // Send updated state back to main thread
        self.postMessage({
            type: 'tick-complete',
            data: {
                grid,
                dwarfs,
                startX,
                materialsStock,
                gold,
                toolsInventory,
                activeResearch,
                researchtree,
                shifted,
                transactions: pendingTransactions.length > 0 ? [...pendingTransactions] : undefined
            }
        });
        
        // Clear pending transactions after sending
        pendingTransactions = [];
    } catch (err) {
        console.error('Worker tick() error:', err);
        self.postMessage({
            type: 'tick-error',
            error: err.message
        });
    }
}

// Listen for messages from main thread
self.addEventListener('message', (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            // Initialize worker with game state
            grid = data.grid;
            dwarfs = data.dwarfs;
            materials = data.materials;
            tools = data.tools;
            gridWidth = data.gridWidth;
            gridDepth = data.gridDepth;
            visibleDepth = data.visibleDepth;
            startX = data.startX;
            materialsStock = data.materialsStock;
            bucketCapacity = data.bucketCapacity;
            dropOff = data.dropOff;
            house = data.house;
            research = data.research;
            smelter = data.smelter;
            if (data.smelterTasks) {
                smelterTasks = JSON.parse(JSON.stringify(data.smelterTasks));
            }
            dropGridStartX = data.dropGridStartX;
            gold = data.gold !== undefined ? data.gold : 1000;
            toolsInventory = data.toolsInventory || [];
            activeResearch = data.activeResearch || null;
            if (data.researchtree) {
                // Copy the full researchtree from main thread
                researchtree = JSON.parse(JSON.stringify(data.researchtree));
            }
            console.log('Worker initialized with game state');
            self.postMessage({ type: 'init-complete' });
            break;
            
        case 'start-loop':
            // Start the worker's internal game loop
            if (gameLoopIntervalId) {
                clearInterval(gameLoopIntervalId);
            }
            const interval = typeof e.data.interval === 'number' ? e.data.interval : DEFAULT_LOOP_INTERVAL_MS;
            gameLoopIntervalId = setInterval(() => {
                if (!gamePaused) {
                    tick();
                }
            }, interval);
            console.log(`Worker game loop started (${interval}ms interval)`);
            break;
            
        case 'set-pause':
            // Update pause state
            gamePaused = e.data.paused;
            console.log(`Worker pause state: ${gamePaused}`);
            break;
            
        case 'tick':
            // Manual tick (legacy support)
            if (!gamePaused) {
                tick();
            }
            break;
            
        case 'update-state':
            // Update specific parts of state from main thread
            if (data.grid) grid = data.grid;
            if (data.dwarfs) dwarfs = data.dwarfs;
            if (data.startX !== undefined) startX = data.startX;
            if (data.materialsStock) materialsStock = data.materialsStock;
            if (data.gold !== undefined) gold = data.gold;
            if (data.toolsInventory) toolsInventory = data.toolsInventory;
            if (data.activeResearch !== undefined) {
                activeResearch = data.activeResearch;
                if (activeResearch) {
                    console.log('Worker: Active research updated:', activeResearch.name);
                }
            }
            if (data.researchtree) {
                // Copy the full researchtree from main thread
                researchtree = JSON.parse(JSON.stringify(data.researchtree));
            }
            if (data.smelterTasks) {
                // Copy the smelter tasks from main thread
                smelterTasks = JSON.parse(JSON.stringify(data.smelterTasks));
            }
            break;
            
        default:
            console.warn('Unknown message type:', type);
    }
});

console.log('Game worker loaded and ready');
