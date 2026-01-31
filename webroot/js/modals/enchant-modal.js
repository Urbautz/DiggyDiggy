/**
 * Enchant Modal
 * Handles tool enchantment interface with slider for enchantment levels
 */

// Store current tool ID for the confirm action
let currentEnchantToolId = null;

/**
 * Opens the enchant modal for a specific tool
 * @param {number} toolId - The ID of the tool to enchant
 */
function openEnchantModal(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        console.error('Tool not found:', toolId);
        return;
    }

    const enchantResearch = researchData['tool-enchanting'];
    const maxEnchantLevel = enchantResearch ? enchantResearch.level : 0;

    if (maxEnchantLevel === 0) {
        alert('You need to research Tool Enchanting first!');
        return;
    }

    currentEnchantToolId = toolId;
    openModal('enchant-modal');
    populateEnchantModal(tool, maxEnchantLevel);
}

/**
 * Populates the enchant modal with tool info and controls
 * @param {Object} tool - The tool to enchant
 * @param {number} maxEnchantLevel - Maximum enchantment level available
 */
function populateEnchantModal(tool, maxEnchantLevel) {
    const toolName = tool.name || `${tool.type} #${tool.id}`;
    const toolPower = tool.power || tool.level || 0;

    // Populate tool info
    const nameEl = document.getElementById('enchant-tool-name');
    const powerEl = document.getElementById('enchant-tool-power');
    if (nameEl) nameEl.textContent = `🔨 ${toolName}`;
    if (powerEl) powerEl.textContent = toolPower;

    // Configure slider
    const slider = document.getElementById('enchant-level-slider');
    const maxLabel = document.getElementById('enchant-max-level-label');
    if (slider) {
        slider.max = maxEnchantLevel;
        slider.value = 1;
    }
    if (maxLabel) maxLabel.textContent = `Level ${maxEnchantLevel}`;

    updateEnchantPreview();
}

/**
 * Updates the enchantment preview when slider changes
 */
function updateEnchantPreview() {
    const slider = document.getElementById('enchant-level-slider');
    const display = document.getElementById('enchant-level-display');
    const powerValue = document.getElementById('enchant-power-value');
    const costValue = document.getElementById('enchant-cost-value');
    const warning = document.getElementById('enchant-warning');
    const btn = document.getElementById('confirm-enchant-btn');

    if (!slider) return;

    const enchantLevel = parseInt(slider.value);

    // Update level display
    if (display) display.textContent = `Level ${enchantLevel}`;

    // Calculate cost using the formula: baseCost * level * (multiplier ^ (level - 1))
    const cost = Math.round(ENCHANT_BASE_COST * enchantLevel * Math.pow(ENCHANT_COST_MULTIPLIER, enchantLevel - 1));
    const canAfford = gold >= cost;

    // Update preview values
    if (powerValue) powerValue.textContent = `+${enchantLevel}`;
    if (costValue) {
        costValue.textContent = `${formatNumber(cost, 'gold')} 💰`;
        costValue.classList.toggle('cannot-afford', !canAfford);
    }

    // Show/hide warning
    if (warning) warning.hidden = canAfford;

    // Update button state
    if (btn) {
        btn.disabled = !canAfford;
    }
}

/**
 * Confirms and applies the enchantment to the tool
 */
function confirmEnchant() {
    const tool = toolsInventory.find(t => t.id === currentEnchantToolId);
    if (!tool) {
        alert('Tool not found!');
        return;
    }

    const slider = document.getElementById('enchant-level-slider');
    if (!slider) return;

    const enchantLevel = parseInt(slider.value);
    const cost = Math.round(ENCHANT_BASE_COST * enchantLevel * Math.pow(ENCHANT_COST_MULTIPLIER, enchantLevel - 1));

    if (gold < cost) {
        alert(`Not enough gold! Need ${formatNumber(cost, 'gold')}, have ${formatNumber(gold, 'gold')}.`);
        return;
    }

    // Deduct gold
    gold -= cost;
    pendingGoldDelta -= cost;  // Track for sync reconciliation
    goldSyncToken++;  // Increment sync token
    logTransaction('expense', cost, `Enchanted ${tool.name || tool.type} to level ${enchantLevel}`);
    updateGoldDisplay();

    // Apply enchantment
    tool.enchantLevel = enchantLevel;

    // Sync to worker (include gold to ensure it's synced)
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gold, goldSyncToken }
        });
    }

    // Save game
    saveGame();

    // Close modal and refresh UI
    closeModal('enchant-modal');
    currentEnchantToolId = null;
    populateToolsInPanel();
}
