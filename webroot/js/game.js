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

    function openSettings() {
        openmModal('settings-modal');
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

    function saveState() {
        try {
            const payload = { dwarfs, holeGrid, holeDepth };
            localStorage.setItem('diggy_game_state', JSON.stringify(payload));
            alert('Game state saved locally.');
            closeModal();
        } catch (err) {
            console.error('Failed to save state', err);
            alert('Saving failed (see console).');
        }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('diggy_game_state');
            if (!raw) { alert('No saved game found.'); return; }
            const data = JSON.parse(raw);
            if (data.holeDepth) holeDepth = data.holeDepth;
            if (Array.isArray(data.holeGrid)) holeGrid = data.holeGrid;
            if (Array.isArray(data.dwarfs)) dwarfs = data.dwarfs;
            updateGameState();
            alert('Game state loaded.');
            closeModal();
        } catch (err) {
            console.error('Failed to load state', err);
            alert('Loading failed (see console).');
        }
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', openModal);
    }

    // Fallback / resilient delegation: make sure clicks open/close modal even if the DOM changed
    if (!window.__diggy_settings_handlers_attached) {
        document.addEventListener('click', (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            if (!t) return;

            // open if the clicked element or an ancestor has id=settings-button
            if (t.closest && t.closest('#settings-button')) {
                openModal();
                return;
            }

            // close when clicking backdrop or close controls
            if (t.closest && t.closest('[data-action="close-modal"]')) {
                closeModal();
                return;
            }

            // Save/Load buttons
            if (t.closest && t.closest('#settings-save')) {
                saveState();
                return;
            }
            if (t.closest && t.closest('#settings-load')) {
                loadState();
                return;
            }
        });
        window.__diggy_settings_handlers_attached = true;
        // useful debug line when testing (can be removed later)
        console.debug('diggy: settings delegation handler attached');
    }
    modalCloseEls.forEach(el => el.addEventListener('click', closeModal));
    if (btnSave) btnSave.addEventListener('click', saveState);
    if (btnLoad) btnLoad.addEventListener('click', loadState);

    // close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.getAttribute('aria-hidden') === 'false') closeModal();
    });
}

document.addEventListener('DOMContentLoaded', initializeGame);