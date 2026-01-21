// Web Worker for game tick calculations
// This worker handles all the heavy computation for the game tick,
// preventing UI blocking during dwarf actions and grid updates.

// Import shared game constants, utilities, and management tasks
importScripts('constants.js', 'utils.js', 'management-tasks.js');

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
let masonry = null;
let management = null;
let smelterTasks = [];
let smelterTasksData = {};
let masonryTasks = [];
let masonryTasksData = {};
let dropGridStartX = 10;
let gold = 1000;
let toolsInventory = [];
let activeResearch = null;
let researchQueue = [];
let researchData = {}; // Research data object (id as key)
let researchTree = []; // Ordered array of research IDs
let pendingTransactions = []; // Queue of transactions to send to main thread
let hasForgedHighHardnessTool = false; // Track if player has successfully forged a tool with 100+ hardness material
let oneTimeInvestments = []; // Array of active one-time investments {amount, ticksRemaining, payoutPerTick, id}
let nextInvestmentId = 1; // Next investment ID to assign
let activeManagementTasks = []; // Array of active management tasks
let managementTasks = {}; // Management task definitions
let platingEffects = {}; // Plating effects definitions (initialized from defs.js via main thread)
let furnitureData = {}; // Furniture definitions (from defs.js via main thread)
let commonRoom = { furniture: {} }; // Common room furniture levels
let individualRooms = {}; // Individual room furniture levels (keyed by room ID)

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
let masonryReservedBy = null; // Track which dwarf name has reserved the masonry
let managementReservedBy = null; // Track which dwarf name has reserved the management cell

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
 * Checks task priority and blacklist, then assigns a random task from highest priority tier available
 * @param {Object} dwarf - The dwarf to assign a task to
 * @param {number|null} diggingX - X coordinate for digging (if returning to digging), or null
 * @param {number|null} diggingY - Y coordinate for digging (if returning to digging), or null
 * @returns {string|null} The task assigned ('research', 'smelting', 'managing', 'digging') or null if none available
 */
function assignDwarfTask(dwarf, diggingX = null, diggingY = null) {
    // Get dwarf's task priority lists (default if not set)
    const taskPriorityHigh = dwarf.taskPriorityHigh || [];
    const taskPriorityNormal = dwarf.taskPriorityNormal || ['digging', 'research', 'smelting', 'managing'];
    const taskPriorityNone = dwarf.taskPriorityNone || [];

    // STEP 1: Find all tasks the dwarf can do
    const allPossibleTasks = ['research', 'masonry', 'smelting', 'managing', 'digging'];

    const taskAvailability = {
        'research': activeResearch && (!researchReservedBy || researchReservedBy === dwarf.name) && typeof research === 'object' && research !== null && canDwarfAttemptResearch(dwarf),
        'masonry': masonryHasWork() && (!masonryReservedBy || masonryReservedBy === dwarf.name) && typeof masonry === 'object' && masonry !== null,
        'smelting': smelterHasWork() && (!smelterReservedBy || smelterReservedBy === dwarf.name) && typeof smelter === 'object' && smelter !== null,
        'managing': managementHasWork() && (!managementReservedBy || managementReservedBy === dwarf.name) && typeof management === 'object' && management !== null,
        'digging': true // Digging is always considered "available" in priority check
    };

    // Filter to only possible tasks (available and not in "no priority" list)
    const possibleTasks = allPossibleTasks.filter(taskId => {
        return taskAvailability[taskId] && !taskPriorityNone.includes(taskId);
    });

    // STEP 2: Debug output - which tasks are possible
    //console.log(`[${dwarf.name}] Task Assignment:`, {
    //    position: `(${dwarf.x}, ${dwarf.y})`,
    //    allAvailability: taskAvailability,
    //    possibleTasks: possibleTasks,
    //    priorityHigh: taskPriorityHigh,
    //    priorityNormal: taskPriorityNormal,
    //    priorityNone: taskPriorityNone
    //});

    // STEP 3: Check high priority tasks
    const possibleHighPriorityTasks = taskPriorityHigh.filter(taskId => possibleTasks.includes(taskId));

    //console.log(`[${dwarf.name}] High Priority Check:`, {
    //    configured: taskPriorityHigh,
    //    possible: possibleHighPriorityTasks
    //});

    if (possibleHighPriorityTasks.length > 0) {
        // Select random task from high priority
        const selectedTask = possibleHighPriorityTasks[Math.floor(Math.random() * possibleHighPriorityTasks.length)];
        //console.log(`[${dwarf.name}] ✅ Selected HIGH PRIORITY task: ${selectedTask}`);
        return executeTask(dwarf, selectedTask, diggingX, diggingY);
    }

    // STEP 4: Check normal priority tasks
    const possibleNormalPriorityTasks = taskPriorityNormal.filter(taskId => possibleTasks.includes(taskId));

    //console.log(`[${dwarf.name}] Normal Priority Check:`, {
    //    configured: taskPriorityNormal,
    //    possible: possibleNormalPriorityTasks
    //});

    if (possibleNormalPriorityTasks.length > 0) {
        // Select random task from normal priority
        const selectedTask = possibleNormalPriorityTasks[Math.floor(Math.random() * possibleNormalPriorityTasks.length)];
        //console.log(`[${dwarf.name}] ✅ Selected NORMAL PRIORITY task: ${selectedTask}`);
        return executeTask(dwarf, selectedTask, diggingX, diggingY);
    }

    // No task was assigned
    //console.log(`[${dwarf.name}] ❌ No task assigned (no possible tasks in high or normal priority)`);
    return null;
}

/**
 * Execute a specific task for a dwarf
 * @param {Object} dwarf - The dwarf to assign the task to
 * @param {string} taskId - The task to execute ('research', 'smelting', 'managing', 'digging')
 * @param {number|null} diggingX - X coordinate for digging, or null
 * @param {number|null} diggingY - Y coordinate for digging, or null
 * @returns {string} The task that was executed
 */
function executeTask(dwarf, taskId, diggingX = null, diggingY = null) {
    // Task configuration for location-based tasks
    const taskConfigs = {
        'research': { location: research, status: 'researching', emoji: '🔬', getReserved: () => researchReservedBy, setReserved: (name) => { researchReservedBy = name; } },
        'masonry': { location: masonry, status: 'masonry', emoji: '🔨', getReserved: () => masonryReservedBy, setReserved: (name) => { masonryReservedBy = name; } },
        'smelting': { location: smelter, status: 'smelting', emoji: '🔥', getReserved: () => smelterReservedBy, setReserved: (name) => { smelterReservedBy = name; } },
        'managing': { location: management, status: 'managing', emoji: '💼', getReserved: () => managementReservedBy, setReserved: (name) => { managementReservedBy = name; } }
    };

    const config = taskConfigs[taskId];
    if (config) {
        const { location, status, emoji, getReserved, setReserved } = config;
        const reservedBy = getReserved();

        if (dwarf.x === location.x && dwarf.y === location.y) {
            // Already at location - start task immediately if not reserved by another
            if (reservedBy === dwarf.name || !reservedBy) {
                setReserved(dwarf.name);
                dwarf.status = status;
                //console.log(`[${dwarf.name}] ${emoji} Started ${taskId} (already at location)`);
                return taskId;
            }
        } else {
            // Not at location - move there
            setReserved(dwarf.name);
            scheduleMove(dwarf, location.x, location.y);
            dwarf.status = 'moving';
            //console.log(`[${dwarf.name}] 🚶 Moving to ${taskId} at (${location.x}, ${location.y})`);
            return taskId;
        }
    } else if (taskId === 'digging') {
        // If digging coordinates provided, move there; otherwise just signal digging task
        if (diggingX !== null && diggingY !== null) {
            scheduleMove(dwarf, diggingX, diggingY);
        }
        //console.log(`[${dwarf.name}] ⛏️ Assigned digging task`);
        return 'digging';
    }

    // Shouldn't reach here, but return the taskId anyway
    return taskId;
}

function isCellOccupiedByStanding(x, y) {
    return dwarfs.some(d => d.x === x && d.y === y && d.status !== 'moving');
}

function isReservedForDig(x, y) {
    return reservedDigBy.has(coordKey(x, y));
}

// Note: getMaterialById, selectRandomGem, hasRandomiumPlating, getRandomOreAtDepth,
// getSmeltedOutputForOre, and applyRandomPlatingEffect are now in utils.js

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

        // Apply Randomium plating transmutation effects
        let finalMatId = matId;
        if (hasRandomiumPlating(dwarf)) {
            const randomiumEffect = platingEffects['randomium'];
            const depth = (y + startX) || 0;
            console.log(`🎲 [Randomium] ${dwarf.name} mining with Randomium plating at depth ${depth}, material: ${mat ? mat.name : matId} (type: ${mat ? mat.type : 'unknown'})`);

            // Check stone → ore transformation (5% chance)
            if (mat && mat.type && mat.type.startsWith('Stone')) {
                const stoneRoll = Math.random();
                console.log(`🎲 [Randomium] Stone check - roll: ${(stoneRoll * 100).toFixed(2)}% vs ${(randomiumEffect.stoneToOreChance * 100).toFixed(0)}% chance`);
                if (stoneRoll < randomiumEffect.stoneToOreChance) {
                    const randomOre = getRandomOreAtDepth(depth);
                    console.log(`🎲 [Randomium] Stone → Ore triggered! Available ore at depth: ${randomOre || 'none'}`);
                    if (randomOre) {
                        finalMatId = randomOre;
                        const oreMat = materials[randomOre];
                        console.log(`🎲 [Randomium] ✅ Stone → Ore transmutation! ${mat.name} turned into ${oreMat ? oreMat.name : randomOre}`);
                        pendingTransactions.push({ type: 'randomium-transmute', x: x, y: y, dwarf: dwarf.name, from: matId, to: finalMatId, transmutation: 'stone-to-ore' });
                    }
                }
            }

            // Check ore → smelted transformation (5% chance)
            if (mat && mat.type && mat.type.includes('Ore')) {
                const oreRoll = Math.random();
                console.log(`🎲 [Randomium] Ore check - roll: ${(oreRoll * 100).toFixed(2)}% vs ${(randomiumEffect.oreToSmeltedChance * 100).toFixed(0)}% chance`);
                if (oreRoll < randomiumEffect.oreToSmeltedChance) {
                    const smeltedOutput = getSmeltedOutputForOre(matId);
                    console.log(`🎲 [Randomium] Ore → Smelted triggered! Smelted output for ${matId}: ${smeltedOutput || 'none (recipe not unlocked)'}`);
                    if (smeltedOutput) {
                        finalMatId = smeltedOutput;
                        const smeltedMat = materials[smeltedOutput];
                        console.log(`🎲 [Randomium] ✅ Ore → Smelted transmutation! ${mat.name} turned into ${smeltedMat ? smeltedMat.name : smeltedOutput}`);
                        pendingTransactions.push({ type: 'randomium-transmute', x: x, y: y, dwarf: dwarf.name, from: matId, to: finalMatId, transmutation: 'ore-to-smelted' });
                    }
                }
            }

            // Check for random other plating effect (5% chance)
            const effectRoll = Math.random();
            console.log(`🎲 [Randomium] Random effect check - roll: ${(effectRoll * 100).toFixed(2)}% vs ${(randomiumEffect.randomPlatingChance * 100).toFixed(0)}% chance`);
            if (effectRoll < randomiumEffect.randomPlatingChance) {
                const randomEffect = applyRandomPlatingEffect(dwarf, { cell, depth, x, y });
                if (randomEffect) {
                    console.log(`🎲 [Randomium] ✅ Random plating effect triggered: ${randomEffect.effect.name}`);
                    pendingTransactions.push({ type: 'randomium-random-effect', x: x, y: y, dwarf: dwarf.name, effect: randomEffect.effect.name });
                }
            }

            console.log(`🎲 [Randomium] Final material collected: ${finalMatId} (original: ${matId})`);
        }

        dwarf.bucket[finalMatId] = (dwarf.bucket[finalMatId] || 0) + 1;

        // Award XP only when material is destroyed
        if (mat && typeof mat.hardness === 'number') {
            const xpGain = Math.ceil(Math.sqrt(mat.hardness));
            dwarf.xp = (dwarf.xp || 0) + xpGain;
        }
    }
}

/**
 * Apply nuclear explosion effects from Plutonium plating
 * - Sets hardness of adjacent cells (8 surrounding) to 1
 * - Halves hardness of cells 2 steps away
 * - Sets energy of dwarfs in affected cells to 50%
 * @param {number} centerX - X coordinate of explosion center
 * @param {number} centerY - Y coordinate of explosion center
 */
function applyNuclearExplosion(centerX, centerY) {
    const affectedCells = [];

    // Process cells in a 5x5 grid centered on the explosion
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            // Skip center cell (already destroyed)
            if (dx === 0 && dy === 0) continue;

            const targetX = (centerX + dx + gridWidth) % gridWidth; // Wrap horizontally
            const targetY = centerY + dy;

            // Skip if out of vertical bounds
            if (targetY < 0 || targetY >= grid.length) continue;

            const distance = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance

            // Get the cell
            const row = grid[targetY];
            if (!row || !row[targetX]) continue;
            const cell = row[targetX];

            // Skip empty cells
            if (!cell.materialId || cell.hardness === 0) continue;

            let effect = null;

            if (distance === 1) {
                // Adjacent cells (8 surrounding): set hardness to 1
                const originalHardness = cell.hardness;
                cell.hardness = 1;
                effect = 'weakened';
                console.log(`☢️ Nuclear blast weakened cell at (${targetX},${targetY}) from ${originalHardness} to 1`);
            } else if (distance === 2) {
                // Cells 2 steps away: halve hardness
                const originalHardness = cell.hardness;
                cell.hardness = Math.ceil(cell.hardness / 2);
                effect = 'damaged';
                console.log(`☢️ Nuclear blast damaged cell at (${targetX},${targetY}) from ${originalHardness} to ${cell.hardness}`);
            }

            if (effect) {
                affectedCells.push({ x: targetX, y: targetY, effect: effect });
            }
        }
    }

    // Affect dwarfs in the blast radius
    for (const dwarf of dwarfs) {
        const dx = Math.abs(dwarf.x - centerX);
        const dy = Math.abs(dwarf.y - centerY);

        // Wrap around horizontal distance
        const wrappedDx = Math.min(dx, gridWidth - dx);
        const distance = Math.max(wrappedDx, dy);

        if (distance > 0 && distance <= 2) {
            // Reduce dwarf energy to 50%
            const originalEnergy = dwarf.energy;
            dwarf.energy = Math.ceil(dwarf.energy * 0.5);
            console.log(`☢️ Nuclear radiation affected ${dwarf.name} at (${dwarf.x},${dwarf.y}) - energy reduced from ${originalEnergy} to ${dwarf.energy}`);
        }
    }

    // Add affected cells to transactions for animation
    if (affectedCells.length > 0) {
        pendingTransactions.push({
            type: 'nuclear-radiation',
            cells: affectedCells
        });
    }
}

// Check if a masonry task is unlocked by research
function isMasonryTaskUnlocked(task) {
    if (!task || !task.requires) return true;
    const research = researchData[task.requires];
    return research && (research.level || 0) >= 1;
}

// Check if the masonry has any actionable work (not "do nothing" as first task, and has materials)
function masonryHasWork() {
    if (!masonryTasks || masonryTasks.length === 0) return false;

    // Check each task in priority order
    for (const taskId of masonryTasks) {
        if (taskId === 'do-nothing') {
            // If "do nothing" is encountered, stop checking
            return false;
        }
        const task = masonryTasksData[taskId];
        // Check if task is unlocked
        if (!isMasonryTaskUnlocked(task)) {
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
        if (!task) continue;

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
                // Magma heating is needed
                return true;
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

                // Check if we have coal
                if (task.input && task.input.material && task.input.amount) {
                    const stockAmount = materialsStock[task.input.material] || 0;
                    if (stockAmount >= task.input.amount) {
                        return true; // Coal heating is available
                    }
                }
                continue; // Coal heating not needed or no coal available
            }
        }

        // For smelting tasks with temperature requirements, check if furnace is hot enough
        if (task.minTemp && smelterTemperature < task.minTemp) {
            continue; // Skip tasks that require higher temperature
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

// Check if management has any active tasks
function managementHasWork() {
    if (!activeManagementTasks || activeManagementTasks.length === 0) return false;
    // Check if there are any active management tasks
    return activeManagementTasks.some(task => task.active);
}

// Find the first active management task
function findActiveManagementTask() {
    if (!activeManagementTasks || activeManagementTasks.length === 0) return null;
    // Return the first active task in priority order
    return activeManagementTasks.find(task => task.active);
}

// Execute a completed management task (delegated to management-tasks.js)
function executeManagementTaskWrapper(task, taskDef) {
    // Build context object with all game state
    const context = {
        gold,
        materials,
        materialsStock,
        gems,
        dwarfs,
        researchData,
        researchTree,
        activeResearch,
        researchQueue,
        smelterTasks,
        smelterTasksData,
        smelterCoalMinTemp,
        smelterCoalMaxTemp,
        smelterMagmaMinTemp,
        SMELTER_MAX_TEMPERATURE_LIMIT,
        managementTasks,
        pendingTransactions,
        startX,
        RESEARCH_COST_MULTIPLIER,
        oneTimeInvestments,
        nextInvestmentId
    };

    // Call the external function
    const updatedContext = executeManagementTask(task, taskDef, context);

    // Update game state from returned context
    gold = updatedContext.gold;
    activeResearch = updatedContext.activeResearch;
    oneTimeInvestments = updatedContext.oneTimeInvestments;
    nextInvestmentId = updatedContext.nextInvestmentId;
    // Update smelter state if furnace automations changed them
    if (updatedContext.smelterCoalMinTemp !== undefined) smelterCoalMinTemp = updatedContext.smelterCoalMinTemp;
    if (updatedContext.smelterCoalMaxTemp !== undefined) smelterCoalMaxTemp = updatedContext.smelterCoalMaxTemp;
    if (updatedContext.smelterMagmaMinTemp !== undefined) smelterMagmaMinTemp = updatedContext.smelterMagmaMinTemp;
    // Note: materials, materialsStock, gems, dwarfs, researchQueue, smelterTasks are passed by reference and modified in place
}

// Find the first actionable masonry task
function findActionableMasonryTask() {
    if (!masonryTasks || masonryTasks.length === 0) return null;

    for (const taskId of masonryTasks) {
        if (taskId === 'do-nothing') {
            return null; // Stop at "do nothing"
        }
        const task = masonryTasksData[taskId];
        // Check if task is unlocked
        if (!isMasonryTaskUnlocked(task)) {
            continue; // Skip locked tasks
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

/**
 * Generic workshop task handler for masonry and smelter
 * Handles the common logic for both workshop types
 */
function handleWorkshopTask(dwarf, workshopConfig) {
    const {
        workshopType,        // 'masonry' or 'smelting'
        location,            // masonry or smelter object
        reservedBy,          // masonryReservedBy or smelterReservedBy
        setReservedBy,       // Function to set reservation
        currentTaskField,    // 'currentMasonryTask' or 'currentSmelterTask'
        findTaskFunction,    // findActionableMasonryTask or findActionableSmelterTask
        handleOutputFunction, // handleMasonryTaskOutput or handleSmelterTaskOutput
        tasksData,           // masonryTasksData or smelterTasksData
        transactionPrefix    // 'Masonry' or 'Smelter'
    } = workshopConfig;

    // Check if at workshop location
    if (typeof location !== 'object' || location === null || dwarf.x !== location.x || dwarf.y !== location.y) {
        // Not at workshop location, release reservation and become idle
        if (reservedBy === dwarf.name) setReservedBy(null);
        if (workshopType === 'smelting' && managementReservedBy === dwarf.name) managementReservedBy = null;
        dwarf.status = 'idle';
        dwarf[currentTaskField] = null;
        return;
    }

    // Check if dwarf has enough energy (energy cost scales with wisdom including furniture bonus)
    if (dwarf.energy < (DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf))) {
        // Don't reset progress when dwarf stops - allow continuation by next dwarf
        if (reservedBy === dwarf.name) setReservedBy(null);
        if (workshopType === 'smelting' && managementReservedBy === dwarf.name) managementReservedBy = null;
        dwarf.status = 'idle';
        dwarf[currentTaskField] = null;
        return;
    }

    // Check if we can afford to pay the dwarf
    const wage = calculateWage(dwarf);
    if (gold < wage) {
        // Not enough gold - check if dwarf will strike
        if (Math.random() > DWARF_STRIKE_BASE_CHANCE) {
            dwarf.status = 'striking';
            return;
        }
    }

    // Find an actionable task from the priority list
    const taskResult = findTaskFunction();
    if (!taskResult) {
        // No work available, release workshop and become idle
        // Don't reset progress - allow continuation when work becomes available
        if (reservedBy === dwarf.name) setReservedBy(null);
        if (workshopType === 'smelting' && managementReservedBy === dwarf.name) managementReservedBy = null;
        dwarf.status = 'idle';
        dwarf[currentTaskField] = null;
        return;
    }

    const task = taskResult.task;
    const taskId = taskResult.taskId;

    // Check if this is a task that requires time (has ticksRequired property)
    if (task.ticksRequired && task.ticksRequired > 0) {
        // Initialize or validate task tracking
        if (!dwarf[currentTaskField] || dwarf[currentTaskField] !== taskId) {
            // Starting a new task or switching tasks
            dwarf[currentTaskField] = taskId;

            // For gem cutting, find the gem that's already being worked on or start a new one
            if (task.type === 'gem-cutting') {
                // First, try to find a gem that's already in progress
                let gemToProcess = gems.find(g => g.markedForCutting && !g.polished && g.cuttingProgress > 0);

                // If no gem in progress, find any gem marked for cutting
                if (!gemToProcess) {
                    gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
                }

                if (gemToProcess) {
                    // Track which gem we're working on
                    task.currentGemId = gemToProcess.id;

                    // Calculate dynamic ticks required based on gem carats
                    // Formula: base ticks + (2 × carats)
                    const gemCarats = gemToProcess.carats || 1;
                    task.ticksRequired = GEM_CUTTING_BASE_TICKS + (GEM_CUTTING_TICKS_PER_CARAT * gemCarats);

                    // Initialize progress if needed
                    if (!gemToProcess.cuttingProgress) {
                        gemToProcess.cuttingProgress = 0;
                    }

                    // Restore progress from the gem to the task
                    task.progress = gemToProcess.cuttingProgress;
                }
            }
        }

        // Always ensure progress is initialized
        if (task.progress === undefined || isNaN(task.progress)) {
            task.progress = 0;
        }

        // Implement wisdom-based difficulty system for output tasks
        let totalProgressGained = 0;

        // For tasks with output, use hardness-based difficulty
        if (task.output && task.output.material && task.hardness !== undefined) {
            const hardness = task.hardness;

            // Calculate how many runs the dwarf gets based on wisdom (including furniture bonus)
            let currentWisdom = getEffectiveWisdom(dwarf);
            let runNumber = 1;

            while (true) {
                const smeltingPower = currentWisdom * SMELTER_WISDOM_PROBABILITY_BONUS;
                const roll = Math.random() * hardness;

                // Use minimum success chance if power is too low
                const minChanceRoll = Math.random();
                const minChanceSuccess = minChanceRoll < SMELTER_MIN_SUCCESS_CHANCE;
                const normalSuccess = roll <= smeltingPower;
                const success = normalSuccess || minChanceSuccess;

                if (!success) {
                    break;
                }

                // Success! Gain 1 progress
                totalProgressGained++;

                // Halve wisdom for next run
                if (getEffectiveWisdom(dwarf) > 0) {
                    currentWisdom = Math.floor(currentWisdom / 2);
                } else {
                    break;
                }

                // Safety check
                if (runNumber > 20) break;
                runNumber++;
            }
        } else if (task.type === 'gem-cutting') {
            // For gem cutting, only make progress if we have a gem assigned
            if (task.currentGemId) {
                totalProgressGained = 1;
            } else {
                // No gem available, reset task and abort
                task.progress = 0;
                dwarf[currentTaskField] = null;
                return; // Skip the rest of this tick
            }
        } else if (task.type === 'heating') {
            // Heating tasks always make progress
            totalProgressGained = 1;
        } else {
            // For other tasks without output, just increment by 1
            totalProgressGained = 1;
        }

        // Apply progress to the task
        task.progress += totalProgressGained;

        // For gem cutting, sync progress with the specific gem
        if (task.type === 'gem-cutting' && task.currentGemId) {
            const gemToProcess = gems.find(g => g.id === task.currentGemId);
            if (gemToProcess) {
                gemToProcess.cuttingProgress = task.progress;
            }
        }

        // Check if task is complete
        if (task.progress >= task.ticksRequired) {
            task.progress = task.ticksRequired;

            // Task complete! Process the result

            // Handle gem cutting completion
            if (task.type === 'gem-cutting' && task.currentGemId) {
                const gemToProcess = gems.find(g => g.id === task.currentGemId);
                if (gemToProcess) {
                    gemToProcess.polished = true;
                    gemToProcess.markedForCutting = false;
                    delete gemToProcess.cuttingProgress;

                    // Increase value by GEM_CUTTING_VALUE_MULTIPLIER (1.8x = 80% increase)
                    gemToProcess.value = Math.round(gemToProcess.value * GEM_CUTTING_VALUE_MULTIPLIER);

                    console.log(`Gem ${gemToProcess.id} polished! New value: ${gemToProcess.value}`);
                }
                delete task.currentGemId;
                task.progress = 0;
                dwarf[currentTaskField] = null;
            }
            // Handle heating task completion (smelter only)
            else if (task.type === 'heating' && task.heatGain) {
                const furnaceTemp = researchData['furnace-temperature'];
                const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
                const maxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

                if (task.heatGain === 'dynamic') {
                    smelterTemperature = maxTemp;
                } else {
                    const coalMaxTemp = 2000;
                    smelterTemperature = Math.min(coalMaxTemp, smelterTemperature + task.heatGain);
                }

                // Consume input materials for heating tasks
                if (task.inputs && Array.isArray(task.inputs)) {
                    task.inputs.forEach(input => {
                        materialsStock[input.material] = (materialsStock[input.material] || 0) - input.amount;
                    });
                } else if (task.input && task.input.material && task.input.amount) {
                    materialsStock[task.input.material] = (materialsStock[task.input.material] || 0) - task.input.amount;
                }

                task.progress = 0;
                dwarf[currentTaskField] = null;
            }
            else {
                // Handle normal workshop task completion
                handleOutputFunction(task, dwarf);

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

                // Reset task progress for next execution
                task.progress = 0;
                dwarf[currentTaskField] = null;
            }
        }

        // Consume energy and pay wage (energy cost scales with wisdom including furniture bonus)
        const energyCostPerTick = DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf);
        dwarf.energy = Math.max(0, dwarf.energy - energyCostPerTick);

        // Pay wage
        gold -= wage;
        // Note: No transaction logged for masonry tasks - they just process existing materials
        // Wage expense is already tracked separately in the wage transaction

        // Award XP for workshop work (based on task hardness)
        const xpGain = Math.ceil(Math.sqrt(task.hardness || 1));
        dwarf.xp = (dwarf.xp || 0) + xpGain;

    } else if (workshopType === 'smelting') {
        // Immediate task (no ticksRequired) - only for smelter
        // Consume input materials
        if (task.inputs && Array.isArray(task.inputs)) {
            task.inputs.forEach(input => {
                materialsStock[input.material] = (materialsStock[input.material] || 0) - input.amount;
            });
        } else if (task.input && task.input.material && task.input.amount) {
            materialsStock[task.input.material] = (materialsStock[task.input.material] || 0) - task.input.amount;
        }

        // Handle heating task
        if (task.type === 'heating' && task.heatGain) {
            const furnaceTemp = researchData['furnace-temperature'];
            const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
            const maxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

            if (task.heatGain === 'dynamic') {
                smelterTemperature = maxTemp;
            } else {
                const coalMaxTemp = 2000;
                smelterTemperature = Math.min(coalMaxTemp, smelterTemperature + task.heatGain);
            }
        } else if (task.output) {
            handleOutputFunction(task, dwarf);
        }

        // Pay the dwarf, consume energy and award XP
        gold = Math.max(0, gold - wage);
        pendingTransactions.push({ type: 'expense', amount: wage, description: `${transactionPrefix} wage for ${dwarf.name}` });
        applyEnergyConsumption(dwarf, DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf));
        dwarf.xp = (dwarf.xp || 0) + DWARF_XP_PER_ACTION;

        return;
    } else {
        // Immediate task for masonry (should not happen) - release workshop and become idle
        if (reservedBy === dwarf.name) setReservedBy(null);
        if (workshopType === 'smelting' && managementReservedBy === dwarf.name) managementReservedBy = null;
        dwarf.status = 'idle';
        dwarf[currentTaskField] = null;
    }
}

// Handle masonry task output production including break chance and bonus ore
function handleMasonryTaskOutput(task, dwarf) {
    // Skip if task has no output (e.g., gem cutting, control tasks)
    if (!task.output) return;

    const outputMaterial = task.output.material;
    const outputAmount = task.output.amount;

    // Check for break chance (for polishing tasks)
    let success = true;
    if (task.breakChance && task.breakChance > 0) {
        const stonePolishing = researchData['stone-polishing'];
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
            }
        }
    }
}

// Handle smelter task output production including break chance and bonus ore
function handleSmelterTaskOutput(task, dwarf) {
    const outputMaterial = task.output.material;
    const outputAmount = task.output.amount;

    // Check for break chance (for polishing tasks)
    let success = true;
    if (task.breakChance && task.breakChance > 0) {
        const stonePolishing = researchData['stone-polishing'];
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
            //console.log(`Checking bonus ore: chance=${task.bonusChance}, type=${task.bonusType}, amount=${task.bonusAmount}`);
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
                //console.log(`Bonus roll failed for ${dwarf.name}`);
            }
        }
    }
}

/**
 * Calculate total furniture bonuses for a dwarf based on common room and their individual room
 * @param {Object} dwarf - The dwarf to calculate bonuses for
 * @returns {Object} Object containing all furniture bonuses (restBonus, maxEnergyBonus, digPowerBonus, critChanceBonus, strengthBonus, wisdomBonus)
 */
function calculateFurnitureBonuses(dwarf) {
    const bonuses = {
        restBonus: 0,           // Additive percentage bonus to rest recovery
        maxEnergyBonus: 0,      // Flat bonus to max energy
        digPowerBonus: 0,       // Additive percentage bonus to dig power
        critChanceBonus: 0,     // Additive bonus to crit chance
        strengthBonus: 0,       // Flat bonus to strength
        wisdomBonus: 0          // Flat bonus to wisdom
    };

    // Add bonuses from common room furniture (applies to all dwarfs)
    if (commonRoom && commonRoom.furniture) {
        for (const furnitureId in commonRoom.furniture) {
            const furnitureLevel = commonRoom.furniture[furnitureId]?.level || 0;
            if (furnitureLevel > 0 && furnitureData[furnitureId]) {
                const effect = furnitureData[furnitureId].effect;
                if (effect) {
                    if (effect.restBonus) bonuses.restBonus += effect.restBonus * furnitureLevel;
                    if (effect.maxEnergyBonus) bonuses.maxEnergyBonus += effect.maxEnergyBonus * furnitureLevel;
                    if (effect.digPowerBonus) bonuses.digPowerBonus += effect.digPowerBonus * furnitureLevel;
                    if (effect.critChanceBonus) bonuses.critChanceBonus += effect.critChanceBonus * furnitureLevel;
                    if (effect.strengthBonus) bonuses.strengthBonus += effect.strengthBonus * furnitureLevel;
                    if (effect.wisdomBonus) bonuses.wisdomBonus += effect.wisdomBonus * furnitureLevel;
                }
            }
        }
    }

    // Add bonuses from dwarf's individual room
    const roomId = dwarf.roomId;
    if (roomId && individualRooms[roomId] && individualRooms[roomId].furniture) {
        for (const furnitureId in individualRooms[roomId].furniture) {
            const furnitureLevel = individualRooms[roomId].furniture[furnitureId]?.level || 0;
            if (furnitureLevel > 0 && furnitureData[furnitureId]) {
                const effect = furnitureData[furnitureId].effect;
                if (effect) {
                    if (effect.restBonus) bonuses.restBonus += effect.restBonus * furnitureLevel;
                    if (effect.maxEnergyBonus) bonuses.maxEnergyBonus += effect.maxEnergyBonus * furnitureLevel;
                    if (effect.digPowerBonus) bonuses.digPowerBonus += effect.digPowerBonus * furnitureLevel;
                    if (effect.critChanceBonus) bonuses.critChanceBonus += effect.critChanceBonus * furnitureLevel;
                    if (effect.strengthBonus) bonuses.strengthBonus += effect.strengthBonus * furnitureLevel;
                    if (effect.wisdomBonus) bonuses.wisdomBonus += effect.wisdomBonus * furnitureLevel;
                }
            }
        }
    }

    return bonuses;
}

function getDwarfToolPower(dwarf) {

    // Calculate power: (Dwarf Base Power * Level Bonus) * Research Bonus * Tool Power * Furniture Bonus
    const baseDigPower = dwarf.digPower || 0;
    const modifiedDigPower = getDiamondModifiedDigPower(dwarf, baseDigPower);
    const levelBonus = 1 + modifiedDigPower * DWARF_DIG_POWER_BONUS;

    // Apply improved-digging research bonus
    const improvedDigging = researchData['improved-digging'];
    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * RESEARCH_IMPROVED_DIGGING_BONUS : 0);

    // Apply furniture dig power bonus
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);
    const furnitureDigBonus = 1 + furnitureBonuses.digPowerBonus;

    if (!dwarf.toolId) return (DWARF_BASE_POWER * levelBonus) * researchBonus * furnitureDigBonus; // default power if no tool
    const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
    if (!toolInstance) return (DWARF_BASE_POWER * levelBonus) * researchBonus * furnitureDigBonus;
    // Check if tool has custom power (forged tools) or use base definition
    let toolPower;
    if (toolInstance.power !== undefined) {
        // Forged tool with custom power
        toolPower = toolInstance.power / 100;
    } else {
        // Base tool - look up definition
        const toolDef = tools.find(t => t.name === toolInstance.type);
        if (!toolDef) return (DWARF_BASE_POWER * levelBonus) * researchBonus * furnitureDigBonus;
        toolPower = toolDef.power / 100;
    }

    // Apply enchantment bonus (1% per enchantment level)
    const enchantBonus = 1 + (toolInstance.enchantLevel || 0) * ENCHANT_POWER_BONUS;

    return (DWARF_BASE_POWER * levelBonus) * researchBonus * toolPower * enchantBonus * furnitureDigBonus;
}

/**
 * Calculate critical hit chance including furniture bonuses
 * Wraps calculateFinalCritChance from utils.js and adds furniture critChanceBonus
 * @param {Object} dwarf - The dwarf performing the action
 * @returns {number} Final critical hit chance as a decimal (0-1)
 */
function getCritChanceWithFurniture(dwarf) {
    // Get base crit chance from utils.js (includes research, gems, plating)
    let critChance = calculateFinalCritChance(dwarf);

    // Add furniture crit chance bonus (additive)
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);
    critChance += furnitureBonuses.critChanceBonus;

    return critChance;
}

/**
 * Get effective wisdom for a dwarf including furniture bonuses
 * @param {Object} dwarf - The dwarf to get wisdom for
 * @returns {number} Effective wisdom value
 */
function getEffectiveWisdom(dwarf) {
    const baseWisdom = dwarf.wisdom || 0;
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);
    return baseWisdom + furnitureBonuses.wisdomBonus;
}

/**
 * Get effective strength for a dwarf including furniture bonuses
 * @param {Object} dwarf - The dwarf to get strength for
 * @returns {number} Effective strength value
 */
function getEffectiveStrength(dwarf) {
    const baseStrength = dwarf.strength || 0;
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);
    return baseStrength + furnitureBonuses.strengthBonus;
}

/**
 * Calculate bucket capacity with furniture strength bonus
 * Wraps calculateDwarfBucketCapacity from utils.js and adds furniture strengthBonus
 * @param {Object} dwarf - The dwarf to calculate capacity for
 * @returns {number} Total bucket capacity in kg
 */
function getBucketCapacityWithFurniture(dwarf) {
    // Get furniture strength bonus
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);

    // Create a temporary dwarf object with increased strength for calculation
    const dwarfWithBonus = {
        ...dwarf,
        strength: (dwarf.strength || 0) + furnitureBonuses.strengthBonus
    };

    return calculateDwarfBucketCapacity(dwarfWithBonus);
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
            // Only shift dwarfs that are within the grid.
            // Dwarfs in the function row (y < 0) should not be shifted.
            if (d.y >= 0) {
                d.y = Math.max(0, d.y - 1);
            }
            if (d.moveTarget && typeof d.moveTarget.y === 'number' && d.moveTarget.y >= 0) {
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
    // If a dwarf is resting but not at the house, it's an invalid state.
    // Correct it by setting them to idle so they can be reassigned a task (like moving to the house).
    if (dwarf.status === 'resting' && house && (dwarf.x !== house.x || dwarf.y !== house.y)) {
        console.warn(`[State Correction] Dwarf ${dwarf.name} was 'resting' at wrong location (${dwarf.x},${dwarf.y}). House is at (${house.x},${house.y}). Setting to 'idle'.`);
        dwarf.status = 'idle';
    }

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
        smelter: smelterReservedBy === dwarf.name,
        management: managementReservedBy === dwarf.name
    };

    // Check for stuck dwarf - only track when actively moving or digging
    const shouldTrackStuck = (dwarf.status === 'moving' || dwarf.status === 'digging' || dwarf.status === 'idle');
    // Functions grid (y=-1) has no hardness, only check main grid cells
    const cellHardness = (dwarf.y >= 0 && grid[dwarf.y] && grid[dwarf.y][dwarf.x]) ? grid[dwarf.y][dwarf.x].hardness : 0;
    const trackKey = dwarf.name; // Use name as unique key
    const tracked = stuckTracking.get(trackKey);
    
    if (shouldTrackStuck) {
        if (tracked) {
            // Check if dwarf moved or made progress digging
            const positionChanged = tracked.x !== dwarf.x || tracked.y !== dwarf.y;
            const progressMade = cellHardness < tracked.hardness;
            if (positionChanged || progressMade) {
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

                    console.warn(`[stuck] Dwarf ${dwarf.name} stuck for ${tracked.ticks} ticks, teleporting to house`);
                    console.log(`  [stuck] Position: (${dwarf.x}, ${dwarf.y}), Status: ${dwarf.status}`);
                    console.log(`  [stuck] Move Target: ${dwarf.moveTarget ? `(${dwarf.moveTarget.x}, ${dwarf.moveTarget.y})` : 'None'}`);
                    console.log(`  [stuck] Reservations: ${digReservations.length > 0 ? `Dig cells: ${digReservations.join(', ')}` : ''}${hasResearch ? ' Research' : ''}${hasSmelter ? ' Smelter' : ''}${digReservations.length === 0 && !hasResearch && !hasSmelter ? 'None' : ''}`);

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
                    if (masonryReservedBy === dwarf.name) masonryReservedBy = null;
                    if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                    if (managementReservedBy === dwarf.name) managementReservedBy = null;
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

    // Failsafe: Release smelter and masonry reservation if dwarf is at house and not actively working
    if (typeof house === 'object' && house !== null && dwarf.x === house.x && dwarf.y === house.y) {
        if (dwarf.status !== 'resting' && dwarf.status !== 'idle') {
            if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
            if (masonryReservedBy === dwarf.name) masonryReservedBy = null;
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
                if (masonryReservedBy === dwarf.name) masonryReservedBy = null;
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                if (managementReservedBy === dwarf.name) managementReservedBy = null;
                scheduleMove(dwarf, house.x, house.y);
                dwarf.status = 'moving';
                return;
            }
        }
    }

    // Resting state
    if (dwarf.status === 'resting') {
        // Calculate furniture bonuses for this dwarf
        const furnitureBonuses = calculateFurnitureBonuses(dwarf);

        // Max energy = base + furniture bonus
        const baseMaxEnergy = dwarf.maxEnergy || 100;
        const maxEnergy = baseMaxEnergy + furnitureBonuses.maxEnergyBonus;

        // Apply better-housing research bonus with diminishing returns
        const betterHousing = researchData['better-housing'];
        const housingLevel = betterHousing ? (betterHousing.level || 0) : 0;
        const researchRestBonus = housingLevel > 0 ? 1 + (housingLevel * RESEARCH_BETTER_HOUSING_BASE_BONUS) / (1 + housingLevel * RESEARCH_BETTER_HOUSING_DIMINISH) : 1;

        // Combine research bonus (multiplier) with furniture bonus (additive percentage)
        const totalRestBonus = researchRestBonus * (1 + furnitureBonuses.restBonus);
        const restAmount = DWARF_REST_AMOUNT * totalRestBonus;
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
            // Check if dwarf has enough energy (energy cost scales with wisdom including furniture bonus)
            if (dwarf.energy < (DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf))) {
                if (researchReservedBy === dwarf.name) researchReservedBy = null;
                dwarf.status = 'idle';
                return;
            }
            
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - check if dwarf will strike
                if (Math.random() > DWARF_STRIKE_BASE_CHANCE) {
                    dwarf.status = 'striking';
                    return;
                }
            }

            // Pay the dwarf, consume energy and generate research point
            gold = Math.max(0, gold - wage);
            pendingTransactions.push({ type: 'expense', amount: wage, description: 'Research wage for ' + dwarf.name });

            // Apply energy consumption with Ruby gem prevention and Zinc plating reduction
            applyEnergyConsumption(dwarf, DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf));
            if (activeResearch.progress === undefined) {
                activeResearch.progress = 0;
            }

            // New probability-based research point generation
            // Calculate effective hardness using helper function
            const hardnessData = calculateResearchEffectiveHardness(dwarf);
            const { currentLevel, baseHardness, levelHardnessIncrease, hardnessBeforeGem, amethystReduction, effectiveHardness } = hardnessData;

            // Debug: Log research attempt start
            const debugRuns = [];

            // Calculate research points with multiple runs based on wisdom (including furniture bonus)
            let totalResearchPoints = 0;
            let currentWisdom = Math.max(1, getEffectiveWisdom(dwarf)); // Ensure at least 1 wisdom for minimum chance
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

                // Halve wisdom for next run (rounded down), but only if effective wisdom > 0
                if (getEffectiveWisdom(dwarf) > 0) {
                    currentWisdom = Math.floor(currentWisdom / 2);
                } else {
                    // Dwarf has 0 effective wisdom, only gets 1 roll with minimum chance
                    break;
                }

                // Safety check: prevent infinite loops
                if (runNumber > 20) break;
            }

            // Research points are applied directly (no gem modifier to points anymore)
            const researchPoints = totalResearchPoints;
            activeResearch.progress += researchPoints;

            // Award XP based on successful attempts (ceiling of square root)
            const successfulAttempts = Math.max(1, totalResearchPoints); // At least 1 for the attempt
            const xpMultiplier = Math.ceil(Math.sqrt(successfulAttempts));
            dwarf.xp = (dwarf.xp || 0) + Math.ceil(Math.sqrt(DWARF_XP_PER_ACTION * xpMultiplier));
            
            // Check if research is complete using formula: baseCost * (1.15^(targetLevel-1))
            // Current level is what we have, target level is current + 1
            const targetLevel = currentLevel + 1;
            const actualCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
            if (activeResearch.progress >= actualCost) {
                const completedResearchId = activeResearch.id;
                const completedResearchLevel = (activeResearch.level || 0) + 1;

                // Update in researchData
                if (researchData[completedResearchId]) {
                    researchData[completedResearchId].level = completedResearchLevel;
                    researchData[completedResearchId].progress = 0;
                }

                console.log(`Research completed: ${activeResearch.name} (Level ${completedResearchLevel})`);

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
                    //console.log(`[WORKER] Starting next queued research:`, nextResearch);
                    const nextResearchItem = researchData[nextResearch.id];

                    if (nextResearchItem) {
                        // Initialize progress if not set
                        if (nextResearchItem.progress === undefined) {
                            nextResearchItem.progress = 0;
                        }

                        // Create active research object with id
                        activeResearch = { ...nextResearchItem, id: nextResearch.id };
                        //console.log(`[WORKER] Started next queued research: ${nextResearchItem.name} (${researchQueue.length} remaining in queue)`);
                    } else {
                        console.error('[WORKER] Queued research not found:', nextResearch.id);
                        // Recursively try next in queue by re-processing
                    }
                }
            }
            return;
        } else {
            // Not at research location, release reservation and become idle
            if (researchReservedBy === dwarf.name) researchReservedBy = null;
            dwarf.status = 'idle';
        }
    }

    // Masonry state
    if (dwarf.status === 'masonry') {
        handleWorkshopTask(dwarf, {
            workshopType: 'masonry',
            location: masonry,
            reservedBy: masonryReservedBy,
            setReservedBy: (val) => { masonryReservedBy = val; },
            currentTaskField: 'currentMasonryTask',
            findTaskFunction: findActionableMasonryTask,
            handleOutputFunction: handleMasonryTaskOutput,
            tasksData: masonryTasksData,
            transactionPrefix: 'Masonry'
        });
        return;
    }

    // Smelting state
    if (dwarf.status === 'smelting') {
        handleWorkshopTask(dwarf, {
            workshopType: 'smelting',
            location: smelter,
            reservedBy: smelterReservedBy,
            setReservedBy: (val) => { smelterReservedBy = val; },
            currentTaskField: 'currentSmelterTask',
            findTaskFunction: findActionableSmelterTask,
            handleOutputFunction: handleSmelterTaskOutput,
            tasksData: smelterTasksData,
            transactionPrefix: 'Smelter'
        });
        return;
    }

    // Managing state
    if (dwarf.status === 'managing') {
        // Check if at management location
        if (typeof management === 'object' && management !== null && dwarf.x === management.x && dwarf.y === management.y) {
            // Check if dwarf has enough energy (energy cost scales with wisdom including furniture bonus)
            if (dwarf.energy < (DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf))) {
                // Don't reset progress when dwarf stops - allow continuation by next dwarf
                if (managementReservedBy === dwarf.name) managementReservedBy = null;
                dwarf.status = 'idle';
                dwarf.currentManagementTask = null;
                return;
            }

            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - check if dwarf will strike
                if (Math.random() > DWARF_STRIKE_BASE_CHANCE) {
                    dwarf.status = 'striking';
                    return;
                }
            }

            // Find an active management task
            const task = findActiveManagementTask();
            if (!task) {
                // No work available, release management and become idle
                if (managementReservedBy === dwarf.name) managementReservedBy = null;
                dwarf.status = 'idle';
                dwarf.currentManagementTask = null;
                return;
            }

            const taskDef = managementTasks[task.type];
            if (!taskDef) {
                // Task definition not found
                if (managementReservedBy === dwarf.name) managementReservedBy = null;
                dwarf.status = 'idle';
                dwarf.currentManagementTask = null;
                return;
            }

            // Initialize or validate task tracking
            if (!dwarf.currentManagementTask || dwarf.currentManagementTask !== task.id) {
                // Starting a new task or switching tasks
                dwarf.currentManagementTask = task.id;
            }

            // Initialize task progress if needed
            if (!task.progress) {
                task.progress = 0;
            }

            // Wisdom-based progress (similar to smelting, including furniture bonus)
            let totalProgressGained = 0;
            let currentWisdom = getEffectiveWisdom(dwarf);
            let runNumber = 1;

            // Use task hardness as difficulty for rolling (like hardness for smelting)
            const hardness = taskDef.hardness || 10;
            // Use task cost as the number of actions needed to complete
            const cost = taskDef.cost || 10;

            while (true) {
                // Calculate success chance based on wisdom vs hardness
                const managingPower = currentWisdom * SMELTER_WISDOM_PROBABILITY_BONUS;
                const roll = Math.random() * hardness;

                // Minimum success chance
                const minChanceRoll = Math.random();
                const minChanceSuccess = minChanceRoll < SMELTER_MIN_SUCCESS_CHANCE;
                const normalSuccess = roll <= managingPower;
                const success = normalSuccess || minChanceSuccess;

                if (!success) {
                    break; // Failed this run
                }

                // Success! Gain 1 progress
                totalProgressGained++;

                // Halve wisdom for next run
                if (getEffectiveWisdom(dwarf) > 0) {
                    currentWisdom = Math.floor(currentWisdom / 2);
                } else {
                    break; // 0 effective wisdom, only 1 roll
                }

                // Safety check
                if (runNumber > 20) break;
                runNumber++;
            }

            // Apply progress
            task.progress += totalProgressGained;

            // Check if task is complete (progress reaches cost)
            if (task.progress >= cost) {
                // Task complete!
                console.log(`[Management] Task "${task.name || taskDef.name}" completed by ${dwarf.name}! (type: ${task.type})`);

                // Award XP (hardness * cost for XP calculation)
                const xpGain = Math.ceil(Math.sqrt(hardness * cost));
                dwarf.xp = (dwarf.xp || 0) + xpGain;

                // Execute the task based on type
                executeManagementTaskWrapper(task, taskDef);

                // Deactivate the task
                task.active = false;
                task.progress = 0;
                dwarf.currentManagementTask = null;

                // Task completed! Keep dwarf as 'managing' status
                // They will check for more work on the next tick
                // Don't release reservation or become idle - stay at management
                console.log(`[${dwarf.name}] ✅ Completed management task, staying at management for more work`);
            } else {
                // Consume energy and pay wage
                applyEnergyConsumption(dwarf, DWARF_BASE_ENERGY_COST_TASK);
                gold -= wage;
                pendingTransactions.push({
                    type: 'expense',
                    amount: wage,
                    description: `Wage for ${dwarf.name}`
                });
            }
        } else {
            // Not at management location, release reservation and become idle
            if (managementReservedBy === dwarf.name) managementReservedBy = null;
            dwarf.status = 'idle';
            dwarf.currentManagementTask = null;
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
    const dwarfCapacity = getBucketCapacityWithFurniture(dwarf);
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
                // Release masonry reservation if dwarf was heading there
                if (masonryReservedBy === dwarf.name) masonryReservedBy = null;
                // Release smelter reservation if dwarf was heading there
                if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
                if (managementReservedBy === dwarf.name) managementReservedBy = null;
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

    // Allow y = -1 for functions grid, otherwise validate against main grid bounds
    const isInFunctionsGrid = rowIndex === -1;
    const isInMainGrid = rowIndex >= 0 && rowIndex < grid.length;

    if (typeof rowIndex !== 'number' || (!isInFunctionsGrid && !isInMainGrid)) {
        console.warn(`Dwarf ${dwarf.name} has invalid y=${rowIndex}`);
        return;
    }

    const power = getDwarfToolPower(dwarf);

    // Only access grid row if dwarf is in the main grid (not in functions grid at y=-1)
    const row = isInMainGrid ? grid[rowIndex] : null;

    // Check if dwarf is at research/smelter location BEFORE accessing grid cells (they are outside main grid)
    // If so, use unified task assignment to respect priorities
    const atResearch = typeof research === 'object' && research !== null && dwarf.x === research.x && dwarf.y === research.y;
    const atSmelter = typeof smelter === 'object' && smelter !== null && dwarf.x === smelter.x && dwarf.y === smelter.y;

    if (dwarf.status === 'idle' && (atResearch || atSmelter) && dwarf.energy >= (DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf))) {
        // Dwarf at special location - use unified task assignment
        const assignedTask = assignDwarfTask(dwarf, null, null);

        // If no task was assigned (e.g. no research/smelting work available),
        // don't just stand here and get stuck. Go home.
        if (assignedTask === null && house) {
            // Also release any reservations that might have been made, just in case
            if (researchReservedBy === dwarf.name) researchReservedBy = null;
            if (masonryReservedBy === dwarf.name) masonryReservedBy = null;
            if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
            if (managementReservedBy === dwarf.name) managementReservedBy = null;
            scheduleMove(dwarf, house.x, house.y);
        }

        // Task was assigned (or fallback move to house was scheduled) - return either way
        return;
    }

    // Only access current cell if in main grid (row exists)
    const curCell = row ? row[originalX] : null;

    let movedDownByChance = false;
    let skipHorizontalScan = false;

    // Idle dwarf - check for tasks based on priority (energy cost scales with wisdom including furniture bonus)
    if (dwarf.status === 'idle' && dwarf.energy >= (DWARF_BASE_ENERGY_COST_TASK + getEffectiveWisdom(dwarf))) {
        // Use unified task assignment (pass null for digging coords to allow continuing to digging logic below)
        const assignedTask = assignDwarfTask(dwarf, null, null);

        // If research or smelting was assigned, dwarf is moving to that task - return early
        if (assignedTask === 'research' || assignedTask === 'smelting') {
            return;
        }

        // If digging was assigned and dwarf is in functions grid, move to main grid first
        if (assignedTask === 'digging' && dwarf.y === -1) {
            // Move dwarf from functions grid to main grid (same x position, y=0)
            scheduleMove(dwarf, dwarf.x, 0);
            dwarf.status = 'moving';
            return;
        }

        // If 'digging' would be assigned, we continue to the digging logic below
        // If null was returned, no valid task was available (all blacklisted or no work available)
        if (assignedTask === null) {
            // No valid task available - if dwarf is at house and needs energy, set to resting
            if (typeof house === 'object' && house !== null && dwarf.x === house.x && dwarf.y === house.y) {
                const maxEnergy = dwarf.maxEnergy || 100;
                if (dwarf.energy < maxEnergy) {
                    console.log(`Dwarf ${dwarf.name} idle at house with low energy (${dwarf.energy}/${maxEnergy}) -> resting`);
                    dwarf.status = 'resting';
                }
            }
            // Otherwise dwarf stays idle (will keep checking each tick)
            return;
        }
    }

    // Idle dwarf on cell with hardness - start digging (but not at research location if research is active)
    // Also check that digging is not in the "no priority" list
    const taskPriorityNone = dwarf.taskPriorityNone || [];
    if (dwarf.status === 'idle' && curCell && curCell.hardness > 0 &&
        !taskPriorityNone.includes('digging') &&
        !(activeResearch && typeof research === 'object' && research !== null && dwarf.x === research.x && dwarf.y === research.y)) {
        const curKey = coordKey(dwarf.x, dwarf.y);
        if (!reservedDigBy.get(curKey) || reservedDigBy.get(curKey) === dwarf.name) {
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - check if dwarf will strike
                if (Math.random() > DWARF_STRIKE_BASE_CHANCE) {
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
            const critChance = getCritChanceWithFurniture(dwarf);
            const isCrit = Math.random() < critChance;
            let finalPower = isCrit ? power * CRITICAL_HIT_DAMAGE_MULTIPLIER : power;
            
            // Check for expertise one-hit on critical
            if (isCrit) {
                const mat = materials[curCell.materialId];
                const matType = mat ? mat.type : '';
                const isStone = matType.startsWith('Stone');
                const isOre = matType.startsWith('Ore');

                const stoneExpertise = researchData['expertise-stone'];
                const oreExpertise = researchData['expertise-ore'];

                let oneHitChance = 0;
                let expertiseType = null;

                if (isStone && stoneExpertise && stoneExpertise.level > 0) {
                    oneHitChance = stoneExpertise.level * STONE_EXPERTISE_ONE_HIT_CHANCE;
                    expertiseType = 'Stone';
                } else if (isOre && oreExpertise && oreExpertise.level > 0) {
                    oneHitChance = oreExpertise.level * ORE_EXPERTISE_ONE_HIT_CHANCE;
                    expertiseType = 'Ore';
                }

                // Apply Uranium and Plutonium plating multipliers to one-hit chance
                const uraniumMultiplier = getUraniumPlatingOneHitMultiplier(dwarf);
                const plutoniumMultiplier = getPlutoniumPlatingOneHitMultiplier(dwarf);
                const totalMultiplier = uraniumMultiplier * plutoniumMultiplier;
                oneHitChance *= totalMultiplier;

                if (totalMultiplier > 1) {
                    console.log(`🎯 One-hit multiplier: ${totalMultiplier}x (Uranium: ${uraniumMultiplier}x, Plutonium: ${plutoniumMultiplier}x) = ${(oneHitChance * 100).toFixed(2)}% chance`);
                }

                if (oneHitChance > 0 && Math.random() < oneHitChance) {
                    finalPower = curCell.hardness; // One-hit!
                    console.log(`💥 CRITICAL ONE-HIT! ${dwarf.name} used ${expertiseType} Expertise to instantly destroy ${mat ? mat.name : curCell.materialId}!`);

                    // Check for Plutonium nuclear explosion
                    const triggerExplosion = shouldPlutoniumTriggerExplosion(dwarf);
                    if (triggerExplosion) {
                        console.log(`☢️ ══════════════════════════════════════════`);
                        console.log(`☢️ NUCLEAR EXPLOSION TRIGGERED!`);
                        console.log(`☢️ ${dwarf.name}'s Plutonium plating detonated!`);
                        console.log(`☢️ Location: (${dwarf.x}, ${dwarf.y})`);
                        console.log(`☢️ Material destroyed: ${mat ? mat.name : curCell.materialId}`);
                        console.log(`☢️ ══════════════════════════════════════════`);
                        pendingTransactions.push({
                            type: 'nuclear-explosion',
                            x: dwarf.x,
                            y: dwarf.y,
                            dwarf: dwarf.name,
                            material: mat ? mat.name : curCell.materialId
                        });

                        // Apply nuclear explosion effects to surrounding cells
                        applyNuclearExplosion(dwarf.x, dwarf.y);
                    } else {
                        pendingTransactions.push({ type: 'one-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name, material: mat ? mat.name : curCell.materialId });
                    }
                } else {
                   // console.log(`⚡ Critical hit by ${dwarf.name} on ${mat ? mat.name : curCell.materialId} (type: ${matType})`);
                    pendingTransactions.push({ type: 'crit-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name });
                }
            }
            
            curCell.hardness = Math.max(0, curCell.hardness - finalPower);
            if (curCell.hardness === 0) {
                handleBlockDestruction(curCell, dwarf, dwarf.x, dwarf.y);
            }

            // Check for Wolfram plating double dig (only if block still has hardness)
            const wolframChance = getWolframPlatingDoubleDigChance(dwarf);
            if (wolframChance > 0 && curCell.hardness > 0 && Math.random() < wolframChance) {
                console.log(`⚡ WOLFRAM DOUBLE DIG! ${dwarf.name} digs a second time in the same tick`);
                // Second dig is always non-critical (only one hit can crit)
                const secondDigPower = power;
                curCell.hardness = Math.max(0, curCell.hardness - secondDigPower);
                if (curCell.hardness === 0) {
                    handleBlockDestruction(curCell, dwarf, dwarf.x, dwarf.y);
                }
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

        // Allow y = -1 for functions grid, validate other positions against main grid
        const validPosition = dwarf.y === -1 || (dwarf.y >= 0 && dwarf.y < grid.length);
        if (!Array.isArray(grid) || !validPosition) {
            dwarf.moveTarget = null;
            dwarf.status = 'idle';
            // Release any reservations when movement fails
            if (researchReservedBy === dwarf.name) researchReservedBy = null;
            if (masonryReservedBy === dwarf.name) masonryReservedBy = null;
            if (smelterReservedBy === dwarf.name) smelterReservedBy = null;
            if (managementReservedBy === dwarf.name) managementReservedBy = null;
        } else {
            dwarf.x = nextX;
            dwarf.y = nextY;

            // Apply movement energy (consumes energy normally, or regenerates with Nickel plating)
            applyMovementEnergy(dwarf, DWARF_ENERGY_COST_PER_MOVE);
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
        // Can't dig in functions grid (y=-1), only in main grid
        const curCellDig = (dwarf.y >= 0 && grid[dwarf.y]) ? grid[dwarf.y][dwarf.x] : null;
        if (curCellDig && curCellDig.hardness > 0) {
            // Check if we can afford to pay the dwarf
            const wage = calculateWage(dwarf);
            if (gold < wage) {
                // Not enough gold - check if dwarf will strike
                if (Math.random() > DWARF_STRIKE_BASE_CHANCE) {
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
            const critChance = getCritChanceWithFurniture(dwarf);
            const isCrit = Math.random() < critChance;
            let finalPower = isCrit ? power * CRITICAL_HIT_DAMAGE_MULTIPLIER : power;

            // Check for expertise one-hit on critical
            if (isCrit) {
                const mat = materials[curCellDig.materialId];
                const matType = mat ? mat.type : '';
                const isStone = matType.startsWith('Stone');
                const isOre = matType.startsWith('Ore');

                const stoneExpertise = researchData['expertise-stone'];
                const oreExpertise = researchData['expertise-ore'];

                let oneHitChance = 0;
                let expertiseType = null;

                if (isStone && stoneExpertise && stoneExpertise.level > 0) {
                    oneHitChance = stoneExpertise.level * STONE_EXPERTISE_ONE_HIT_CHANCE;
                    expertiseType = 'Stone';
                } else if (isOre && oreExpertise && oreExpertise.level > 0) {
                    oneHitChance = oreExpertise.level * ORE_EXPERTISE_ONE_HIT_CHANCE;
                    expertiseType = 'Ore';
                }

                // Apply Uranium and Plutonium plating multipliers to one-hit chance
                const uraniumMultiplier = getUraniumPlatingOneHitMultiplier(dwarf);
                const plutoniumMultiplier = getPlutoniumPlatingOneHitMultiplier(dwarf);
                const totalMultiplier = uraniumMultiplier * plutoniumMultiplier;
                oneHitChance *= totalMultiplier;

                if (totalMultiplier > 1) {
                    console.log(`🎯 One-hit multiplier: ${totalMultiplier}x (Uranium: ${uraniumMultiplier}x, Plutonium: ${plutoniumMultiplier}x) = ${(oneHitChance * 100).toFixed(2)}% chance`);
                }

                if (oneHitChance > 0 && Math.random() < oneHitChance) {
                    finalPower = curCellDig.hardness; // One-hit!
                    console.log(`💥 CRITICAL ONE-HIT! ${dwarf.name} used ${expertiseType} Expertise to instantly destroy ${mat ? mat.name : curCellDig.materialId}!`);

                    // Check for Plutonium nuclear explosion
                    const triggerExplosion = shouldPlutoniumTriggerExplosion(dwarf);
                    if (triggerExplosion) {
                        console.log(`☢️ ══════════════════════════════════════════`);
                        console.log(`☢️ NUCLEAR EXPLOSION TRIGGERED!`);
                        console.log(`☢️ ${dwarf.name}'s Plutonium plating detonated!`);
                        console.log(`☢️ Location: (${dwarf.x}, ${dwarf.y})`);
                        console.log(`☢️ Material destroyed: ${mat ? mat.name : curCellDig.materialId}`);
                        console.log(`☢️ ══════════════════════════════════════════`);
                        pendingTransactions.push({
                            type: 'nuclear-explosion',
                            x: dwarf.x,
                            y: dwarf.y,
                            dwarf: dwarf.name,
                            material: mat ? mat.name : curCellDig.materialId
                        });

                        // Apply nuclear explosion effects to surrounding cells
                        applyNuclearExplosion(dwarf.x, dwarf.y);
                    } else {
                        pendingTransactions.push({ type: 'one-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name, material: mat ? mat.name : curCellDig.materialId });
                    }
                } else {
                    //console.log(`⚡ Critical hit by ${dwarf.name} on ${mat ? mat.name : curCellDig.materialId} (type: ${matType})`);
                    pendingTransactions.push({ type: 'crit-hit', x: dwarf.x, y: dwarf.y, dwarf: dwarf.name });
                }
            }
            
            curCellDig.hardness = Math.max(0, curCellDig.hardness - finalPower);
            if (curCellDig.hardness === 0) {
                handleBlockDestruction(curCellDig, dwarf, dwarf.x, dwarf.y);
            }

            // Check for Wolfram plating double dig (only if block still has hardness)
            const wolframChance = getWolframPlatingDoubleDigChance(dwarf);
            if (wolframChance > 0 && curCellDig.hardness > 0 && Math.random() < wolframChance) {
                console.log(`⚡ WOLFRAM DOUBLE DIG! ${dwarf.name} digs a second time in the same tick`);
                // Second dig is always non-critical (only one hit can crit)
                const secondDigPower = power;
                curCellDig.hardness = Math.max(0, curCellDig.hardness - secondDigPower);
                if (curCellDig.hardness === 0) {
                    handleBlockDestruction(curCellDig, dwarf, dwarf.x, dwarf.y);
                }
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

    // If dwarf is in functions grid, they should only perform functions tasks, unless they are idle.
    if (!row) {
        // If the dwarf is idle in the function row, it should try to move to the grid to find work.
        if (dwarf.status === 'idle') {
            const taskPriorityNone = dwarf.taskPriorityNone || [];
            if (!taskPriorityNone.includes('digging')) {
                scheduleMove(dwarf, dwarf.x, 0); // Move to (x,0) to start digging
            }
        }
        return; // For other statuses in function row, do nothing else.
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
            console.warn(`Dwarf ${dwarf.name} wanted to move up to (${foundCol},${aboveRowIndex}) but it's occupied; will dig current target instead.`);
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
        // Not enough gold - check if dwarf will strike
        if (Math.random() > DWARF_STRIKE_BASE_CHANCE) {
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
    const critChance = getCritChanceWithFurniture(dwarf);
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

/**
 * Check management task activation conditions and update their active status
 */
function checkManagementTaskActivationWrapper() {
    // Build context object with all game state
    const context = {
        gold,
        materials,
        materialsStock,
        gems,
        dwarfs,
        researchData,
        researchTree,
        activeResearch,
        researchQueue,
        smelterTasks,
        smelterTasksData,
        managementTasks,
        startX,
        RESEARCH_COST_MULTIPLIER,
        oneTimeInvestments,
        nextInvestmentId
    };

    // Call the external function
    checkManagementTaskActivation(activeManagementTasks, context);
    // Note: activeManagementTasks is modified in place
}

function tick() {
    try {
        // Cool down smelter temperature with insulation research
        if (smelterTemperature > SMELTER_BASE_TEMPERATURE) {
            const insulationResearch = researchData['furnace-insulation'];
            const insulationLevel = insulationResearch ? (insulationResearch.level || 0) : 0;
            const coolingReduction = insulationLevel * RESEARCH_FURNACE_INSULATION_BONUS;
            const coolingRate = SMELTER_COOLING_RATE * (1 - coolingReduction);
            smelterTemperature = Math.max(SMELTER_BASE_TEMPERATURE, smelterTemperature * (1 - coolingRate));
        }

        // Apply interest from Small Time Investments research
        const smallTimeInvestments = researchData['small-time-investments'];
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

        // Process one-time investments
        if (oneTimeInvestments && oneTimeInvestments.length > 0) {
            const activeInvestments = [];
            let totalInvestmentPayout = 0;
            const completedInvestments = [];

            for (const investment of oneTimeInvestments) {
                if (investment.ticksRemaining > 0) {
                    // Pay out for this tick
                    gold += investment.payoutPerTick;
                    totalInvestmentPayout += investment.payoutPerTick;

                    // Decrement remaining ticks
                    investment.ticksRemaining--;

                    // Keep investment if not complete
                    if (investment.ticksRemaining > 0) {
                        activeInvestments.push(investment);
                    } else {
                        // Investment complete
                        completedInvestments.push(investment.id);
                    }
                } else {
                    // This shouldn't happen, but filter out just in case
                    continue;
                }
            }

            // Log single transaction for all investment payouts this tick
            if (totalInvestmentPayout > 0) {
                pendingTransactions.push({
                    type: 'income',
                    amount: totalInvestmentPayout,
                    description: 'Investment payouts'
                });
            }

            // Log completion messages for any completed investments
            for (const investmentId of completedInvestments) {
                pendingTransactions.push({
                    type: 'income',
                    amount: 0,
                    description: `Investment #${investmentId} completed`
                });
            }

            oneTimeInvestments = activeInvestments;
        }

        // Ensure only one dwarf is researching at a time
        const researchingDwarfs = dwarfs.filter(d => d.status === 'researching');
        if (researchingDwarfs.length > 1) {
            // Keep the first one researching, reset the others to idle and send home
            for (let i = 1; i < researchingDwarfs.length; i++) {
                const dwarf = researchingDwarfs[i];
                console.warn(`[Research Conflict] Multiple dwarfs researching. Resetting ${dwarf.name} to idle.`);
                dwarf.status = 'idle';
                if (house) {
                    scheduleMove(dwarf, house.x, house.y);
                }
            }
            // Ensure reservation is held by the remaining researcher
            researchReservedBy = researchingDwarfs[0].name;
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
                        console.error(`Failsafe: Releasing smelter reservation from ${smelterReservedBy} (at house or elsewhere)`);
                        smelterReservedBy = null;
                    }
                } else {
                    // Reserved by a dwarf that doesn't exist anymore
                    console.error(`Failsafe: Releasing smelter reservation from non-existent dwarf ${smelterReservedBy}`);
                    smelterReservedBy = null;
                }
            }
        }
        
        const shifted = checkAndShiftTopRows();

        // Check and update management task activation states
        checkManagementTaskActivationWrapper();

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
                researchData,
                shifted,
                smelterTemperature,
                smelterCoalMinTemp,
                smelterCoalMaxTemp,
                smelterMagmaMinTemp,
                smelterHeatingMode,
                smelterTasks,
                smelterTasksData,
                oneTimeInvestments,
                nextInvestmentId,
                activeManagementTasks,
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
            masonry = data.masonry;
            smelter = data.smelter;
            management = data.management;
            if (data.masonryTasks) {
                masonryTasks = JSON.parse(JSON.stringify(data.masonryTasks));
            }
            if (data.masonryTasksData) {
                masonryTasksData = JSON.parse(JSON.stringify(data.masonryTasksData));
            }
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
            if (data.researchData) {
                // Copy the full researchData from main thread
                researchData = JSON.parse(JSON.stringify(data.researchData));
            }
            if (data.researchTree) {
                // Copy the researchTree array from main thread
                researchTree = JSON.parse(JSON.stringify(data.researchTree));
            }
            // Initialize smelter temperature state
            if (data.smelterTemperature !== undefined) smelterTemperature = data.smelterTemperature;
            if (data.smelterCoalMinTemp !== undefined) smelterCoalMinTemp = data.smelterCoalMinTemp;
            if (data.smelterCoalMaxTemp !== undefined) smelterCoalMaxTemp = data.smelterCoalMaxTemp;
            if (data.smelterMagmaMinTemp !== undefined) smelterMagmaMinTemp = data.smelterMagmaMinTemp;
            if (data.smelterHeatingMode !== undefined) smelterHeatingMode = data.smelterHeatingMode;
            // Initialize one-time investments
            if (data.oneTimeInvestments) oneTimeInvestments = JSON.parse(JSON.stringify(data.oneTimeInvestments));
            if (data.nextInvestmentId !== undefined) nextInvestmentId = data.nextInvestmentId;
            // Initialize management tasks
            if (data.activeManagementTasks) activeManagementTasks = JSON.parse(JSON.stringify(data.activeManagementTasks));
            if (data.managementTasks) managementTasks = JSON.parse(JSON.stringify(data.managementTasks));
            // Initialize plating effects (from defs.js)
            if (data.platingEffects) platingEffects = JSON.parse(JSON.stringify(data.platingEffects));
            // Initialize furniture data
            if (data.furnitureData) furnitureData = JSON.parse(JSON.stringify(data.furnitureData));
            if (data.commonRoom) commonRoom = JSON.parse(JSON.stringify(data.commonRoom));
            if (data.individualRooms) individualRooms = JSON.parse(JSON.stringify(data.individualRooms));
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
                if (data.researchData) {
                    // Copy the full researchData from main thread
                    researchData = JSON.parse(JSON.stringify(data.researchData));
                }
                if (data.researchTree) {
                    // Copy the researchTree array from main thread
                    researchTree = JSON.parse(JSON.stringify(data.researchTree));
                }
                if (data.masonryTasks) {
                    // Copy the masonry tasks from main thread
                    masonryTasks = JSON.parse(JSON.stringify(data.masonryTasks));
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
                if (data.activeManagementTasks !== undefined) {
                    activeManagementTasks = JSON.parse(JSON.stringify(data.activeManagementTasks));
                }
                // Update furniture data
                if (data.furnitureData) furnitureData = JSON.parse(JSON.stringify(data.furnitureData));
                if (data.commonRoom) commonRoom = JSON.parse(JSON.stringify(data.commonRoom));
                if (data.individualRooms) individualRooms = JSON.parse(JSON.stringify(data.individualRooms));
            }
            break;

        case 'create-investment':
            // Create a new one-time investment
            if (data && data.amount) {
                const amount = data.amount;
                const payoutPerTick = amount / 100000; // 1 gold per 100k invested per tick
                const ticksRequired = 120000; // 120,000 ticks (10 hours at 300ms per tick)

                const investment = {
                    id: nextInvestmentId++,
                    amount: amount,
                    ticksRemaining: ticksRequired,
                    payoutPerTick: payoutPerTick,
                    startTick: Date.now() // For display purposes
                };

                oneTimeInvestments.push(investment);
                gold -= amount; // Deduct the investment amount

                pendingTransactions.push({
                    type: 'expense',
                    amount: amount,
                    description: `One-time investment #${investment.id} created`
                });

                console.log(`Created investment #${investment.id}: ${amount} gold, ${payoutPerTick} per tick for ${ticksRequired} ticks`);

                // Send updated state back
                self.postMessage({
                    type: 'investment-created',
                    investment: investment,
                    gold: gold,
                    oneTimeInvestments: oneTimeInvestments
                });
            }
            break;

        default:
            console.warn('Unknown message type:', type);
    }
});

// Global error handler for worker thread
self.addEventListener('error', (event) => {
    const errorMsg = event.message || 'Unknown worker error';
    const errorFile = event.filename ? event.filename.split('/').pop() : 'unknown file';
    const errorLine = event.lineno || '?';

    console.error('=== WORKER CRITICAL ERROR ===');
    console.error('Message:', errorMsg);
    console.error('File:', errorFile);
    console.error('Line:', errorLine);
    console.error('=============================');

    self.postMessage({
        type: 'tick-error',
        error: `${errorMsg} (${errorFile}:${errorLine})`
    });

    // Don't prevent default error handling
    return false;
});

self.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason || 'Unknown promise rejection';
    const message = reason.message || String(reason);

    console.error('=== WORKER UNHANDLED REJECTION ===');
    console.error('Reason:', message);
    console.error('==================================');

    self.postMessage({
        type: 'tick-error',
        error: `Promise rejection: ${message}`
    });

    // Don't prevent default error handling
    return false;
});

console.log('Game worker loaded and ready');
