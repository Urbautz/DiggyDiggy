// ============================================================================
// ENRICHMENT MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the enrichment modal
// Enrichment handles rare ore processing with centrifuge tension system

/**
 * Get the task ID that is currently being worked on at the enrichment facility (if any)
 * @returns {string|null} The task ID or null if no task is active
 */
function getCurrentActiveEnrichmentTask() {
    // Check if any dwarf is currently at enrichment
    const enrichmentDwarf = dwarfs.find(d => d.status === 'enriching');
    if (!enrichmentDwarf) return null;

    // Find the first actionable task in priority order
    for (const taskId of enrichmentTasks) {
        if (taskId === 'do-nothing') return null;
        const task = enrichmentTasksData[taskId];

        // Prestress task: actionable if in pressing mode
        if (task.type === 'prestress') {
            if (centrifugePressingMode) return taskId;
            continue;
        }

        // Check if task has required materials
        if (task.input && task.input.material) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                // Check tension requirement
                if (task.minTension && centrifugeTension < task.minTension) continue;
                return taskId;
            }
        }
    }

    return null;
}

/**
 * Calculate how many times an enrichment task can be performed
 */
function calculateEnrichmentTaskAvailableRuns(task) {
    if (task.input && task.input.material && task.input.amount) {
        const stockAmount = materialsStock[task.input.material] || 0;
        return Math.floor(stockAmount / task.input.amount);
    }
    return 0;
}

// Create a threshold control row for the centrifuge tension panel
function createTensionThresholdControl(label, valueId, currentValue, adjustFunctionName, step) {
    const row = document.createElement('div');
    row.className = 'smelter-temp-threshold-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'smelter-temp-threshold-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'smelter-temp-threshold-controls';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.className = 'smelter-temp-btn';
    decreaseBtn.textContent = `-${step}`;
    decreaseBtn.onclick = () => {
        window[adjustFunctionName](-step);
        updateCentrifugeTensionPanel();
    };
    controlsDiv.appendChild(decreaseBtn);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'smelter-temp-threshold-value';
    valueSpan.id = valueId;
    valueSpan.textContent = `${currentValue}`;
    controlsDiv.appendChild(valueSpan);

    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'smelter-temp-btn';
    increaseBtn.textContent = `+${step}`;
    increaseBtn.onclick = () => {
        window[adjustFunctionName](step);
        updateCentrifugeTensionPanel();
    };
    controlsDiv.appendChild(increaseBtn);

    row.appendChild(controlsDiv);
    return row;
}

// Create the centrifuge tension control panel
function createCentrifugeTensionPanel() {
    const currentTension = Math.round(centrifugeTension);
    const maxTension = CENTRIFUGE_MAX_TENSION_LIMIT;
    const tensionPercent = Math.min(100, (centrifugeTension / maxTension) * 100);
    const tensionColor = currentTension > 7500 ? '#ff4444'
                       : currentTension > 5000 ? '#ff8800'
                       : currentTension > 1000 ? '#ffbb00'
                       : '#88ccff';

    const panel = document.createElement('div');
    panel.className = 'smelter-temp-control-panel centrifuge-tension-panel';
    panel.id = 'centrifuge-tension-panel';

    // Section header
    const header = document.createElement('div');
    header.className = 'smelter-temp-control-header';
    header.innerHTML = '<span class="smelter-temp-control-icon">⚙️</span> Centrifuge Tension';
    panel.appendChild(header);

    // Tension bar
    const barContainer = document.createElement('div');
    barContainer.className = 'smelter-temp-bar-container';
    barContainer.id = 'centrifuge-tension-bar-container';

    const bar = document.createElement('div');
    bar.className = 'centrifuge-tension-bar-fill';
    bar.id = 'centrifuge-tension-bar';
    bar.style.width = `${tensionPercent}%`;
    barContainer.appendChild(bar);
    panel.appendChild(barContainer);

    // Current tension display
    const tensionDisplay = document.createElement('div');
    tensionDisplay.className = 'smelter-temp-current-display';
    tensionDisplay.id = 'centrifuge-tension-display';
    tensionDisplay.innerHTML = `<strong>Tension:</strong> <span id="centrifuge-tension-value" style="color: ${tensionColor}; font-weight: bold;">${currentTension}</span> / ${maxTension}`;
    panel.appendChild(tensionDisplay);

    // Max tension threshold subsection
    const thresholdSection = document.createElement('div');
    thresholdSection.className = 'smelter-temp-subsection';

    const thresholdHeader = document.createElement('div');
    thresholdHeader.className = 'smelter-temp-subsection-title';
    thresholdHeader.textContent = '🎯 Target Tension';
    thresholdSection.appendChild(thresholdHeader);

    const thresholdControls = document.createElement('div');
    thresholdControls.className = 'smelter-temp-controls-grid';
    thresholdControls.appendChild(
        createTensionThresholdControl('Max Tension', 'centrifuge-max-tension-value', centrifugeMaxTension, 'adjustCentrifugeMaxTension', 250)
    );
    thresholdSection.appendChild(thresholdControls);
    panel.appendChild(thresholdSection);

    return panel;
}

// Efficiently update centrifuge tension panel values
function updateCentrifugeTensionPanel() {
    const panel = document.getElementById('centrifuge-tension-panel');
    if (!panel) return;

    const currentTension = Math.round(centrifugeTension);
    const maxTension = CENTRIFUGE_MAX_TENSION_LIMIT;
    const tensionPercent = Math.min(100, (centrifugeTension / maxTension) * 100);
    const tensionColor = currentTension > 7500 ? '#ff4444'
                       : currentTension > 5000 ? '#ff8800'
                       : currentTension > 1000 ? '#ffbb00'
                       : '#88ccff';

    // Update bar
    const bar = document.getElementById('centrifuge-tension-bar');
    if (bar) bar.style.width = `${tensionPercent}%`;

    // Update tension value
    const tensionValue = document.getElementById('centrifuge-tension-value');
    if (tensionValue) {
        tensionValue.textContent = `${currentTension}`;
        tensionValue.style.color = tensionColor;
    }

    // Update max tension threshold value
    const maxTensionValue = document.getElementById('centrifuge-max-tension-value');
    if (maxTensionValue) maxTensionValue.textContent = `${centrifugeMaxTension}`;
}

// Adjust centrifuge max tension setting
window.adjustCentrifugeMaxTension = function(amount) {
    centrifugeMaxTension = Math.max(0, Math.min(CENTRIFUGE_MAX_TENSION_LIMIT, centrifugeMaxTension + amount));

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                centrifugeMaxTension: centrifugeMaxTension
            }
        });
    }

    saveGame();
    populateEnrichment();
}

function populateEnrichment() {
    const container = document.getElementById('enrichment-content');
    if (!container) return;

    container.innerHTML = '';

    // Header description
    const headerDesc = document.createElement('p');
    headerDesc.className = 'smelter-description';
    headerDesc.textContent = 'Set the priority of Zentrifuge tasks. The facility will work on tasks from top to bottom.';
    container.appendChild(headerDesc);

    // Centrifuge tension control panel
    const tensionPanel = createCentrifugeTensionPanel();
    container.appendChild(tensionPanel);

    // Task list container
    const taskList = document.createElement('div');
    taskList.className = 'smelter-task-list';
    taskList.id = 'enrichment-task-list';

    // Set up auto-refresh for enrichment modal
    if (window.enrichmentRefreshInterval) {
        clearInterval(window.enrichmentRefreshInterval);
    }
    window.enrichmentRefreshInterval = setInterval(() => {
        const modal = document.getElementById('enrichment-modal');
        if (modal && modal.getAttribute('aria-hidden') === 'false') {
            updateEnrichmentTasksDisplay();
        } else {
            clearInterval(window.enrichmentRefreshInterval);
            window.enrichmentRefreshInterval = null;
        }
    }, 100); // Update every 100ms for smooth progress updates

    // Find if there's a "do-nothing" task and track if we're below it
    const doNothingIndex = enrichmentTasks.findIndex(id => id === 'do-nothing');

    // Get the currently active task
    const activeTaskId = getCurrentActiveEnrichmentTask();

    // Track display index for visible tasks only
    let displayIndex = 0;

    // Render each task
    enrichmentTasks.forEach((taskId, index) => {
        const task = enrichmentTasksData[taskId];
        if (!task) return;

        const taskRow = document.createElement('div');
        taskRow.className = 'smelter-task-row';
        taskRow.dataset.taskId = taskId;
        taskRow.dataset.taskIndex = index;
        taskRow.draggable = true;

        // Check if this task is unreachable (below "do-nothing")
        const isUnreachable = doNothingIndex >= 0 && index > doNothingIndex && taskId !== 'do-nothing';

        // Check if this task is actionable
        let isActionable = false;
        let stockAmount = 0;
        let isTensionBlocked = false;
        if (taskId === 'do-nothing') {
            isActionable = true;
        } else if (task.type === 'prestress') {
            isActionable = centrifugePressingMode;
        } else {
            if (task.input && task.input.material) {
                stockAmount = materialsStock[task.input.material] || 0;
                const hasMaterials = stockAmount >= task.input.amount;
                if (hasMaterials && task.minTension && centrifugeTension < task.minTension) {
                    isTensionBlocked = true;
                    isActionable = false;
                } else {
                    isActionable = hasMaterials;
                }
            }
        }

        // Check if this is the currently active task
        const isActiveTask = (taskId === activeTaskId);

        // Add appropriate classes
        if (isUnreachable) {
            taskRow.classList.add('smelter-task-unreachable');
        } else if (isActionable) {
            taskRow.classList.add('smelter-task-actionable');
        } else if (task.type === 'prestress' && !centrifugePressingMode) {
            taskRow.classList.add('smelter-task-temp-ok');
        } else if (isTensionBlocked) {
            taskRow.classList.add('smelter-task-temp-low');
        }

        if (isActiveTask) {
            taskRow.classList.add('smelter-task-active');
        }

        // Status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'smelter-task-status';
        if (isUnreachable) {
            statusIndicator.textContent = '⛔';
            statusIndicator.title = 'Unreachable - move "Do Nothing" task down';
        } else if (isActiveTask) {
            statusIndicator.textContent = '🧍';
            statusIndicator.title = 'Currently being worked on';
        } else if (task.type === 'prestress' && !centrifugePressingMode) {
            statusIndicator.textContent = '⚙️';
            statusIndicator.title = 'Tension adequate - no prestress needed';
        } else if (isActionable) {
            statusIndicator.textContent = '✅';
            statusIndicator.title = 'Ready';
        } else if (isTensionBlocked) {
            statusIndicator.textContent = '🌀';
            statusIndicator.title = `Tension too low - need ${task.minTension}, current ${Math.round(centrifugeTension)}`;
        } else {
            statusIndicator.textContent = '⏳';
            statusIndicator.title = 'Waiting for materials';
        }

        // Priority number (only for visible tasks)
        const priorityNumber = document.createElement('span');
        priorityNumber.className = 'smelter-task-priority';
        priorityNumber.textContent = `${displayIndex + 1}.`;
        displayIndex++;

        // Task name
        const taskName = document.createElement('span');
        taskName.className = 'smelter-task-name';
        taskName.textContent = task.name;

        // Recipe/progress info
        const taskRecipe = document.createElement('span');
        taskRecipe.className = 'smelter-task-recipe';

        // For tasks with progress, show progress
        if (task.progress !== undefined && task.progress > 0 && task.type !== 'prestress') {
            const progress = task.progress;
            const ticksRequired = task.ticksRequired;
            const percentage = Math.round((progress / ticksRequired) * 100);
            const availableRuns = calculateEnrichmentTaskAvailableRuns(task);
            const runsText = availableRuns > 1 ? ` (${availableRuns - 1} more available)` : '';
            taskRecipe.textContent = `Progress: ${progress}/${ticksRequired} ticks (${percentage}%)${runsText}`;
            taskRecipe.classList.add('recipe-ready');
        } else if (task.type === 'prestress') {
            // Prestress centrifuge task
            const currentTension = Math.round(centrifugeTension);
            if (centrifugePressingMode) {
                taskRecipe.textContent = `Winding up... (${currentTension} / ${centrifugeMaxTension})`;
                taskRecipe.classList.add('recipe-ready');
            } else {
                taskRecipe.textContent = `Tension at target (${currentTension} / ${centrifugeMaxTension})`;
                taskRecipe.classList.add('recipe-blocked');
            }
        } else if (task.input && task.output) {
            // Single input/output with stock counts and tension requirement
            const inputMat = getMaterialById(task.input.material);
            const outputMat = getMaterialById(task.output.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const outputName = outputMat ? outputMat.name : task.output.material;
            const stock = materialsStock[task.input.material] || 0;
            const tensionReq = task.minTension ? ` @ ${task.minTension} tension` : '';

            taskRecipe.textContent = `${task.input.amount}× ${inputName} (${stock}) → ${task.output.amount}× ${outputName}${tensionReq}`;

            if (!isActionable && !isUnreachable) {
                taskRecipe.classList.add('recipe-blocked');
            } else {
                taskRecipe.classList.add('recipe-ready');
            }
        } else if (task.type === 'none') {
            // Do nothing task
            taskRecipe.textContent = task.description;
            taskRecipe.classList.add('recipe-ready');
        }

        // Task info container (with flex: 1 to push buttons right)
        const taskInfo = document.createElement('div');
        taskInfo.className = 'smelter-task-info';
        taskInfo.appendChild(taskName);
        taskInfo.appendChild(taskRecipe);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.className = 'smelter-task-buttons';

        // Move to top button
        const topBtn = document.createElement('button');
        topBtn.className = 'smelter-btn-move';
        topBtn.innerHTML = '⤊';
        topBtn.title = 'Move to top (highest priority)';
        topBtn.disabled = index === 0;
        topBtn.onclick = () => moveEnrichmentTaskToTop(index);
        btnContainer.appendChild(topBtn);

        // Move up button
        const upBtn = document.createElement('button');
        upBtn.className = 'smelter-btn-move';
        upBtn.innerHTML = '⬆';
        upBtn.title = 'Move up (higher priority)';
        upBtn.disabled = index === 0;
        upBtn.onclick = () => moveEnrichmentTask(index, -1);
        btnContainer.appendChild(upBtn);

        // Move down button
        const downBtn = document.createElement('button');
        downBtn.className = 'smelter-btn-move';
        downBtn.innerHTML = '⬇';
        downBtn.title = 'Move down (lower priority)';
        downBtn.disabled = index === enrichmentTasks.length - 1;
        downBtn.onclick = () => moveEnrichmentTask(index, 1);
        btnContainer.appendChild(downBtn);

        // Deactivate button (move to end)
        const deactivateBtn = document.createElement('button');
        deactivateBtn.className = 'smelter-btn-move';
        deactivateBtn.innerHTML = '⤋';
        deactivateBtn.title = 'Deactivate (move to bottom)';
        deactivateBtn.disabled = index === enrichmentTasks.length - 1;
        deactivateBtn.onclick = () => moveEnrichmentTaskToBottom(index);
        btnContainer.appendChild(deactivateBtn);

        // Assemble task row
        taskRow.appendChild(statusIndicator);
        taskRow.appendChild(priorityNumber);
        taskRow.appendChild(taskInfo);
        taskRow.appendChild(btnContainer);

        // Add drag-and-drop handlers
        taskRow.addEventListener('dragstart', handleEnrichmentDragStart);
        taskRow.addEventListener('dragover', handleEnrichmentDragOver);
        taskRow.addEventListener('drop', handleEnrichmentDrop);
        taskRow.addEventListener('dragend', handleEnrichmentDragEnd);

        taskList.appendChild(taskRow);
    });

    container.appendChild(taskList);
}

// Enrichment drag and drop handlers
let enrichmentDraggedElement = null;
let enrichmentDraggedIndex = null;

function handleEnrichmentDragStart(e) {
    const taskRow = e.target.closest('.smelter-task-row');
    if (!taskRow) return;

    enrichmentDraggedElement = taskRow;
    enrichmentDraggedIndex = parseInt(taskRow.dataset.taskIndex);
    taskRow.classList.add('smelter-task-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', taskRow.innerHTML);
}

function handleEnrichmentDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const taskRow = e.target.closest('.smelter-task-row');
    if (!taskRow || taskRow === enrichmentDraggedElement) return;

    const rect = taskRow.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    // Remove all drop indicators
    document.querySelectorAll('.smelter-task-row').forEach(row => {
        row.classList.remove('smelter-drop-above', 'smelter-drop-below');
    });

    // Add indicator based on mouse position
    if (e.clientY < midpoint) {
        taskRow.classList.add('smelter-drop-above');
    } else {
        taskRow.classList.add('smelter-drop-below');
    }
}

function handleEnrichmentDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const targetRow = e.target.closest('.smelter-task-row');
    if (!targetRow || !enrichmentDraggedElement || targetRow === enrichmentDraggedElement) return;

    const targetIndex = parseInt(targetRow.dataset.taskIndex);
    const rect = targetRow.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    // Determine if we're dropping above or below the target
    let newIndex;
    if (e.clientY < midpoint) {
        // Drop above target
        newIndex = targetIndex;
    } else {
        // Drop below target
        newIndex = targetIndex + 1;
    }

    // Adjust index if dragging down
    if (enrichmentDraggedIndex < newIndex) {
        newIndex--;
    }

    // Reorder tasks if position changed
    if (enrichmentDraggedIndex !== newIndex) {
        const movedTask = enrichmentTasks.splice(enrichmentDraggedIndex, 1)[0];
        enrichmentTasks.splice(newIndex, 0, movedTask);

        // Sync with worker
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: {
                    enrichmentTasks: enrichmentTasks
                }
            });
        }

        saveGame();
        populateEnrichment();
    }

    // Clean up
    document.querySelectorAll('.smelter-task-row').forEach(row => {
        row.classList.remove('smelter-drop-above', 'smelter-drop-below');
    });
}

function handleEnrichmentDragEnd(e) {
    const taskRow = e.target.closest('.smelter-task-row');
    if (taskRow) {
        taskRow.classList.remove('smelter-task-dragging');
    }
    document.querySelectorAll('.smelter-task-row').forEach(row => {
        row.classList.remove('smelter-drop-above', 'smelter-drop-below');
    });
    enrichmentDraggedElement = null;
    enrichmentDraggedIndex = null;
}

/**
 * Update the enrichment tasks display (called periodically while modal is open)
 */
function updateEnrichmentTasksDisplay() {
    const taskList = document.getElementById('enrichment-task-list');
    if (!taskList) return;

    const activeTaskId = getCurrentActiveEnrichmentTask();

    // Update each task row
    const taskRows = taskList.querySelectorAll('.smelter-task-row');
    taskRows.forEach(taskRow => {
        const taskId = taskRow.dataset.taskId;
        const task = enrichmentTasksData[taskId];
        if (!task) return;

        const statusIndicator = taskRow.querySelector('.smelter-task-status');
        if (!statusIndicator) return;

        const isCurrentlyActive = (taskId === activeTaskId);
        const wasActive = taskRow.classList.contains('smelter-task-active');

        // Update active state
        if (isCurrentlyActive) {
            taskRow.classList.add('smelter-task-active');
            if (statusIndicator) {
                statusIndicator.textContent = '🧍';
                statusIndicator.title = 'Currently being worked on';
            }
        } else {
            taskRow.classList.remove('smelter-task-active');
            if (!isCurrentlyActive && wasActive) {
                // Task is no longer active, restore appropriate icon
                const isActionable = taskRow.classList.contains('smelter-task-actionable');
                if (isActionable) {
                    statusIndicator.textContent = '✅';
                    statusIndicator.title = 'Ready - materials available';
                }
            }
        }

        // Update progress for tasks being worked on
        if (task.ticksRequired) {
            const taskRecipe = taskRow.querySelector('.smelter-task-recipe');
            if (taskRecipe) {
                // Check if task has progress (being worked on or paused)
                if (task.progress !== undefined && task.progress > 0) {
                    // Show progress for task with active progress
                    const progress = task.progress;
                    const ticksRequired = task.ticksRequired;
                    const percentage = Math.round((progress / ticksRequired) * 100);

                    // Calculate available runs after current task
                    const availableRuns = calculateEnrichmentTaskAvailableRuns(task);
                    const runsText = availableRuns > 1 ? ` (${availableRuns - 1} more available)` : '';

                    taskRecipe.textContent = `Progress: ${progress}/${ticksRequired} ticks (${percentage}%)${runsText}`;
                    taskRecipe.classList.remove('recipe-blocked');
                    taskRecipe.classList.add('recipe-ready');
                }
            }
        }

        // Update prestress task recipe text
        if (task.type === 'prestress') {
            const taskRecipe = taskRow.querySelector('.smelter-task-recipe');
            if (taskRecipe) {
                const currentTension = Math.round(centrifugeTension);
                if (centrifugePressingMode) {
                    taskRecipe.textContent = `Winding up... (${currentTension} / ${centrifugeMaxTension})`;
                    taskRecipe.classList.remove('recipe-blocked');
                    taskRecipe.classList.add('recipe-ready');
                } else {
                    taskRecipe.textContent = `Tension at target (${currentTension} / ${centrifugeMaxTension})`;
                    taskRecipe.classList.remove('recipe-ready');
                    taskRecipe.classList.add('recipe-blocked');
                }
            }
        }
    });

    // Update the tension control panel
    updateCentrifugeTensionPanel();
}

/**
 * Move an enrichment task to the top of the priority list
 */
function moveEnrichmentTaskToTop(index) {
    // Already at top
    if (index === 0) return;

    // Remove task from current position and insert at top
    const task = enrichmentTasks.splice(index, 1)[0];
    enrichmentTasks.unshift(task);

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                enrichmentTasks: enrichmentTasks
            }
        });
    }

    // Save the new order
    saveGame();

    // Re-render the list
    populateEnrichment();
}

/**
 * Move an enrichment task to the bottom of the priority list (deactivate)
 */
function moveEnrichmentTaskToBottom(index) {
    // Already at bottom
    if (index === enrichmentTasks.length - 1) return;

    // Remove task from current position and append at end
    const task = enrichmentTasks.splice(index, 1)[0];
    enrichmentTasks.push(task);

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                enrichmentTasks: enrichmentTasks
            }
        });
    }

    // Save the new order
    saveGame();

    // Re-render the list
    populateEnrichment();
}

/**
 * Move an enrichment task up or down in the priority list
 */
function moveEnrichmentTask(index, direction) {
    const newIndex = index + direction;

    // Bounds check
    if (newIndex < 0 || newIndex >= enrichmentTasks.length) return;

    // Swap tasks
    const temp = enrichmentTasks[index];
    enrichmentTasks[index] = enrichmentTasks[newIndex];
    enrichmentTasks[newIndex] = temp;

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                enrichmentTasks: enrichmentTasks
            }
        });
    }

    // Save the new order
    saveGame();

    // Re-render the list
    populateEnrichment();
}
