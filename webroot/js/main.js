
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
                    cell.title = `${standingHere.map(d => d.name).join(', ')} (standing here, dug out)`;
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
                    cell.title = mat ? `${mat.name} (dug out)` : 'Empty';
                    cell.setAttribute('aria-label', `row ${r} col ${c} empty`);
                }

                // moving dwarfs are shown with a running icon (may be behind the dig marker)
                if (movingHere.length > 0) {
                    const mover = document.createElement('span');
                    mover.className = 'moving-marker';
                    mover.textContent = '🏃';
                    cell.appendChild(mover);
                }
            } else {
                // color indicates material; title shows name + rounded-up hardness
                if (mat) cell.style.background = mat.color;
                const displayHardness = Math.ceil(rawHardness);
                cell.title = mat ? `${mat.name} (hardness ${displayHardness})` : `hardness ${displayHardness}`;
                // show current hardness value inside the cell (rounded up for clarity)
                if (standingHere.length > 0) {
                    // mark the cell with the background emoji and render hardness text normally
                    cell.classList.add('has-dwarf');
                    cell.textContent = displayHardness;
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
                    cell.textContent = displayHardness;
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
        return;
    }
    // close any open modal
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => m.setAttribute('aria-hidden','true'));
}

// Open the dwarfs overview modal and populate current data
function openDwarfs() {
    populateDwarfsOverview();
    openModal('dwarfs-modal');
}

function closeDwarfs() {
    closeModal('dwarfs-modal');
}

// Populate the dwarfs modal with a compact table showing state for each dwarf
function populateDwarfsOverview() {
    const container = document.getElementById('dwarfs-list');
    if (!container) return;
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'dwarfs-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Name</th><th>Level</th><th>Tool</th><th>Status</th><th>Bucket</th><th>Pos</th><th>XP</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const d of dwarfs) {
        const tr = document.createElement('tr');

        const bucketContents = (() => {
            if (!d.bucket || Object.keys(d.bucket).length === 0) return 'empty';
            return Object.entries(d.bucket).map(([k,v]) => `${k}:${v}`).join(', ');
        })();

        tr.innerHTML = `
            <td>${d.name}</td>
            <td>${d.level ?? '-'}</td>
            <td>${d.shovelType ?? '-'}</td>
            <td>${d.status ?? 'idle'}</td>
            <td>${bucketContents}</td>
            <td>${d.x ?? '-'},${d.y ?? '-'}</td>
            <td>${d.xp ?? 0}</td>
        `;
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
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

function tick() {
    // Run one game tick — let dwarfs act
    try {
        if (typeof dig === 'function') dig();
    } catch (err) {
        console.error('tick(): error running dig()', err);
    }
}

// Initialize the game state
function initGame() {
    generateGrid();
    updateGridDisplay();
}

// Start the game
initGame();