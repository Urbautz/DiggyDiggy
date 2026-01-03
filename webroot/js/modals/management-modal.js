// ============================================================================
// MANAGEMENT MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the management modal

// Initialize active management tasks array (populated from save file or starts empty)
let activeManagementTasks = [];
let nextManagementTaskId = 1;

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

    // Header description
    const headerDesc = document.createElement('p');
    headerDesc.className = 'management-description';
    headerDesc.textContent = 'Manage automated tasks. Dwarfs will execute these tasks automatically based on priority.';
    container.appendChild(headerDesc);

    // Add task button
    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'btn-primary';
    addTaskBtn.style.marginBottom = '16px';
    addTaskBtn.innerHTML = '➕ Add Task';
    addTaskBtn.onclick = () => openAddManagementTaskModal();
    container.appendChild(addTaskBtn);

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

            // Task header with drag handle and name
            const taskHeader = document.createElement('div');
            taskHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

            const leftSide = document.createElement('div');
            leftSide.style.cssText = 'display: flex; align-items: center; gap: 8px;';

            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle';
            dragHandle.textContent = '⠿';
            dragHandle.style.cssText = 'cursor: grab; font-size: 18px; color: #666;';

            const taskName = document.createElement('strong');
            taskName.textContent = taskDef.name;

            leftSide.appendChild(dragHandle);
            leftSide.appendChild(taskName);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-danger';
            deleteBtn.style.cssText = 'padding: 4px 8px; font-size: 11px;';
            deleteBtn.textContent = '🗑️ Remove';
            deleteBtn.onclick = () => removeManagementTask(activeTask.id);

            taskHeader.appendChild(leftSide);
            taskHeader.appendChild(deleteBtn);

            // Task description
            const taskDesc = document.createElement('div');
            taskDesc.style.cssText = 'font-size: 12px; color: #aaa; margin-bottom: 8px;';
            taskDesc.textContent = taskDef.description;

            // Task values display
            const valuesDiv = document.createElement('div');
            valuesDiv.style.cssText = 'font-size: 12px; margin-bottom: 8px; padding: 8px; background: #1a2a3a; border-radius: 4px;';

            const valuesList = [];
            for (const [key, value] of Object.entries(activeTask.values)) {
                // Get label from task definition if available
                const valueDef = taskDef.values[key];
                const labelText = (valueDef && valueDef.Description) || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                valuesList.push(`<strong>${labelText}:</strong> ${formatManagementValue(key, value, valueDef)}`);
            }
            valuesDiv.innerHTML = valuesList.join('<br>');

            // Cost display
            const costDiv = document.createElement('div');
            costDiv.style.cssText = 'font-size: 12px; color: #ffbb00;';
            costDiv.innerHTML = `<strong>Cost:</strong> ${taskDef.cost} research points per execution`;

            taskRow.appendChild(taskHeader);
            taskRow.appendChild(taskDesc);
            taskRow.appendChild(valuesDiv);
            taskRow.appendChild(costDiv);

            taskList.appendChild(taskRow);
        });

        // Set up drag and drop for task reordering
        setupManagementTaskDragAndDrop(taskList);
    }

    container.appendChild(taskList);
}

// Format management task values for display
function formatManagementValue(key, value, valueDef) {
    // Check type from valueDef if available
    if (valueDef && valueDef.type === 'material-dropdown') {
        const mat = getMaterialById(value);
        return mat ? mat.name : value;
    }
    if (key === 'material') {
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
    document.getElementById('task-description').innerHTML = '<em>Select a task type to see its description</em>';
    document.getElementById('task-cost-display').style.display = 'none';
}

// Update the task value input fields based on selected task type
function updateTaskValueFields() {
    const taskTypeSelect = document.getElementById('task-type-select');
    const selectedType = taskTypeSelect.value;

    const descriptionDiv = document.getElementById('task-description');
    const valuesContainer = document.getElementById('task-values-container');
    const costDisplay = document.getElementById('task-cost-display');
    const costValue = document.getElementById('task-cost-value');

    if (!selectedType) {
        descriptionDiv.innerHTML = '<em>Select a task type to see its description</em>';
        valuesContainer.innerHTML = '';
        costDisplay.style.display = 'none';
        return;
    }

    const taskDef = mangementTasks[selectedType];
    if (!taskDef) return;

    // Update description
    descriptionDiv.textContent = taskDef.description;

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
            // Material dropdown
            input = document.createElement('select');
            input.className = 'management-input';
            input.id = `task-value-${key}`;

            // Populate with materials
            for (const [matId, matData] of Object.entries(materials)) {
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

    // Create new task
    const newTask = {
        id: nextManagementTaskId++,
        type: selectedType,
        values: values,
        enabled: true
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
        console.log('[Management] Confirm button clicked!');
        confirmAddManagementTask();
    }
});

console.log('[Management] Event listener registered for confirm-add-task-btn');
