
// pick a random material from the registry (equal probability for now)
function randomMaterial() {
    const idx = Math.floor(Math.random() * materials.length);
    return materials[idx];
}

function getMaterialById(id) {
    return materials.find(m => m.id === id) || null;
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

                // show drop-off marker (global drop-off location) if this cell matches
                    if (typeof dropOff === 'object' && dropOff !== null && dropOff.x === c && dropOff.y === r) {
                        cell.classList.add('drop-off');
                        const box = document.createElement('span');
                        // warehouse icon
                        box.className = 'drop-off-marker warehouse';
                        box.textContent = '🏭';
                        box.title = 'Warehouse (drop-off)';
                        cell.appendChild(box);
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', (ev) => { ev.stopPropagation(); focusMaterialsPanel(); });
                    }
            } else {
                // color indicates material; title shows name + rounded-up hardness
                if (mat) cell.style.background = mat.color;
                
                const displayHardness = Math.ceil(rawHardness);
                // show current hardness value inside the cell (rounded up for clarity)
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
                        const box = document.createElement('span');
                        box.className = 'drop-off-marker warehouse';
                        box.textContent = '🏭';
                        box.title = 'Warehouse (drop-off)';
                        cell.appendChild(box);
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', (ev) => { ev.stopPropagation(); focusMaterialsPanel(); });
                    }

                    // show house / bed icon if this is the house cell
                    if (typeof house === 'object' && house !== null && house.x === gx && house.y === gy) {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', (ev) => { ev.stopPropagation(); openDwarfs(); });
                        const bed = document.createElement('span');
                        bed.className = 'drop-off-marker house';
                        bed.textContent = '🏠';
                        bed.title = 'House (open dwarfs overview)';
                        cell.appendChild(bed);
                    }

                    // show resting marker when dwarf is resting here
                    const restersHere = dwarfsHere.filter(d => d.status === 'resting');
                    if (restersHere.length > 0) {
                        const sleep = document.createElement('span');
                        sleep.className = 'resting-marker';
                        sleep.textContent = '😴';
                        cell.appendChild(sleep);
                    }

                    // Show unloading animation when dwarf is unloading here
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

                    rowEl.appendChild(cell);
                }
                tb.appendChild(rowEl);
            }
        }

        updateMaterialsPanel();
        updateStockDisplay();
        refreshTooltipAfterRedraw();
}

    // dwarf-status UI removed from header; the Dwarfs modal shows this information when requested

function openSettings() {
    // Open the settings modal
    openModal('settings-modal');
}

function openModal(modalname) {
    const modal = document.getElementById(modalname);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modalName) {
    // If a modalName is provided, close that specific modal; otherwise close all open modals
    if (modalName) {
        const m = document.getElementById(modalName);
        if (m) m.setAttribute('aria-hidden', 'true');
        // If we just closed the dwarfs modal, stop live updates
        if (modalName === 'dwarfs-modal') stopDwarfsLiveUpdate();
        return;
    }
    // close any open modal
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
        const id = m.id;
        m.setAttribute('aria-hidden','true');
        if (id === 'dwarfs-modal') stopDwarfsLiveUpdate();
    });
}

// Open the dwarfs overview modal and populate current data
function openDwarfs() {
    populateDwarfsOverview();
    openModal('dwarfs-modal');
    startDwarfsLiveUpdate();
}

function closeDwarfs() {
    closeModal('dwarfs-modal');
    stopDwarfsLiveUpdate();
}

// Populate the dwarfs modal with a compact table showing state for each dwarf
function populateDwarfsOverview() {
    const container = document.getElementById('dwarfs-list');
    if (!container) return;
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'dwarfs-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Name</th><th>Level</th><th>Tool</th><th>Status</th><th>Energy</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const d of dwarfs) {
        const tr = document.createElement('tr');

        // create cells manually so bucket can render one resource per line
        const nameTd = document.createElement('td'); nameTd.textContent = d.name;
        const levelTd = document.createElement('td'); levelTd.textContent = d.level ?? '-';
        const toolTd = document.createElement('td'); toolTd.textContent = d.shovelType ?? '-';
        const statusTd = document.createElement('td'); statusTd.textContent = d.status ?? 'idle';
        const energyTd = document.createElement('td'); energyTd.textContent = (typeof d.energy === 'number') ? d.energy : '-';

        tr.appendChild(nameTd);
        tr.appendChild(levelTd);
        tr.appendChild(toolTd);
        tr.appendChild(statusTd);
        tr.appendChild(energyTd);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

// ---- live-update for the dwarfs modal ----
let _dwarfsModalRefreshId = null;
function startDwarfsLiveUpdate(intervalMs = 350) {
    if (_dwarfsModalRefreshId) return;
    // Refresh immediately and then on an interval while modal is open
    _dwarfsModalRefreshId = setInterval(() => {
        // only update if the modal is visible
        const modal = document.getElementById('dwarfs-modal');
        if (!modal || modal.getAttribute('aria-hidden') === 'true') {
            // if modal is gone or hidden, stop the interval
            stopDwarfsLiveUpdate();
            return;
        }
        populateDwarfsOverview();
    }, intervalMs);
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

function updateMaterialsPanel() {
    const list = document.getElementById('materials-list');
    if (!list) return;
    list.innerHTML = '';
    for (const m of materials) {
        const id = m.id;
        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        const row = document.createElement('div');
        row.className = 'warehouse-row';
        const name = document.createElement('span'); name.className = 'warehouse-name'; name.textContent = m.name;
        const cnt = document.createElement('span'); cnt.className = 'warehouse-count'; cnt.textContent = String(count);
        row.appendChild(name);
        row.appendChild(cnt);
        list.appendChild(row);
    }
}

function focusMaterialsPanel() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
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
    const hardness = Math.max(0, Math.ceil(Number(cellData.hardness) || 0));
    const isDugOut = hardness <= 0;
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

function tick() {
    // Run one game tick — let dwarfs act
    try {
        // prefer per-dwarf action when available
        if (typeof actForDwarf === 'function') {
            for (const d of dwarfs) actForDwarf(d);
            if (typeof checkAndShiftTopRows === 'function') checkAndShiftTopRows();
        } else if (typeof dig === 'function') {
            dig();
        }
    } catch (err) {
        console.error('tick(): error running dig()', err);
    }
}

function initializeGame() {
    setInterval(tick, 250); // Dwarfs dig every second
    updateGameState();
}

// Initialize the game state
function initGame() {
    generateGrid();
    updateGridDisplay();
}

// Start the game
initGame();