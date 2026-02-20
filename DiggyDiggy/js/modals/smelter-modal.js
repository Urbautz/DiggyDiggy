// ============================================================================
// SMELTER AND TASK DETAILS MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the smelter modal and task details

// Helper function to add a table row
function addTableRow(table, headerText, contentText) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = headerText;
    const td = document.createElement('td');
    td.textContent = contentText;
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
}

// Helper function to calculate how many times a task can be performed (accounting for batch capacity)
function calculateTaskAvailableRuns(task) {
    if (task.type === 'gem-cutting') {
        return gems.filter(g => g.markedForCutting && !g.polished).length;
    }

    // Get smelter capacity (only for non-heating tasks)
    const capacity = task.type === 'heating' ? 1 : getSmelterCapacity();

    if (task.type === 'heating' || !task.output) {
        // Heating tasks - check input material (no capacity multiplier)
        if (task.input && task.input.material && task.input.amount) {
            const stockAmount = materialsStock[task.input.material] || 0;
            return Math.floor(stockAmount / task.input.amount);
        }
        return 0;
    }

    // For tasks with multiple inputs (alloys) - account for batch capacity
    if (task.inputs && Array.isArray(task.inputs)) {
        let minRuns = Infinity;
        for (const input of task.inputs) {
            const stockAmount = materialsStock[input.material] || 0;
            // Divide by (amount * capacity) to get number of batches
            const possibleRuns = Math.floor(stockAmount / (input.amount * capacity));
            minRuns = Math.min(minRuns, possibleRuns);
        }
        return minRuns === Infinity ? 0 : minRuns;
    }

    // For tasks with single input - account for batch capacity
    if (task.input && task.input.material && task.input.amount) {
        const stockAmount = materialsStock[task.input.material] || 0;
        // Divide by (amount * capacity) to get number of batches
        return Math.floor(stockAmount / (task.input.amount * capacity));
    }

    return 0;
}

// Helper function to create a threshold control row for the main smelter view
function createThresholdControl(label, valueId, currentValue, adjustFunctionName) {
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
    decreaseBtn.textContent = '-25°';
    decreaseBtn.onclick = () => {
        window[adjustFunctionName](-25);
        updateMainTempControls();
    };
    controlsDiv.appendChild(decreaseBtn);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'smelter-temp-threshold-value';
    valueSpan.id = valueId;
    valueSpan.textContent = `${currentValue}°`;
    controlsDiv.appendChild(valueSpan);

    const increaseBtn = document.createElement('button');
    increaseBtn.className = 'smelter-temp-btn';
    increaseBtn.textContent = '+25°';
    increaseBtn.onclick = () => {
        window[adjustFunctionName](25);
        updateMainTempControls();
    };
    controlsDiv.appendChild(increaseBtn);

    row.appendChild(controlsDiv);
    return row;
}

// Create the temperature control panel for the main smelter view
function createTemperatureControlPanel() {
    // Gate: furnace research must be unlocked
    const furnaceResearch = researchData['furnace'];
    if (!furnaceResearch || (furnaceResearch.level || 0) < 1) {
        return null;
    }

    // Calculate derived values
    const furnaceTemp = researchData['furnace-temperature'];
    const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
    const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);
    const currentTemp = Math.round(smelterTemperature);
    const tempPercent = Math.min(100, (smelterTemperature / maxTempLimit) * 100);
    const tempColor = currentTemp > 1000 ? '#ff4444'
                    : currentTemp > 500 ? '#ff8800'
                    : currentTemp > 100 ? '#ffbb00'
                    : '#88ccff';

    // Main container
    const panel = document.createElement('div');
    panel.className = 'smelter-temp-control-panel';
    panel.id = 'smelter-temp-control-panel';

    // Section header
    const header = document.createElement('div');
    header.className = 'smelter-temp-control-header';
    header.innerHTML = '<span class="smelter-temp-control-icon">🌡️</span> Temperature Control';
    panel.appendChild(header);

    // Temperature bar
    const barContainer = document.createElement('div');
    barContainer.className = 'smelter-temp-bar-container';
    barContainer.id = 'smelter-main-temp-bar-container';

    const bar = document.createElement('div');
    bar.className = 'smelter-temp-bar-fill';
    bar.id = 'smelter-main-temp-bar';
    bar.style.width = `${tempPercent}%`;
    barContainer.appendChild(bar);
    panel.appendChild(barContainer);

    // Current temperature display
    const tempDisplay = document.createElement('div');
    tempDisplay.className = 'smelter-temp-current-display';
    tempDisplay.id = 'smelter-main-temp-display';
    tempDisplay.innerHTML = `<strong>Current:</strong> <span id="smelter-main-temp-value" style="color: ${tempColor}; font-weight: bold;">${currentTemp}°</span> / ${maxTempLimit}°`;
    panel.appendChild(tempDisplay);

    // Coal heating subsection (always shown if furnace is unlocked)
    const coalSection = document.createElement('div');
    coalSection.className = 'smelter-temp-subsection';
    coalSection.id = 'smelter-coal-temp-section';

    const coalHeader = document.createElement('div');
    coalHeader.className = 'smelter-temp-subsection-title';
    coalHeader.textContent = '⛏️ Coal Heating';
    coalSection.appendChild(coalHeader);

    const coalControls = document.createElement('div');
    coalControls.className = 'smelter-temp-controls-grid';
    coalControls.appendChild(
        createThresholdControl('Min Threshold', 'smelter-main-coal-min', smelterCoalMinTemp, 'adjustCoalMinTemp')
    );
    coalControls.appendChild(
        createThresholdControl('Max Threshold', 'smelter-main-coal-max', smelterCoalMaxTemp, 'adjustCoalMaxTemp')
    );
    coalSection.appendChild(coalControls);
    panel.appendChild(coalSection);

    // Magma heating subsection (only if magma-furnace research is unlocked)
    const magmaResearch = researchData['magma-furnace'];
    const isMagmaUnlocked = magmaResearch && (magmaResearch.level || 0) >= 1;

    if (isMagmaUnlocked) {
        const magmaSection = document.createElement('div');
        magmaSection.className = 'smelter-temp-subsection';
        magmaSection.id = 'smelter-magma-temp-section';

        const magmaHeader = document.createElement('div');
        magmaHeader.className = 'smelter-temp-subsection-title';
        magmaHeader.textContent = '🌋 Magma Heating';
        magmaSection.appendChild(magmaHeader);

        const magmaControls = document.createElement('div');
        magmaControls.className = 'smelter-temp-controls-grid';
        magmaControls.appendChild(
            createThresholdControl('Min Threshold', 'smelter-main-magma-min', smelterMagmaMinTemp, 'adjustMagmaMinTemp')
        );
        magmaSection.appendChild(magmaControls);
        panel.appendChild(magmaSection);
    }

    return panel;
}

// Efficiently update the main temperature control panel values without DOM rebuild
function updateMainTempControls() {
    const panel = document.getElementById('smelter-temp-control-panel');
    if (!panel) return;

    const furnaceTemp = researchData['furnace-temperature'];
    const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
    const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);
    const currentTemp = Math.round(smelterTemperature);
    const tempPercent = Math.min(100, (smelterTemperature / maxTempLimit) * 100);
    const tempColor = currentTemp > 1000 ? '#ff4444'
                    : currentTemp > 500 ? '#ff8800'
                    : currentTemp > 100 ? '#ffbb00'
                    : '#88ccff';

    // Update bar
    const bar = document.getElementById('smelter-main-temp-bar');
    if (bar) bar.style.width = `${tempPercent}%`;

    // Update temperature value text
    const tempValue = document.getElementById('smelter-main-temp-value');
    if (tempValue) {
        tempValue.textContent = `${currentTemp}°`;
        tempValue.style.color = tempColor;
    }

    // Update threshold values
    const coalMin = document.getElementById('smelter-main-coal-min');
    if (coalMin) coalMin.textContent = `${smelterCoalMinTemp}°`;

    const coalMax = document.getElementById('smelter-main-coal-max');
    if (coalMax) coalMax.textContent = `${smelterCoalMaxTemp}°`;

    const magmaMin = document.getElementById('smelter-main-magma-min');
    if (magmaMin) magmaMin.textContent = `${smelterMagmaMinTemp}°`;
}

// Open task details modal
function openTaskDetailsModal(task, isUnlocked, requiredResearchName) {
    openModal('task-details-modal');

    // Get all elements
    const titleEl = document.getElementById('task-details-title');
    const descriptionEl = document.getElementById('task-description');
    const materialsSection = document.getElementById('task-materials-section');
    const materialsTable = document.getElementById('task-materials-table');
    const tempSection = document.getElementById('task-temperature-section');
    const tempTable = document.getElementById('task-temperature-table');
    const tempBarContainer = document.getElementById('task-temp-bar-container');
    const requirementsEl = document.getElementById('task-requirements');

    if (!titleEl || !descriptionEl) return;

    // Set title and description
    titleEl.textContent = task.name;
    descriptionEl.textContent = task.description;

    // Clear previous content
    materialsTable.innerHTML = '';
    tempTable.innerHTML = '';
    materialsSection.style.display = 'none';
    tempSection.style.display = 'none';
    tempBarContainer.style.display = 'none';

    // Get smelter capacity for batch processing (not for heating tasks)
    const capacity = task.type === 'heating' ? 1 : getSmelterCapacity();

    // Input/Output Materials section
    if ((task.input && task.output) || (task.inputs && task.output) || task.type === 'gem-cutting') {
        materialsSection.style.display = '';

        // Show batch size info if capacity > 1
        if (capacity > 1) {
            addTableRow(materialsTable, 'Batch Size', `${capacity}x (from Smelter Capacity research)`);
        }

        if (task.type === 'gem-cutting') {
            // Gem cutting task
            addTableRow(materialsTable, 'Input', 'Any gem marked for cutting');
            addTableRow(materialsTable, 'Output', 'Polished gem (+50% value)');
            if (task.ticksRequired) {
                addTableRow(materialsTable, 'Time', `${task.ticksRequired} ticks`);
            }
            if (task.hardness !== undefined) {
                addTableRow(materialsTable, 'Difficulty', `${task.hardness}`);
            }
        } else if (task.inputs && Array.isArray(task.inputs)) {
            // Multiple inputs (alloy format) - show batch amounts
            task.inputs.forEach(input => {
                const inputMat = getMaterialById(input.material);
                const inputName = inputMat ? inputMat.name : input.material;
                const stockAmount = materialsStock[input.material] || 0;
                const batchAmount = input.amount * capacity;

                const tr = document.createElement('tr');
                const th = document.createElement('th');
                th.textContent = 'Input';

                const td = document.createElement('td');
                td.textContent = `${batchAmount}x ${inputName} `;

                const stockSpan = document.createElement('span');
                stockSpan.style.color = stockAmount >= batchAmount ? '#81c784' : '#e57373';
                stockSpan.textContent = `(Stock: ${formatNumber(stockAmount, 'material')})`;
                td.appendChild(stockSpan);

                tr.appendChild(th);
                tr.appendChild(td);
                materialsTable.appendChild(tr);
            });

            const outputMat = getMaterialById(task.output.material);
            const outputName = outputMat ? outputMat.name : task.output.material;
            const batchOutputAmount = task.output.amount * capacity;
            addTableRow(materialsTable, 'Output', `${batchOutputAmount}x ${outputName}`);
            if (task.ticksRequired) {
                addTableRow(materialsTable, 'Time', `${task.ticksRequired} ticks`);
            }
            if (task.hardness !== undefined) {
                addTableRow(materialsTable, 'Difficulty', `${task.hardness}`);
            }
        } else if (task.input && task.output) {
            // Single input - show batch amounts
            const inputMat = getMaterialById(task.input.material);
            const outputMat = getMaterialById(task.output.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const outputName = outputMat ? outputMat.name : task.output.material;
            const stockAmount = materialsStock[task.input.material] || 0;
            const batchInputAmount = task.input.amount * capacity;
            const batchOutputAmount = task.output.amount * capacity;

            const inputTr = document.createElement('tr');
            const inputTh = document.createElement('th');
            inputTh.textContent = 'Input';

            const inputTd = document.createElement('td');
            inputTd.textContent = `${batchInputAmount}x ${inputName} `;

            const stockSpan = document.createElement('span');
            stockSpan.style.color = stockAmount >= batchInputAmount ? '#81c784' : '#e57373';
            stockSpan.textContent = `(Stock: ${formatNumber(stockAmount, 'material')})`;
            inputTd.appendChild(stockSpan);

            inputTr.appendChild(inputTh);
            inputTr.appendChild(inputTd);
            materialsTable.appendChild(inputTr);

            addTableRow(materialsTable, 'Output', `${batchOutputAmount}x ${outputName}`);
            if (task.ticksRequired) {
                addTableRow(materialsTable, 'Time', `${task.ticksRequired} ticks`);
            }
            if (task.hardness !== undefined) {
                addTableRow(materialsTable, 'Difficulty', `${task.hardness}`);
            }
        } else if (task.input && task.type === 'heating') {
            // Heating task (no capacity multiplier)
            const inputMat = getMaterialById(task.input.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const stockAmount = materialsStock[task.input.material] || 0;
            const heatInfo = task.heatGain === 'dynamic' ? 'Heat to max temperature' : `+${task.heatGain}° (max 2000°)`;

            const inputTr = document.createElement('tr');
            const inputTh = document.createElement('th');
            inputTh.textContent = 'Input';

            const inputTd = document.createElement('td');
            inputTd.textContent = `${task.input.amount}x ${inputName} `;

            const stockSpan = document.createElement('span');
            stockSpan.style.color = stockAmount >= task.input.amount ? '#81c784' : '#e57373';
            stockSpan.textContent = `(Stock: ${formatNumber(stockAmount, 'material')})`;
            inputTd.appendChild(stockSpan);

            inputTr.appendChild(inputTh);
            inputTr.appendChild(inputTd);
            materialsTable.appendChild(inputTr);

            addTableRow(materialsTable, 'Effect', heatInfo);
            if (task.ticksRequired) {
                addTableRow(materialsTable, 'Time', `${task.ticksRequired} ticks`);
            }
        }

        if (task.breakChance) {
            addTableRow(materialsTable, 'Break Chance', `${Math.round(task.breakChance * 100)}%`);
        }
    }

    // Heating/Temperature Settings section
    if (task.minTemp || task.type === 'heating') {
        tempSection.style.display = '';

        if (task.minTemp) {
            const currentTemp = Math.round(smelterTemperature);
            const tempStatus = currentTemp >= task.minTemp ? '✅ Ready' : `❌ Too low (${currentTemp}°)`;

            addTableRow(tempTable, 'Required Temp', `${task.minTemp}°`);

            const currentTempTr = document.createElement('tr');
            const currentTempTh = document.createElement('th');
            currentTempTh.textContent = 'Current Temp';
            const currentTempTd = document.createElement('td');
            currentTempTd.style.color = currentTemp >= task.minTemp ? '#81c784' : '#e57373';
            currentTempTd.textContent = tempStatus;
            currentTempTr.appendChild(currentTempTh);
            currentTempTr.appendChild(currentTempTd);
            tempTable.appendChild(currentTempTr);
        } else if (task.type === 'heating') {
            const currentTemp = Math.round(smelterTemperature);
            const furnaceTemp = researchData['furnace-temperature'];
            const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
            const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

            // Temperature bar
            tempBarContainer.style.display = '';
            const tempBar = document.getElementById('task-detail-temp-bar');
            const tempPercent = Math.min(100, (smelterTemperature / maxTempLimit) * 100);
            tempBar.style.width = `${tempPercent}%`;

            // Current temp display (read-only)
            const tempColor = currentTemp > 1000 ? '#ff4444' : currentTemp > 500 ? '#ff8800' : currentTemp > 100 ? '#ffbb00' : '#88ccff';
            const currentTempRow = document.createElement('tr');
            const currentTempTh = document.createElement('th');
            currentTempTh.textContent = 'Current Temp';
            const currentTempTd = document.createElement('td');
            currentTempTd.id = 'task-detail-current-temp';
            currentTempTd.style.color = tempColor;
            currentTempTd.style.fontWeight = 'bold';
            currentTempTd.textContent = `${currentTemp}°`;
            currentTempRow.appendChild(currentTempTh);
            currentTempRow.appendChild(currentTempTd);
            tempTable.appendChild(currentTempRow);

            if (task.heatGain === 'dynamic') {
                addTableRow(tempTable, 'Max Temp', `${maxTempLimit}°`);
            } else {
                addTableRow(tempTable, 'Heat Gain', `+${task.heatGain}° per use`);
            }
        }
    }

    // Requirements section
    if (task.requires) {
        const status = isUnlocked ? '✅ Unlocked' : '🔒 Locked';
        const statusColor = isUnlocked ? '#81c784' : '#e57373';
        requirementsEl.style.color = statusColor;
        requirementsEl.textContent = `${requiredResearchName} - ${status}`;
    } else {
        requirementsEl.style.color = '#81c784';
        requirementsEl.textContent = '✅ None required';
    }

    // Set up auto-refresh for temperature values if this is a heating task
    if (task.type === 'heating' || task.minTemp) {
        if (window.taskDetailRefreshInterval) {
            clearInterval(window.taskDetailRefreshInterval);
        }
        window.taskDetailRefreshInterval = setInterval(() => {
            const modal = document.getElementById('task-details-modal');
            if (modal && modal.getAttribute('aria-hidden') === 'false') {
                updateTaskDetailTemperature();
            } else {
                clearInterval(window.taskDetailRefreshInterval);
                window.taskDetailRefreshInterval = null;
            }
        }, 100); // Update every 100ms for smooth updates
    }
}

// Update temperature values in task details modal
function updateTaskDetailTemperature() {
    const currentTempEl = document.getElementById('task-detail-current-temp');
    const tempBarEl = document.getElementById('task-detail-temp-bar');
    if (currentTempEl) {
        const currentTemp = Math.round(smelterTemperature);
        const tempColor = currentTemp > 1000 ? '#ff4444' : currentTemp > 500 ? '#ff8800' : currentTemp > 100 ? '#ffbb00' : '#88ccff';
        currentTempEl.textContent = `${currentTemp}°`;
        currentTempEl.style.color = tempColor;
    }

    if (tempBarEl) {
        const furnaceTemp = researchData['furnace-temperature'];
        const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
        const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);
        const tempPercent = Math.min(100, (smelterTemperature / maxTempLimit) * 100);
        tempBarEl.style.width = `${tempPercent}%`;
    }
}

// Efficiently update just the temperature display in smelter (not full rebuild)
function updateSmelterTemperatureDisplay() {
    // Find the heating task rows (both coal and magma)
    const taskList = document.getElementById('smelter-task-list');
    if (!taskList) return;

    // Update both heating tasks
    const heatingTaskIds = ['heat-furnace', 'heat-magma-furnace'];

    for (const taskId of heatingTaskIds) {
        const heatingTaskRow = taskList.querySelector(`[data-task-id="${taskId}"]`);
        if (!heatingTaskRow) continue;

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
            // Calculate max temperature based on furnace-temperature research
            const furnaceTemp = researchData['furnace-temperature'];
            const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
            const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);
            const tempPercent = Math.min(100, (smelterTemperature / maxTempLimit) * 100);
            tempBars[0].style.width = `${tempPercent}%`;
        }

        // Update task actionability based on temperature
        const task = smelterTasksData[taskId];
        if (task) {
            const stockAmount = materialsStock[task.input.material] || 0;
            const isUnlocked = !task.requires || (researchData[task.requires]?.level || 0) >= 1;

            // For magma, only check if temp is below min (always heats to max)
            // For coal, use smelterHeatingMode for accurate status (respects hysteresis)
            let isActionable;
            if (task.heatGain === 'dynamic') {
                isActionable = isUnlocked && (stockAmount >= task.input.amount) && (smelterTemperature < smelterMagmaMinTemp);
            } else {
                isActionable = isUnlocked && (stockAmount >= task.input.amount) && smelterHeatingMode;
            }

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
                    // For heating tasks, check if it's blocked due to temperature or materials
                    if (task.heatGain !== 'dynamic' && stockAmount >= task.input.amount && !smelterHeatingMode) {
                        // Coal heating: Temperature is adequate (not in heating mode)
                        statusIndicator.textContent = '🔥';
                        statusIndicator.title = 'Temperature adequate - no heating needed';
                    } else if (task.heatGain === 'dynamic' && stockAmount >= task.input.amount && smelterTemperature >= smelterMagmaMinTemp) {
                        // Magma heating: Temperature is adequate (above minimum threshold)
                        statusIndicator.textContent = '🔥';
                        statusIndicator.title = 'Temperature adequate - no heating needed';
                    } else {
                        statusIndicator.textContent = '❌';
                        statusIndicator.title = `Blocked - need ${task.input.amount}x, have ${formatNumber(stockAmount, 'material')}x`;
                    }
                }
            }

            // Update recipe stock info
            const recipeSpan = heatingTaskRow.querySelector('.smelter-task-recipe');
            if (recipeSpan) {
                const inputMat = getMaterialById(task.input.material);
                const inputName = inputMat ? inputMat.name : task.input.material;
                const stockInfo = `(${formatNumber(stockAmount, 'material')}/${task.input.amount})`;

                // Display format depends on task type
                if (task.heatGain === 'dynamic') {
                    // Magma: show "to max temp"
                    const furnaceTempRes = researchData['furnace-temperature'];
                    const furnaceTempLvl = furnaceTempRes ? (furnaceTempRes.level || 0) : 0;
                    const maxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLvl * 100);
                    recipeSpan.textContent = `${task.input.amount}x ${inputName} ${stockInfo} → Heat to ${maxTemp}° (max)`;
                } else {
                    // Coal: show heat gain
                    recipeSpan.textContent = `${task.input.amount}x ${inputName} ${stockInfo} → +${task.heatGain}° Heat (max 2000°)`;
                }
            }
        }
    }

    // Also update the main temperature control panel
    updateMainTempControls();
}

/**
 * Update dynamic parts of smelter task display (gem cutting progress and active task indicator)
 */
function updateSmelterTasksDisplay() {
    const taskList = document.getElementById('smelter-task-list');
    if (!taskList) return;

    const activeTaskId = getCurrentActiveTask();

    // Update each task row
    smelterTasks.forEach((taskId) => {
        const taskRow = taskList.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskRow) return;

        // Update status indicator for active task
        const statusIndicator = taskRow.querySelector('.smelter-task-status');
        if (statusIndicator && taskId !== 'do-nothing') {
            const isUnreachable = taskRow.classList.contains('smelter-task-unreachable');
            const isLocked = taskRow.classList.contains('smelter-task-locked');
            const isCurrentlyActive = taskId === activeTaskId;

            // Only update if the active status changed
            const wasActive = statusIndicator.textContent === '🧍';
            if (isCurrentlyActive && !wasActive && !isUnreachable && !isLocked) {
                statusIndicator.textContent = '🧍';
                statusIndicator.title = 'Currently being worked on';
            } else if (!isCurrentlyActive && wasActive) {
                // Task is no longer active, restore appropriate icon
                const isActionable = taskRow.classList.contains('smelter-task-actionable');
                if (isActionable) {
                    statusIndicator.textContent = '✅';
                    statusIndicator.title = 'Ready - materials available';
                }
            }
        }

        // Update progress for tasks being worked on
        const task = smelterTasksData[taskId];
        if (task && task.ticksRequired) {
            const taskRecipe = taskRow.querySelector('.smelter-task-recipe');
            if (taskRecipe) {
                // Check if task has progress (being worked on or paused)
                if (task.progress !== undefined && task.progress > 0) {
                    // Show progress for task with active progress
                    const progress = task.progress;
                    const ticksRequired = task.ticksRequired;
                    const percentage = Math.round((progress / ticksRequired) * 100);

                    // Calculate available runs after current task
                    const availableRuns = calculateTaskAvailableRuns(task);
                    const runsText = availableRuns > 1 ? ` (${availableRuns - 1} more available)` : '';

                    taskRecipe.textContent = `Progress: ${progress}/${ticksRequired} ticks (${percentage}%)${runsText}`;
                    taskRecipe.classList.remove('recipe-blocked');
                    taskRecipe.classList.add('recipe-ready');
                } else if (task.type === 'gem-cutting') {
                    // Special case for gem cutting - show queued gems
                    const totalQueuedGems = gems.filter(g => g.markedForCutting && !g.polished).length;
                    if (totalQueuedGems > 0) {
                        taskRecipe.textContent = `${totalQueuedGems} gem${totalQueuedGems > 1 ? 's' : ''} queued`;
                    } else {
                        taskRecipe.textContent = 'No gems queued for cutting';
                    }
                }
            }
        }
    });
}

/**
 * Get the task ID that is currently being worked on (if any)
 * @returns {string|null} The task ID or null if no task is active
 */
function getCurrentActiveTask() {
    // Check if any dwarf is currently smelting
    const smeltingDwarf = dwarfs.find(d => d.status === 'smelting');
    if (!smeltingDwarf) return null;

    // Find the first actionable task in priority order
    for (const taskId of smelterTasks) {
        if (taskId === 'do-nothing') return null;
        const task = smelterTasksData[taskId];

        // Check if task is unlocked
        const isUnlocked = !task.requires || (researchData[task.requires]?.level || 0) >= 1;
        if (!isUnlocked) continue;

        // Check if task has required materials/gems
        if (task.type === 'gem-cutting') {
            const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
            if (gemToProcess) return taskId;
        } else if (task.inputs && Array.isArray(task.inputs)) {
            const hasAllInputs = task.inputs.every(input => {
                const stockAmount = materialsStock[input.material] || 0;
                return stockAmount >= input.amount;
            });
            if (hasAllInputs) {
                if (task.minTemp) {
                    if (smelterTemperature >= task.minTemp) return taskId;
                } else {
                    return taskId;
                }
            }
        } else if (task.input && task.input.material) {
            const stockAmount = materialsStock[task.input.material] || 0;
            if (stockAmount >= task.input.amount) {
                if (task.type === 'heating') {
                    if (task.heatGain === 'dynamic') {
                        if (smelterTemperature < smelterMagmaMinTemp) return taskId;
                    } else {
                        if (smelterHeatingMode) return taskId;
                    }
                } else if (task.minTemp) {
                    if (smelterTemperature >= task.minTemp) return taskId;
                } else {
                    return taskId;
                }
            }
        }
    }

    return null;
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

    // Temperature control panel (above task list)
    const tempPanel = createTemperatureControlPanel();
    if (tempPanel) {
        container.appendChild(tempPanel);
    }

    // Task list container
    const taskList = document.createElement('div');
    taskList.className = 'smelter-task-list';
    taskList.id = 'smelter-task-list';

    // Set up auto-refresh for smelter modal
    if (window.smelterRefreshInterval) {
        clearInterval(window.smelterRefreshInterval);
    }
    window.smelterRefreshInterval = setInterval(() => {
        const modal = document.getElementById('smelter-modal');
        if (modal && modal.getAttribute('aria-hidden') === 'false') {
            updateSmelterTasksDisplay();
        } else {
            clearInterval(window.smelterRefreshInterval);
            window.smelterRefreshInterval = null;
        }
    }, 100); // Update every 100ms for smooth progress updates

    // Find if there's a "do-nothing" task and track if we're below it
    const doNothingIndex = smelterTasks.findIndex(id => id === 'do-nothing');

    // Get the currently active task
    const activeTaskId = getCurrentActiveTask();

    // Track display index for visible tasks only
    let displayIndex = 0;

    // Render each task
    smelterTasks.forEach((taskId, index) => {
        const task = smelterTasksData[taskId];
        const taskRow = document.createElement('div');
        taskRow.className = 'smelter-task-row';
        taskRow.dataset.taskId = taskId;
        taskRow.dataset.taskIndex = index;
        taskRow.draggable = true;

        // Check if this task is unreachable (below "do-nothing")
        const isUnreachable = doNothingIndex >= 0 && index > doNothingIndex && taskId !== 'do-nothing';

        // Check if this task requires research
        let isUnlocked = true;
        let requiredResearchName = null;
        if (task.requires) {
            const requiredResearch = researchData[task.requires];
            if (requiredResearch) {
                isUnlocked = (requiredResearch.level || 0) >= 1;
                requiredResearchName = requiredResearch.name;
            }
        }

        // Skip rendering tasks that are not unlocked
        if (!isUnlocked) {
            return;
        }

        // Check if this task is actionable (has enough materials for batch processing)
        let isActionable = false;
        let stockAmount = 0;
        // Get capacity multiplier for non-heating tasks
        const capacity = task.type === 'heating' ? 1 : getSmelterCapacity();

        if (taskId === 'do-nothing') {
            isActionable = true; // "Do nothing" is always "actionable"
        } else if (task.type === 'gem-cutting' && isUnlocked) {
            // For gem cutting tasks, check if there are any gems marked for cutting
            const gemToProcess = gems.find(g => g.markedForCutting && !g.polished);
            isActionable = !!gemToProcess;
        } else if (isUnlocked) {
            // Use utility function to check materials with capacity multiplier
            const hasMaterials = hasMaterialsForTask(task, materialsStock, capacity);

            // For single input tasks, also track stock amount for display
            if (task.input && task.input.material) {
                stockAmount = materialsStock[task.input.material] || 0;
            }

            // For heating tasks, only actionable if temp is below appropriate threshold
            if (task.type === 'heating') {
                if (task.heatGain === 'dynamic') {
                    // Magma: check against magma min
                    isActionable = hasMaterials && (smelterTemperature < smelterMagmaMinTemp);
                } else {
                    // Coal: use smelterHeatingMode for accurate status (respects hysteresis)
                    isActionable = hasMaterials && smelterHeatingMode;
                }
            } else if (task.minTemp) {
                // For smelting tasks with temp requirements, check both materials and temperature
                isActionable = hasMaterials && (smelterTemperature >= task.minTemp);
            } else {
                isActionable = hasMaterials;
            }
        }

        // Add actionable/blocked/locked class
        if (taskId !== 'do-nothing') {
            if (isUnreachable) {
                taskRow.classList.add('smelter-task-unreachable');
            } else if (!isUnlocked) {
                taskRow.classList.add('smelter-task-locked');
            } else if (isActionable) {
                taskRow.classList.add('smelter-task-actionable');
            } else {
                // Determine if blocked by temperature or materials
                const hasMaterials = hasMaterialsForTask(task, materialsStock, capacity);
                let tempClass = null;

                // Check for temperature-related states
                if (task.type === 'heating' && task.heatGain !== 'dynamic' && hasMaterials && !smelterHeatingMode) {
                    // Coal heating: temperature is adequate (use yellow - temp OK)
                    tempClass = 'smelter-task-temp-ok';
                } else if (task.minTemp && smelterTemperature < task.minTemp) {
                    // Smelting task: temperature too low (use yellow - temp low)
                    tempClass = 'smelter-task-temp-low';
                }

                taskRow.classList.add(tempClass || 'smelter-task-blocked');
            }
        }

        // Priority number (using displayIndex for visible tasks only)
        const priorityNum = document.createElement('span');
        priorityNum.className = 'smelter-task-priority';
        priorityNum.textContent = `${displayIndex + 1}.`;
        taskRow.appendChild(priorityNum);

        // Increment display index for next visible task
        displayIndex++;

        // Status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'smelter-task-status';

        // Check if this task is currently being worked on
        const isCurrentlyActive = taskId === activeTaskId;

        if (taskId === 'do-nothing') {
            statusIndicator.textContent = '⏸️';
            statusIndicator.title = 'Idle task';
        } else if (isUnreachable) {
            statusIndicator.textContent = '🚫';
            statusIndicator.title = 'Unreachable - will never execute (below "Do Nothing")';
        } else if (!isUnlocked) {
            statusIndicator.textContent = '🔒';
            statusIndicator.title = `Locked - requires ${requiredResearchName}`;
        } else if (isCurrentlyActive) {
            statusIndicator.textContent = '🧍';
            statusIndicator.title = 'Currently being worked on';
        } else if (isActionable) {
            statusIndicator.textContent = '✅';
            statusIndicator.title = capacity > 1 ? `Ready - materials available for batch of ${capacity}` : 'Ready - materials available';
        } else {
            // Determine why task is blocked
            if (task.type === 'heating' && task.heatGain !== 'dynamic' && stockAmount >= task.input.amount && !smelterHeatingMode) {
                // Coal heating task: temperature is adequate (not in heating mode)
                statusIndicator.textContent = '🔥';
                statusIndicator.title = 'Temperature adequate - no heating needed';
            } else if (task.type === 'heating' && task.heatGain === 'dynamic' && stockAmount >= task.input.amount && smelterTemperature >= smelterMagmaMinTemp) {
                // Magma heating task: temperature is adequate (above minimum threshold)
                statusIndicator.textContent = '🔥';
                statusIndicator.title = 'Temperature adequate - no heating needed';
            } else if (task.minTemp && smelterTemperature < task.minTemp) {
                statusIndicator.textContent = '🌡️';
                statusIndicator.title = `Temperature too low - need ${task.minTemp}°, current ${Math.round(smelterTemperature)}°`;
            } else if (task.type === 'gem-cutting') {
                statusIndicator.textContent = '💤';
                statusIndicator.title = `Blocked - no gems marked for cutting`;
            } else if (task.inputs && Array.isArray(task.inputs)) {
                // Multiple inputs - show all missing materials (with capacity requirement)
                statusIndicator.textContent = '💤';
                const missingMaterials = task.inputs.filter(input => {
                    const stock = materialsStock[input.material] || 0;
                    return stock < input.amount * capacity;
                }).map(input => {
                    const stock = materialsStock[input.material] || 0;
                    const requiredAmount = input.amount * capacity;
                    return `${input.material}: ${formatNumber(stock, 'material')}/${requiredAmount}`;
                }).join(', ');
                const batchNote = capacity > 1 ? ` (batch of ${capacity})` : '';
                statusIndicator.title = `Blocked - need ${missingMaterials}${batchNote}`;
            } else if (task.input && task.input.amount) {
                statusIndicator.textContent = '💤';
                const requiredAmount = task.input.amount * capacity;
                const batchNote = capacity > 1 ? ` (batch of ${capacity})` : '';
                statusIndicator.title = `Blocked - need ${requiredAmount}x, have ${formatNumber(stockAmount, 'material')}x${batchNote}`;
            } else {
                statusIndicator.textContent = '💤';
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

        // Check if this task has progress (being worked on or paused)
        if (task.progress !== undefined && task.progress > 0 && task.ticksRequired) {
            // Show progress for task with active progress
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';

            const progress = task.progress;
            const ticksRequired = task.ticksRequired;
            const percentage = Math.round((progress / ticksRequired) * 100);

            // Calculate available runs after current task
            const availableRuns = calculateTaskAvailableRuns(task);
            const runsText = availableRuns > 1 ? ` (${availableRuns - 1} more available)` : '';

            taskRecipe.textContent = `Progress: ${progress}/${ticksRequired} ticks (${percentage}%)${runsText}`;
            taskRecipe.classList.add('recipe-ready');
            taskInfo.appendChild(taskRecipe);
        }
        // Show gem cutting queue if this is gem cutting and not showing progress
        else if (task.type === 'gem-cutting') {
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';

            const totalQueuedGems = gems.filter(g => g.markedForCutting && !g.polished).length;

            if (totalQueuedGems > 0) {
                taskRecipe.textContent = `${totalQueuedGems} gem${totalQueuedGems > 1 ? 's' : ''} queued`;
                taskRecipe.classList.add('recipe-ready');
            } else {
                taskRecipe.textContent = 'No gems queued for cutting';
                taskRecipe.classList.add('recipe-blocked');
            }

            taskInfo.appendChild(taskRecipe);
        }

        // Show input/output if applicable (with available runs and batch amounts)
        else if (task.inputs && task.output) {
            // Multiple inputs (alloy format)
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputsText = task.inputs.map(input => {
                const inputMat = getMaterialById(input.material);
                const inputName = inputMat ? inputMat.name : input.material;
                const batchAmount = input.amount * capacity;
                return `${batchAmount}x ${inputName}`;
            }).join(' + ');
            const outputMat = getMaterialById(task.output.material);
            const outputName = outputMat ? outputMat.name : task.output.material;
            const batchOutputAmount = task.output.amount * capacity;
            const tempReq = task.minTemp ? ` @ ${task.minTemp}°` : '';

            const availableRuns = calculateTaskAvailableRuns(task);
            const runsText = availableRuns > 0 ? ` (${availableRuns}x available)` : '';

            taskRecipe.textContent = `${inputsText} → ${batchOutputAmount}x ${outputName}${tempReq}${runsText}`;
            if (!isUnlocked) {
                taskRecipe.classList.add('recipe-locked');
            } else {
                taskRecipe.classList.add(isActionable ? 'recipe-ready' : 'recipe-blocked');
            }
            taskInfo.appendChild(taskRecipe);
        } else if (task.input && task.output) {
            // Single input (legacy format)
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputMat = getMaterialById(task.input.material);
            const outputMat = getMaterialById(task.output.material);
            const inputName = inputMat ? inputMat.name : task.input.material;
            const outputName = outputMat ? outputMat.name : task.output.material;
            const batchInputAmount = task.input.amount * capacity;
            const batchOutputAmount = task.output.amount * capacity;
            const tempReq = task.minTemp ? ` @ ${task.minTemp}°` : '';

            const availableRuns = calculateTaskAvailableRuns(task);
            const runsText = availableRuns > 0 ? ` (${availableRuns}x available)` : '';

            taskRecipe.textContent = `${batchInputAmount}x ${inputName} → ${batchOutputAmount}x ${outputName}${tempReq}${runsText}`;
            if (!isUnlocked) {
                taskRecipe.classList.add('recipe-locked');
            } else {
                taskRecipe.classList.add(isActionable ? 'recipe-ready' : 'recipe-blocked');
            }
            taskInfo.appendChild(taskRecipe);
        } else if (task.input && task.type === 'heating') {
            // Show heating task info with temperature display (with available runs)
            const taskRecipe = document.createElement('span');
            taskRecipe.className = 'smelter-task-recipe';
            const inputMat = getMaterialById(task.input.material);
            const inputName = inputMat ? inputMat.name : task.input.material;

            const availableRuns = calculateTaskAvailableRuns(task);
            const runsText = availableRuns > 0 ? ` (${availableRuns}x available)` : '';

            // Calculate display info for heating tasks
            let heatingDisplay = '';
            if (task.heatGain === 'dynamic') {
                // Magma: show "to max temp"
                const furnaceTemp = researchData['furnace-temperature'];
                const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
                const maxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);
                heatingDisplay = `${task.input.amount}x ${inputName} → Heat to ${maxTemp}° (max)${runsText}`;
            } else {
                // Coal: show heat gain and max 2000°
                heatingDisplay = `${task.input.amount}x ${inputName} → +${task.heatGain}° Heat (max 2000°)${runsText}`;
            }
            taskRecipe.textContent = heatingDisplay;
            if (!isUnlocked) {
                taskRecipe.classList.add('recipe-locked');
            } else {
                taskRecipe.classList.add(isActionable ? 'recipe-ready' : 'recipe-blocked');
            }
            taskInfo.appendChild(taskRecipe);
        }

        taskRow.appendChild(taskInfo);

        // Move buttons container
        const btnContainer = document.createElement('div');
        btnContainer.className = 'smelter-task-buttons';

        // Info button
        const infoBtn = document.createElement('button');
        infoBtn.className = 'smelter-btn-info';
        infoBtn.innerHTML = 'ℹ️';
        infoBtn.title = 'Show task details';
        infoBtn.onclick = () => openTaskDetailsModal(task, isUnlocked, requiredResearchName);
        btnContainer.appendChild(infoBtn);

        // Move to top button
        const topBtn = document.createElement('button');
        topBtn.className = 'smelter-btn-move';
        topBtn.innerHTML = '⤊';
        topBtn.title = 'Move to top (highest priority)';
        topBtn.disabled = index === 0;
        topBtn.onclick = () => moveSmelterTaskToTop(index);
        btnContainer.appendChild(topBtn);

        // Move up button
        const upBtn = document.createElement('button');
        upBtn.className = 'smelter-btn-move';
        upBtn.innerHTML = '⬆';
        upBtn.title = 'Move up (higher priority)';
        upBtn.disabled = index === 0;
        upBtn.onclick = () => moveSmelterTask(index, -1);
        btnContainer.appendChild(upBtn);

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

    // Set up drag and drop event listeners
    setupSmelterDragAndDrop();
}

// Set up drag and drop for smelter tasks
function setupSmelterDragAndDrop() {
    const taskList = document.getElementById('smelter-task-list');
    if (!taskList) return;

    let draggedElement = null;
    let draggedIndex = null;

    taskList.addEventListener('dragstart', (e) => {
        const taskRow = e.target.closest('.smelter-task-row');
        if (!taskRow) return;

        draggedElement = taskRow;
        draggedIndex = parseInt(taskRow.dataset.taskIndex);
        taskRow.classList.add('smelter-task-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', taskRow.innerHTML);
    });

    taskList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const taskRow = e.target.closest('.smelter-task-row');
        if (!taskRow || taskRow === draggedElement) return;

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
    });

    taskList.addEventListener('dragleave', (e) => {
        const taskRow = e.target.closest('.smelter-task-row');
        if (taskRow) {
            taskRow.classList.remove('smelter-drop-above', 'smelter-drop-below');
        }
    });

    taskList.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const targetRow = e.target.closest('.smelter-task-row');
        if (!targetRow || !draggedElement || targetRow === draggedElement) return;

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
        if (draggedIndex < newIndex) {
            newIndex--;
        }

        // Move the task in the array
        if (draggedIndex !== newIndex) {
            const movedTask = smelterTasks.splice(draggedIndex, 1)[0];
            smelterTasks.splice(newIndex, 0, movedTask);

            // Sync with worker
            if (gameWorker && workerInitialized) {
                gameWorker.postMessage({
                    type: 'update-state',
                    data: {
                        smelterTasks: smelterTasks
                    }
                });
            }

            saveGame();
            populateSmelter();
        }

        // Clean up
        document.querySelectorAll('.smelter-task-row').forEach(row => {
            row.classList.remove('smelter-drop-above', 'smelter-drop-below');
        });
    });

    taskList.addEventListener('dragend', (e) => {
        const taskRow = e.target.closest('.smelter-task-row');
        if (taskRow) {
            taskRow.classList.remove('smelter-task-dragging');
        }
        document.querySelectorAll('.smelter-task-row').forEach(row => {
            row.classList.remove('smelter-drop-above', 'smelter-drop-below');
        });
        draggedElement = null;
        draggedIndex = null;
    });
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

// Adjust coal minimum temperature setting
window.adjustCoalMinTemp = function(amount) {
    // Calculate max temperature limit based on furnace-temperature research
    const furnaceTemp = researchData['furnace-temperature'];
    const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
    const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

    smelterCoalMinTemp = Math.max(25, Math.min(maxTempLimit, smelterCoalMinTemp + amount));
    // Ensure min doesn't exceed max
    if (smelterCoalMinTemp > smelterCoalMaxTemp) {
        smelterCoalMinTemp = smelterCoalMaxTemp;
    }

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterCoalMinTemp: smelterCoalMinTemp
            }
        });
    }

    saveGame();
    populateSmelter();
}

// Adjust coal maximum temperature setting
window.adjustCoalMaxTemp = function(amount) {
    // Calculate max temperature based on furnace-temperature research
    const furnaceTemp = researchData['furnace-temperature'];
    const furnaceTempLevel = furnaceTemp ? furnaceTemp.level : 0;
    const researchMaxTemp = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

    // Coal max is capped at the lower of research max or 2000°
    const coalMaxLimit = Math.min(researchMaxTemp, 2000);

    smelterCoalMaxTemp = Math.max(25, Math.min(coalMaxLimit, smelterCoalMaxTemp + amount));
    // Ensure max doesn't go below min
    if (smelterCoalMaxTemp < smelterCoalMinTemp) {
        smelterCoalMaxTemp = smelterCoalMinTemp;
    }

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterCoalMaxTemp: smelterCoalMaxTemp
            }
        });
    }

    saveGame();
    populateSmelter();
}

// Adjust magma minimum temperature setting
window.adjustMagmaMinTemp = function(amount) {
    // Calculate max temperature limit based on furnace-temperature research
    const furnaceTemp = researchData['furnace-temperature'];
    const furnaceTempLevel = furnaceTemp ? (furnaceTemp.level || 0) : 0;
    const maxTempLimit = SMELTER_MAX_TEMPERATURE_LIMIT + (furnaceTempLevel * 100);

    smelterMagmaMinTemp = Math.max(25, Math.min(maxTempLimit, smelterMagmaMinTemp + amount));

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                smelterMagmaMinTemp: smelterMagmaMinTemp
            }
        });
    }

    saveGame();
    populateSmelter();
}
