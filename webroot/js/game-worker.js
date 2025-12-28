// Web Worker for game tick calculations
// This worker handles all the heavy computation for the game tick,
// preventing UI blocking during dwarf actions and grid updates.

// Import shared game constants and utilities
importScripts('constants.js', 'utils.js');

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
let gems = []; // Separate gems array
let nextGemId = 1; // Next gem ID to assign
let bucketCapacity = 4;
let dropOff = null;
let house = null;
let research = null;
let smelter = null;
let smelterTasks = [];
let smelterTasksData = {};
let dropGridStartX = 10;
let gold = 1000;
let toolsInventory = [];
let activeResearch = null;
let researchQueue = [];
let researchtree = [];
let pendingTransactions = []; // Queue of transactions to send to main thread

// Smelter temperature system
let smelterTemperature = 25; // Current temperature in degrees
let smelterCoalMinTemp = 25; // Minimum temperature for coal heating (user configurable)
let smelterCoalMaxTemp = 1200; // Maximum temperature for coal heating (user configurable)
let smelterMagmaMinTemp = 25; // Minimum temperature for magma heating (user configurable)
let smelterHeatingMode = false; // Track if we're currently in heating mode (for hysteresis)

// Reservation maps (coordinate -> dwarf name who reserved the cell)
const reservedDigBy = new Map();
let researchReservedBy = null; // Track which dwarf name has reserved the research cell
let smelterReservedBy = null; // Track which dwarf name has reserved the smelter

// Stuck detection tracking
const stuckTracking = new Map(); // dwarf -> { x, y, hardness, ticks }

// Failsafe tick counter
let failsafeTickCounter = 0;

/**
 * Calculate the effective hardness for the current research
 * @param {Object} dwarf - The dwarf attempting research (for gem calculations)
 * @returns {Object} Object containing baseHardness, levelHardnessIncrease, hardnessBeforeGem, amethystReduction, and effectiveHardness
 */
function calculateResearchEffectiveHardness(dwarf) {
    if (!activeResearch) return null;

    const currentLevel = activeResearch.level || 0;
    const baseHardness = activeResearch.hardness || RESEARCH_HARDNESS_MIN;
    const levelHardnessIncrease = currentLevel * RESEARCH_HARDNESS_SCALING_PER_LEVEL;
    const hardnessBeforeGem = Math.min(RESEARCH_HARDNESS_MAX, baseHardness + levelHardnessIncrease);

    // Apply Amethyst gem hardness reduction
    const amethystReduction = getAmethystHardnessReduction(dwarf);
    const effectiveHardness = Math.max(RESEARCH_HARDNESS_MIN, hardnessBeforeGem - amethystReduction);

    return {
        currentLevel,
        baseHardness,
        levelHardnessIncrease,
        hardnessBeforeGem,
        amethystReduction,
        effectiveHardness
    };
}

/**
 * Check if a dwarf has enough wisdom to attempt the current research
 * @param {Object} dwarf - The dwarf to check
 * @returns {boolean} True if dwarf can attempt research
 */
function canDwarfAttemptResearch(dwarf) {
    if (!activeResearch) return false;

    // With minimum 5% chance, any dwarf can attempt any research
    // (They always have at least 5% chance to succeed)
    return true;
}

// Game loop state
let gameLoopIntervalId = null;
let gamePaused = false;

function coordKey(x, y) {
    return `${x},${y}`;
}

/**
 * Unified task assignment for dwarfs
 * Checks task priority and blacklist, then assigns the highest priority available task
 * @param {Object} dwarf - The dwarf to assign a task to
 * @param {number|null} diggingX - X coordinate for digging (if returning to digging), or null
 * @param {number|null} diggingY - Y coordinate for digging (if returning to digging), or null
 * @returns {string|null} The task assigned ('research', 'smelting', 'digging') or null if none available
 */
function assignDwarfTask(dwarf, diggingX = null, diggingY = null) {
    // Get dwarf's task priority list (default if not set)
    const taskPriority = dwarf.taskPriority || ['digging', 'research', 'smelting'];
    const taskBlacklist = dwarf.taskBlacklist || [];

    // Check if each task is available
    const researchAvailabilityDetails = {
        activeResearch: !!activeResearch,
        researchReservedBy: researchReservedBy,
        researchObjectExists: typeof research === 'object' && research !== null,
        canAttempt: canDwarfAttemptResearch(dwarf)
    };

    const taskAvailability = {
        'research': activeResearch && (!researchReservedBy || researchReservedBy === dwarf.name) && typeof research === 'object' && research !== null && canDwarfAttemptResearch(dwarf),
        'smelting': smelterHasWork() && (!smelterReservedBy || smelterReservedBy === dwarf.name) && typeof smelter === 'object' && smelter !== null,
        'digging': true // Digging is always considered "available" in priority check
    };

    // Debug logging
    console.log(`[${dwarf.name}] assignDwarfTask called:`, {
        priority: taskPriority,
        blacklist: taskBlacklist,
        availability: taskAvailability,
        researchDetails: researchAvailabilityDetails,
        position: `(${dwarf.x}, ${dwarf.y})`,
        status: dwarf.status
    });

    // Find the highest priority task that is available and not blacklisted
    for (const taskId of taskPriority) {
        // Skip if blacklisted or not available
        if (taskBlacklist.includes(taskId) || !taskAvailability[taskId]) {
            console.log(`[${dwarf.name}] Skipping ${taskId}: blacklisted=${taskBlacklist.includes(taskId)}, unavailable=${!taskAvailability[taskId]}`);
            continue;
        }

        console.log(`[${dwarf.name}] Attempting to assign ${taskId}`);

        // Task is available! Execute it
        if (taskId === 'research') {
            // Check if already at research location
            if (dwarf.x === research.x && dwarf.y === research.y) {
                // Already at research - start researching immediately
                if (researchReservedBy === dwarf.name || !researchReservedBy) {
                    researchReservedBy = dwarf.name;
                    dwarf.status = 'researching';
                    console.log(`[${dwarf.name}] Started researching (already at location)`);
                    return 'research';
                }
            } else {
                // Not at research - move there
                researchReservedBy = dwarf.name;
                scheduleMove(dwarf, research.x, research.y);
                dwarf.status = 'moving';
                console.log(`[${dwarf.name}] Moving to research at (${research.x}, ${research.y})`);
                return 'research';
            }
        } else if (taskId === 'smelting') {
            // Check if already at smelter location
            if (dwarf.x === smelter.x && dwarf.y === smelter.y) {
                // Already at smelter - start smelting immediately
                if (smelterReservedBy === dwarf.name || !smelterReservedBy) {
                    smelterReservedBy = dwarf.name;
                    dwarf.status = 'smelting';
                    console.log(`[${dwarf.name}] Started smelting (already at location)`);
                    return 'smelting';
                }
            } else {
                // Not at smelter - move there
                smelterReservedBy = dwarf.name;
                scheduleMove(dwarf, smelter.x, smelter.y);
                dwarf.status = 'moving';
                console.log(`[${dwarf.name}] Moving to smelter at (${smelter.x}, ${smelter.y})`);
                return 'smelting';
            }
        } else if (taskId === 'digging') {
            // If digging coordinates provided, move there; otherwise just signal digging task
            if (diggingX !== null && diggingY !== null) {
                scheduleMove(dwarf, diggingX, diggingY);
            }
            console.log(`[${dwarf.name}] Assigned digging task`);
            return 'digging';
        }
    }

    // No task was assigned
    console.log(`[${dwarf.name}] No task assigned (all blacklisted or unavailable)`);
    return null;
}

function isCellOccupiedByStanding(x, y) {
    return dwarfs.some(d => d.x === x && d.y === y && d.status !== 'moving');
}

function isReservedForDig(x, y) {
    return reservedDigBy.has(coordKey(x, y));
}

// Note: getMaterialById and selectRandomGem are now in utils.js

/**
 * Handle block destruction logic including gem spawning and material collection
 * @param {Object} cell - The grid cell being destroyed
 * @param {Object} dwarf - The dwarf performing the destruction
 * @param {number} x - X coordinate of the cell
 * @param {number} y - Y coordinate of the cell
 */
function handleBlockDestruction(cell, dwarf, x, y) {
    const matId = cell.materialId;
    const mat = materials[matId];

    // Check if this stone contains a gem BEFORE collecting it
    // Apply Silver plating gem probability multiplier
    const silverMultiplier = getSilverPlatingGemMultiplier(dwarf);
    const effectiveGemChance = GEM_SPAWN_CHANCE * silverMultiplier;
    if (mat && mat.type && mat.type.startsWith('Stone') && !cell.gemId && Math.random() < effectiveGemChance) {
        const gemType = selectRandomGem();
        if (!gemType) return; // No gems available

        // Calculate carat: 1 + random whole number based on depth
        const depth = (y + startX) || 0;
        const maxCarat = Math.floor(depth / GEM_CARAT_DEPTH_DIVISOR);
        const carat = 1 + Math.floor(Math.random() * (maxCarat ));

        // Get gem material to use its hardness
        const gemMat = materials[gemType];
        const gemHardness = gemMat ? gemMat.hardness : 1;

        // Create gem object with unique ID
        const gem = {
            id: nextGemId++,
            type: gemType,
            carat: carat,
            polished: false,
            x: x,
            y: y
        };
        gems.push(gem);

        // Replace the stone with the gem material
        cell.materialId = gemType;
        cell.hardness = gemHardness;
        cell.gemId = gem.id;

        pendingTransactions.push({ type: 'gem-spawn', x: x, y: y, dwarf: dwarf.name, gem: gemType, carat: carat, gemId: gem.id });

        // Don't collect the stone - gem is now in its place
        // Award XP for destroying the stone
        if (mat && typeof mat.hardness === 'number') {
            const xpGain = Math.ceil(Math.sqrt(mat.hardness));
            dwarf.xp = (dwarf.xp || 0) + xpGain;
        }
    } else {
        // No gem - collect the material normally
        dwarf.bucket = dwarf.bucket || {};

        // If this is a gem block being collected, mark gem as collected but keep in gems array
        if (cell.gemId) {
            // Gem collected! Update its status but don't remove from gems array
            const gemIndex = gems.findIndex(g => g.id === cell.gemId);
            if (gemIndex !== -1) {
                // Keep the gem in the array - it's now in the warehouse
                // No need to remove it
            }
            delete cell.gemId;
        }

        dwarf.bucket[matId] = (dwarf.bucket[matId] || 0) + 1;

        // Award XP only when material is destroyed
        if (mat && typeof mat.hardness === 'number') {
            const xpGain = Math.ceil(Math.sqrt(mat.hardness));
            dwarf.xp = (dwarf.xp || 0) + xpGain;
        }
    }
}

// Check if a smelter task is unlocked by research
// Note: isSmelterTaskUnlocked is now in utils.js

// Check if the smelter has any actionable work (not "do nothing" as first task, and has materials)
function smelterHasWork() {
    if (!smelterTasks || smelterTasks.length === 0) return false;

    // Check each task in priority order
    for (const taskId of smelterTasks) {
        if (taskId === 'do-nothing') {
            // If "do nothing" is encountered, stop checking
            return false;
        }
        const task = smelterTasksData[taskId];
        // Check if task is unlocked
        if (!isSmelterTaskUnlocked(task)) {
            continue; // Skip locked tasks
        }
        // For gem cutting tasks, check if there are any gems marked for cutting
        if (task.type === 'gem-cutting') {
            const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
            if (gemToProcess) {
                return true;
            }
        }
        // Check for single input (legacy format)
        if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                return true; // Found a task with enough materials
            }
        }
        // Check for multiple inputs (alloy format)
        if (task.inputs && Array.isArray(task.inputs)) {
            const hasAllInputs = task.inputs.every(input => {
                const stockAmount = materialsStock[input.material] || 0;
                return stockAmount >= input.amount;
            });
            if (hasAllInputs) {
                return true; // Found a task with all required materials
            }
        }
    }
    return false;
}

// Find the first actionable smelter task
function findActionableSmelterTask() {
    if (!smelterTasks || smelterTasks.length === 0) return null;

    for (const taskId of smelterTasks) {
        if (taskId === 'do-nothing') {
            return null; // Stop at "do nothing"
        }
        const task = smelterTasksData[taskId];
        // Check if task is unlocked
        if (!isSmelterTaskUnlocked(task)) {
            continue; // Skip locked tasks
        }

        // For heating tasks, use hysteresis: start heating when below min, stop when above max
        if (task.type === 'heating') {
            // For magma (dynamic), only activate when below min temp
            // For coal, use hysteresis with min and max
            if (task.heatGain === 'dynamic') {
                // Magma: only heat when below magma min temp (it instantly goes to max)
                if (smelterTemperature >= smelterMagmaMinTemp) {
                    continue; // Skip magma heating if at or above magma min temp
                }
            } else {
                // Coal: use hysteresis
                // Update heating mode based on temperature
                if (smelterTemperature < smelterCoalMinTemp) {
                    smelterHeatingMode = true; // Start heating when below coal min
                } else if (smelterTemperature >= smelterCoalMaxTemp) {
                    smelterHeatingMode = false; // Stop heating when at/above coal max
                }
                // Skip heating if not in heating mode
                if (!smelterHeatingMode) {
                    continue;
                }
            }
        }

        // For smelting tasks with temperature requirements, check if furnace is hot enough
        if (task.minTemp && smelterTemperature < task.minTemp) {
            continue; // Skip tasks that require higher temperature
        }

        // For gem cutting tasks, check if there are any gems marked for cutting
        if (task.type === 'gem-cutting') {
            const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
            if (gemToProcess) {
                return { task: task, taskId: taskId };
            }
            continue; // No gems available, try next task
        }

        // Check for single input (legacy format)
        if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                return { task: task, taskId: taskId };
            }
        }
        // Check for multiple inputs (alloy format)
        if (task.inputs && Array.isArray(task.inputs)) {
            const hasAllInputs = task.inputs.every(input => {
                const stockAmount = materialsStock[input.material] || 0;
                return stockAmount >= input.amount;
            });
            if (hasAllInputs) {
                return { task: task, taskId: taskId };
            }
        }
    }
    return null;
}

// Handle smelter task output production including break chance and bonus ore
function handleSmelterTaskOutput(task, dwarf) {
    const outputMaterial = task.output.material;
    const outputAmount = task.output.amount;

    // Check for break chance (for polishing tasks)
    let success = true;
    if (task.breakChance && task.breakChance > 0) {
        const stonePolishing = researchtree.find(r => r.id === 'stone-polishing');
        const polishingLevel = stonePolishing ? (stonePolishing.level || 0) : 0;
        const breakReduction = polishingLevel * RESEARCH_STONE_POLISHING_BREAK_REDUCTION;
        const actualBreakChance = Math.max(0, task.breakChance - breakReduction);
        success = Math.random() >= actualBreakChance;
    }

    // Produce output materials only if successful
    if (success) {
        materialsStock[outputMaterial] = (materialsStock[outputMaterial] || 0) + outputAmount;

        // Check for bonus ore (for sieve-loose-stone task)
        if (task.bonusChance && task.bonusType === 'deep-ore' && task.bonusAmount) {
            console.log(`Checking bonus ore: chance=${task.bonusChance}, type=${task.bonusType}, amount=${task.bonusAmount}`);
            if (Math.random() < task.bonusChance) {
                // Calculate current depth (deepest dug row)
                const currentDepth = startX;
                const targetDepth = currentDepth * 2;

                // Find all ores that would appear at double the current depth
                const availableOres = [];
                for (const [materialId, materialData] of Object.entries(materials)) {
                    // Only consider ore types
                    if (materialData.type && materialData.type.includes('Ore')) {
                        const minLevel = materialData.minlevel || 0;
                        const maxLevel = materialData.maxlevel || Infinity;

                        // Check if this ore appears at the target depth
                        if (targetDepth >= minLevel && targetDepth <= maxLevel) {
                            availableOres.push(materialId);
                        }
                    }
                }

                // If we found any ores, randomly select one and add it
                if (availableOres.length > 0) {
                    const randomOre = availableOres[Math.floor(Math.random() * availableOres.length)];
                    materialsStock[randomOre] = (materialsStock[randomOre] || 0) + task.bonusAmount;
                    console.log(`Dwarf ${dwarf.name} found bonus ${task.bonusAmount}x ${randomOre} while sieving (depth ${currentDepth}, target ${targetDepth})!`);
                } else {
                    console.log(`No ores available at target depth ${targetDepth} (current depth: ${currentDepth})`);
                }
            } else {
                console.log(`Bonus roll failed for ${dwarf.name}`);
            }
        }
    }
}

function getDwarfToolPower(dwarf) {

    // Calculate power: (Dwarf Base Power * Level Bonus) * Research Bonus * Tool Power
    const baseDigPower = dwarf.digPower || 0;
    const modifiedDigPower = getDiamondModifiedDigPower(dwarf, baseDigPower);
    const levelBonus = 1 + modifiedDigPower * DWARF_DIG_POWER_BONUS;
    
    // Apply improved-digging research bonus
    const improvedDigging = researchtree.find(r => r.id === 'improved-digging');
    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * RESEARCH_IMPROVED_DIGGING_BONUS : 0);
    
    if (!dwarf.toolId) return (DWARF_BASE_POWER * levelBonus) * researchBonus; // default power if no tool
    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance) return (DWARF_BASE_POWER * levelBonus) * researchBonus;
    // Check if tool has custom power (forged tools) or use base definition
    let toolPower;
    if (toolInstance.power !== undefined) {
        // Forged tool with custom power
        toolPower = toolInstance.power / 100;
    } else {
        // Base tool - look up definition
        const toolDef = tools.find(t => t.name === toolInstance.type);
        if (!toolDef) return (DWARF_BASE_POWER * levelBonus) * researchBonus;
        toolPower = toolDef.power / 100;
    }

    // Apply enchantment bonus (1% per enchantment level)
    const enchantBonus = 1 + (toolInstance.enchantLevel || 0) * ENCHANT_POWER_BONUS;

    return (DWARF_BASE_POWER * levelBonus) * researchBonus * toolPower * enchantBonus;
}

// Note: calculateWage and randomMaterial are now in utils.js

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
            let matId;

            // Check left tile
            if (c > 0 && Math.random() < GRID_CLUSTERING_HORIZONTAL_CHANCE) {
                const leftCell = newRow[c - 1];
                if (leftCell && leftCell.materialId) {
                    const leftMat = materials[leftCell.materialId];
                    if (leftMat) {
                        matId = leftCell.materialId;
                    }
                }
            }

            // Check above tile
            if (!matId && grid.length > 0 && Math.random() < GRID_CLUSTERING_VERTICAL_CHANCE) {
                const aboveCell = grid[grid.length - 1][c];
                if (aboveCell && aboveCell.materialId && aboveCell.hardness > 0) {
                    const aboveMat = materials[aboveCell.materialId];
                    if (aboveMat) {
                        matId = aboveCell.materialId;
                    }
                }
            }

            // If no clustering, use random based on depth
            if (!matId) {
                matId = randomMaterial(newRowDepth);
            }

            const mat = materials[matId];
            newRow.push({ materialId: matId, hardness: mat.hardness });
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
        // If a material is destroyed by collapse (set to hardness 0), award XP to any dwarf standing at that cell
        if (src.hardness > 0) {
            for (const d of dwarfs) {
                if (d.x === ux && d.y === scanY) {
                    const mat = materials[src.materialId];
                    if (mat && typeof mat.hardness === 'number') {
                        const xpGain = Math.ceil(Math.sqrt(mat.hardness));
                        d.xp = (d.xp || 0) + xpGain;
                    }
                }
            }
        }
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

    // Track current reservations for debugging
    const digReservations = [];
    for (const [key, val] of reservedDigBy.entries()) {
        if (val === dwarf.name) digReservations.push(key);
    }
    dwarf.reservations = {
        dig: digReservations,
        research: researchReservedBy === dwarf.name,
        smelter: smelterReservedBy === dwarf.name
    };

    // Check for stuck dwarf - only track when actively moving or digging
    const shouldTrackStuck = (dwarf.status === 'moving' || dwarf.status === 'digging' || dwarf.status === 'idle');
    const cellHardness = (grid[dwarf.y] && grid[dwarf.y][dwarf.x]) ? grid[dwarf.y][dwarf.x].hardness : 0;
    const trackKey = dwarf.name; // Use name as unique key
    const tracked = stuckTracking.get(trackKey);
    
    if (shouldTrackStuck) {
        if (tracked) {
            // Check if position or hardness changed
            if (tracked.x !== dwarf.x || tracked.y !== dwarf.y || tracked.hardness !== cellHardness) {
                // Dwarf moved or made progress, reset tracking
                stuckTracking.set(trackKey, { x: dwarf.x, y: dwarf.y, hardness: cellHardness, ticks: 0 });
            } else {
                // Same position and hardness, increment stuck counter
                tracked.ticks++;
                if (tracked.ticks >= STUCK_DETECTION_TICKS) {
                    // Stuck! Teleport to house and reset
                    // Gather debug information about reservations
                    const digReservations = [];
                    for (const [key, val] of reservedDigBy.entries()) {
                        if (val === dwarf.name) digReservations.push(key);
                    }
                    const hasResearch = researchReservedBy === dwarf.name;
                    const hasSmelter = smelterReservedBy === dwarf.name;

                    console.log(`Dwarf ${dwarf.name} stuck for ${tracked.ticks} ticks, teleporting to house`);
                    console.log(`  Position: (${dwarf.x}, ${dwarf.y}), Status: ${dwarf.status}`);
                    console.log(`  Move Target: ${dwarf.moveTarget ? `(${dwarf.moveTarget.x}, ${dwarf.moveTarget.y})` : 'None'}`);
                    console.log(`  Reservations: ${digReservations.length > 0 ? `Dig cells: ${digReservations.join(', ')}` : ''}${hasResearch ? ' Research' : ''}${hasSmelter ? ' Smelter' : ''}${digReservations.length === 0 && !hasResearch && !hasSmelter ? 'None' : ''}`);

                    dwarf.x = house.x;
                    dwarf.y = house.y;
                    dwarf.status = 'idle';
                    dwarf.moveTarget = null;
                    dwarf.bucket = {}; // Clear bucket to prevent stuck with full bucket
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
    } else {
        // Not tracking (resting, researching, etc.) - clear stuck tracking
        if (tracked) stuckTracking.delete(trackKey);
    }

    //console.log(`Dwarf ${dwarf.name} is acting at (${dwarf.x}, ${dwarf.y}) status=${dwarf.status}`);

    // Failsafe: Release smelter reservation if dwarf is at house and not actively working
    if (typeof house === 'object' && house !== null && dwarf.x === house.x && dwarf.y === house.y) {
        if (dwarf.status !== 'resting' && dwarf.status !== 'idle' && smelterReservedBy === dwarf.name) {
            smelterReservedBy = null;
        }
    }

    // Low energy handling
    if (typeof house === 'object' && house !== null && typeof dwarf.energy === 'number' && dwarf.energy < DWARF_LOW_ENERGY_THRESHOLD) {
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
        const betterHousing = researchtree.find(r => r.id === 'better-housing');
        const housingLevel = betterHousing ? (betterHousing.level || 0) : 0;
        const restBonus = housingLevel > 0 ? 1 + (housingLevel * RESEARCH_BETTER_HOUSING_BASE_BONUS) / (1 + housingLevel * RESEARCH_BETTER_HOUSING_DIMINISH) : 1;
        const restAmount = DWARF_REST_AMOUNT * restBonus;
        dwarf.energy = Math.min(maxEnergy, (dwarf.energy || 0) + restAmount);
        if (dwarf.energy >= maxEnergy) {
            dwarf.status = 'idle';
            dwarf.energy = maxEnergy;
            
            // After resting, check for special tasks
            const canResearch = activeResearch && !researchReservedBy && typeof research === 'object' && research !== null && canDwarfAttemptResearch(dwarf);
            const canSmelt = smelterHasWork() && !smelterReservedBy && typeof smelter === 'object' && smelter !== null;

            if ((canResearch || canSmelt) && Math.random() < TASK_RESEARCH_CHANCE) {
                if (canResearch && canSmelt) {
                    // Both available - split evenly
                    if (Math.random() < TASK_RESEARCH_SPLIT) {
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
            if (dwarf.energy < DWARF_ENERGY_COST_PER_RESEARCH) {
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                dwarf.status = 'idle';
                return;
            }
            
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - strike chance reduced by union-busting research
                const unionBusting = researchtree.find(r => r.id === 'union-busting');
                const continueWorkChance = DWARF_STRIKE_BASE_CHANCE + ((unionBusting ? unionBusting.level : 0) * RESEARCH_UNION_BUSTING_BONUS);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            
            // Pay the dwarf, consume energy and generate research point
            gold = Math.max(0, gold - wage);
            pendingTransactions.push({ type: 'expense', amount: wage, description: 'Research wage for ' + dwarf.name });

            // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
            applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_RESEARCH);
            if (activeResearch.progress === undefined) {
                activeResearch.progress = 0;
            }

            // New probability-based research point generation
            // Calculate effective hardness using helper function
            const hardnessData = calculateResearchEffectiveHardness(dwarf);
            const { currentLevel, baseHardness, levelHardnessIncrease, hardnessBeforeGem, amethystReduction, effectiveHardness } = hardnessData;

            // Debug: Log research attempt start
            const debugRuns = [];

            // Calculate research points with multiple runs based on wisdom
            let totalResearchPoints = 0;
            let currentWisdom = Math.max(1, dwarf.wisdom || 0); // Ensure at least 1 wisdom for minimum chance
            let runNumber = 0;

            while (currentWisdom > 0) {
                runNumber++;

                // Roll for success with minimum 10% chance
                const roll = Math.random() * 100 + 1; // Random between 1 and 100
                const researchPower = currentWisdom * roll;

                // Apply minimum success chance: if roll is <= 10, always succeed
                const minChanceSuccess = roll <= (RESEARCH_MIN_SUCCESS_CHANCE * 100);
                const powerSuccess = researchPower >= effectiveHardness;
                const success = minChanceSuccess || powerSuccess;

                if (success) {
                    totalResearchPoints += 1;
                } else {
                    // Debug: Track this failed run
                    debugRuns.push({
                        run: runNumber,
                        wisdom: currentWisdom,
                        roll: roll.toFixed(1),
                        power: researchPower.toFixed(1),
                        hardness: effectiveHardness,
                        minChance: false,
                        success: success
                    });
                    // If failed, stop additional runs on this tick
                    break;
                }

                // Debug: Track this successful run
                debugRuns.push({
                    run: runNumber,
                    wisdom: currentWisdom,
                    roll: roll.toFixed(1),
                    power: researchPower.toFixed(1),
                    hardness: effectiveHardness,
                    minChance: minChanceSuccess,
                    success: success
                });

                // Halve wisdom for next run (rounded down), but only if actual wisdom > 0
                if ((dwarf.wisdom || 0) > 0) {
                    currentWisdom = Math.floor(currentWisdom / 2);
                } else {
                    // Dwarf has 0 wisdom, only gets 1 roll with minimum chance
                    break;
                }

                // Safety check: prevent infinite loops
                if (runNumber > 20) break;
            }

            // Research points are applied directly (no gem modifier to points anymore)
            const researchPoints = totalResearchPoints;
            activeResearch.progress += researchPoints;

            // Debug output
            // console.log(`[RESEARCH] ${dwarf.name} researching ${activeResearch.name} (Lv${currentLevel})`);
            // console.log(`  Hardness: ${baseHardness} base + ${levelHardnessIncrease} (level scaling) = ${hardnessBeforeGem}`);
            // if (amethystReduction > 0) {
            //     console.log(`  💎 Amethyst: -${amethystReduction.toFixed(2)} hardness → ${effectiveHardness.toFixed(2)} effective hardness`);
            // } else {
            //     console.log(`  Effective hardness: ${effectiveHardness}`);
            // }
            // console.log(`  Dwarf Wisdom: ${dwarf.wisdom || 0} (min 10% chance per roll)`);
            // debugRuns.forEach(run => {
            //     const result = run.success ? (run.minChance ? '✓ SUCCESS (min chance!)' : '✓ SUCCESS') : '✗ FAIL';
            //     console.log(`  Run ${run.run}: wisdom=${run.wisdom} × roll=${run.roll} = ${run.power} vs ${run.hardness} → ${result}`);
            // });
            // console.log(`  Total: ${totalResearchPoints} research points`);

            const WisdomMultiplier = Math.ceil(Math.sqrt(dwarf.wisdom || 0));
            dwarf.xp = (dwarf.xp || 0) + DWARF_XP_PER_ACTION * (WisdomMultiplier > 0 ? WisdomMultiplier : 1);
            
            // console.log(`Dwarf ${dwarf.name} generated ${researchPoints} research points (wisdom: ${dwarf.wisdom || 0})`);

            // Check if research is complete using formula: baseCost * (1.15^(targetLevel-1))
            // Current level is what we have, target level is current + 1
            const targetLevel = currentLevel + 1;
            const actualCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
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

                console.log(`Research completed: ${completedResearch.name} (Level ${completedResearch.level})`);

                // Clear active research and release reservation
                activeResearch = null;
                if (researchReservedBy === dwarf.name) {
                    researchReservedBy = null;
                    //console.log(`Research reservation released by ${dwarf.name}`);
                }
                dwarf.status = 'idle';

                // Start next queued research if available
                console.log(`[WORKER] Research completed. Queue length: ${researchQueue.length}`);
                if (researchQueue.length > 0) {
                    const nextResearch = researchQueue.shift();
                    console.log(`[WORKER] Starting next queued research:`, nextResearch);
                    const nextResearchItem = researchtree.find(r => r.id === nextResearch.id);

                    if (nextResearchItem) {
                        // Initialize progress if not set
                        if (nextResearchItem.progress === undefined) {
                            nextResearchItem.progress = 0;
                        }

                        // Set as active
                        activeResearch = nextResearchItem;
                        console.log(`[WORKER] Started next queued research: ${nextResearchItem.name} (${researchQueue.length} remaining in queue)`);
                    } else {
                        console.error('[WORKER] Queued research not found:', nextResearch.id);
                        // Recursively try next in queue by re-processing
                    }
                } else {
                    console.log('[WORKER] No researches in queue to start');
                }
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
            if (dwarf.energy < DWARF_ENERGY_COST_PER_SMELT) {
                // Reset task progress when dwarf stops due to low energy
                if (dwarf.currentSmelterTask && smelterTasksData[dwarf.currentSmelterTask]) {
                    smelterTasksData[dwarf.currentSmelterTask].progress = 0;
                }
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                dwarf.status = 'idle';
                dwarf.currentSmelterTask = null;
                return;
            }
            
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - strike chance reduced by union-busting research
                const unionBusting = researchtree.find(r => r.id === 'union-busting');
                const continueWorkChance = DWARF_STRIKE_BASE_CHANCE + ((unionBusting ? unionBusting.level : 0) * RESEARCH_UNION_BUSTING_BONUS);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            
            // Find an actionable task from the priority list
            const taskResult = findActionableSmelterTask();
            if (!taskResult) {
                // No work available, release smelter and become idle
                // Reset task progress when dwarf stops due to no work
                if (dwarf.currentSmelterTask && smelterTasksData[dwarf.currentSmelterTask]) {
                    smelterTasksData[dwarf.currentSmelterTask].progress = 0;
                }
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                dwarf.status = 'idle';
                dwarf.currentSmelterTask = null;
                return;
            }

            const task = taskResult.task;
            const taskId = taskResult.taskId;

            // Check if this is a task that requires time (has ticksRequired property)
            if (task.ticksRequired && task.ticksRequired > 0) {
                // Initialize or validate task tracking
                if (!dwarf.currentSmelterTask || dwarf.currentSmelterTask !== taskId) {
                    // Starting a new task or switching tasks
                    dwarf.currentSmelterTask = taskId;

                    // For gem cutting, also initialize gem progress
                    if (task.type === 'gem-cutting') {
                        const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
                        if (gemToProcess && !gemToProcess.cuttingProgress) {
                            gemToProcess.cuttingProgress = 0;
                        }
                    }
                }

                // Always ensure progress is initialized (not just when starting new task)
                // This handles cases where task.progress might be NaN or undefined
                if (task.progress === undefined || isNaN(task.progress)) {
                    task.progress = 0;
                }

                // Implement wisdom-based difficulty system for output tasks (similar to research)
                let totalProgressGained = 0;

                // For tasks with output, use hardness-based difficulty
                if (task.output && task.output.material && task.hardness !== undefined) {
                    // Use the task's hardness property instead of the material's hardness
                    const hardness = task.hardness;

                    // Calculate how many runs the dwarf gets based on wisdom
                    let currentWisdom = dwarf.wisdom || 0;
                    let runNumber = 1;

                    while (true) {
                        // Calculate success chance: (wisdom * SMELTER_WISDOM_PROBABILITY_BONUS) vs hardness
                        // Higher hardness materials are harder to smelt successfully
                        const smeltingPower = currentWisdom * SMELTER_WISDOM_PROBABILITY_BONUS;
                        const roll = Math.random() * hardness;

                        // Use minimum success chance if smelting power is too low
                        const minChanceRoll = Math.random();
                        const minChanceSuccess = minChanceRoll < SMELTER_MIN_SUCCESS_CHANCE;
                        const normalSuccess = roll <= smeltingPower;
                        const success = normalSuccess || minChanceSuccess;

                        if (!success) {
                            // Failed this run, stop
                            break;
                        }

                        // Success! Gain 1 progress
                        totalProgressGained++;

                        // Halve wisdom for next run (rounded down), but only if actual wisdom > 0
                        if ((dwarf.wisdom || 0) > 0) {
                            currentWisdom = Math.floor(currentWisdom / 2);
                        } else {
                            // Dwarf has 0 wisdom, only gets 1 roll with minimum chance
                            break;
                        }

                        // Safety check: prevent infinite loops
                        if (runNumber > 20) break;
                        runNumber++;
                    }
                } else {
                    // For tasks without output (heating, gem cutting), just increment by 1
                    totalProgressGained = 1;
                }

                // Apply progress to the task (not the dwarf)
                task.progress += totalProgressGained;

                // For gem cutting, sync progress with gem object
                if (task.type === 'gem-cutting') {
                    const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
                    if (gemToProcess) {
                        gemToProcess.cuttingProgress = task.progress;
                    }
                }

                // Check if task is complete (cap progress at ticksRequired for display purposes)
                if (task.progress >= task.ticksRequired) {
                    // Cap progress at ticksRequired to avoid display issues
                    task.progress = task.ticksRequired;

                    // Task complete! Process the result

                    // Handle gem cutting completion
                    if (task.type === 'gem-cutting') {
                        const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
                        if (gemToProcess) {
                            gemToProcess.polished = true;
                            gemToProcess.markedForCutting = false;
                            gemToProcess.cuttingProgress = 0;
                        }
                    }
                    // Handle heating task completion
                    else if (task.type === 'heating' && task.heatGain) {
                        const furnaceTemp = researchtree.find(r => r.id === 'furnace-temperature');
                        const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
                        const maxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

                        if (task.heatGain === 'dynamic') {
                            smelterTemperature = maxTemp;
                        } else {
                            const coalMaxTemp = 2000;
                            smelterTemperature = Math.min(coalMaxTemp, smelterTemperature + task.heatGain);
                        }
                    }
                    // Handle regular smelting/processing with output
                    else if (task.output) {
                        handleSmelterTaskOutput(task, dwarf);
                    }

                    // Consume input materials after task completion
                    if (task.inputs && Array.isArray(task.inputs)) {
                        task.inputs.forEach(input => {
                            materialsStock[input.material] = (materialsStock[input.material] || 0) - input.amount;
                        });
                    } else if (task.input && task.input.material && task.input.amount) {
                        const inputMaterial = task.input.material;
                        const inputAmount = task.input.amount;
                        materialsStock[inputMaterial] = (materialsStock[inputMaterial] || 0) - inputAmount;
                    }

                    // Reset progress on the task and clear dwarf's current task
                    task.progress = 0;
                    dwarf.currentSmelterTask = null;

                    // Task completed! Check if there's more work immediately
                    // This allows the dwarf to continue to the next task without waiting a tick
                    const nextTaskResult = findActionableSmelterTask();
                    if (!nextTaskResult) {
                        // No more work available, release smelter and become idle
                        if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                        dwarf.status = 'idle';
                    }
                    // If there is more work, the dwarf will pick it up on the next tick
                }

                // Pay the dwarf, consume energy and award XP for each tick
                gold = Math.max(0, gold - wage);
                pendingTransactions.push({ type: 'expense', amount: wage, description: 'Smelter wage for ' + dwarf.name });
                applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_SMELT);

                // Award XP with wisdom multiplier (like research)
                const wisdomMultiplier = Math.ceil(Math.sqrt(dwarf.wisdom || 0));
                dwarf.xp = (dwarf.xp || 0) + DWARF_XP_PER_ACTION * (wisdomMultiplier > 0 ? wisdomMultiplier : 1);

                return;
            }

            // Perform the smelting action (instant tasks without ticksRequired)
            // Consume input materials - support both single input and multiple inputs (for alloys)
            if (task.inputs && Array.isArray(task.inputs)) {
                // Multiple inputs (alloy format)
                task.inputs.forEach(input => {
                    materialsStock[input.material] = (materialsStock[input.material] || 0) - input.amount;
                });
            } else if (task.input && task.input.material && task.input.amount) {
                // Single input (legacy format)
                const inputMaterial = task.input.material;
                const inputAmount = task.input.amount;
                materialsStock[inputMaterial] = (materialsStock[inputMaterial] || 0) - inputAmount;
            }

            // Handle heating task
            if (task.type === 'heating' && task.heatGain) {
                // Calculate max temperature based on furnace-temperature research
                const furnaceTemp = researchtree.find(r => r.id === 'furnace-temperature');
                const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
                const maxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

                if (task.heatGain === 'dynamic') {
                    // Magma furnace: set temperature directly to max
                    smelterTemperature = maxTemp;
                    //console.log(`Dwarf ${dwarf.name} used magma to heat furnace to max ${Math.round(smelterTemperature)}°`);
                } else {
                    // Coal: add heat gain, capped at 2000°
                    const coalMaxTemp = 2000;
                    smelterTemperature = Math.min(coalMaxTemp, smelterTemperature + task.heatGain);
                    //console.log(`Dwarf ${dwarf.name} heated furnace by ${task.heatGain}° (now ${Math.round(smelterTemperature)}°, coal max: ${coalMaxTemp}°)`);
                }
            } else if (task.output) {
                // Regular smelting task with output
                handleSmelterTaskOutput(task, dwarf);
            }
            
            // Pay the dwarf, consume energy and award XP
            gold = Math.max(0, gold - wage);
            pendingTransactions.push({ type: 'expense', amount: wage, description: 'Smelter wage for ' + dwarf.name });

            // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
            applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_SMELT);
            dwarf.xp = (dwarf.xp || 0) + DWARF_XP_PER_ACTION;
            
            //console.log(`Dwarf ${dwarf.name} performed smelting task`);
            return;
        } else {
            // Not at smelter location, release reservation and become idle
            // Reset task progress when dwarf stops
            if (dwarf.currentSmelterTask && smelterTasksData[dwarf.currentSmelterTask]) {
                smelterTasksData[dwarf.currentSmelterTask].progress = 0;
            }
            if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
            dwarf.status = 'idle';
            dwarf.currentSmelterTask = null;
        }
    }

    // Striking state - dwarf refuses to work without pay
    if (dwarf.status === 'striking') {
        // Check if there's gold available now
        if (gold >= DWARF_BASE_WAGE) {
            // Gold available, go back to idle and resume work
            dwarf.status = 'idle';
        }
        return;
    }

    // Full bucket handling (weight-based)
    const bucketWeight = calculateBucketWeight(dwarf.bucket);
    const dwarfCapacity = calculateDwarfBucketCapacity(dwarf);
    if (bucketWeight >= dwarfCapacity) {
        if (dwarf.x === dropOff.x && dwarf.y === dropOff.y) {
            if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0) {
                if (dwarf.status !== 'unloading') {
                    dwarf.status = 'unloading';
                    return;
                }

                for (const [mat, cnt] of Object.entries(dwarf.bucket)) {
                    // Check if this is a gem material - gems should stay in gems array, not materialsStock
                    const material = materials[mat];
                    if (material && material.type === 'Gem') {
                        // Skip gems - they're already in the gems array
                        continue;
                    }
                    // Only regular materials go to materialsStock
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
                            if (typeof dwarf.energy === 'number' && dwarf.energy < DWARF_LOW_ENERGY_THRESHOLD && typeof house === 'object') {
                                scheduleMove(dwarf, house.x, house.y);
                                //console.log(`Dwarf ${dwarf.name} low energy after unload -> heading to house at (${house.x},${house.y})`);
                            } else {
                                // Use unified task assignment function
                                assignDwarfTask(dwarf, chosen, rowIdx);
                                //console.log(`Dwarf ${dwarf.name} returning from drop-off with task assignment`);
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

    // Check if dwarf is at research/smelter location BEFORE accessing grid cells (they are outside main grid)
    // If so, use unified task assignment to respect priorities
    const atResearch = typeof research === 'object' && research !== null && dwarf.x === research.x && dwarf.y === research.y;
    const atSmelter = typeof smelter === 'object' && smelter !== null && dwarf.x === smelter.x && dwarf.y === smelter.y;

    if (dwarf.status === 'idle' && (atResearch || atSmelter) && dwarf.energy >= DWARF_ENERGY_COST_PER_RESEARCH) {
        // Dwarf at special location - use unified task assignment
        assignDwarfTask(dwarf, null, null);
        // Task was assigned (or all tasks blacklisted) - return either way
        return;
    }

    const curCell = row[originalX];

    let movedDownByChance = false;
    let skipHorizontalScan = false;

    // Idle dwarf - check for tasks based on priority
    if (dwarf.status === 'idle' && dwarf.energy >= DWARF_ENERGY_COST_PER_RESEARCH) {
        // Use unified task assignment (pass null for digging coords to allow continuing to digging logic below)
        const assignedTask = assignDwarfTask(dwarf, null, null);

        // If research or smelting was assigned, dwarf is moving to that task - return early
        if (assignedTask === 'research' || assignedTask === 'smelting') {
            return;
        }
        // If 'digging' would be assigned, we continue to the digging logic below
        // If null was returned, no valid task was available (all blacklisted) - continue to digging as fallback
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
                const continueWorkChance = DWARF_STRIKE_BASE_CHANCE + ((unionBusting ? unionBusting.level : 0) * RESEARCH_UNION_BUSTING_BONUS);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            reservedDigBy.set(curKey, dwarf.name);
            dwarf.status = 'digging';
            const prev = curCell.hardness;

            // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
            applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_DIG);
            gold = Math.max(0, gold - wage); // Deduct payment for digging
            pendingTransactions.push({ type: 'expense', amount: wage, description: `Digging wage for ${dwarf.name}` });
            // XP is now only awarded when a material is destroyed

            // Check for critical hit
            const critChance = calculateFinalCritChance(dwarf);
            const isCrit = Math.random() < critChance;
            let finalPower = isCrit ? power * CRITICAL_HIT_DAMAGE_MULTIPLIER : power;
            
            // Check for expertise one-hit on critical
            if (isCrit) {
                const mat = materials[curCell.materialId];
                const matType = mat ? mat.type : '';
                const isStone = matType.startsWith('Stone');
                const isOre = matType.startsWith('Ore');
                
                const stoneExpertise = researchtree.find(r => r.id === 'expertise-stone');
                const oreExpertise = researchtree.find(r => r.id === 'expertise-ore');
                
                let oneHitChance = 0;
                let expertiseType = null;
                
                if (isStone && stoneExpertise && stoneExpertise.level > 0) {
                    oneHitChance = stoneExpertise.level * STONE_EXPERTISE_ONE_HIT_CHANCE;
                    expertiseType = 'Stone';
                } else if (isOre && oreExpertise && oreExpertise.level > 0) {
                    oneHitChance = oreExpertise.level * ORE_EXPERTISE_ONE_HIT_CHANCE;
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
                handleBlockDestruction(curCell, dwarf, dwarf.x, dwarf.y);
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

            // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
            applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_MOVE);
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
                const continueWorkChance = DWARF_STRIKE_BASE_CHANCE + ((unionBusting ? unionBusting.level : 0) * RESEARCH_UNION_BUSTING_BONUS);
                if (Math.random() > continueWorkChance) {
                    dwarf.status = 'striking';
                    return;
                }
            }
            const prev = curCellDig.hardness;

            // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
            applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_DIG);
            gold = Math.max(0, gold - wage); // Deduct payment for digging
            pendingTransactions.push({ type: 'expense', amount: wage, description: `Digging wage for ${dwarf.name}` });
            // XP is now only awarded when a material is destroyed (see above)

            // Check for critical hit
            const critChance = calculateFinalCritChance(dwarf);
            const isCrit = Math.random() < critChance;
            let finalPower = isCrit ? power * CRITICAL_HIT_DAMAGE_MULTIPLIER : power;

            // Check for expertise one-hit on critical
            if (isCrit) {
                const mat = materials[curCellDig.materialId];
                const matType = mat ? mat.type : '';
                const isStone = matType.startsWith('Stone');
                const isOre = matType.startsWith('Ore');
                
                const stoneExpertise = researchtree.find(r => r.id === 'expertise-stone');
                const oreExpertise = researchtree.find(r => r.id === 'expertise-ore');
                
                let oneHitChance = 0;
                let expertiseType = null;
                
                if (isStone && stoneExpertise && stoneExpertise.level > 0) {
                    oneHitChance = stoneExpertise.level * STONE_EXPERTISE_ONE_HIT_CHANCE;
                    expertiseType = 'Stone';
                } else if (isOre && oreExpertise && oreExpertise.level > 0) {
                    oneHitChance = oreExpertise.level * ORE_EXPERTISE_ONE_HIT_CHANCE;
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
                handleBlockDestruction(curCellDig, dwarf, dwarf.x, dwarf.y);
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
        if (Math.random() < GRID_MOVE_DOWN_CHANCE) {
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
        // Check if dwarf has been stuck for a while - allow overriding reservations
        const tracked = stuckTracking.get(dwarf.name);
        const isNearStuck = tracked && tracked.ticks > STUCK_DETECTION_TICKS * 0.5;
        
        for (let offset = 0; offset < row.length; offset++) {
            const c = (originalX + dir * offset + row.length) % row.length;
            if (!(row[c] && row[c].hardness > 0)) continue;
            // Allow near-stuck dwarfs to override reservations
            if (!isNearStuck && isReservedForDig(c, rowIndex) && reservedDigBy.get(coordKey(c, rowIndex)) !== dwarf.name) continue;
            if (isCellOccupiedByStanding(c, rowIndex)) {
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
            // Fallback: move to random adjacent cell to break stuck state
            const randomCol = (dwarf.x + (Math.random() < 0.5 ? 1 : -1) + gridWidth) % gridWidth;
            scheduleMove(dwarf, randomCol, dwarf.y);
            return;
        }

        const nextRow = grid[nextRowIndex];
        let foundBelow = -1;
        const tracked = stuckTracking.get(dwarf.name);
        const isNearStuck = tracked && tracked.ticks > STUCK_DETECTION_TICKS * 0.5;

        for (let offset = 0; offset < nextRow.length; offset++) {
            const c = (originalX + dir * offset + nextRow.length) % nextRow.length;
            if (!(nextRow[c] && nextRow[c].hardness > 0)) continue;
            // Allow near-stuck dwarfs to override reservations
            if (!isNearStuck && isReservedForDig(c, nextRowIndex) && reservedDigBy.get(coordKey(c, nextRowIndex)) !== dwarf.name) continue;
            if (isCellOccupiedByStanding(c, nextRowIndex)) continue;
            foundBelow = c;
            break;
        }

        if (foundBelow === -1) {
            console.log(`No diggable cell found on row ${rowIndex} or row ${nextRowIndex} for dwarf ${dwarf.name}`);
            // Fallback: try moving to house or random location
            if (house && Math.random() < 0.7) {
                scheduleMove(dwarf, house.x, house.y);
            } else {
                const randomCol = Math.floor(Math.random() * gridWidth);
                const randomRow = Math.min(rowIndex + Math.floor(Math.random() * 3), grid.length - 1);
                scheduleMove(dwarf, randomCol, randomRow);
            }
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
                // Try adjacent column as fallback
                const altCol = (foundCol + 1) % gridWidth;
                if (!scheduleMove(dwarf, altCol, dwarf.y)) {
                    // Last resort: random movement
                    const randomCol = Math.floor(Math.random() * gridWidth);
                    scheduleMove(dwarf, randomCol, dwarf.y);
                }
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
            if (Math.random() < GRID_MOVE_UP_CHANCE) {
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
            if (Math.random() < GRID_MOVE_UP_CHANCE) {
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
    // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
    applyEnergyConsumption(dwarf, DWARF_ENERGY_COST_PER_DIG);
    gold = Math.max(0, gold - wage); // Deduct payment for digging
    pendingTransactions.push({ type: 'expense', amount: wage, description: `Digging wage for ${dwarf.name}` });

    // Check for critical hit
    const critChance = calculateFinalCritChance(dwarf);
    const isCrit = Math.random() < critChance;
    const finalPower = isCrit ? power * CRITICAL_HIT_DAMAGE_MULTIPLIER : power;

    target.hardness = Math.max(0, target.hardness - finalPower);
    
    // Record critical hit for animation
    if (isCrit) {
        pendingTransactions.push({ type: 'crit-hit', x: foundCol, y: targetRowIndex, dwarf: dwarf.name });
    }
    if (target.hardness === 0) {
        handleBlockDestruction(target, dwarf, foundCol, targetRowIndex);
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
        // Cool down smelter temperature with insulation research
        if (smelterTemperature > SMELTER_BASE_TEMPERATURE) {
            const insulationResearch = researchtree.find(r => r.id === 'furnace-insulation');
            const insulationLevel = insulationResearch ? (insulationResearch.level || 0) : 0;
            const coolingReduction = insulationLevel * RESEARCH_FURNACE_INSULATION_BONUS;
            const coolingRate = SMELTER_COOLING_RATE * (1 - coolingReduction);
            smelterTemperature = Math.max(SMELTER_BASE_TEMPERATURE, smelterTemperature * (1 - coolingRate));
        }

        // Apply interest from Small Time Investments research
        const smallTimeInvestments = researchtree.find(r => r.id === 'small-time-investments');
        if (smallTimeInvestments && (smallTimeInvestments.level || 0) > 0 && gold > 0) {
            let totalInterest = 0;

            // Apply cumulative tiered interest rates
            // Tier 1: First 1000 gold gets the highest rate
            const tier1Amount = Math.min(gold, RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT);
            totalInterest += tier1Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_RATE;

            // Tier 2: Gold between 1000 and 100k gets the second rate
            if (gold > RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT) {
                const tier2Amount = Math.min(gold - RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT,
                                             RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT - RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT);
                totalInterest += tier2Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_RATE;
            }

            // Tier 3: Gold between 100k and 10M gets the third rate
            if (gold > RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT) {
                const tier3Amount = Math.min(gold - RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT,
                                             RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_LIMIT - RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT);
                totalInterest += tier3Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_RATE;
            }

            if (totalInterest > 0) {
                gold += totalInterest;
                pendingTransactions.push({
                    type: 'income',
                    amount: totalInterest,
                    description: 'Interest from investments'
                });
            }
        }

        for (const d of dwarfs) {
            actForDwarf(d);
        }
        
        // Failsafe: Ensure smelter reservation is valid
        failsafeTickCounter++;
        if (failsafeTickCounter >= FAILSAFE_CHECK_INTERVAL) {
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
                gems,
                nextGemId,
                gold,
                toolsInventory,
                activeResearch,
                researchQueue,
                researchtree,
                shifted,
                smelterTemperature,
                smelterCoalMinTemp,
                smelterCoalMaxTemp,
                smelterMagmaMinTemp,
                smelterHeatingMode,
                smelterTasksData,
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
            gems = data.gems || [];
            nextGemId = data.nextGemId || 1;
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
            if (data.smelterTasksData) {
                smelterTasksData = JSON.parse(JSON.stringify(data.smelterTasksData));
            }
            dropGridStartX = data.dropGridStartX;
            gold = data.gold !== undefined ? data.gold : 1000;
            toolsInventory = data.toolsInventory || [];
            activeResearch = data.activeResearch || null;
            researchQueue = data.researchQueue ? JSON.parse(JSON.stringify(data.researchQueue)) : [];
            if (data.researchtree) {
                // Copy the full researchtree from main thread
                researchtree = JSON.parse(JSON.stringify(data.researchtree));
            }
            // Initialize smelter temperature state
            if (data.smelterTemperature !== undefined) smelterTemperature = data.smelterTemperature;
            if (data.smelterCoalMinTemp !== undefined) smelterCoalMinTemp = data.smelterCoalMinTemp;
            if (data.smelterCoalMaxTemp !== undefined) smelterCoalMaxTemp = data.smelterCoalMaxTemp;
            if (data.smelterMagmaMinTemp !== undefined) smelterMagmaMinTemp = data.smelterMagmaMinTemp;
            if (data.smelterHeatingMode !== undefined) smelterHeatingMode = data.smelterHeatingMode;
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
            // data may be undefined if message has no data payload
            if (data) {
                if (data.grid) grid = data.grid;
                if (data.dwarfs) dwarfs = data.dwarfs;
                if (data.startX !== undefined) startX = data.startX;
                if (data.materialsStock) materialsStock = data.materialsStock;
                if (data.gold !== undefined) gold = data.gold;
                if (data.gems !== undefined) gems = data.gems;
                if (data.toolsInventory) toolsInventory = data.toolsInventory;
                if (data.activeResearch !== undefined) {
                    activeResearch = data.activeResearch;
                    // if (activeResearch) {
                    //     console.log('Worker: Active research updated:', activeResearch.name);
                    // }
                }
                if (data.researchQueue !== undefined) {
                    researchQueue = JSON.parse(JSON.stringify(data.researchQueue));
                    console.log(`[WORKER] Research queue updated. Length: ${researchQueue.length}`, researchQueue);
                }
                if (data.researchtree) {
                    // Copy the full researchtree from main thread
                    researchtree = JSON.parse(JSON.stringify(data.researchtree));
                }
                if (data.smelterTasks) {
                    // Copy the smelter tasks from main thread
                    smelterTasks = JSON.parse(JSON.stringify(data.smelterTasks));
                }
                if (data.smelterTemperature !== undefined) smelterTemperature = data.smelterTemperature;
                if (data.smelterCoalMinTemp !== undefined) smelterCoalMinTemp = data.smelterCoalMinTemp;
                if (data.smelterCoalMaxTemp !== undefined) smelterCoalMaxTemp = data.smelterCoalMaxTemp;
                if (data.smelterMagmaMinTemp !== undefined) smelterMagmaMinTemp = data.smelterMagmaMinTemp;
                if (data.smelterHeatingMode !== undefined) smelterHeatingMode = data.smelterHeatingMode;
            }
            break;
            
        default:
            console.warn('Unknown message type:', type);
    }
});

console.log('Game worker loaded and ready');
