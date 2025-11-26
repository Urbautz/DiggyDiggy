// This file initializes the game, setting up the initial state and handling the game loop.

let dwarfs = [];
let grid = [];
const gridWidth = 10;
const gridDepth = 25; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Material registry — easy to extend later
const materials = [
    { id: 'earth', name: 'Earth', hardness: 3, color: '#6b4b2c' },
    { id: 'clay', name: 'Clay', hardness: 10, color: '#a57f61' },
    { id: 'sandstone', name: 'Sandstone', hardness: 25, color: '#d5b68a' },
];

// Add new material at runtime
function addMaterial(material) {
    // Expected shape: { id, name, hardness, color }
    materials.push(material);
}

// pick a random material from the registry (equal probability for now)
function randomMaterial() {
    const idx = Math.floor(Math.random() * materials.length);
    return materials[idx];
}

function getMaterialById(id) {
    return materials.find(m => m.id === id) || null;
}

// Create a random grid (grid[row][col] -> { materialId, hardness })
function generateGrid() {
    grid = [];
    for (let r = 0; r < gridDepth; r++) {
        const row = [];
        for (let c = 0; c < gridWidth; c++) {
            const mat = randomMaterial();
            row.push({ materialId: mat.id, hardness: mat.hardness });
        }
        grid.push(row);
    }
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
            cell.textContent = cellData.hardness;
            cell.setAttribute('aria-label', `row ${r} col ${c} hardness ${cellData.hardness}`);

            rowEl.appendChild(cell);
        }
        tbody.appendChild(rowEl);
    }
}

// Initialize the game state
function initGame() {
    dwarfs = [{ name: "Dwarf 1", shovelType: "Stone Shovel", depth: 0 }];
    generateGrid();
    updateGridDisplay();
}

// Start the game
initGame();