
// pick a random material from the registry based on depth level and probability (probability)
function randomMaterial(depthLevel = 0) {
    // Filter materials that are valid for this depth level
    const validMaterials = materials.filter(m => 
        depthLevel >= (m.minlevel || 0) && depthLevel <= (m.maxlevel || Infinity)
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

                    // show workbench icon if this is the workbench cell
                    if (typeof workbench === 'object' && workbench !== null && workbench.x === gx && workbench.y === gy) {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', (ev) => { ev.stopPropagation(); openWorkbench(); });
                        const bench = document.createElement('span');
                        bench.className = 'drop-off-marker workbench';
                        bench.textContent = '🔨';
                        bench.title = 'Workbench (craft tools)';
                        cell.appendChild(bench);
                    }

                    // show resting marker when dwarf is resting here
                    const restersHere = dwarfsHere.filter(d => d.status === 'resting');
                    if (restersHere.length > 0) {
                        const sleep = document.createElement('span');
                        sleep.className = 'resting-marker';
                        sleep.textContent = '😴';
                        cell.appendChild(sleep);
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
        updateGoldDisplay();
        refreshTooltipAfterRedraw();
}

    // dwarf-status UI removed from header; the Dwarfs modal shows this information when requested

function openWorkbench() {
    openModal('workbench-modal');
}

function openSettings() {
    // Pause game when opening settings
    if (!gamePaused) {
        togglePause();
    }
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

// Switch the materials panel to show dwarfs overview
function openDwarfs() {
    const panel = document.getElementById('materials-panel');
    if (!panel) return;
    
    // Mark panel as showing dwarfs view
    panel.dataset.view = 'dwarfs';
    
    // Update header
    const header = panel.querySelector('.materials-panel-header h3');
    if (header) header.textContent = 'Dwarfs';
    
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
    
    // Update header
    const header = panel.querySelector('.materials-panel-header h3');
    if (header) header.textContent = 'Warehouse';
    
    // Show warehouse content
    stopDwarfsLiveUpdate();
    updateMaterialsPanel();
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

// Populate dwarfs in the materials panel (not modal)
function populateDwarfsInPanel() {
    const list = document.getElementById('materials-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Create a compact list of dwarfs
    for (const d of dwarfs) {
        const row = document.createElement('div');
        row.className = 'dwarf-row';
        
        const name = document.createElement('div');
        name.className = 'dwarf-name';
        name.textContent = d.name;
        
        const info = document.createElement('div');
        info.className = 'dwarf-info';
        info.textContent = `Lvl. ${d.level || 1}  •⚡${d.energy || 0} • ${d.status || 'idle'}`;
        
        row.appendChild(name);
        row.appendChild(info);
        list.appendChild(row);
    }
}

// ---- live-update for the dwarfs panel/modal ----
let _dwarfsModalRefreshId = null;
function startDwarfsLiveUpdate(intervalMs = 350) {
    if (_dwarfsModalRefreshId) return;
    // Refresh immediately and then on an interval while view is active
    _dwarfsModalRefreshId = setInterval(() => {
        const panel = document.getElementById('materials-panel');
        // Check if we're still in dwarfs view
        if (panel && panel.dataset.view === 'dwarfs') {
            populateDwarfsInPanel();
        } else {
            // If not in dwarfs view, stop the interval
            stopDwarfsLiveUpdate();
        }
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
    
    // Calculate earnings
    const earnings = material.worth * amount;
    
    // Update stock and gold
    materialsStock[materialId] -= amount;
    gold += earnings;
    
    // Update the worker's state with new values
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                materialsStock: materialsStock,
                gold: gold
            }
        });
    }
    
    // Update UI
    updateMaterialsPanel();
    updateGoldDisplay();
    
    // Save game
    saveGame();
    
    console.log(`Sold ${amount} ${material.name} for ${earnings.toFixed(2)} gold`);
}

function updateMaterialsPanel() {
    const panel = document.getElementById('materials-panel');
    // Only update if we're in warehouse view (or view not set)
    if (panel && panel.dataset.view === 'dwarfs') return;
    
    const list = document.getElementById('materials-list');
    if (!list) return;
    list.innerHTML = '';
    for (const m of materials) {
        const id = m.id;
        const count = (typeof materialsStock !== 'undefined' && materialsStock[id] != null) ? materialsStock[id] : 0;
        // Skip materials with 0 stock
        if (count === 0) continue;
        
        const row = document.createElement('div');
        row.className = 'warehouse-row';
        
        const info = document.createElement('div');
        info.className = 'warehouse-info';
        
        const name = document.createElement('span');
        name.className = 'warehouse-name';
        name.textContent = m.name;
        
        const worth = document.createElement('span');
        worth.className = 'warehouse-worth';
        worth.textContent = `${m.worth.toFixed(2)} 💰`;
        worth.title = `Worth: ${m.worth.toFixed(2)} gold each`;
        
        const cnt = document.createElement('span');
        cnt.className = 'warehouse-count';
        cnt.textContent = String(count);
        
        info.appendChild(name);
        info.appendChild(worth);
        info.appendChild(cnt);
        
        const buttons = document.createElement('div');
        buttons.className = 'warehouse-buttons';
        
        const sell1Btn = document.createElement('button');
        sell1Btn.className = 'btn-sell';
        sell1Btn.textContent = 'Sell 1';
        sell1Btn.title = `Sell 1 ${m.name} for ${m.worth.toFixed(2)} gold`;
        sell1Btn.onclick = () => {
            console.log('Sell 1 button clicked for', id);
            sellMaterial(id, 1);
        };
        
        const sellAllBtn = document.createElement('button');
        sellAllBtn.className = 'btn-sell-all';
        sellAllBtn.textContent = 'Sell All';
        sellAllBtn.title = `Sell all ${count} ${m.name} for ${(count * m.worth).toFixed(2)} gold`;
        sellAllBtn.onclick = () => {
            console.log('Sell All button clicked for', id);
            sellMaterial(id, count);
        };
        
        buttons.appendChild(sell1Btn);
        buttons.appendChild(sellAllBtn);
        
        row.appendChild(info);
        row.appendChild(buttons);
        list.appendChild(row);
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

// Web Worker for game calculations
let gameWorker = null;
let workerInitialized = false;
let gameTickIntervalId = null;
let gamePaused = false;

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
                dwarfs = data.dwarfs;
                startX = data.startX;
                
                // Update materialsStock properties (can't reassign const)
                for (const key in data.materialsStock) {
                    materialsStock[key] = data.materialsStock[key];
                }
                
                // Update gold
                if (data.gold !== undefined) {
                    gold = data.gold;
                }
                
                // Update UI to reflect new state
                updateGridDisplay();
                
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
            dropGridStartX,
            gold
        }
    });
}

function tick() {
    // Don't tick if game is paused
    if (gamePaused) return;
    
    // Send tick request to worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({ type: 'tick' });
    } else {
        console.warn('Worker not ready yet');
    }
}

function togglePause() {
    gamePaused = !gamePaused;
    const btn = document.getElementById('pause-button');
    if (btn) {
        btn.textContent = gamePaused ? '▶️' : '⏸️';
        btn.title = gamePaused ? 'Resume game' : 'Pause game';
    }
    console.log(gamePaused ? 'Game paused' : 'Game resumed');
}

function saveGame() {
    try {
        const gameState = {
            grid: grid,
            dwarfs: dwarfs,
            startX: startX,
            materialsStock: materialsStock,
            gold: gold,
            timestamp: Date.now(),
            version: '1.0'
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
        
        console.log('Game loaded from', new Date(gameState.timestamp));
        return true;
    } catch (e) {
        console.error('Failed to load game:', e);
        return false;
    }
}

function deleteSave() {
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

function initializeGame() {
    initWorker();
    gameTickIntervalId = setInterval(tick, 250); // Dwarfs dig every 250ms
    gamePaused = false; // Start with game running
    updateGameState();
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
}

// Start the game
initGame();