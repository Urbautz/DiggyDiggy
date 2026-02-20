/**
 * Settings and About Modals
 * Simple modal openers for Settings and About pages
 */

/**
 * Opens the settings modal
 */
function openSettings() {
    openModal('settings-modal');
}

/**
 * Opens the about modal and loads version information
 */
function openAbout() {
    openModal('about-modal');
    loadVersionInfo();
}

/**
 * Loads version information from version.html file
 */
async function loadVersionInfo() {
    const container = document.getElementById('about-content');
    if (!container) return;

    try {
        const response = await fetch('version.html');
        if (response.ok) {
            const html = await response.text();
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p style="color: #ff6b6b;">Failed to load version information.</p>';
        }
    } catch (error) {
        container.innerHTML = '<p style="color: #ff6b6b;">Error loading version information.</p>';
        console.error('Error loading version info:', error);
    }
}

/**
 * Exports the current game state to a downloadable JSON file
 */
window.exportSave = function() {
    try {
        // Get the current game state from localStorage
        const saved = localStorage.getItem('diggyDiggyGameState');
        if (!saved) {
            alert('No saved game found to export.');
            return;
        }

        // Parse and re-stringify to ensure valid JSON with formatting
        const gameState = JSON.parse(saved);
        const jsonString = JSON.stringify(gameState, null, 2);

        // Create a blob with the JSON data
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create a temporary download link
        const link = document.createElement('a');
        const timestamp = new Date(gameState.timestamp || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `diggy-diggy-save-${gameState.version || 'unknown'}-${timestamp}.json`;

        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('Save exported successfully:', filename);
        alert('Save file exported successfully!');
    } catch (e) {
        console.error('Failed to export save:', e);
        alert('Failed to export save file. Check the console for details.');
    }
}

/**
 * Imports a game state from an uploaded JSON file
 */
window.importSave = function() {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const contents = e.target.result;
                const gameState = JSON.parse(contents);

                // Validate that this is a Diggy Diggy save file
                if (!gameState.version || !gameState.grid || !gameState.dwarfs) {
                    alert('Invalid save file. This does not appear to be a Diggy Diggy save.');
                    return;
                }

                // Check version compatibility
                if (gameState.version !== gameversion) {
                    const userConfirm = confirm(
                        `Version mismatch!\n\n` +
                        `Save file version: ${gameState.version}\n` +
                        `Current game version: ${gameversion}\n\n` +
                        `Loading a save from a different version may cause issues or data loss.\n\n` +
                        `Do you want to continue anyway?`
                    );

                    if (!userConfirm) {
                        console.log('Import cancelled by user due to version mismatch');
                        return;
                    }

                    console.warn(`Importing save with version mismatch: ${gameState.version} -> ${gameversion}`);
                }

                // Final confirmation before overwriting current save
                const finalConfirm = confirm(
                    'This will replace your current saved game.\n\n' +
                    'Are you sure you want to import this save file?'
                );

                if (!finalConfirm) {
                    console.log('Import cancelled by user');
                    return;
                }

                // Save to localStorage
                localStorage.setItem('diggyDiggyGameState', JSON.stringify(gameState));

                console.log('Save imported successfully from version', gameState.version);
                alert('Save file imported successfully! The page will reload to apply the new save.');

                // Reload the page to apply the imported save
                location.reload();

            } catch (e) {
                console.error('Failed to import save:', e);
                alert('Failed to import save file. The file may be corrupted or invalid.\n\nError: ' + e.message);
            }
        };

        reader.onerror = function() {
            console.error('Failed to read file');
            alert('Failed to read the file. Please try again.');
        };

        reader.readAsText(file);
    });

    // Trigger file selection dialog
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}
