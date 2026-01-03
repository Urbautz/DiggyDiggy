// ============================================================================
// MANAGEMENT MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the management modal

// Initialize active management tasks array (populated from save file or starts empty)
let activeManagementTasks = [];
let nextManagementTaskId = 1;
let currentEditingTaskId = null;

// Open the management modal
function openManagement() {
    console.log('[Management] openManagement called');
    // Check if management research is completed
    const managementResearch = researchData['management'];
    const isManagementUnlocked = managementResearch && (managementResearch.level || 0) >= 1;
    console.log('[Management] Research unlocked:', isManagementUnlocked);

    if (!isManagementUnlocked) {
        alert('Management requires the "Management" research to be completed first!');
        return;
    }

    openModal('management-modal');
    populateManagement();
}

// Populate the management modal with task list
function populateManagement() {
    const container = document.getElementById('management-content');
    if (!container) return;

    container.innerHTML = '';

    // Task list container
    const taskList = document.createElement('div');
    taskList.className = 'management-task-list';
    taskList.id = 'management-task-list';

    if (activeManagementTasks.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        emptyMsg.style.cssText = 'text-align: center; padding: 20px; color: #888;';
        emptyMsg.textContent = 'No management tasks configured. Click "Add Task" to get started!';
        taskList.appendChild(emptyMsg);
    } else {
        // Render each active task
        activeManagementTasks.forEach((activeTask, index) => {
            const taskDef = mangementTasks[activeTask.type];
            if (!taskDef) return;

            const taskRow = document.createElement('div');
            taskRow.className = 'management-task-row';
            taskRow.dataset.taskId = activeTask.id;
            taskRow.dataset.taskIndex = index;
            taskRow.draggable = true;

            // Priority number (like smelter)
            const priority = document.createElement('span');
            priority.className = 'management-task-priority';
            priority.textContent = index + 1;

            // Drag handle
            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle';
            dragHandle.textContent = '⠿';

            // Task name and status
            const taskInfo = document.createElement('div');
            taskInfo.className = 'management-task-info';

            const taskName = document.createElement('span');
            taskName.className = 'management-task-name';

            // Check if task name is the default (or starts with default)
            const defaultName = taskDef.name;
            const customName = activeTask.name || defaultName;
            const isDefaultName = customName === defaultName || customName.startsWith(defaultName + ' (');

            if (isDefaultName) {
                // Use default name with parameters
                taskName.textContent = defaultName + getTaskParameterSummary(activeTask, taskDef);
            } else {
                // Use custom name as-is
                taskName.textContent = customName;
            }

            // Active/Inactive badge
            const statusBadge = document.createElement('span');
            statusBadge.className = activeTask.active ? 'management-task-active' : 'management-task-inactive';
            statusBadge.textContent = activeTask.active ? 'Active' : 'Inactive';

            taskInfo.appendChild(taskName);
            taskInfo.appendChild(statusBadge);

            // Buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'management-task-buttons';

            // Details button
            const detailsBtn = document.createElement('button');
            detailsBtn.className = 'management-task-detail-btn';
            detailsBtn.textContent = '📋';
            detailsBtn.title = 'Details';
            detailsBtn.onclick = (e) => {
                e.stopPropagation();
                openEditManagementTaskModal(activeTask.id);
            };

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'management-task-delete-btn';
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Remove';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeManagementTask(activeTask.id);
            };

            buttonsContainer.appendChild(detailsBtn);
            buttonsContainer.appendChild(deleteBtn);

            taskRow.appendChild(priority);
            taskRow.appendChild(dragHandle);
            taskRow.appendChild(taskInfo);
            taskRow.appendChild(buttonsContainer);

            taskList.appendChild(taskRow);
        });

        // Set up drag and drop for task reordering
        setupManagementTaskDragAndDrop(taskList);
    }

    container.appendChild(taskList);
}

// Lightweight update: only refresh active/inactive badges without redrawing entire list
function updateManagementTaskActivationStates() {
    if (activeManagementTasks.length === 0) return;

    activeManagementTasks.forEach((activeTask) => {
        const taskRow = document.querySelector(`[data-task-id="${activeTask.id}"]`);
        if (!taskRow) return;

        // Find the status badge within this task row
        const statusBadge = taskRow.querySelector('.management-task-active, .management-task-inactive');
        if (!statusBadge) return;

        // Update badge class and text based on current active state
        if (activeTask.active) {
            statusBadge.className = 'management-task-active';

            // Show progress if task is being worked on
            const taskDef = mangementTasks[activeTask.type];
            if (activeTask.progress && taskDef && taskDef.cost) {
                const progress = Math.floor(activeTask.progress);
                const total = taskDef.cost;
                const percentage = Math.round((progress / total) * 100);
                statusBadge.textContent = `Active (${progress}/${total})`;
            } else {
                statusBadge.textContent = 'Active';
            }
        } else {
            statusBadge.className = 'management-task-inactive';
            statusBadge.textContent = 'Inactive';
        }
    });
}

// Format management task values for display
function formatManagementValue(key, value, valueDef) {
    // Check type from valueDef if available
    if (valueDef && (valueDef.type === 'material-dropdown' || valueDef.type === 'gem-dropdown')) {
        const mat = getMaterialById(value);
        return mat ? mat.name : value;
    }
    if (key === 'material' || key === 'gem') {
        const mat = getMaterialById(value);
        return mat ? mat.name : value;
    }
    if (key.toLowerCase().includes('gold')) {
        return `${formatNumber(value, 'gold')} gold`;
    }
    if (key.toLowerCase().includes('quantity') || key.toLowerCase().includes('amount')) {
        return formatNumber(value, 'material');
    }
    return value;
}

// Generate parameter summary for task display (e.g., "Earth, 100, 50")
function getTaskParameterSummary(activeTask, taskDef) {
    if (!activeTask.values || !taskDef.values) return '';

    const params = [];
    for (const [key, valueDef] of Object.entries(taskDef.values)) {
        const value = activeTask.values[key];
        if (value !== undefined) {
            params.push(formatManagementValue(key, value, valueDef));
        }
    }

    return params.length > 0 ? ` (${params.join(', ')})` : '';
}

// Open modal to add a new management task
async function openAddManagementTaskModal() {
    console.log('[Management] openAddManagementTaskModal called');

    // Ensure modal is loaded before trying to populate it
    if (window.modalManager) {
        await window.modalManager.ensureLoaded('management-modal');
    }

    openModal('add-management-task-modal');

    // Use setTimeout to ensure modal DOM is ready
    setTimeout(() => {
        populateAddTaskModal();
    }, 50);
}

// Populate the add task modal
function populateAddTaskModal() {
    console.log('[Management] populateAddTaskModal called');
    const taskTypeSelect = document.getElementById('task-type-select');
    if (!taskTypeSelect) {
        console.error('[Management] task-type-select not found!');
        console.error('[Management] Available elements in DOM:', document.querySelectorAll('[id]'));
        return;
    }
    console.log('[Management] task-type-select found:', taskTypeSelect);

    // Clear and populate task type dropdown
    taskTypeSelect.innerHTML = '<option value="">-- Select Task Type --</option>';

    console.log('[Management] mangementTasks:', mangementTasks);
    for (const [taskId, taskDef] of Object.entries(mangementTasks)) {
        console.log('[Management] Processing task:', taskId, taskDef);
        // Check if task requires research
        if (taskDef.requires) {
            const reqMet = Object.entries(taskDef.requires).every(([researchId, level]) => {
                const research = researchData[researchId];
                return research && (research.level || 0) >= level;
            });
            if (!reqMet) {
                console.log('[Management] Task', taskId, 'requirements not met');
                continue; // Skip tasks with unmet requirements
            }
        }

        const option = document.createElement('option');
        option.value = taskId;
        option.textContent = taskDef.name;
        taskTypeSelect.appendChild(option);
        console.log('[Management] Added task option:', taskId);
    }

    // Set up event listener for task type selection
    taskTypeSelect.onchange = () => updateTaskValueFields();

    // Clear previous values
    document.getElementById('task-values-container').innerHTML = '';
    document.getElementById('task-description').innerHTML = '';
    document.getElementById('task-description').style.display = 'none';
    document.getElementById('task-name-group').style.display = 'none';
    document.getElementById('task-name-input').value = '';
    document.getElementById('task-cost-display').style.display = 'none';
}

// Update the task value input fields based on selected task type
function updateTaskValueFields() {
    console.log('[Management] updateTaskValueFields called');
    const taskTypeSelect = document.getElementById('task-type-select');
    const selectedType = taskTypeSelect.value;
    console.log('[Management] Selected type:', selectedType);

    const descriptionDiv = document.getElementById('task-description');
    const valuesContainer = document.getElementById('task-values-container');
    const costDisplay = document.getElementById('task-cost-display');
    const costValue = document.getElementById('task-cost-value');
    const taskNameGroup = document.getElementById('task-name-group');
    const taskNameInput = document.getElementById('task-name-input');

    if (!selectedType) {
        console.log('[Management] No task selected');
        descriptionDiv.innerHTML = '';
        descriptionDiv.style.display = 'none';
        taskNameGroup.style.display = 'none';
        taskNameInput.value = '';
        valuesContainer.innerHTML = '';
        costDisplay.style.display = 'none';
        return;
    }

    const taskDef = mangementTasks[selectedType];
    console.log('[Management] Task definition:', taskDef);
    if (!taskDef) {
        console.error('[Management] Task definition not found for:', selectedType);
        return;
    }

    // Update description and show it
    console.log('[Management] Setting description to:', taskDef.description);
    descriptionDiv.textContent = taskDef.description;
    descriptionDiv.style.display = 'block';

    // Show task name field with placeholder for auto-generated name
    taskNameGroup.style.display = 'block';
    taskNameInput.value = '';
    taskNameInput.placeholder = '(auto generated description)';

    // Update cost
    costValue.textContent = taskDef.cost;
    costDisplay.style.display = 'block';

    // Build value input fields as table
    valuesContainer.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'management-task-form';

    for (const [key, valueDef] of Object.entries(taskDef.values)) {
        const row = document.createElement('tr');

        const labelCell = document.createElement('td');
        labelCell.className = 'form-label';
        const labelText = valueDef.Description || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        labelCell.textContent = labelText;

        const inputCell = document.createElement('td');
        inputCell.className = 'form-input';

        let input;
        const fieldType = valueDef.type || 'number';
        const defaultValue = valueDef.default !== undefined ? valueDef.default : '';

        if (fieldType === 'material-dropdown') {
            // Material dropdown (exclude gems and zero-value materials)
            input = document.createElement('select');
            input.className = 'management-input';
            input.id = `task-value-${key}`;

            // Populate with materials, filtering out gems and worthless materials
            for (const [matId, matData] of Object.entries(materials)) {
                // Skip gems (type contains "Gem")
                if (matData.type && matData.type.includes('Gem')) continue;
                // Skip materials with zero or negative worth
                if (matData.worth <= 0) continue;

                const option = document.createElement('option');
                option.value = matId;
                option.textContent = matData.name;
                if (matId === defaultValue) option.selected = true;
                input.appendChild(option);
            }
        } else if (fieldType === 'gem-dropdown') {
            // Gem dropdown (only gems)
            input = document.createElement('select');
            input.className = 'management-input';
            input.id = `task-value-${key}`;

            // Populate with gems only
            for (const [matId, matData] of Object.entries(materials)) {
                // Only include materials where type contains "Gem"
                if (!matData.type || !matData.type.includes('Gem')) continue;

                const option = document.createElement('option');
                option.value = matId;
                option.textContent = matData.name;
                if (matId === defaultValue) option.selected = true;
                input.appendChild(option);
            }
        } else {
            // Number input
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'management-input management-number-input';
            input.id = `task-value-${key}`;
            input.value = defaultValue;
            input.min = '0';
            input.step = key.toLowerCase().includes('gold') || key.toLowerCase().includes('amount') ? '100' : '1';
        }

        inputCell.appendChild(input);
        row.appendChild(labelCell);
        row.appendChild(inputCell);
        table.appendChild(row);
    }

    valuesContainer.appendChild(table);
}

// Confirm adding a new management task
function confirmAddManagementTask() {
    console.log('[Management] confirmAddManagementTask called');
    const taskTypeSelect = document.getElementById('task-type-select');
    const selectedType = taskTypeSelect.value;
    console.log('[Management] Selected type:', selectedType);

    if (!selectedType) {
        alert('Please select a task type!');
        return;
    }

    const taskDef = mangementTasks[selectedType];
    console.log('[Management] Task definition:', taskDef);
    if (!taskDef) return;

    // Get task name
    const taskNameInput = document.getElementById('task-name-input');
    const taskName = taskNameInput.value.trim() || taskDef.name;

    // Collect values from form
    const values = {};
    for (const key of Object.keys(taskDef.values)) {
        const input = document.getElementById(`task-value-${key}`);
        console.log('[Management] Input for', key, ':', input);
        if (input) {
            values[key] = input.type === 'number' ? parseFloat(input.value) : input.value;
        }
    }
    console.log('[Management] Collected values:', values);

    // Create new task (inactive by default)
    const newTask = {
        id: nextManagementTaskId++,
        type: selectedType,
        name: taskName,
        values: values,
        active: false  // Tasks start inactive
    };
    console.log('[Management] New task:', newTask);

    activeManagementTasks.push(newTask);
    console.log('[Management] Active tasks:', activeManagementTasks);

    // Sync with worker
    syncManagementTasksWithWorker();

    // Close modal and refresh
    closeModal('add-management-task-modal');
    populateManagement();

    // Save game state
    saveGame();
}

// Remove a management task
function removeManagementTask(taskId) {
    const index = activeManagementTasks.findIndex(t => t.id === taskId);
    if (index >= 0) {
        if (confirm('Remove this management task?')) {
            activeManagementTasks.splice(index, 1);
            syncManagementTasksWithWorker();
            populateManagement();
            saveGame();
        }
    }
}

// Open modal to edit an existing management task
async function openEditManagementTaskModal(taskId) {
    console.log('[Management] openEditManagementTaskModal called for task', taskId);

    // Find the task
    const task = activeManagementTasks.find(t => t.id === taskId);
    if (!task) {
        console.error('[Management] Task not found:', taskId);
        return;
    }

    const taskDef = mangementTasks[task.type];
    if (!taskDef) {
        console.error('[Management] Task definition not found:', task.type);
        return;
    }

    currentEditingTaskId = taskId;

    // Ensure modal is loaded before trying to populate it
    if (window.modalManager) {
        await window.modalManager.ensureLoaded('management-modal');
    }

    openModal('edit-management-task-modal');

    // Use setTimeout to ensure modal DOM is ready
    setTimeout(() => {
        populateEditTaskModal(task, taskDef);
    }, 50);
}

// Populate the edit task modal
function populateEditTaskModal(task, taskDef) {
    console.log('[Management] populateEditTaskModal called');

    // Set task type (readonly)
    const taskTypeDisplay = document.getElementById('edit-task-type-display');
    if (taskTypeDisplay) {
        taskTypeDisplay.value = taskDef.name;
    }

    // Set description
    const descriptionDiv = document.getElementById('edit-task-description');
    if (descriptionDiv) {
        descriptionDiv.textContent = taskDef.description;
    }

    // Set task name
    const taskNameInput = document.getElementById('edit-task-name-input');
    if (taskNameInput) {
        // Check if task has a custom name (not matching default or auto-generated)
        const defaultName = taskDef.name;
        const isDefaultName = !task.name || task.name === defaultName || task.name.startsWith(defaultName + ' (');

        if (isDefaultName) {
            // Show placeholder for auto-generated description
            taskNameInput.value = '';
            taskNameInput.placeholder = '(auto generated description)';
        } else {
            // Show custom name
            taskNameInput.value = task.name;
            taskNameInput.placeholder = '(auto generated description)';
        }
    }

    // Set cost
    const costValue = document.getElementById('edit-task-cost-value');
    if (costValue) {
        costValue.textContent = taskDef.cost;
    }

    // Build value input fields
    const valuesContainer = document.getElementById('edit-task-values-container');
    if (!valuesContainer) {
        console.error('[Management] edit-task-values-container not found');
        return;
    }

    valuesContainer.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'management-task-form';

    for (const [key, valueDef] of Object.entries(taskDef.values)) {
        const row = document.createElement('tr');

        const labelCell = document.createElement('td');
        labelCell.className = 'form-label';
        const labelText = valueDef.Description || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        labelCell.textContent = labelText;

        const inputCell = document.createElement('td');
        inputCell.className = 'form-input';

        let input;
        const fieldType = valueDef.type || 'number';
        const currentValue = task.values[key];

        if (fieldType === 'material-dropdown') {
            // Material dropdown (exclude gems and zero-value materials)
            input = document.createElement('select');
            input.className = 'management-input';
            input.id = `edit-task-value-${key}`;

            // Populate with materials, filtering out gems and worthless materials
            for (const [matId, matData] of Object.entries(materials)) {
                if (matData.type && matData.type.includes('Gem')) continue;
                if (matData.worth <= 0) continue;

                const option = document.createElement('option');
                option.value = matId;
                option.textContent = matData.name;
                if (matId === currentValue) option.selected = true;
                input.appendChild(option);
            }
        } else if (fieldType === 'gem-dropdown') {
            // Gem dropdown (only gems)
            input = document.createElement('select');
            input.className = 'management-input';
            input.id = `edit-task-value-${key}`;

            // Populate with gems only
            for (const [matId, matData] of Object.entries(materials)) {
                if (!matData.type || !matData.type.includes('Gem')) continue;

                const option = document.createElement('option');
                option.value = matId;
                option.textContent = matData.name;
                if (matId === currentValue) option.selected = true;
                input.appendChild(option);
            }
        } else {
            // Number input
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'management-input management-number-input';
            input.id = `edit-task-value-${key}`;
            input.value = currentValue !== undefined ? currentValue : '';
            input.min = '0';
            input.step = key.toLowerCase().includes('gold') || key.toLowerCase().includes('amount') ? '100' : '1';
        }

        inputCell.appendChild(input);
        row.appendChild(labelCell);
        row.appendChild(inputCell);
        table.appendChild(row);
    }

    valuesContainer.appendChild(table);
}

// Confirm editing a management task
function confirmEditManagementTask() {
    console.log('[Management] confirmEditManagementTask called');

    if (currentEditingTaskId === null) {
        console.error('[Management] No task being edited');
        return;
    }

    const task = activeManagementTasks.find(t => t.id === currentEditingTaskId);
    if (!task) {
        console.error('[Management] Task not found:', currentEditingTaskId);
        return;
    }

    const taskDef = mangementTasks[task.type];
    if (!taskDef) {
        console.error('[Management] Task definition not found:', task.type);
        return;
    }

    // Get task name
    const taskNameInput = document.getElementById('edit-task-name-input');
    const taskName = taskNameInput.value.trim() || taskDef.name;

    // Collect values from form
    const values = {};
    for (const key of Object.keys(taskDef.values)) {
        const input = document.getElementById(`edit-task-value-${key}`);
        console.log('[Management] Edit input for', key, ':', input);
        if (input) {
            values[key] = input.type === 'number' ? parseFloat(input.value) : input.value;
        }
    }
    console.log('[Management] Collected edit values:', values);

    // Update task
    task.name = taskName;
    task.values = values;
    task.active = false; // Set to inactive when edited

    console.log('[Management] Updated task:', task);

    // Sync with worker
    syncManagementTasksWithWorker();

    // Close modal and refresh
    closeModal('edit-management-task-modal');
    populateManagement();

    // Save game state
    saveGame();

    currentEditingTaskId = null;
}

// Set up drag and drop for management task reordering
function setupManagementTaskDragAndDrop(taskList) {
    let draggedElement = null;

    taskList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('management-task-row')) {
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
        }
    });

    taskList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('management-task-row')) {
            e.target.style.opacity = '';
            draggedElement = null;
        }
    });

    taskList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(taskList, e.clientY);
        if (afterElement == null) {
            taskList.appendChild(draggedElement);
        } else {
            taskList.insertBefore(draggedElement, afterElement);
        }
    });

    taskList.addEventListener('drop', (e) => {
        e.preventDefault();
        updateManagementTaskOrder();
    });
}

// Helper function to find the element after which to insert the dragged element
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.management-task-row:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Update the management task order after drag and drop
function updateManagementTaskOrder() {
    const taskList = document.getElementById('management-task-list');
    if (!taskList) return;

    const rows = taskList.querySelectorAll('.management-task-row');
    const newOrder = [];

    rows.forEach(row => {
        const taskId = parseInt(row.dataset.taskId);
        const task = activeManagementTasks.find(t => t.id === taskId);
        if (task) {
            newOrder.push(task);
        }
    });

    activeManagementTasks = newOrder;
    syncManagementTasksWithWorker();
    saveGame();
}

// Sync management tasks with worker
function syncManagementTasksWithWorker() {
    if (workerInitialized && gameWorker) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { activeManagementTasks }
        });
    }
}

// Set up event listener for confirm add task button
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'confirm-add-task-btn') {
        console.log('[Management] Confirm add button clicked!');
        confirmAddManagementTask();
    } else if (e.target && e.target.id === 'confirm-edit-task-btn') {
        console.log('[Management] Confirm edit button clicked!');
        confirmEditManagementTask();
    }
});

console.log('[Management] Event listeners registered for management task buttons');
