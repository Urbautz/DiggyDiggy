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
        const originalX = dwarf.x; // remember where we started on this tick
        if (typeof rowIndex !== 'number' || rowIndex < 0 || rowIndex >= grid.length) {
            console.warn(`Dwarf ${dwarf.name} has invalid y=${rowIndex}`);
            continue;
        }

        // Find the tool power for this dwarf's shovel
        const tool = tools.find(t => t.name === dwarf.shovelType);
        const power = tool ? tool.power : 0.5;

        const row = grid[rowIndex];
        const curCell = row[originalX];

        // If the dwarf currently stands on an empty cell, there's a chance
        // they will go down one level (dig deeper) instead of moving left/right.
        // This is an "erratic" 30% chance and only applies when the current cell is dug out (hardness <= 0).
        let movedDownByChance = false;
        let skipHorizontalScan = false;
        if (curCell && curCell.hardness <= 0) {
            const downChance = 0.3;
            if (Math.random() < downChance) {
                const downRowIndex = rowIndex + 1;
                if (downRowIndex < grid.length) {
                    const downCell = grid[downRowIndex][dwarf.x];
                    const occupiedDown = dwarfs.some(other => other !== dwarf && other.x === dwarf.x && other.y === downRowIndex);
                    if (downCell && downCell.hardness > 0 && !occupiedDown) {
                        // move down and dig straight below
                        dwarf.y = downRowIndex;
                        movedDownByChance = true;
                        skipHorizontalScan = true;
                        console.log(`Dwarf ${dwarf.name} decided to dig down from (${dwarf.x},${rowIndex}) to (${dwarf.x},${downRowIndex})`);
                    }
                }
            }
        }

        // Try to find a column on the same row that still has hardness > 0.
        // Start searching from the dwarf's current x, then scan to the end and wrap-around.
        let foundCol = -1;
        // pick a random scan direction for this dwarf this tick: 1 => right, -1 => left
        const dir = Math.random() < 0.5 ? 1 : -1;
        // If a chance-made move pushed the dwarf down, prefer to dig the column directly below his original x
        if (movedDownByChance) foundCol = originalX;
        // Only scan horizontally on the original row if not skipping
        if (!skipHorizontalScan) {
            for (let offset = 0; offset < row.length; offset++) {
                // scan starting at originalX then step in the chosen direction and wrap
                const c = (originalX + dir * offset + row.length) % row.length;
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
                // use the same horizontal direction when scanning below
                const c = (originalX + dir * offset + nextRow.length) % nextRow.length;
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

        // Move dwarf to that column and determine the exact target cell
        const prevRowIndex = rowIndex; // remember where we started for the "move up" rule
        // ensure a valid foundCol
        if (foundCol === -1) {
            // safety-check
            console.log(`No target found for dwarf ${dwarf.name} at startRow=${rowIndex}`);
            continue;
        }
        dwarf.x = foundCol;

        // If the dwarf moved horizontally (changed x) and the level above is not dug out,
        // move the dwarf up by one row to dig there instead (if the above cell exists and is undug and not occupied)
        if (foundCol !== originalX && prevRowIndex > 0) {
            const aboveRowIndex = prevRowIndex - 1;
            const aboveCell = grid[aboveRowIndex] && grid[aboveRowIndex][foundCol];
            const occupiedAbove = dwarfs.some(other => other !== dwarf && other.x === foundCol && other.y === aboveRowIndex);
            if (aboveCell && aboveCell.hardness > 0 && !occupiedAbove) {
                dwarf.y = aboveRowIndex;
                console.log(`Dwarf ${dwarf.name} moved up to (${foundCol},${aboveRowIndex}) after changing x`);
            } else if (aboveCell && aboveCell.hardness > 0 && occupiedAbove) {
                // Add explicit logging to help diagnose rare cases where the above cell is undug but occupied
                console.log(`Dwarf ${dwarf.name} wanted to move up to (${foundCol},${aboveRowIndex}) but it's occupied; will dig current target instead.`);
            }
        }

        // Final safety-check: if we still are planning to dig at current row/column but the
        // above-cell (original row - 1) is undug and unoccupied, prefer to go up instead.
        if (dwarf.x !== originalX && prevRowIndex > 0) {
            const aboveRowIndex2 = prevRowIndex - 1;
            const aboveCell2 = grid[aboveRowIndex2] && grid[aboveRowIndex2][dwarf.x];
            const occupiedAbove2 = dwarfs.some(other => other !== dwarf && other.x === dwarf.x && other.y === aboveRowIndex2);
            if (aboveCell2 && aboveCell2.hardness > 0 && !occupiedAbove2) {
                // Move up and prefer that cell
                dwarf.y = aboveRowIndex2;
                console.log(`(Safety) Dwarf ${dwarf.name} moved up to (${dwarf.x},${aboveRowIndex2}) before digging`);
            } else if (aboveCell2 && aboveCell2.hardness > 0 && occupiedAbove2) {
                console.log(`(Safety) Dwarf ${dwarf.name} could not move up to (${dwarf.x},${aboveRowIndex2}) because another dwarf is present`);
            }
        }

        // Recompute the target row index (maybe changed by downward/upward move earlier)
        const targetRowIndex = dwarf.y;
        const target = grid[targetRowIndex][foundCol];
        // If we moved horizontally (found a different column than where we started),
        // and the level above the previous row has hardness > 0, climb up and dig there.
        const startedX = dwarf.x; // currently the x after we set foundCol
        // But we need the original starting x to detect a change; calculate it from previous state.
        // We can infer the original x from 'startedX' and 'foundCol' logic: since we assigned dwarf.x=foundCol already,
        // store the original starting x by reading from the dwarf object earlier? It was mutated earlier, so track separately.

        // To ensure correctness, let's capture originalX at the top of the loop instead of trying to infer it here.
        const prev = target.hardness;
        target.hardness = Math.max(0, target.hardness - power);
        console.log(`Dwarf ${dwarf.name} moved to (${foundCol},${targetRowIndex}) and reduced hardness ${prev} -> ${target.hardness}`);
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