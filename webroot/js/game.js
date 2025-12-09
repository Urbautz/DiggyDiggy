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
    // initialize grid array
    grid.length = 0; // clear existing
    for (let r = 0; r < gridDepth; r++) {
        const row = [];
        for (let c = 0; c < gridWidth; c++) {
            let mat;
            
            // Check left tile
            if (c > 0 && Math.random() < GRID_CLUSTERING_HORIZONTAL_CHANCE) {
                const leftCell = row[c - 1];
                if (leftCell && leftCell.materialId) {
                    const leftMat = materials.find(m => m.id === leftCell.materialId);
                    if (leftMat) {
                        mat = leftMat;
                    }
                }
            }
            
            // Check above tile (if not air/empty)
            if (!mat && r > 0 && Math.random() < GRID_CLUSTERING_VERTICAL_CHANCE) {
                const aboveCell = grid[r - 1][c];
                if (aboveCell && aboveCell.materialId && aboveCell.hardness > 0) {
                    const aboveMat = materials.find(m => m.id === aboveCell.materialId);
                    if (aboveMat) {
                        mat = aboveMat;
                    }
                }
            }
            
            // If no clustering, use random based on depth
            if (!mat) {
                mat = randomMaterial(r + (startX || 0));
            }
            
            row.push({ materialId: mat.id, hardness: mat.hardness });
        }
        grid.push(row);
    }
}

// NOTE: Game tick logic (actForDwarf, dig, scheduleMove, etc.) has been moved to game-worker.js
// The worker handles all heavy computation to prevent UI blocking

    // close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.getAttribute('aria-hidden') === 'false') closeSettings();
    });

// Avoid referencing initializeGame directly (it may be defined in another script file)
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initializeGame === 'function') initializeGame();
});