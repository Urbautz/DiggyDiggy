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
            const mat = randomMaterial();
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