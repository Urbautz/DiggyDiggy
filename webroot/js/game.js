// File: /diggy-diggy/diggy-diggy/webroot/js/game.js


let holeDepth = 10;
let holeGrid = Array.from({ length: holeDepth }, () => Array(10).fill(' '));

function updateGameState() {
    const gridElement = document.getElementById('holeGrid');
    if (!gridElement) return; // nothing to update on pages without the holeGrid element
    gridElement.innerHTML = '';
    for (let row of holeGrid) {
        const rowElement = document.createElement('tr');
        for (let cell of row) {
            const cellElement = document.createElement('td');
            cellElement.textContent = cell;
            rowElement.appendChild(cellElement);
        }
        gridElement.appendChild(rowElement);
    }
}

// Create a random grid (grid[row][col] -> { materialId, hardness })
function generateGrid() {
    for (let r = 0; r < gridDepth; r++) {
        const row = [];
        for (let c = 0; c < gridWidth; c++) {
            const mat = randomMaterial();
            row.push({ materialId: mat.id, hardness: mat.hardness });
        }
        grid.push(row);
    }
}

function dig() {
    for (let dwarf of dwarfs) {
        console.log(`Dwarf ${dwarf.name} is digging at (${dwarf.x}, ${dwarf.y})`);
        // guard: ensure grid is available and the dwarf's row exists
        if (!Array.isArray(grid) || grid.length === 0) {
            console.warn('Grid not initialized yet');
            continue;
        }

        const rowIndex = dwarf.y;
        if (typeof rowIndex !== 'number' || rowIndex < 0 || rowIndex >= grid.length) {
            console.warn(`Dwarf ${dwarf.name} has invalid y=${rowIndex}`);
            continue;
        }

        // Find the tool power for this dwarf's shovel
        const tool = tools.find(t => t.name === dwarf.shovelType);
        const power = tool ? tool.power : 0.5;

        const row = grid[rowIndex];

        // Try to find a column on the same row that still has hardness > 0.
        // Start searching from the dwarf's current x, then scan to the end and wrap-around.
        let foundCol = -1;
        for (let offset = 0; offset < row.length; offset++) {
            const c = (dwarf.x + offset) % row.length;
            // skip if no cell or already dug
            if (!(row[c] && row[c].hardness > 0)) continue;

            // skip if another dwarf (not this one) already occupies this cell
            const occupied = dwarfs.some(other => other !== dwarf && other.x === c && other.y === rowIndex);
            if (occupied) {
                console.log(`Cell (${c},${rowIndex}) is occupied by another dwarf — skipping`);
                continue;
            }

            foundCol = c;
            break;
        }

        if (foundCol === -1) {
            // nothing to dig on this row — try the row below (move down one row) if available
            const nextRowIndex = rowIndex + 1;
            if (nextRowIndex >= grid.length) {
                console.log(`No diggable cell found on row ${rowIndex} and no row below for dwarf ${dwarf.name}`);
                continue;
            }

            const nextRow = grid[nextRowIndex];
            let foundBelow = -1;

            for (let offset = 0; offset < nextRow.length; offset++) {
                const c = (dwarf.x + offset) % nextRow.length;
                if (!(nextRow[c] && nextRow[c].hardness > 0)) continue;
                // skip if occupied
                const occupiedBelow = dwarfs.some(other => other !== dwarf && other.x === c && other.y === nextRowIndex);
                if (occupiedBelow) continue;
                foundBelow = c;
                break;
            }

            if (foundBelow === -1) {
                console.log(`No diggable cell found on row ${rowIndex} or row ${nextRowIndex} for dwarf ${dwarf.name}`);
                continue;
            }

            // move the dwarf down and set target to the found below column
            dwarf.y = nextRowIndex;
            foundCol = foundBelow;
        }

        // Move dwarf to that column and apply digging power
        dwarf.x = foundCol;
        const target = row[foundCol];
        const prev = target.hardness;
        target.hardness = Math.max(0, target.hardness - power);
        console.log(`Dwarf ${dwarf.name} moved to x=${foundCol} and reduced hardness ${prev} -> ${target.hardness}`);
        // Refresh UI display if available
        updateGridDisplay();
    }
}
function initializeGame() {
    setInterval(tick, 200); // Dwarfs dig every second
    updateGameState();
}

    // close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.getAttribute('aria-hidden') === 'false') closeSettings();
    });

document.addEventListener('DOMContentLoaded', initializeGame);