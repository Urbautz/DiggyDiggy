// File: /diggy-diggy/diggy-diggy/webroot/js/game.js

let dwarfs = [
    { name: "Dwarf 1", shovelType: "Stone Shovel", depth: 0 }
];

let holeDepth = 10;
let holeGrid = Array.from({ length: holeDepth }, () => Array(10).fill(' '));

function dig() {
    for (let dwarf of dwarfs) {
        if (dwarf.depth < holeDepth) {
            holeGrid[dwarf.depth][Math.floor(Math.random() * 10)] = 'D';
            dwarf.depth++;
        }
    }
    updateGameState();
}

function updateGameState() {
    const gridElement = document.getElementById('holeGrid');
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
}

document.addEventListener('DOMContentLoaded', initializeGame);