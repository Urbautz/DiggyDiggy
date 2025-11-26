// File: /diggy-diggy/diggy-diggy/webroot/js/game.js

let dwarfs = [
    { name: "Dwarf 1", shovelType: "Stone Shovel", depth: 0 }
];

let holeDepth = 10;
let holeGrid = Array.from({ length: holeDepth }, () => Array(10).fill(' '));

function dig() {
    alert(dig);
}

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

function initializeGame() {
    setInterval(dig, 1000); // Dwarfs dig every second
    updateGameState();

    // Attach click handler for the Dig button if present so players can manually trigger a dig
    const digButton = document.getElementById('dig-button');
    if (digButton) {
        digButton.addEventListener('click', () => {
            dig();
            updateGameState();
        });
    }

    }

    // close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.getAttribute('aria-hidden') === 'false') closeSettings();
    });

document.addEventListener('DOMContentLoaded', initializeGame);