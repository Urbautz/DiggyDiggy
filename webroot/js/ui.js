// This file handles the user interface interactions, updating the display based on the game state and player actions.

const gridElement = document.getElementById('digging-grid');

function createGrid(depth) {
    gridElement.innerHTML = ''; // Clear existing grid
    for (let i = 0; i < depth; i++) {
        const row = document.createElement('tr');
        for (let j = 0; j < 10; j++) {
            const cell = document.createElement('td');
            cell.className = 'dig-cell';
            cell.innerText = '⬜'; // Empty cell representation
            row.appendChild(cell);
        }
        gridElement.appendChild(row);
    }
}

function updateGrid(depth, dwarfs) {
    for (let i = 0; i < depth; i++) {
        for (let j = 0; j < 10; j++) {
            const cell = gridElement.rows[i].cells[j];
            if (i < dwarfs.length) {
                cell.innerText = '⬛'; // Dwarf is digging
            } else {
                cell.innerText = '⬜'; // Empty cell
            }
        }
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