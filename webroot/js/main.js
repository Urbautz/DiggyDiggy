
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
        depthCell.textContent = (r + 1).toString(); // show 1..visibleDepth
        depthCell.setAttribute('aria-label', `Depth ${r + 1}`);
        rowEl.appendChild(depthCell);

        for (let c = 0; c < gridWidth; c++) {
            const cellData = grid[r][c];
            const mat = getMaterialById(cellData.materialId);

            const cell = document.createElement('td');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            if (mat) {
                // color indicates material; title shows name + hardness
                cell.style.background = mat.color;
                cell.title = `${mat.name} (hardness ${cellData.hardness})`;
            }

            // show current hardness value inside the cell
            let display = String(cellData.hardness);

            // If one or more dwarfs occupy this cell, show a small marker or initial(s)
            if (Array.isArray(window.dwarfs)) {
                const dwarfsHere = dwarfs.filter(d => d.x === c && d.y === r);
                if (dwarfsHere.length > 0) {
                    // use initials for multiple dwarfs, fallback to a simple marker
                    const initials = dwarfsHere.map(d => (d.name || 'D').charAt(0)).join('');
                    display += ' ' + initials;
                }
            }

            cell.textContent = display;
            cell.setAttribute('aria-label', `row ${r} col ${c} hardness ${cellData.hardness}`);

            rowEl.appendChild(cell);
        }
        tbody.appendChild(rowEl);
    }
}

function openSettings() {
    alert("hallo welt");
        openModal('settings-modal');
}

function openModal(modalname) {
    const modal = document.getElementById(modalname);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
}

function initUI() {
    createGrid(10); // Initialize the grid with 10 rows
}

function tick() {}

// Initialize the game state
function initGame() {
    generateGrid();
    updateGridDisplay();
}

// Start the game
initGame();