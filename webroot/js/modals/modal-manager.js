/**
 * Modal Manager
 * Handles loading and initialization of modal HTML templates
 */

class ModalManager {
    constructor() {
        this.modals = [
            'dwarfs-modal',
            'forge-modal',
            'forging-animation-modal',
            'enchant-modal',
            'gem-modal',
            'levelup-modal',
            'research-modal',
            'smelter-modal',
            'task-details-modal',
            'transactions-modal',
            'settings-modal',
            'gems-modal',
            'sell-modal',
            'warehouse-sell-modal',
            'about-modal'
        ];
        this.loadedModals = new Set();
        this.loadPromises = new Map();
    }

    /**
     * Initialize all modals by loading their HTML
     */
    async initializeAll() {
        const loadPromises = this.modals.map(modalName => this.loadModal(modalName));
        await Promise.all(loadPromises);
        console.log('All modals loaded successfully');

        // Dispatch event to notify that modals are ready
        window.dispatchEvent(new CustomEvent('modalsLoaded'));
    }

    /**
     * Load a single modal HTML file
     * @param {string} modalName - The name of the modal (e.g., 'dwarfs-modal')
     */
    async loadModal(modalName) {
        // Return existing promise if already loading
        if (this.loadPromises.has(modalName)) {
            return this.loadPromises.get(modalName);
        }

        // Return immediately if already loaded
        if (this.loadedModals.has(modalName)) {
            return Promise.resolve();
        }

        const loadPromise = (async () => {
            try {
                const response = await fetch(`modals/${modalName}.html`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${modalName}: ${response.statusText}`);
                }

                const html = await response.text();

                // Create a temporary container to parse the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // Append the modal to the body
                document.body.appendChild(tempDiv.firstElementChild);

                this.loadedModals.add(modalName);
                console.log(`Modal loaded: ${modalName}`);
            } catch (error) {
                console.error(`Error loading modal ${modalName}:`, error);
                throw error;
            } finally {
                this.loadPromises.delete(modalName);
            }
        })();

        this.loadPromises.set(modalName, loadPromise);
        return loadPromise;
    }

    /**
     * Load a modal on-demand (lazy loading)
     * @param {string} modalName - The name of the modal to load
     */
    async ensureLoaded(modalName) {
        if (!this.loadedModals.has(modalName)) {
            await this.loadModal(modalName);
        }
    }
}

// Create global instance
window.modalManager = new ModalManager();

// Initialize all modals when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.modalManager.initializeAll();
    });
} else {
    window.modalManager.initializeAll();
}
