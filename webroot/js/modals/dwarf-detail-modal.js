/**
 * Dwarf Detail Modal
 * Handles dwarf panel, dwarf detail modal, level up system, and dwarf management
 */

/**
 * Helper function to convert coordinates to location name
 */
function getLocationName(x, y) {
    if (typeof house === 'object' && house !== null && x === house.x && y === house.y) {
        return '🏠 House';
    }
    if (typeof dropOff === 'object' && dropOff !== null && x === dropOff.x && y === dropOff.y) {
        return '📦 Warehouse';
    }
    if (typeof masonry === 'object' && masonry !== null && x === masonry.x && y === masonry.y) {
        return '🔨 Masonry';
    }
    if (typeof smelter === 'object' && smelter !== null && x === smelter.x && y === smelter.y) {
        return '🔥 Smelter';
    }
    if (typeof research === 'object' && research !== null && x === research.x && y === research.y) {
        return '🔬 Research Lab';
    }
    if (typeof management === 'object' && management !== null && x === management.x && y === management.y) {
        return '🏢 Management';
    }
    return '⛏️ Mining';
}

/**
 * Helper function to get what the dwarf is currently working on
 */
function getDwarfCurrentActivity(dwarf) {
    if (dwarf.status === 'digging') {
        // Get the material at the dwarf's current position
        if (grid && grid[dwarf.y] && grid[dwarf.y][dwarf.x]) {
            const cell = grid[dwarf.y][dwarf.x];
            if (cell.materialId) {
                const material = getMaterialById(cell.materialId);
                return material ? material.name : cell.materialId;
            }
        }
        return 'Digging';
    } else if (dwarf.status === 'researching') {
        // Get the active research
        if (typeof activeResearch !== 'undefined' && activeResearch && activeResearch.name) {
            return activeResearch.name;
        }
        return 'Researching';
    } else if (dwarf.status === 'masonry') {
        // Get the current masonry task - use same logic as worker's findActionableMasonryTask
        if (typeof masonryTasks !== 'undefined' && Array.isArray(masonryTasks)) {
            for (const taskId of masonryTasks) {
                if (taskId === 'do-nothing') break;
                const task = masonryTasksData[taskId];

                // Check if task is unlocked (researched)
                const isUnlocked = !task.requires || (researchData[task.requires]?.level || 0) >= 1;
                if (!isUnlocked) continue;

                // Check for single input (legacy format)
                if (task.input && task.input.material && task.input.amount) {
                    const stockAmount = materialsStock[task.input.material] || 0;
                    if (stockAmount >= task.input.amount) {
                        return task.name;
                    }
                }

                // Check for multiple inputs (alloy format)
                if (task.inputs && Array.isArray(task.inputs)) {
                    const hasAllInputs = task.inputs.every(input => {
                        const stockAmount = materialsStock[input.material] || 0;
                        return stockAmount >= input.amount;
                    });
                    if (hasAllInputs) {
                        return task.name;
                    }
                }
            }
        }
        return 'Masonry';
    } else if (dwarf.status === 'smelting') {
        // Get the current smelter task - use same logic as worker's findActionableSmelterTask
        if (typeof smelterTasks !== 'undefined' && Array.isArray(smelterTasks)) {
            for (const taskId of smelterTasks) {
                if (taskId === 'do-nothing') break;
                const task = smelterTasksData[taskId];

                // Check if task is unlocked (researched)
                const isUnlocked = !task.requires || (researchData[task.requires]?.level || 0) >= 1;
                if (!isUnlocked) continue;

                // For heating tasks, check temperature requirements
                if (task.type === 'heating') {
                    if (task.heatGain === 'dynamic') {
                        if (smelterTemperature >= smelterMagmaMinTemp) continue;
                    } else {
                        if (smelterTemperature >= smelterCoalMaxTemp) continue;
                    }
                }

                // Check temperature requirements for smelting tasks
                if (task.minTemp && smelterTemperature < task.minTemp) continue;

                // For gem cutting tasks
                if (task.type === 'gem-cutting') {
                    const hasGemsToPolish = gems.some(g => g.markedForCutting && !g.polished);
                    if (hasGemsToPolish) return task.name;
                    continue;
                }

                // Check for single input (legacy format)
                if (task.input && task.input.material && task.input.amount) {
                    const stockAmount = materialsStock[task.input.material] || 0;
                    if (stockAmount >= task.input.amount) {
                        return task.name;
                    }
                }

                // Check for multiple inputs (alloy format)
                if (task.inputs && Array.isArray(task.inputs)) {
                    const hasAllInputs = task.inputs.every(input => {
                        const stockAmount = materialsStock[input.material] || 0;
                        return stockAmount >= input.amount;
                    });
                    if (hasAllInputs) {
                        return task.name;
                    }
                }
            }
        }
        return 'Smelting';
    }
    return null;
}

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

    // Initialize task priority drop zones (only needs to be done once)
    initializeTaskPriorityDropZones();

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

    // Clear and add current dwarf as first option
    switcher.innerHTML = '';

    const currentOption = document.createElement('option');
    currentOption.value = '';
    currentOption.textContent = `👷 ${currentDwarfName}`;
    switcher.appendChild(currentOption);

    // Sort dwarfs: those who can level up first, then by name
    const sortedDwarfs = [...dwarfs].sort((a, b) => {
        const aXP = a.xp || 0;
        const aLevel = getDwarfLevel(a);
        const aNeeded = getDwarfXpForLevel(aLevel);
        const aCanLevelUp = aXP >= aNeeded;

        const bXP = b.xp || 0;
        const bLevel = getDwarfLevel(b);
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
            const currentLevel = getDwarfLevel(d);
            const xpNeeded = getDwarfXpForLevel(currentLevel);
            const canLevelUp = currentXP >= xpNeeded;
            const levelUpIndicator = canLevelUp ? ' ⭐' : '';

            const option = document.createElement('option');
            option.value = d.name;
            option.textContent = `${d.name}${levelUpIndicator}`;
            switcher.appendChild(option);
        }
    });

    // Update "Next" button visibility and handler
    updateNextSkillpointButton(currentDwarfName);

    // Add change event listener
    switcher.onchange = (e) => {
        if (e.target.value) {
            const selectedDwarf = dwarfs.find(d => d.name === e.target.value);
            if (selectedDwarf) {
                openDwarfDetailModal(selectedDwarf);
            }
            // Reset dropdown to current dwarf
            e.target.value = '';
        }
    };
}

/**
 * Update the "Next dwarf with skill points" button
 */
function updateNextSkillpointButton(currentDwarfName) {
    const nextBtn = document.getElementById('next-skillpoint-dwarf-btn');
    if (!nextBtn) return;

    // Find next dwarf with unspent skill points (excluding current)
    const dwarfsWithSkillPoints = dwarfs.filter(d => {
        if (d.name === currentDwarfName) return false;
        const currentXP = d.xp || 0;
        const currentLevel = getDwarfLevel(d);
        const xpNeeded = getDwarfXpForLevel(currentLevel);
        return currentXP >= xpNeeded;
    });

    if (dwarfsWithSkillPoints.length > 0) {
        // Sort by name for consistency
        dwarfsWithSkillPoints.sort((a, b) => a.name.localeCompare(b.name));
        const nextDwarf = dwarfsWithSkillPoints[0];

        nextBtn.classList.remove('hidden');
        nextBtn.title = `Switch to ${nextDwarf.name}`;

        // Update click handler
        nextBtn.onclick = () => {
            openDwarfDetailModal(nextDwarf);
        };
    } else {
        nextBtn.classList.add('hidden');
    }
}

/**
 * Task definitions for drag-and-drop UI
 */
const TASK_DEFINITIONS = {
    'digging': { icon: '⛏️', name: 'Digging' },
    'research': { icon: '🔬', name: 'Research' },
    'masonry': { icon: '🔨', name: 'Masonry' },
    'smelting': { icon: '🔥', name: 'Smelter' },
    'managing': { icon: '🏢', name: 'Managing' }
};

/**
 * Populate task priority lists with drag-and-drop functionality
 */
function populateTaskPriorityLists(dwarf) {
    const priorityHighList = document.getElementById('task-priority-high-list');
    const priorityNormalList = document.getElementById('task-priority-normal-list');
    const priorityNoneList = document.getElementById('task-priority-none-list');

    if (!priorityHighList || !priorityNormalList || !priorityNoneList) return;

    // Clear existing content
    priorityHighList.innerHTML = '';
    priorityNormalList.innerHTML = '';
    priorityNoneList.innerHTML = '';

    // Ensure dwarf has task arrays - use proper initialization to avoid duplicates
    if (!dwarf.taskPriorityHigh) dwarf.taskPriorityHigh = [];
    if (!dwarf.taskPriorityNone) dwarf.taskPriorityNone = [];

    // Initialize taskPriorityNormal with all tasks not in other lists
    if (!dwarf.taskPriorityNormal) {
        const allTasks = ['digging', 'research', 'masonry', 'smelting', 'managing'];
        dwarf.taskPriorityNormal = allTasks.filter(task =>
            !dwarf.taskPriorityHigh.includes(task) &&
            !dwarf.taskPriorityNone.includes(task)
        );
    } else {
        // Even if taskPriorityNormal exists, ensure no duplicates across lists
        // Remove any tasks from normal that are in high or none
        dwarf.taskPriorityNormal = dwarf.taskPriorityNormal.filter(task =>
            !dwarf.taskPriorityHigh.includes(task) &&
            !dwarf.taskPriorityNone.includes(task)
        );

        // Add any missing tasks to normal priority (tasks that aren't in any list)
        const allTasks = ['digging', 'research', 'masonry', 'smelting', 'managing'];
        const allAssignedTasks = [
            ...dwarf.taskPriorityHigh,
            ...dwarf.taskPriorityNormal,
            ...dwarf.taskPriorityNone
        ];

        for (const task of allTasks) {
            if (!allAssignedTasks.includes(task)) {
                dwarf.taskPriorityNormal.push(task);
            }
        }
    }

    // Populate high priority list
    dwarf.taskPriorityHigh.forEach((taskId, index) => {
        const taskDef = TASK_DEFINITIONS[taskId];
        if (!taskDef) return;

        const item = createTaskPriorityItem(taskId, taskDef, dwarf.name, 'high');
        priorityHighList.appendChild(item);
    });

    // Populate normal priority list
    dwarf.taskPriorityNormal.forEach((taskId, index) => {
        const taskDef = TASK_DEFINITIONS[taskId];
        if (!taskDef) return;

        const item = createTaskPriorityItem(taskId, taskDef, dwarf.name, 'normal');
        priorityNormalList.appendChild(item);
    });

    // Populate no priority list
    dwarf.taskPriorityNone.forEach(taskId => {
        const taskDef = TASK_DEFINITIONS[taskId];
        if (!taskDef) return;

        const item = createTaskPriorityItem(taskId, taskDef, dwarf.name, 'none');
        priorityNoneList.appendChild(item);
    });

    // Add drop handlers to the list containers themselves
    // This allows dropping into empty areas of the lists
    [priorityHighList, priorityNormalList, priorityNoneList].forEach(list => {
        // Store dwarf name on the list for drop handler
        list.dataset.dwarfName = dwarf.name;

        // Remove old listeners if any
        list.removeEventListener('dragover', handleListDragOver);
        list.removeEventListener('drop', handleListDrop);
        list.removeEventListener('dragleave', handleListDragLeave);

        // Add new listeners
        list.addEventListener('dragover', handleListDragOver);
        list.addEventListener('drop', handleListDrop);
        list.addEventListener('dragleave', handleListDragLeave);
    });
}

/**
 * Create a draggable task priority item
 */
function createTaskPriorityItem(taskId, taskDef, dwarfName, listType) {
    const item = document.createElement('div');
    item.className = 'task-priority-item';
    item.draggable = true;
    item.dataset.taskId = taskId;
    item.dataset.dwarfName = dwarfName;
    item.dataset.listType = listType;

    item.innerHTML = `
        <span class="task-priority-item-icon">${taskDef.icon}</span>
        <span class="task-priority-item-name">${taskDef.name}</span>
        <span class="task-priority-item-handle">⋮⋮</span>
    `;

    // Add drag event listeners
    item.addEventListener('dragstart', handleTaskDragStart);
    item.addEventListener('dragend', handleTaskDragEnd);
    item.addEventListener('dragover', handleTaskDragOver);
    item.addEventListener('drop', handleTaskDrop);
    item.addEventListener('dragleave', handleTaskDragLeave);

    return item;
}

/**
 * Drag and drop event handlers
 */
let draggedTask = null;

function handleTaskDragStart(e) {
    draggedTask = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleTaskDragEnd(e) {
    this.classList.remove('dragging');

    // Remove drag-over class from all items
    document.querySelectorAll('.task-priority-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleTaskDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }

    e.dataTransfer.dropEffect = 'move';

    // Add visual indicator
    if (this !== draggedTask) {
        this.classList.add('drag-over');
    }

    return false;
}

function handleTaskDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleTaskDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    this.classList.remove('drag-over');

    if (draggedTask !== this) {
        const dwarfName = this.dataset.dwarfName;
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (!dwarf) return;

        const draggedTaskId = draggedTask.dataset.taskId;
        const draggedFromList = draggedTask.dataset.listType;

        // Determine which list this was dropped on
        let droppedOnList = 'normal';
        if (this.parentElement.id === 'task-priority-high-list') {
            droppedOnList = 'high';
        } else if (this.parentElement.id === 'task-priority-normal-list') {
            droppedOnList = 'normal';
        } else if (this.parentElement.id === 'task-priority-none-list') {
            droppedOnList = 'none';
        }

        // Remove from all lists first to prevent duplicates
        let fromHighIndex = dwarf.taskPriorityHigh.indexOf(draggedTaskId);
        if (fromHighIndex > -1) dwarf.taskPriorityHigh.splice(fromHighIndex, 1);

        let fromNormalIndex = dwarf.taskPriorityNormal.indexOf(draggedTaskId);
        if (fromNormalIndex > -1) dwarf.taskPriorityNormal.splice(fromNormalIndex, 1);

        let fromNoneIndex = dwarf.taskPriorityNone.indexOf(draggedTaskId);
        if (fromNoneIndex > -1) dwarf.taskPriorityNone.splice(fromNoneIndex, 1);

        // Add to destination list
        if (droppedOnList === 'high') {
            const targetTaskId = this.dataset.taskId;
            const targetIndex = dwarf.taskPriorityHigh.indexOf(targetTaskId);
            dwarf.taskPriorityHigh.splice(targetIndex, 0, draggedTaskId);
        } else if (droppedOnList === 'normal') {
            const targetTaskId = this.dataset.taskId;
            const targetIndex = dwarf.taskPriorityNormal.indexOf(targetTaskId);
            dwarf.taskPriorityNormal.splice(targetIndex, 0, draggedTaskId);
        } else {
            // No priority - just add to end if not already present
            if (!dwarf.taskPriorityNone.includes(draggedTaskId)) {
                dwarf.taskPriorityNone.push(draggedTaskId);
            }
        }

        // Save and refresh
        saveTaskPriorityChanges(dwarf);
        populateTaskPriorityLists(dwarf);
    }

    return false;
}

/**
 * Handle dragover on list containers (for dropping into empty areas)
 */
function handleListDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }

    e.dataTransfer.dropEffect = 'move';

    // Add visual indicator to the list container
    this.classList.add('drag-over-list');

    return false;
}

/**
 * Handle dragleave on list containers
 */
function handleListDragLeave(e) {
    // Only remove if we're actually leaving the list (not entering a child)
    if (!this.contains(e.relatedTarget)) {
        this.classList.remove('drag-over-list');
    }
}

/**
 * Handle drop on list containers (for dropping into empty areas)
 */
function handleListDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    if (e.preventDefault) {
        e.preventDefault();
    }

    this.classList.remove('drag-over-list');

    // Only process if we're dropping on the list itself, not on a child item
    if (e.target.classList.contains('task-priority-list')) {
        const dwarfName = this.dataset.dwarfName;
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (!dwarf || !draggedTask) return;

        const draggedTaskId = draggedTask.dataset.taskId;

        // Determine which list this was dropped on
        let droppedOnList = 'normal';
        if (this.id === 'task-priority-high-list') {
            droppedOnList = 'high';
        } else if (this.id === 'task-priority-normal-list') {
            droppedOnList = 'normal';
        } else if (this.id === 'task-priority-none-list') {
            droppedOnList = 'none';
        }

        // Remove from all lists first to prevent duplicates
        let fromHighIndex = dwarf.taskPriorityHigh.indexOf(draggedTaskId);
        if (fromHighIndex > -1) dwarf.taskPriorityHigh.splice(fromHighIndex, 1);

        let fromNormalIndex = dwarf.taskPriorityNormal.indexOf(draggedTaskId);
        if (fromNormalIndex > -1) dwarf.taskPriorityNormal.splice(fromNormalIndex, 1);

        let fromNoneIndex = dwarf.taskPriorityNone.indexOf(draggedTaskId);
        if (fromNoneIndex > -1) dwarf.taskPriorityNone.splice(fromNoneIndex, 1);

        // Add to destination list at the end
        if (droppedOnList === 'high') {
            dwarf.taskPriorityHigh.push(draggedTaskId);
        } else if (droppedOnList === 'normal') {
            dwarf.taskPriorityNormal.push(draggedTaskId);
        } else {
            dwarf.taskPriorityNone.push(draggedTaskId);
        }

        // Save and refresh
        saveTaskPriorityChanges(dwarf);
        populateTaskPriorityLists(dwarf);
    }

    return false;
}

/**
 * Add drop zones for empty lists
 */
function initializeTaskPriorityDropZones() {
    const priorityHighList = document.getElementById('task-priority-high-list');
    const priorityNormalList = document.getElementById('task-priority-normal-list');
    const priorityNoneList = document.getElementById('task-priority-none-list');

    [priorityHighList, priorityNormalList, priorityNoneList].forEach(list => {
        list.addEventListener('dragover', function(e) {
            if (e.preventDefault) e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
        });

        list.addEventListener('drop', function(e) {
            if (e.stopPropagation) e.stopPropagation();

            if (!draggedTask) return false;

            const dwarfName = draggedTask.dataset.dwarfName;
            const dwarf = dwarfs.find(d => d.name === dwarfName);
            if (!dwarf) return false;

            const draggedTaskId = draggedTask.dataset.taskId;

            // Determine which list this was dropped on
            let droppedOnList = 'normal';
            if (this.id === 'task-priority-high-list') {
                droppedOnList = 'high';
            } else if (this.id === 'task-priority-normal-list') {
                droppedOnList = 'normal';
            } else if (this.id === 'task-priority-none-list') {
                droppedOnList = 'none';
            }

            // Remove from all lists first to prevent duplicates
            let fromHighIndex = dwarf.taskPriorityHigh.indexOf(draggedTaskId);
            if (fromHighIndex > -1) dwarf.taskPriorityHigh.splice(fromHighIndex, 1);

            let fromNormalIndex = dwarf.taskPriorityNormal.indexOf(draggedTaskId);
            if (fromNormalIndex > -1) dwarf.taskPriorityNormal.splice(fromNormalIndex, 1);

            let fromNoneIndex = dwarf.taskPriorityNone.indexOf(draggedTaskId);
            if (fromNoneIndex > -1) dwarf.taskPriorityNone.splice(fromNoneIndex, 1);

            // Add to destination list only if not already present
            if (droppedOnList === 'high') {
                if (!dwarf.taskPriorityHigh.includes(draggedTaskId)) {
                    dwarf.taskPriorityHigh.push(draggedTaskId);
                }
            } else if (droppedOnList === 'normal') {
                if (!dwarf.taskPriorityNormal.includes(draggedTaskId)) {
                    dwarf.taskPriorityNormal.push(draggedTaskId);
                }
            } else {
                if (!dwarf.taskPriorityNone.includes(draggedTaskId)) {
                    dwarf.taskPriorityNone.push(draggedTaskId);
                }
            }

            // Save and refresh
            saveTaskPriorityChanges(dwarf);
            populateTaskPriorityLists(dwarf);

            return false;
        });
    });
}

/**
 * Save task priority changes to game state
 */
function saveTaskPriorityChanges(dwarf) {
    // Find the actual dwarf in the main array
    const actualDwarf = dwarfs.find(d => d.name === dwarf.name);
    if (actualDwarf) {
        actualDwarf.taskPriorityHigh = [...dwarf.taskPriorityHigh];
        actualDwarf.taskPriorityNormal = [...dwarf.taskPriorityNormal];
        actualDwarf.taskPriorityNone = [...dwarf.taskPriorityNone];

        // Sync with worker
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: { dwarfs }
            });
        }

        // Save game
        saveGame();

        console.log(`Task priorities updated for ${dwarf.name}:`, {
            high: dwarf.taskPriorityHigh,
            normal: dwarf.taskPriorityNormal,
            none: dwarf.taskPriorityNone
        });
    }
}

/**
 * Populate the static template with dwarf data (full population on open)
 */
function populateDwarfDetailTemplate(dwarf, includeToolSelector = true) {
    const currentXP = dwarf.xp || 0;
    const currentLevel = getDwarfLevel(dwarf);
    const xpNeeded = getDwarfXpForLevel(currentLevel);

    // Calculate bucket info (weight-based)
    const bucketWeight = calculateBucketWeight(dwarf.bucket);
    const dwarfCapacity = calculateDwarfBucketCapacity(dwarf);

    // Calculate furniture bonuses early for use in multiple places
    const furnitureBonusesEarly = calculateFurnitureBonuses(dwarf);
    const effectiveMaxEnergyDisplay = (dwarf.maxEnergy || 100) + furnitureBonusesEarly.maxEnergyBonus;

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

    const improvedDigging = researchData['improved-digging'];
    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * 0.01 : 0);
    const enchantBonus = 1 + enchantLevel * ENCHANT_POWER_BONUS;
    const furnitureDigBonus = 1 + furnitureBonusesEarly.digPowerBonus;

    // Apply gem bonus (5% per carat for each gem)

    const totalDigPower = (baseDwarfPower * levelBonus) * researchBonus * toolPower * enchantBonus * furnitureDigBonus;

    // Populate basic stats
    document.getElementById('dwarf-level').textContent = `⭐ ${currentLevel}`;
    document.getElementById('dwarf-xp').textContent = `${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')}`;
    document.getElementById('dwarf-energy').textContent = `⚡ ${Math.round(dwarf.energy || 0)}/${effectiveMaxEnergyDisplay}`;
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
    const enchantLine = enchantLevel > 0 ? `<div class="dwarf-digpower-enchant">× Enchantment: ${formatNumber(enchantBonus, 'percent')} (+${enchantLevel})</div>` : '';
    const diamondBonusPercent = baseDigPowerPoints > 0
        ? ((modifiedDigPowerPoints - baseDigPowerPoints) / baseDigPowerPoints * 100)
        : 0;
    // Calculate total Diamond carats for tooltip
    let totalDiamondCarat = 0;
    if (currentTool && currentTool.gems && currentTool.gems.length > 0) {
        totalDiamondCarat = currentTool.gems
            .filter(gem => gem.type === 'diamond')
            .reduce((sum, gem) => sum + gem.carat, 0);
    }
    const diamondTooltip = totalDiamondCarat > 0 ? `title="${totalDiamondCarat}ct Diamond in tool"` : '';
    const diamondBonusLine = modifiedDigPowerPoints > baseDigPowerPoints
        ? `<div class="dwarf-digpower-diamond" ${diamondTooltip}>💎 (Diamond: +${formatNumber(diamondBonusPercent, 'percent')}% to Level)</div>`
        : '';
    const furnitureDigLine = furnitureBonusesEarly.digPowerBonus > 0
        ? `<div class="dwarf-digpower-furniture">× 🏠 Furniture: ${formatNumber(furnitureDigBonus, 'percent')}</div>`
        : '';
    document.getElementById('dwarf-digpower-calc').innerHTML = `
        <div>Base: ${baseDwarfPower}</div>
        <div>× Level Bonus: ${formatNumber(levelBonus, 'percent')}</div>
        ${diamondBonusLine}
        <div>× Research: ${formatNumber(researchBonus, 'percent')} (${improvedDigging ? improvedDigging.level : 0})</div>
        <div>× Tool Power: ${formatNumber(toolPower, 'percent')}</div>
        ${enchantLine}
        ${furnitureDigLine}
    `;

    // Calculate and populate wage
    const wageOptimization = researchData['wage-optimization'];
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
        <div id="dwarf-wage-next" class="dwarf-wage-next">Next level: ${formatNumber(nextLevelWage, 'gold')}</div>
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
            enchantSpan.className = 'dwarf-tool-badge dwarf-tool-badge-enchant';
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
                gemSpan.className = 'dwarf-tool-badge dwarf-tool-badge-gem';
                gemSpan.textContent = `💎 ${type} ${carats}ct`;
                gemSpan.title = `${carats} carat ${type}`;
                toolBadges.appendChild(gemSpan);
            });
        }

        // Add plating display if tool has plating
        if (currentTool.plating && platingEffects[currentTool.plating]) {
            const platingEffect = platingEffects[currentTool.plating];
            const platingMaterial = materials[currentTool.plating];
            const platingColor = platingMaterial ? platingMaterial.color : '#888888';

            const platingSpan = document.createElement('span');
            platingSpan.className = 'dwarf-tool-badge dwarf-tool-badge-plating';
            platingSpan.style.background = platingColor;
            platingSpan.style.borderColor = platingColor;
            platingSpan.textContent = platingEffect.name;
            platingSpan.title = platingEffect.description;
            toolBadges.appendChild(platingSpan);
        }
    }

    // Populate combat bonuses section
    populateCombatBonuses(dwarf);

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
        card.className = 'levelup-option dwarf-stat-card';

        const headerEl = document.createElement('h4');
        headerEl.className = 'dwarf-stat-card-header';
        headerEl.textContent = `${icon} ${name}`;
        card.appendChild(headerEl);

        const skillPointsEl = document.createElement('p');
        skillPointsEl.className = 'dwarf-stat-card-points';
        skillPointsEl.innerHTML = `Skill Points invested: ${level}`;

        if (hasEnoughXP) {
            const btn = document.createElement('button');
            btn.className = 'btn-primary dwarf-stat-upgrade-btn';
            btn.textContent = '+1';
            btn.dataset.upgradeType = upgradeType;
            btn.dataset.dwarfName = dwarf.name;
            skillPointsEl.appendChild(btn);
        }

        card.appendChild(skillPointsEl);

        const descEl = document.createElement('p');
        descEl.className = 'dwarf-stat-card-desc';
        descEl.textContent = description;
        card.appendChild(descEl);

        return card;
    };

    const energyLevel = Math.round(Math.log((dwarf.maxEnergy || 100) / 100) / Math.log(DWARF_LEVELUP_ENERGY_MULTIPLIER));

    // Calculate Ruby energy prevention chance for display
    let rubyEnergyChance = 0;
    let totalRubyCarat = 0;
    if (dwarf.toolId) {
        const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
        if (toolInstance && toolInstance.gems && toolInstance.gems.length > 0) {
            totalRubyCarat = toolInstance.gems
                .filter(gem => gem.type === 'ruby')
                .reduce((sum, gem) => sum + gem.carat, 0);
            if (totalRubyCarat > 0) {
                rubyEnergyChance = calculateRubyEnergyPreventionChance(totalRubyCarat);
            }
        }
    }

    // Calculate gem bonuses for display
    // Get total carats for each gem type
    let totalDiamondCaratForStats = 0;
    let totalSapphireCarat = 0;
    let totalAmethystCarat = 0;
    if (dwarf.toolId) {
        const toolInstance = toolsInventory.find(t => t.id === dwarf.toolId);
        if (toolInstance && toolInstance.gems && toolInstance.gems.length > 0) {
            totalDiamondCaratForStats = toolInstance.gems
                .filter(gem => gem.type === 'diamond')
                .reduce((sum, gem) => sum + gem.carat, 0);
            totalSapphireCarat = toolInstance.gems
                .filter(gem => gem.type === 'sapphire')
                .reduce((sum, gem) => sum + gem.carat, 0);
            totalAmethystCarat = toolInstance.gems
                .filter(gem => gem.type === 'amethyst')
                .reduce((sum, gem) => sum + gem.carat, 0);
        }
    }

    // Get furniture bonuses for this dwarf
    const furnitureBonuses = calculateFurnitureBonuses(dwarf);

    const baseDigPower = dwarf.digPower || 0;
    const modifiedDigPower = getDiamondModifiedDigPower(dwarf, baseDigPower);
    const diamondDigPowerPercent = (modifiedDigPower > baseDigPower && baseDigPower > 0)
        ? ((modifiedDigPower - baseDigPower) / baseDigPower * 100)
        : 0;
    const diamondBonus = modifiedDigPower > baseDigPower ? ` (+${formatNumber(diamondDigPowerPercent, 'percent')}% from 💎Diamond ${totalDiamondCaratForStats}ct)` : '';
    const furnitureDigPowerBonus = furnitureBonuses.digPowerBonus > 0 ? `\n🏠 Furniture: +${formatNumber(furnitureBonuses.digPowerBonus * 100, 'percent')}%` : '';
    const digPowerDesc = `+${(baseDigPower * 10).toFixed(1)}% power${diamondBonus}${furnitureDigPowerBonus}`;

    const baseMaxEnergy = dwarf.maxEnergy || 100;
    const effectiveMaxEnergy = baseMaxEnergy + furnitureBonuses.maxEnergyBonus;
    const furnitureEnergyBonus = furnitureBonuses.maxEnergyBonus > 0 ? `\n🏠 Furniture: +${furnitureBonuses.maxEnergyBonus}` : '';
    const energyDesc = `Maximum Energy: ${effectiveMaxEnergy}${rubyEnergyChance > 0 ? `\n💎Ruby ${totalRubyCarat}ct: ${formatNumber(rubyEnergyChance, 'percent')}% chance to prevent energy consumption` : ''}${furnitureEnergyBonus}`;

    const baseStrength = dwarf.strength || 0;
    const modifiedStrength = getSapphireModifiedStrength(dwarf, baseStrength);
    const effectiveStrength = Math.floor(modifiedStrength) + furnitureBonuses.strengthBonus;
    const sapphireBonusPercent = (modifiedStrength > baseStrength && baseStrength > 0)
        ? ((modifiedStrength - baseStrength) / baseStrength * 100)
        : 0;
    const sapphireBonus = modifiedStrength > baseStrength ? ` (+${formatNumber(sapphireBonusPercent, 'percent')}% from 💎Sapphire ${totalSapphireCarat}ct)` : '';
    const furnitureStrengthBonus = furnitureBonuses.strengthBonus > 0 ? `\n🏠 Furniture: +${furnitureBonuses.strengthBonus}` : '';
    const strengthDesc = `+5kg per strength point${sapphireBonus}${furnitureStrengthBonus}`;

    const baseWisdom = dwarf.wisdom || 0;
    const effectiveWisdom = baseWisdom + furnitureBonuses.wisdomBonus;
    const amethystReduction = getAmethystHardnessReduction(dwarf);
    const amethystBonus = amethystReduction > 0 ? ` (-${(amethystReduction*100).toFixed(0)}% hardness from 💎Amethyst ${totalAmethystCarat}ct)` : '';
    const furnitureWisdomBonus = furnitureBonuses.wisdomBonus > 0 ? `\n🏠 Furniture: +${furnitureBonuses.wisdomBonus}` : '';
    const wisdomDesc = `Research success probability and Smelting Speed${amethystBonus}${furnitureWisdomBonus}`;

    // Display stats - show base skill points (furniture bonuses shown in tooltip)
    statsGrid.appendChild(createStatCard('⛏️', 'Dig Power', dwarf.digPower || 0, digPowerDesc, 'digPower'));
    statsGrid.appendChild(createStatCard('⚡', 'Max Energy', energyLevel, energyDesc, 'maxEnergy'));
    statsGrid.appendChild(createStatCard('💪', 'Strength', effectiveStrength, strengthDesc, 'strength'));
    statsGrid.appendChild(createStatCard('🧠', 'Wisdom', effectiveWisdom, wisdomDesc, 'wisdom'));

    // Populate rename input
    const renameInput = document.getElementById('dwarf-rename-input');
    renameInput.value = dwarf.name;
    const renameBtn = document.getElementById('dwarf-rename-btn');
    renameBtn.dataset.dwarfName = dwarf.name;

    // Set reset button dataset and cost
    const resetBtn = document.getElementById('dwarf-reset-btn');
    resetBtn.dataset.dwarfName = dwarf.name;
    const resetCost = (getDwarfLevel(dwarf)) * DWARF_RESET_COST_PER_LEVEL;
    document.getElementById('dwarf-reset-cost').textContent = resetCost;

    // Populate task priority lists
    populateTaskPriorityLists(dwarf);
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
    const currentLevel = getDwarfLevel(dwarf);
    const xpNeeded = getDwarfXpForLevel(currentLevel);

    // Calculate bucket info (weight-based)
    const bucketWeight = calculateBucketWeight(dwarf.bucket);
    const dwarfCapacity = calculateDwarfBucketCapacity(dwarf);

    // Calculate furniture bonuses for energy display
    const furnitureBonusesRefresh = calculateFurnitureBonuses(dwarf);
    const effectiveMaxEnergyRefresh = (dwarf.maxEnergy || 100) + furnitureBonusesRefresh.maxEnergyBonus;

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
    const improvedDigging = researchData['improved-digging'];
    const researchBonus = 1 + (improvedDigging ? (improvedDigging.level || 0) * 0.01 : 0);
    const totalDigPower = (baseDwarfPower * levelBonus) * researchBonus * toolPower;

    // Update only the dynamic text content (fast, non-blocking)
    document.getElementById('dwarf-level').textContent = `⭐ ${currentLevel}`;
    document.getElementById('dwarf-xp').textContent = `${formatNumber(currentXP, 'xp')}/${formatNumber(xpNeeded, 'xp')}`;
    document.getElementById('dwarf-energy').textContent = `⚡ ${Math.round(dwarf.energy || 0)}/${effectiveMaxEnergyRefresh}`;
    document.getElementById('dwarf-status').textContent = `💼 ${dwarf.status || 'idle'}`;

    // Update location information with friendly names
    document.getElementById('dwarf-position').textContent = getLocationName(dwarf.x || 0, dwarf.y || 0);

    // Update target with current activity
    const moveTargetElement = document.getElementById('dwarf-move-target');
    if (dwarf.moveTarget) {
        moveTargetElement.textContent = getLocationName(dwarf.moveTarget.x, dwarf.moveTarget.y);
    } else {
        const activity = getDwarfCurrentActivity(dwarf);
        if (activity) {
            moveTargetElement.innerHTML = `<span class="dwarf-move-target-activity">${activity.substr(0,12)}</span>`;
        } else {
            moveTargetElement.textContent = '→ None';
        }
    }

    // Update bucket header and contents
    document.getElementById('dwarf-bucket-header').textContent = `🧺 Bucket (${bucketWeight}kg/${dwarfCapacity}kg)`;
    const bucketContents = document.getElementById('dwarf-bucket-contents');
    if (dwarf.bucket && Object.keys(dwarf.bucket).length > 0 && bucketWeight > 0) {
        let bucketHTML = '<div class="dwarf-bucket-refresh-grid">';
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
                <div class="dwarf-bucket-refresh-item">
                    <div class="dwarf-bucket-refresh-item-name">${displayName}</div>
                    <div class="dwarf-bucket-refresh-item-count">${displayCount}</div>
                </div>
            `;
        }
        bucketHTML += '</div>';
        bucketContents.innerHTML = bucketHTML;
    } else {
        bucketContents.innerHTML = '<p class="dwarf-bucket-refresh-empty">Empty</p>';
    }

    document.getElementById('dwarf-digpower-total').textContent = formatNumber(totalDigPower, 'material');

    // Update combat bonuses
    populateCombatBonuses(dwarf);
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
    const currentLevel = getDwarfLevel(dwarf);
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

/**
 * Populate combat bonuses section in dwarf detail modal
 * Shows: Resting Rate, Critical Hit Chance, One-Hit Chance (Stone), One-Hit Chance (Ore)
 */
function populateCombatBonuses(dwarf) {
    // Calculate resting rate with furniture bonus
    const restingRate = calculateEffectiveRestingRate(dwarf);
    const baseRestingRate = getBaseRestingRate();
    const restingRateEl = document.getElementById('dwarf-resting-rate');
    if (restingRateEl) {
        const restBonus = restingRate - baseRestingRate;
        if (restBonus > 0) {
            restingRateEl.textContent = `${formatNumber(restingRate, 'material')}/tick`;
            restingRateEl.title = `Base: ${baseRestingRate}, Furniture: +${formatNumber(restBonus, 'material')}`;
        } else {
            restingRateEl.textContent = `${baseRestingRate}/tick`;
            restingRateEl.title = 'Base resting rate';
        }
    }

    // Calculate critical hit chance with furniture bonus
    const critChance = calculateCritChanceWithFurniture(dwarf);
    const critChanceEl = document.getElementById('dwarf-crit-chance');
    if (critChanceEl) {
        critChanceEl.textContent = `${formatNumber(critChance * 100, 'percent')}%`;
        // Build tooltip with breakdown
        const baseCrit = typeof CRITICAL_HIT_BASE_CHANCE !== 'undefined' ? CRITICAL_HIT_BASE_CHANCE : 0.02;
        const materialScience = researchData['material-science'];
        const researchBonus = (materialScience ? materialScience.level : 0) * (typeof RESEARCH_MATERIAL_SCIENCE_CRIT_BONUS !== 'undefined' ? RESEARCH_MATERIAL_SCIENCE_CRIT_BONUS : 0.05);
        const furnitureBonuses = calculateFurnitureBonuses(dwarf);

        let tooltip = `Base: ${(baseCrit * 100).toFixed(0)}%`;
        if (researchBonus > 0) tooltip += `\nResearch: +${(researchBonus * 100).toFixed(0)}%`;
        if (furnitureBonuses.critChanceBonus > 0) tooltip += `\nFurniture: +${(furnitureBonuses.critChanceBonus * 100).toFixed(1)}%`;
        critChanceEl.title = tooltip;
    }

    // Calculate one-hit chances
    const oneHitChances = calculateMaxOneHitChances(dwarf);

    const oneHitStoneEl = document.getElementById('dwarf-onehit-stone');
    if (oneHitStoneEl) {
        const stoneChance = oneHitChances.stoneChance * 100;
        oneHitStoneEl.textContent = `${formatNumber(stoneChance, 'percent')}%`;
        const stoneExpertise = researchData['expertise-stone'];
        const stoneLevel = stoneExpertise ? (stoneExpertise.level || 0) : 0;
        oneHitStoneEl.title = stoneLevel > 0
            ? `Stone Expertise Level ${stoneLevel}\n2% chance per level on critical hits`
            : 'Requires Stone Expertise research';
    }

    const oneHitOreEl = document.getElementById('dwarf-onehit-ore');
    if (oneHitOreEl) {
        const oreChance = oneHitChances.oreChance * 100;
        oneHitOreEl.textContent = `${formatNumber(oreChance, 'percent')}%`;
        const oreExpertise = researchData['expertise-ore'];
        const oreLevel = oreExpertise ? (oreExpertise.level || 0) : 0;
        oneHitOreEl.title = oreLevel > 0
            ? `Ore Expertise Level ${oreLevel}\n3% chance per level on critical hits`
            : 'Requires Ore Expertise research';
    }

    // Calculate XP gain bonus from furniture
    const xpGainBonusEl = document.getElementById('dwarf-xp-gain-bonus');
    if (xpGainBonusEl) {
        const furnitureBonuses = calculateFurnitureBonuses(dwarf);
        const xpGainBonus = furnitureBonuses.xpGainBonus * 100;
        xpGainBonusEl.textContent = `+${formatNumber(xpGainBonus, 'percent')}%`;
        xpGainBonusEl.title = xpGainBonus > 0
            ? `Furniture bonus: +${formatNumber(xpGainBonus, 'percent')}% XP from all sources`
            : 'No XP bonus (upgrade Shrine or Desk furniture)';
    }
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

    const currentLevel = getDwarfLevel(dwarf);
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
