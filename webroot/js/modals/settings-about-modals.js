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
