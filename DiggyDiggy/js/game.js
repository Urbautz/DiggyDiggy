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
            let matId;

            // Check left tile
            if (c > 0 && Math.random() < GRID_CLUSTERING_HORIZONTAL_CHANCE) {
                const leftCell = row[c - 1];
                if (leftCell && leftCell.materialId) {
                    const leftMat = materials[leftCell.materialId];
                    if (leftMat) {
                        matId = leftCell.materialId;
                    }
                }
            }

            // Check above tile (if not air/empty)
            if (!matId && r > 0 && Math.random() < GRID_CLUSTERING_VERTICAL_CHANCE) {
                const aboveCell = grid[r - 1][c];
                if (aboveCell && aboveCell.materialId && aboveCell.hardness > 0) {
                    const aboveMat = materials[aboveCell.materialId];
                    if (aboveMat) {
                        matId = aboveCell.materialId;
                    }
                }
            }

            // If no clustering, use random based on depth
            if (!matId) {
                matId = randomMaterial(r + (startX || 0));
            }

            const mat = materials[matId];
            row.push({ materialId: matId, hardness: mat.hardness });
        }
        grid.push(row);
    }
}

// NOTE: Game tick logic (actForDwarf, dig, scheduleMove, etc.) has been moved to game-worker.js
// The worker handles all heavy computation to prevent UI blocking

    // close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal[aria-hidden="false"]');
            if (openModals.length > 0) {
                // Close the last opened modal
                const lastModal = openModals[openModals.length - 1];
                const closeBtn = lastModal.querySelector('[data-action="close-modal"]');
                if (closeBtn) closeBtn.click();
            }
        }
    });

// Avoid referencing initializeGame directly (it may be defined in another script file)
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initializeGame === 'function') initializeGame();
});