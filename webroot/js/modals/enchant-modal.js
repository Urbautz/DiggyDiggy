/**
 * Enchant Modal
 * Handles tool enchantment interface with slider for enchantment levels
 */

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

    const enchantResearch = researchtree.find(r => r.id === 'tool-enchanting');
    const maxEnchantLevel = enchantResearch ? enchantResearch.level : 0;

    if (maxEnchantLevel === 0) {
        alert('You need to research Tool Enchanting first!');
        return;
    }

    openModal('enchant-modal');
    populateEnchantModal(tool, maxEnchantLevel);
}

/**
 * Populates the enchant modal with tool info and controls
 * @param {Object} tool - The tool to enchant
 * @param {number} maxEnchantLevel - Maximum enchantment level available
 */
function populateEnchantModal(tool, maxEnchantLevel) {
    const container = document.getElementById('enchant-content');
    if (!container) return;

    const toolName = tool.name || `${tool.type} #${tool.id}`;
    const toolPower = tool.power || tool.level || 0;

    container.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0;">🔨 ${toolName}</h3>
            <p style="margin: 0; color: #9fbfe0; font-size: 13px;">Current Power: ${toolPower}</p>
        </div>

        <div style="margin-bottom: 16px; padding: 12px; background: rgba(138, 43, 226, 0.1); border: 1px solid rgba(138, 43, 226, 0.3); border-radius: 6px;">
            <label for="enchant-level-slider" style="display: block; margin-bottom: 8px; font-weight: 600;">Enchantment Level:</label>
            <input type="range" id="enchant-level-slider" min="1" max="${maxEnchantLevel}" value="1"
                   style="width: 100%; margin-bottom: 8px;"
                   oninput="updateEnchantPreview()">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #9fbfe0;">
                <span>Level 1</span>
                <span id="enchant-level-display" style="font-weight: bold; color: #dda0ff;">Level 1</span>
                <span>Level ${maxEnchantLevel}</span>
            </div>
        </div>

        <div id="enchant-preview" style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <!-- Preview will be populated by updateEnchantPreview() -->
        </div>

        <button id="confirm-enchant-btn" class="btn-primary" style="width: 100%; padding: 10px; font-size: 14px; font-weight: bold;"
                onclick="confirmEnchant(${tool.id})">
            ✨ Enchant Tool
        </button>
    `;

    updateEnchantPreview();
}

/**
 * Updates the enchantment preview when slider changes
 */
function updateEnchantPreview() {
    const slider = document.getElementById('enchant-level-slider');
    const display = document.getElementById('enchant-level-display');
    const preview = document.getElementById('enchant-preview');

    if (!slider || !display || !preview) return;

    const enchantLevel = parseInt(slider.value);
    display.textContent = `Level ${enchantLevel}`;

    // Calculate cost using the formula: baseCost * (multiplier ^ (level - 1))
    const cost = Math.round(ENCHANT_BASE_COST * Math.pow(ENCHANT_COST_MULTIPLIER, enchantLevel - 1));
    const canAfford = gold >= cost;

    preview.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #e6eefc;">Enchantment Power:</span>
            <span style="color: #dda0ff; font-weight: bold;">+${enchantLevel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #e6eefc;">Gold Cost:</span>
            <span style="color: ${canAfford ? '#ffd700' : '#ff6b6b'}; font-weight: bold;">${cost} 💰</span>
        </div>
        ${!canAfford ? '<p style="color: #ff6b6b; margin: 8px 0 0 0; font-size: 12px;">⚠️ Not enough gold!</p>' : ''}
    `;

    // Update button state
    const btn = document.getElementById('confirm-enchant-btn');
    if (btn) {
        btn.disabled = !canAfford;
        btn.style.opacity = canAfford ? '1' : '0.5';
        btn.style.cursor = canAfford ? 'pointer' : 'not-allowed';
    }
}

/**
 * Confirms and applies the enchantment to the tool
 * @param {number} toolId - The ID of the tool to enchant
 */
function confirmEnchant(toolId) {
    const tool = toolsInventory.find(t => t.id === toolId);
    if (!tool) {
        alert('Tool not found!');
        return;
    }

    const slider = document.getElementById('enchant-level-slider');
    if (!slider) return;

    const enchantLevel = parseInt(slider.value);
    const cost = Math.round(ENCHANT_BASE_COST * Math.pow(ENCHANT_COST_MULTIPLIER, enchantLevel - 1));

    if (gold < cost) {
        alert(`Not enough gold! Need ${formatNumber(cost, 'gold')}, have ${formatNumber(gold, 'gold')}.`);
        return;
    }

    // Deduct gold
    gold -= cost;
    logTransaction('expense', cost, `Enchanted ${tool.name || tool.type} to level ${enchantLevel}`);
    updateGoldDisplay();

    // Apply enchantment
    tool.enchantLevel = enchantLevel;

    // Sync to worker (include gold to ensure it's synced)
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { toolsInventory, gold }
        });
    }

    // Save game
    saveGame();

    // Close modal and refresh UI
    closeModal('enchant-modal');
    populateToolsInPanel(); // Refresh tools panel to show enchantment

    // Show success message
    alert(`✨ Tool enchanted to level ${enchantLevel}!\n\nThe tool now has +${enchantLevel} enchantment power.`);
}
