/**
 * Sell Modal
 * Handles individual material selling with slider interface
 */

/**
 * Opens the sell modal for a specific material
 * @param {string} materialId - The material ID to sell
 */
function openSellModal(materialId) {
    const material = getMaterialById(materialId);
    const availableStock = materialsStock[materialId] || 0;

    if (!material || availableStock === 0) {
        console.warn(`Cannot sell ${materialId}: not found or no stock`);
        return;
    }

    // Calculate trade bonus
    const betterTrading = getResearchLevel('trading');
    const tradeBonus = 1 + betterTrading * RESEARCH_TRADING_BONUS;

    // Apply price negotiations bonus (1% per wisdom level of highest wisdom dwarf)
    const priceNegotiationsLevel = getResearchLevel('price-negotiations');
    const negotiationsBonus = priceNegotiationsLevel > 0 ? (1 + getHighestDwarfWisdom() * RESEARCH_PRICE_NEGOTIATIONS_BONUS) : 1;

    const totalTradeBonus = tradeBonus * negotiationsBonus;
    const unitPrice = material.worth * totalTradeBonus;

    // Update modal title
    const title = document.getElementById('sell-modal-title');
    if (title) title.textContent = `💰 Sell ${material.name}`;

    // Update info fields
    const availableEl = document.getElementById('sell-available');
    if (availableEl) availableEl.textContent = formatNumber(availableStock, 'material');

    const unitPriceEl = document.getElementById('sell-unit-price');
    if (unitPriceEl) unitPriceEl.textContent = formatNumber(unitPrice, 'gold');

    const tradeBonusEl = document.getElementById('sell-trade-bonus');
    if (tradeBonusEl) tradeBonusEl.textContent = `+${Math.round((totalTradeBonus - 1) * 100)}%`;

    // Setup slider
    const slider = document.getElementById('sell-amount-slider');
    const amountDisplay = document.getElementById('sell-amount-display');
    const sliderMin = document.getElementById('sell-slider-min');
    const sliderMax = document.getElementById('sell-slider-max');
    const totalValueEl = document.getElementById('sell-total-value');
    const totalContainer = totalValueEl?.parentElement;

    if (slider) {
        // Calculate appropriate step size based on available stock
        // Ensure step size allows selecting the exact available stock
        let stepSize;

        // Count decimal places in available stock
        const stockStr = availableStock.toString();
        const decimalIndex = stockStr.indexOf('.');
        const decimalPlaces = decimalIndex === -1 ? 0 : stockStr.length - decimalIndex - 1;

        // Use step size that matches precision needed
        if (decimalPlaces >= 3 || availableStock < 0.01) {
            stepSize = Math.pow(10, -Math.max(3, decimalPlaces)); // At least 0.001, more if needed
        } else if (decimalPlaces === 2 || availableStock < 1) {
            stepSize = 0.01;
        } else if (decimalPlaces === 1 || availableStock < 100) {
            stepSize = 0.1;
        } else {
            stepSize = 1;
        }

        // Set minimum to step size or available stock (whichever is smaller)
        const minValue = Math.min(stepSize, availableStock);
        slider.min = minValue.toString();
        slider.max = availableStock.toString();
        slider.value = availableStock.toString(); // Start at max (sell all)
        slider.step = stepSize.toString();

        if (sliderMin) sliderMin.textContent = formatNumber(minValue, 'material');
        if (sliderMax) sliderMax.textContent = formatNumber(availableStock, 'material');

        // Set material color as background for total value
        if (totalContainer) {
            totalContainer.style.background = `linear-gradient(135deg, ${material.color}, ${material.color}dd)`;
        }

        // Update display function - gets current slider value from DOM
        const updateDisplay = () => {
            const currentSlider = document.getElementById('sell-amount-slider');
            const amount = parseFloat(currentSlider.value);
            if (amountDisplay) amountDisplay.textContent = formatNumber(amount, 'material');
            if (totalValueEl) {
                const totalValue = unitPrice * amount;
                totalValueEl.textContent = formatNumber(totalValue, 'gold') + ' 💰';
            }
        };

        // Remove old event listeners by cloning
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);

        // Add event listener to the new slider
        newSlider.addEventListener('input', updateDisplay);

        // Initial update
        updateDisplay();
    }

    // Setup button handler
    const sellSelectedBtn = document.getElementById('sell-selected-btn');

    if (sellSelectedBtn) {
        sellSelectedBtn.onclick = () => {
            const amount = parseFloat(document.getElementById('sell-amount-slider').value);
            sellMaterial(materialId, amount);
            closeModal('sell-modal');
        };
    }

    // Open modal
    openModal('sell-modal');
}

/**
 * Executes the sale of materials
 * @param {string} materialId - The material ID to sell
 * @param {number} amount - The amount to sell
 */
function sellMaterial(materialId, amount) {
    console.log('sellMaterial called:', materialId, amount);
    if (!materialsStock[materialId] || materialsStock[materialId] < amount) {
        console.warn(`Not enough ${materialId} to sell`);
        return;
    }

    const material = getMaterialById(materialId);
    if (!material) {
        console.warn(`Material ${materialId} not found`);
        return;
    }

    // Apply better-trading research bonus (3% per level)
    const betterTrading = getResearchLevel('trading');
    const tradeBonus = 1 + betterTrading * RESEARCH_TRADING_BONUS;

    // Apply price negotiations bonus (1% per wisdom level of highest wisdom dwarf)
    const priceNegotiationsLevel = getResearchLevel('price-negotiations');
    const negotiationsBonus = priceNegotiationsLevel > 0 ? (1 + getHighestDwarfWisdom() * RESEARCH_PRICE_NEGOTIATIONS_BONUS) : 1;

    const totalTradeBonus = tradeBonus * negotiationsBonus;

    // Calculate earnings with trade bonus
    const earnings = material.worth * amount * totalTradeBonus;

    // Update stock and gold
    materialsStock[materialId] -= amount;
    gold += earnings;

    // Log transaction
    logTransaction('income', earnings, `Sold ${amount}x ${material.name}`);

    // Update the worker's state with new values
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                materialsStock: materialsStock,
                gold: gold,
                toolsInventory: toolsInventory
            }
        });
    }

    // Update UI
    updateGoldDisplay();
    updateMaterialsPanel(); // Refresh warehouse panel after selling

    // Save game
    saveGame();

    console.log(`Sold ${amount} ${material.name} for ${formatNumber(earnings, 'gold')} gold (${formatNumber(tradeBonus, 'material')}x bonus)`);
}
