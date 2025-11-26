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

// Reservation maps (coordinate -> dwarf who reserved the cell)
const reservedDigBy = new Map();
const reservedMoveBy = new Map();

function coordKey(x,y){ return `${x},${y}`; }

function isCellOccupiedByStanding(x,y){
    return dwarfs.some(d => d.x === x && d.y === y && d.status !== 'moving');
}

function isReservedForDig(x,y){ return reservedDigBy.has(coordKey(x,y)); }
function isReservedForMove(x,y){ return reservedMoveBy.has(coordKey(x,y)); }


function dig() {
    for (let dwarf of dwarfs) {
        if (!dwarf.status) dwarf.status = 'idle';
        if (!('moveTarget' in dwarf)) dwarf.moveTarget = null;
        console.log(`Dwarf ${dwarf.name} is acting at (${dwarf.x}, ${dwarf.y}) status=${dwarf.status}`);
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

        // state flags for search
        let movedDownByChance = false;
        let skipHorizontalScan = false;

        // If the dwarf is idle and the current cell still has hardness, start digging here.
        if (dwarf.status === 'idle' && curCell && curCell.hardness > 0) {
            const curKey = coordKey(dwarf.x, dwarf.y);
            // If not reserved by someone else, reserve and dig
            if (!reservedDigBy.get(curKey) || reservedDigBy.get(curKey) === dwarf) {
                reservedDigBy.set(curKey, dwarf);
                dwarf.status = 'digging';
                const prev = curCell.hardness;
                curCell.hardness = Math.max(0, curCell.hardness - power);
                console.log(`Dwarf ${dwarf.name} started digging at (${dwarf.x},${dwarf.y}) ${prev} -> ${curCell.hardness}`);
                if (curCell.hardness === 0) {
                    if (reservedDigBy.get(curKey) === dwarf) reservedDigBy.delete(curKey);
                    dwarf.status = 'idle';
                }
                updateGridDisplay();
                continue; // consume tick — no movement this turn
            }
        }

        // 1) If dwarf is mid-move: advance one step toward its moveTarget
        if (dwarf.status === 'moving' && dwarf.moveTarget) {
            const tx = dwarf.moveTarget.x, ty = dwarf.moveTarget.y;
            const dx = tx - dwarf.x, dy = ty - dwarf.y;
            const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
            const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
            const nextX = dwarf.x + (stepX !== 0 ? stepX : 0);
            const nextY = dwarf.y + (stepX === 0 ? stepY : 0);

            const nextKey = coordKey(nextX, nextY);
            const reservedBy = reservedMoveBy.get(nextKey);
            const occupiedByStanding = isCellOccupiedByStanding(nextX, nextY);

            if (reservedBy && reservedBy !== dwarf) {
                console.log(`Dwarf ${dwarf.name} can't move to ${nextKey} — reserved by ${reservedBy.name}`);
                const finalKey = coordKey(tx, ty);
                if (reservedMoveBy.get(finalKey) === dwarf) reservedMoveBy.delete(finalKey);
                dwarf.moveTarget = null;
                dwarf.status = 'idle';
            } else if (occupiedByStanding) {
                console.log(`Dwarf ${dwarf.name} blocked by standing dwarf at ${nextKey}`);
                const finalKey = coordKey(tx, ty);
                if (reservedMoveBy.get(finalKey) === dwarf) reservedMoveBy.delete(finalKey);
                dwarf.moveTarget = null;
                dwarf.status = 'idle';
            } else {
                dwarf.x = nextX; dwarf.y = nextY;
                console.log(`Dwarf ${dwarf.name} moved to (${dwarf.x},${dwarf.y})`);
                if (dwarf.x === tx && dwarf.y === ty) {
                    const finalKey = coordKey(tx, ty);
                    if (reservedMoveBy.get(finalKey) === dwarf) reservedMoveBy.delete(finalKey);
                    dwarf.moveTarget = null; dwarf.status = 'idle';
                } else {
                    dwarf.status = 'moving';
                }
                updateGridDisplay();
                continue; // movement consumes the action for this tick
            }
        }

        // 2) If dwarf is mid-dig: do the dig action
        if (dwarf.status === 'digging') {
            const curKeyDig = coordKey(dwarf.x, dwarf.y);
            if (!reservedDigBy.get(curKeyDig)) reservedDigBy.set(curKeyDig, dwarf);
            const curCellDig = grid[dwarf.y][dwarf.x];
            if (curCellDig && curCellDig.hardness > 0) {
                const prev = curCellDig.hardness;
                curCellDig.hardness = Math.max(0, curCellDig.hardness - power);
                console.log(`Dwarf ${dwarf.name} continues digging at (${dwarf.x},${dwarf.y}) ${prev} -> ${curCellDig.hardness}`);
                if (curCellDig.hardness === 0) {
                    if (reservedDigBy.get(curKeyDig) === dwarf) reservedDigBy.delete(curKeyDig);
                    dwarf.status = 'idle';
                }
                updateGridDisplay();
                continue; // digging consumes tick
            } else {
                if (reservedDigBy.get(curKeyDig) === dwarf) reservedDigBy.delete(curKeyDig);
                dwarf.status = 'idle';
            }
        }

        // If current cell is dug out, there's a 30% chance to try to move down one row first
        if (curCell && curCell.hardness <= 0) {
            const downChance = 0.3;
            if (Math.random() < downChance) {
                const downRowIndex = rowIndex + 1;
                if (downRowIndex < grid.length) {
                    const downCell = grid[downRowIndex][originalX];
                    const occupiedDown = isCellOccupiedByStanding(originalX, downRowIndex);
                    const downKey = coordKey(originalX, downRowIndex);
                    if (downCell && downCell.hardness > 0 && !occupiedDown && !isReservedForDig(originalX, downRowIndex) && !isReservedForMove(originalX, downRowIndex)) {
                        dwarf.moveTarget = { x: originalX, y: downRowIndex };
                        dwarf.status = 'moving';
                        reservedMoveBy.set(downKey, dwarf);
                        console.log(`Dwarf ${dwarf.name} decided to move down from (${originalX},${rowIndex}) to (${originalX},${downRowIndex})`);
                        updateGridDisplay();
                        continue; // consume move for this tick
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

                // skip if the cell is reserved for digging by someone else
                if (isReservedForDig(c, rowIndex) && reservedDigBy.get(coordKey(c,rowIndex)) !== dwarf) continue;
                // don't pick a target if final target is already reserved for move by a different dwarf
                if (isReservedForMove(c, rowIndex) && reservedMoveBy.get(coordKey(c,rowIndex)) !== dwarf) continue;
                // don't pick a target if a standing dwarf occupies it
                if (isCellOccupiedByStanding(c, rowIndex)) {
                    console.log(`Cell (${c},${rowIndex}) is occupied by a standing dwarf — skipping`);
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
                if (isReservedForDig(c, nextRowIndex) && reservedDigBy.get(coordKey(c,nextRowIndex)) !== dwarf) continue;
                if (isReservedForMove(c, nextRowIndex) && reservedMoveBy.get(coordKey(c,nextRowIndex)) !== dwarf) continue;
                if (isCellOccupiedByStanding(c, nextRowIndex)) continue;
                foundBelow = c;
                break;
            }

            if (foundBelow === -1) {
                console.log(`No diggable cell found on row ${rowIndex} or row ${nextRowIndex} for dwarf ${dwarf.name}`);
                continue;
            }

            // schedule move to the found below column (movement will happen one step per tick)
            const targetKey = coordKey(foundBelow, nextRowIndex);
            dwarf.moveTarget = { x: foundBelow, y: nextRowIndex };
            reservedMoveBy.set(targetKey, dwarf);
            dwarf.status = 'moving';
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
        // If the found target is a different column (horizontal move) and dwarf is not already moving,
        // schedule a move rather than teleporting. Movement takes one tick and is step-by-step.
        if (foundCol !== originalX || (dwarf.y !== rowIndex)) {
            // if we already scheduled a move (down case), don't overwrite that
            if (!dwarf.moveTarget) {
                const finalKey = coordKey(foundCol, dwarf.y);
                if (reservedMoveBy.get(finalKey) && reservedMoveBy.get(finalKey) !== dwarf) {
                    console.log(`Dwarf ${dwarf.name} can't reserve (${foundCol},${dwarf.y}) — already reserved`);
                    // can't move there — skip action
                    continue;
                }
                reservedMoveBy.set(finalKey, dwarf);
                dwarf.moveTarget = { x: foundCol, y: dwarf.y };
                dwarf.status = 'moving';
                console.log(`Dwarf ${dwarf.name} planning move to (${foundCol},${dwarf.y})`);
                updateGridDisplay();
                continue; // movement scheduled: consumes tick
            }
        }

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
        // reserve target for digging
        const targetKey = coordKey(foundCol, targetRowIndex);
        if (!reservedDigBy.get(targetKey)) reservedDigBy.set(targetKey, dwarf);
        // perform digging
        target.hardness = Math.max(0, target.hardness - power);
        console.log(`Dwarf ${dwarf.name} moved to (${foundCol},${targetRowIndex}) and reduced hardness ${prev} -> ${target.hardness}`);
        // update dwarf status and release dig reservation if the cell is fully dug
        if (target.hardness === 0) {
            if (reservedDigBy.get(targetKey) === dwarf) reservedDigBy.delete(targetKey);
            dwarf.status = 'idle';
        } else {
            dwarf.status = 'digging';
        }
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