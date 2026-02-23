/**
 * Forge Modal
 * Handles forge interface, forging process, gem setting, and tool inventory display
 */

// Track if player has successfully forged a tool with 100+ hardness material
let hasForgedHighHardnessTool = false;

// Forge state - tracks the current forging process
let forgeState = {
    baseMaterial: null,      // Selected ingot material
    hammeringCount: 1,       // 1-10 iterations
    coolingOilQuality: 1,    // 1-25 quality
    platingMaterial: '',     // Selected plating material (optional)
    handleQuality: 1,        // 1-100 quality
    retryCount: 1,           // 1-stock amount
    skipAnimation: false     // Skip forging animation
};

/**
 * Utility function for async sleep/delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Opens the forge modal
 */
function openForge() {
    // Check if forge research is unlocked
    const forgeResearch = researchData['forge'];
    const isForgeUnlocked = forgeResearch && (forgeResearch.level || 0) >= 1;

    if (!isForgeUnlocked) {
        return;
    }

    openModal('forge-modal');
    populateForge();
}

/**
 * Populate the forge modal
 */
function populateForge() {
    const container = document.getElementById('forge-content');
    if (!container) return;

    container.innerHTML = '';

    // Create forge interface directly (no tabs)
    createForgeInterface(container);

    // Restore previous forge state settings
    restoreForgeState();

    // Show/hide skip animation checkbox based on whether player has forged high hardness tool
    const skipAnimationContainer = document.getElementById('skip-animation-container');
    if (skipAnimationContainer) {
        skipAnimationContainer.style.display = hasForgedHighHardnessTool ? 'block' : 'none';
    }
}

/**
 * Create the forge interface
 */
function createForgeInterface(container) {
    // Expected outcomes section at the top
    const outcomes = document.createElement('div');
    outcomes.className = 'forge-outcomes forge-outcomes-top';
    outcomes.innerHTML = `
        <h3>Expected Outcomes</h3>
        <div class="outcome-row">
            <span class="outcome-label">Total Cost:</span>
            <span id="total-forge-cost" class="outcome-value">0 💰</span>
        </div>
        <div class="outcome-row">
            <span class="outcome-label">Success Probability:</span>
            <span id="success-probability" class="outcome-value">0%</span>
        </div>
        <div class="outcome-row">
            <span class="outcome-label">Expected Quality (if successful):</span>
            <span id="expected-quality" class="outcome-value">-</span>
        </div>
    `;
    container.appendChild(outcomes);

    // Step 1: Heat Material
    const step1 = document.createElement('div');
    step1.className = 'forge-step';
    step1.innerHTML = `
        <h3>Step 1: Heat Material</h3>
        <label for="base-material">Select Base Material (Ingot):</label>
        <select id="base-material">
            <option value="">-- Select Ingot --</option>
        </select>
    `;
    container.appendChild(step1);

    // Populate ingot dropdown with hardness and stock info
    const materialSelect = step1.querySelector('#base-material');
    // Filter materials that can be used as forge base materials
    const ingots = [];
    for (const [id, mat] of Object.entries(materials)) {
        if (mat.forge === 'Base') {
            ingots.push({ id, ...mat });
        }
    }
    for (const ingot of ingots) {
        const stockAmount = materialsStock[ingot.id] || 0;
        const option = document.createElement('option');
        option.value = ingot.id;
        option.textContent = `${ingot.name} (Hardness: ${ingot.hardness}, Stock: ${stockAmount})`;
        option.dataset.hardness = ingot.hardness;
        option.disabled = stockAmount <= 0;
        if (stockAmount <= 0) {
            option.textContent += ' - OUT OF STOCK';
        }
        materialSelect.appendChild(option);
    }

    // Step 2: Hammering
    const step2 = document.createElement('div');
    step2.className = 'forge-step';
    step2.innerHTML = `
        <h3>Step 2: Hammering</h3>
        <label for="hammering-slider">Hammering Iterations: <span id="hammering-value">1</span></label>
        <input type="range" id="hammering-slider" min="1" max="${FORGE_HAMMERING_MAX_ITERATIONS}" value="1" step="1">
        <p class="forge-warning">⚠️ There is a ${((1 - FORGE_HAMMERING_SUCCESS_RATE) * 100).toFixed(0)}% chance to destroy the material during each iteration, but the outcome quality will improve with more iterations.</p>
    `;
    container.appendChild(step2);

    // Step 3: Cooling
    const step3 = document.createElement('div');
    step3.className = 'forge-step';
    step3.innerHTML = `
        <h3>Step 3: Cooling</h3>
        <label for="cooling-slider">Cooling Oil Quality: <span id="cooling-value">1</span> (Cost: <span id="cooling-cost">0</span> 💰) <span id="cooling-affordable" class="affordability-indicator"></span></label>
        <input type="range" id="cooling-slider" min="1" max="${FORGE_COOLING_MAX_QUALITY}" value="1" step="1">
        <p class="forge-warning">⚠️ ${(FORGE_COOLING_BASE_BRITTLE_CHANCE * 100).toFixed(0)}% chance the material will become brittle when cooling. Better coolant will decrease this probability.</p>
    `;
    container.appendChild(step3);

    // Step 4: Sharpening
    const step4 = document.createElement('div');
    step4.className = 'forge-step';
    step4.innerHTML = `
        <h3>Step 4: Sharpening</h3>
        <p class="forge-info">This will improve the sharpness of the item - or make it worse, good luck!</p>
    `;
    container.appendChild(step4);

    // Step 5: Plating (optional)
    const step5 = document.createElement('div');
    step5.className = 'forge-step';
    step5.innerHTML = `
        <h3>Step 5: Plating (Optional)</h3>
        <label for="plating-material">Select Plating Material:</label>
        <select id="plating-material">
            <option value="">-- No Plating --</option>
        </select>
        <p id="plating-description" class="forge-info"></p>
    `;
    container.appendChild(step5);

    // Populate plating dropdown with available plating materials
    const platingSelect = step5.querySelector('#plating-material');
    const platingMaterials = [];
    for (const [id, mat] of Object.entries(materials)) {
        if (mat.forge === 'Plating') {
            platingMaterials.push({ id, ...mat });
        }
    }
    for (const plating of platingMaterials) {
        const stockAmount = materialsStock[plating.id] || 0;
        const option = document.createElement('option');
        option.value = plating.id;
        option.textContent = `${plating.name} (Stock: ${stockAmount})`;
        option.disabled = stockAmount <= 0;
        if (stockAmount <= 0) {
            option.textContent += ' - OUT OF STOCK';
        }
        platingSelect.appendChild(option);
    }

    // Step 6: Mount Handle
    const stepHandle = document.createElement('div');
    stepHandle.className = 'forge-step';
    stepHandle.innerHTML = `
        <h3>Step 6: Mount Handle</h3>
        <label for="handle-slider">Handle Quality: <span id="handle-value">1</span> (Cost: <span id="handle-cost">${FORGE_HANDLE_BASE_COST}</span> 💰) <span id="handle-affordable" class="affordability-indicator"></span></label>
        <input type="range" id="handle-slider" min="1" max="${FORGE_HANDLE_MAX_QUALITY}" value="1" step="1">
        <p class="forge-info">The handle determines comfort and durability. Better handles improve the overall tool quality.</p>
    `;
    container.appendChild(stepHandle);

    // Step 7: Retries
    const stepRetry = document.createElement('div');
    stepRetry.className = 'forge-step';
    stepRetry.innerHTML = `
        <h3>Step 7: Retry Attempts</h3>
        <label for="retry-slider">Number of Retries: <span id="retry-value">1</span> (Max: <span id="retry-max">1</span> based on stock)</label>
        <input type="range" id="retry-slider" min="1" max="1" value="1" step="1">
        <p class="forge-info">If forging fails, automatically retry with another ingot. Limited by available stock.</p>
        <div id="skip-animation-container" style="display: none; margin-top: 10px;">
            <label>
                <input type="checkbox" id="skip-animation-checkbox">
                Skip animation
            </label>
        </div>
    `;
    container.appendChild(stepRetry);

    // Forge button
    const forgeAction = document.createElement('div');
    forgeAction.className = 'forge-action';
    forgeAction.innerHTML = `
        <button id="forge-button" class="btn-primary" disabled>Forge Tool</button>
    `;
    container.appendChild(forgeAction);

    // Wire up event listeners
    setupForgeListeners();
}

/**
 * Set up event listeners for forge controls
 */
function setupForgeListeners() {
    const materialSelect = document.getElementById('base-material');
    const hammeringSlider = document.getElementById('hammering-slider');
    const coolingSlider = document.getElementById('cooling-slider');
    const platingSelect = document.getElementById('plating-material');
    const handleSlider = document.getElementById('handle-slider');
    const retrySlider = document.getElementById('retry-slider');
    const skipAnimationCheckbox = document.getElementById('skip-animation-checkbox');

    if (materialSelect) {
        materialSelect.addEventListener('change', updateForgeState);
    }
    if (hammeringSlider) {
        hammeringSlider.addEventListener('input', updateForgeState);
    }
    if (coolingSlider) {
        coolingSlider.addEventListener('input', updateForgeState);
    }
    if (platingSelect) {
        platingSelect.addEventListener('change', updateForgeState);
    }
    if (handleSlider) {
        handleSlider.addEventListener('input', updateForgeState);
    }
    if (retrySlider) {
        retrySlider.addEventListener('input', updateForgeState);
    }
    if (skipAnimationCheckbox) {
        skipAnimationCheckbox.addEventListener('change', updateForgeState);
    }
}

/**
 * Restore forge state to UI elements
 */
function restoreForgeState() {
    const materialSelect = document.getElementById('base-material');
    const hammeringSlider = document.getElementById('hammering-slider');
    const coolingSlider = document.getElementById('cooling-slider');
    const platingSelect = document.getElementById('plating-material');
    const handleSlider = document.getElementById('handle-slider');
    const retrySlider = document.getElementById('retry-slider');
    const skipAnimationCheckbox = document.getElementById('skip-animation-checkbox');

    // Restore material selection
    if (materialSelect && forgeState.baseMaterial) {
        materialSelect.value = forgeState.baseMaterial;
    }

    // Restore slider values
    if (hammeringSlider) {
        hammeringSlider.value = forgeState.hammeringCount;
    }
    if (coolingSlider) {
        coolingSlider.value = forgeState.coolingOilQuality;
    }
    if (platingSelect && forgeState.platingMaterial) {
        platingSelect.value = forgeState.platingMaterial;
    }
    if (handleSlider) {
        handleSlider.value = forgeState.handleQuality;
    }
    if (retrySlider) {
        retrySlider.value = forgeState.retryCount;
    }
    if (skipAnimationCheckbox) {
        skipAnimationCheckbox.checked = forgeState.skipAnimation;
    }

    // Update UI to reflect restored state
    updateForgeState();
}

/**
 * Update the forge state and UI based on current selections
 */
function updateForgeState() {
    // Get current selections
    const materialSelect = document.getElementById('base-material');
    const hammeringSlider = document.getElementById('hammering-slider');
    const coolingSlider = document.getElementById('cooling-slider');
    const handleSlider = document.getElementById('handle-slider');
    const retrySlider = document.getElementById('retry-slider');

    // Update forge state
    if (materialSelect) {
        forgeState.baseMaterial = materialSelect.value;

        // Update retry slider max based on stock
        if (retrySlider && forgeState.baseMaterial) {
            const stockAmount = materialsStock[forgeState.baseMaterial] || 0;
            const maxRetries = Math.max(1, stockAmount);
            retrySlider.max = maxRetries;
            const retryMax = document.getElementById('retry-max');
            if (retryMax) {
                retryMax.textContent = maxRetries;
            }
            // Reset retry value if it exceeds new max
            if (parseInt(retrySlider.value) > maxRetries) {
                retrySlider.value = maxRetries;
            }
        }
    }

    if (hammeringSlider) {
        forgeState.hammeringCount = parseInt(hammeringSlider.value);
        const hammeringValue = document.getElementById('hammering-value');
        if (hammeringValue) {
            hammeringValue.textContent = forgeState.hammeringCount;
        }
    }

    if (coolingSlider) {
        forgeState.coolingOilQuality = parseInt(coolingSlider.value);
        const coolingValue = document.getElementById('cooling-value');
        const coolingCost = document.getElementById('cooling-cost');
        const coolingAffordable = document.getElementById('cooling-affordable');
        if (coolingValue) {
            coolingValue.textContent = forgeState.coolingOilQuality;
        }
        if (coolingCost) {
            // Calculate cooling oil cost: level 1 = 0, level 2 = 500, increasing by 25% each level
            const cost = forgeState.coolingOilQuality === 1 ? 0 : 500 * Math.pow(1.25, forgeState.coolingOilQuality - 2);
            coolingCost.textContent = formatNumber(cost, 'gold');

            // Show affordability indicator
            if (coolingAffordable) {
                if (gold >= cost) {
                    coolingAffordable.textContent = '✓';
                    coolingAffordable.className = 'affordability-indicator affordable';
                } else {
                    coolingAffordable.textContent = '✗';
                    coolingAffordable.className = 'affordability-indicator not-affordable';
                }
            }
        }
    }

    // Update plating material and description
    const platingSelect = document.getElementById('plating-material');
    if (platingSelect) {
        forgeState.platingMaterial = platingSelect.value;
        const platingDescription = document.getElementById('plating-description');
        if (platingDescription) {
            if (forgeState.platingMaterial && platingEffects[forgeState.platingMaterial]) {
                const effect = platingEffects[forgeState.platingMaterial];
                platingDescription.textContent = `Effect: ${effect.description}`;
                platingDescription.className = 'forge-info plating-effect';
            } else {
                platingDescription.textContent = '';
                platingDescription.className = 'forge-info';
            }
        }
    }

    if (handleSlider) {
        forgeState.handleQuality = parseInt(handleSlider.value);
        const handleValue = document.getElementById('handle-value');
        const handleCost = document.getElementById('handle-cost');
        const handleAffordable = document.getElementById('handle-affordable');
        if (handleValue) {
            handleValue.textContent = forgeState.handleQuality;
        }
        if (handleCost) {
            // Calculate handle cost: level 1 = 100, increasing by 15% each level
            const cost = 100 * Math.pow(1.15, forgeState.handleQuality - 1);
            handleCost.textContent = formatNumber(cost, 'gold');

            // Show affordability indicator
            if (handleAffordable) {
                if (gold >= cost) {
                    handleAffordable.textContent = '✓';
                    handleAffordable.className = 'affordability-indicator affordable';
                } else {
                    handleAffordable.textContent = '✗';
                    handleAffordable.className = 'affordability-indicator not-affordable';
                }
            }
        }
    }

    if (retrySlider) {
        forgeState.retryCount = parseInt(retrySlider.value);
        const retryValue = document.getElementById('retry-value');
        if (retryValue) {
            retryValue.textContent = forgeState.retryCount;
        }
    }

    // Update skip animation checkbox state
    const skipAnimationCheckbox = document.getElementById('skip-animation-checkbox');
    if (skipAnimationCheckbox) {
        forgeState.skipAnimation = skipAnimationCheckbox.checked;
    }

    // Calculate and display total cost
    const totalCostDisplay = document.getElementById('total-forge-cost');
    const forgeButton = document.getElementById('forge-button');

    if (totalCostDisplay) {
        const coolingCost = forgeState.coolingOilQuality === 1 ? 0 : FORGE_COOLING_BASE_COST * Math.pow(FORGE_COOLING_COST_MULTIPLIER, forgeState.coolingOilQuality - 2);
        const handleCost = FORGE_HANDLE_BASE_COST * Math.pow(FORGE_HANDLE_COST_MULTIPLIER, forgeState.handleQuality - 1);
        // Plating doesn't cost gold, just consumes 1 ingot
        const totalCost = coolingCost + handleCost;
        totalCostDisplay.textContent = `${formatNumber(totalCost, 'gold')} 💰`;

        // Calculate success probability
        // Base: 90% chance to survive hammering per iteration
        const hammeringSuccessRate = Math.pow(FORGE_HAMMERING_SUCCESS_RATE, forgeState.hammeringCount);

        // Cooling: 70% base success rate, improved by coolant quality
        // Each level reduces brittleness chance by ~1.2%
        const coolingBrittleChance = Math.max(0, FORGE_COOLING_BASE_BRITTLE_CHANCE - (forgeState.coolingOilQuality - 1) * FORGE_COOLING_BRITTLE_REDUCTION_PER_QUALITY);
        const coolingSuccessRate = 1 - coolingBrittleChance;

        // Overall success probability
        const totalSuccessRate = hammeringSuccessRate * coolingSuccessRate;

        // Calculate expected quality (simplified model)
        // Quality improves with: base material hardness, hammering iterations, cooling oil quality, handle quality
        const baseQuality = FORGE_BASE_QUALITY;
        let materialHardness = 0;
        if (forgeState.baseMaterial) {
            const material = materials[forgeState.baseMaterial];
            materialHardness = material ? material.hardness : 0;
        }
        const hammeringBonus = forgeState.hammeringCount * FORGE_HAMMERING_BONUS_PER_ITERATION;
        const coolingBonus = forgeState.coolingOilQuality * FORGE_COOLING_BONUS_PER_QUALITY;
        const handleBonus = forgeState.handleQuality * FORGE_HANDLE_BONUS_PER_QUALITY;
        const expectedQuality = baseQuality + materialHardness + hammeringBonus + coolingBonus + handleBonus;

        // Update success probability display
        const successProbDisplay = document.getElementById('success-probability');
        if (successProbDisplay) {
            successProbDisplay.textContent = `${(totalSuccessRate * 100).toFixed(1)}%`;
            if (totalSuccessRate >= FORGE_SUCCESS_RATE_HIGH_THRESHOLD) {
                successProbDisplay.className = 'outcome-value success-high';
            } else if (totalSuccessRate >= FORGE_SUCCESS_RATE_MEDIUM_THRESHOLD) {
                successProbDisplay.className = 'outcome-value success-medium';
            } else {
                successProbDisplay.className = 'outcome-value success-low';
            }
        }

        // Update expected quality display
        const qualityDisplay = document.getElementById('expected-quality');
        if (qualityDisplay) {
            if (forgeState.baseMaterial) {
                qualityDisplay.textContent = formatNumber(expectedQuality, 'material');
            } else {
                qualityDisplay.textContent = '-';
            }
        }

        // Enable/disable forge button
        if (forgeButton) {
            if (forgeState.baseMaterial && gold >= totalCost) {
                forgeButton.disabled = false;
            } else {
                forgeButton.disabled = true;
            }
        }
    }
}

/**
 * Start the forging process with animation
 */
async function startForging() {
    // Validate we have material selected
    if (!forgeState.baseMaterial) {
        alert('Please select a base material first!');
        return;
    }

    // Check stock for base material
    const stockAmount = materialsStock[forgeState.baseMaterial] || 0;
    if (stockAmount < forgeState.retryCount) {
        alert(`Not enough ${forgeState.baseMaterial} in stock! Need ${forgeState.retryCount}, have ${stockAmount}.`);
        return;
    }

    // Check stock for plating material if selected
    if (forgeState.platingMaterial) {
        const platingStock = materialsStock[forgeState.platingMaterial] || 0;
        if (platingStock < forgeState.retryCount) {
            alert(`Not enough ${forgeState.platingMaterial} in stock! Need ${forgeState.retryCount} for plating, have ${platingStock}.`);
            return;
        }
    }

    // Calculate costs for validation
    const coolingCost = forgeState.coolingOilQuality === 1 ? 0 : FORGE_COOLING_BASE_COST * Math.pow(FORGE_COOLING_COST_MULTIPLIER, forgeState.coolingOilQuality - 2);
    const handleCost = FORGE_HANDLE_BASE_COST * Math.pow(FORGE_HANDLE_COST_MULTIPLIER, forgeState.handleQuality - 1);
    const totalCost = coolingCost + handleCost;

    // Check gold upfront
    if (gold < totalCost) {
        alert(`Not enough gold! Need ${formatNumber(totalCost, 'gold')}, have ${formatNumber(gold, 'gold')}.`);
        return;
    }

    // Costs will be deducted during the forging process:
    // - Cooling cost after successful hammering
    // - Handle cost before mounting handle

    // Close forge modal and show animation modal
    closeModal('forge-modal');
    openModal('forging-animation-modal');

    const animationContent = document.getElementById('forging-animation-content');
    animationContent.innerHTML = '<div class="forging-anvil">🔨</div><div class="forging-message">Forging...</div>';

    // Helper function to conditionally sleep based on skipAnimation setting
    const conditionalSleep = async (ms) => {
        if (!forgeState.skipAnimation) {
            await sleep(ms);
        }
    };

    // Try forging up to retryCount times
    let success = false;
    let finalQuality = 0;
    let attemptsUsed = 0;
    let failedAttempts = 0;
    let failureReasons = []; // Track why each attempt failed
    let qualityProgression = {}; // Track quality at each step for successful attempt

    for (let attempt = 0; attempt < forgeState.retryCount; attempt++) {
        attemptsUsed++;

        // Check if we have material
        if ((materialsStock[forgeState.baseMaterial] || 0) <= 0) {
            break;
        }

        // Consume material immediately
        materialsStock[forgeState.baseMaterial]--;

        // Update UI and sync immediately
        updateStockDisplay();
        saveGame();

        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: {
                    materialsStock: materialsStock
                }
            });
        }

        // Calculate quality components
        const material = materials[forgeState.baseMaterial];
        const materialHardness = material ? material.hardness : 0;
        const baseQuality = FORGE_BASE_QUALITY;
        const hammeringBonus = forgeState.hammeringCount * FORGE_HAMMERING_BONUS_PER_ITERATION;
        const coolingBonus = forgeState.coolingOilQuality * FORGE_COOLING_BONUS_PER_QUALITY;
        const handleBonus = forgeState.handleQuality * FORGE_HANDLE_BONUS_PER_QUALITY;

        let currentQuality = baseQuality + materialHardness;

        // Track initial quality
        qualityProgression = {
            initial: Math.round(currentQuality)
        };

        // Animate hammering
        const hammeringSteps = forgeState.hammeringCount;
        let hammeringFailed = false;
        for (let i = 0; i < hammeringSteps; i++) {
            animationContent.innerHTML = `<div class="forging-anvil shake">🔨</div><div class="forging-message">Hammering... (${i + 1}/${hammeringSteps})</div>`;
            await conditionalSleep(1200);

            // Check if material destroyed during hammering
            if (Math.random() > FORGE_HAMMERING_SUCCESS_RATE) {
                animationContent.innerHTML = `<div class="forging-anvil">💥</div><div class="forging-message forging-failure">Material destroyed during hammering!</div>`;
                await conditionalSleep(2000);
                hammeringFailed = true;
                failedAttempts++;
                failureReasons.push('Destroyed during hammering');
                break;
            }

            // Show completion of this hammer strike with quality
            const strikeQuality = Math.round(currentQuality + (i + 1) * FORGE_HAMMERING_BONUS_PER_ITERATION);
            animationContent.innerHTML = `<div class="forging-anvil">🔨</div><div class="forging-message">Hammering complete (${i + 1}/${hammeringSteps})</div><div class="forging-quality">Current Power: ${strikeQuality}</div>`;
            await conditionalSleep(800);
        }

        // Check if we broke during hammering
        if (hammeringFailed) {
            continue; // Try next attempt
        }

        currentQuality += hammeringBonus;
        qualityProgression.afterHammering = Math.round(currentQuality);

        // Show hammering success
        animationContent.innerHTML = `<div class="forging-anvil">✅</div><div class="forging-message forging-success">Hammering successful!</div><div class="forging-quality">Current Power: ${Math.round(currentQuality)}</div>`;
        await conditionalSleep(1000);

        // Deduct cooling cost (only after successful hammering)
        const coolingCost = forgeState.coolingOilQuality === 1 ? 0 : FORGE_COOLING_BASE_COST * Math.pow(FORGE_COOLING_COST_MULTIPLIER, forgeState.coolingOilQuality - 2);
        if (coolingCost > 0) {
            gold -= coolingCost;
            pendingGoldDelta -= coolingCost;  // Track for sync reconciliation
            goldSyncToken++;  // Increment sync token
            updateGoldDisplay();
            logTransaction('expense', coolingCost, 'Cooling oil for forging');
            saveGame();
            if (gameWorker && workerInitialized) {
                gameWorker.postMessage({
                    type: 'update-state',
                    data: { gold: gold, goldSyncToken: goldSyncToken }
                });
            }
        }

        // Cooling step
        animationContent.innerHTML = `<div class="forging-anvil shake">💧</div><div class="forging-message">Cooling...</div>`;
        await conditionalSleep(1800);

        const coolingBrittleChance = Math.max(0, FORGE_COOLING_BASE_BRITTLE_CHANCE - (forgeState.coolingOilQuality - 1) * FORGE_COOLING_BRITTLE_REDUCTION_PER_QUALITY);
        if (Math.random() < coolingBrittleChance) {
            animationContent.innerHTML = `<div class="forging-anvil">💔</div><div class="forging-message forging-failure">Material became brittle during cooling!</div>`;
            await conditionalSleep(2000);
            failedAttempts++;
            failureReasons.push('Became brittle during cooling');
            continue; // Try next attempt
        }

        currentQuality += coolingBonus;
        qualityProgression.afterCooling = Math.round(currentQuality);

        // Show cooling success
        animationContent.innerHTML = `<div class="forging-anvil">❄️</div><div class="forging-message forging-success">Cooling successful!</div><div class="forging-quality">Current Power: ${Math.round(currentQuality)}</div>`;
        await conditionalSleep(1200);

        // Plating step (optional)
        if (forgeState.platingMaterial) {
            // Consume plating material
            materialsStock[forgeState.platingMaterial]--;
            updateStockDisplay();
            saveGame();
            if (gameWorker && workerInitialized) {
                gameWorker.postMessage({
                    type: 'update-state',
                    data: { materialsStock: materialsStock }
                });
            }

            animationContent.innerHTML = `<div class="forging-anvil shake">✨</div><div class="forging-message">Applying plating...</div>`;
            await conditionalSleep(1800);

            // Get plating material name
            const platingMat = materials[forgeState.platingMaterial];
            const platingName = platingMat ? platingMat.name : forgeState.platingMaterial;

            // Show plating success
            animationContent.innerHTML = `<div class="forging-anvil">🌟</div><div class="forging-message forging-success">Plating applied!</div><div class="forging-quality">${platingName} plating complete</div>`;
            await conditionalSleep(1200);
        }

        // Deduct handle cost before mounting
        const handleCost = FORGE_HANDLE_BASE_COST * Math.pow(FORGE_HANDLE_COST_MULTIPLIER, forgeState.handleQuality - 1);
        gold -= handleCost;
        pendingGoldDelta -= handleCost;  // Track for sync reconciliation
        goldSyncToken++;  // Increment sync token
        updateGoldDisplay();
        logTransaction('expense', handleCost, 'Handle for forging');
        saveGame();
        if (gameWorker && workerInitialized) {
            gameWorker.postMessage({
                type: 'update-state',
                data: { gold: gold, goldSyncToken: goldSyncToken }
            });
        }

        // Handle mounting step
        animationContent.innerHTML = `<div class="forging-anvil shake">🪓</div><div class="forging-message">Mounting handle...</div>`;
        await conditionalSleep(1800);

        currentQuality += handleBonus;
        qualityProgression.afterHandle = Math.round(currentQuality);

        // Show handle mounting success
        animationContent.innerHTML = `<div class="forging-anvil">✅</div><div class="forging-message forging-success">Handle mounted!</div><div class="forging-quality">Current Power: ${Math.round(currentQuality)}</div>`;
        await conditionalSleep(1200);

        // Sharpening step - 3 iterations
        let sharpeningQuality = currentQuality;
        qualityProgression.beforeSharpening = Math.round(sharpeningQuality);
        const sharpeningIterations = FORGE_SHARPENING_ITERATIONS;

        for (let i = 0; i < sharpeningIterations; i++) {
            animationContent.innerHTML = `<div class="forging-anvil shake">✨</div><div class="forging-message">Sharpening... (${i + 1}/${sharpeningIterations})</div>`;
            await conditionalSleep(1200);

            // Apply percentage-based sharpening variance: -5% to +20% of current quality
            const variancePercent = (Math.random() * (FORGE_SHARPENING_MAX_VARIANCE - FORGE_SHARPENING_MIN_VARIANCE)) + FORGE_SHARPENING_MIN_VARIANCE;
            const iterationVariance = sharpeningQuality * variancePercent;
            sharpeningQuality += iterationVariance;

            // Show completion of this sharpening pass
            const changePercent = (variancePercent * 100).toFixed(1);
            const changeSign = variancePercent >= 0 ? '+' : '';
            animationContent.innerHTML = `<div class="forging-anvil">✨</div><div class="forging-message">Sharpening pass ${i + 1} complete (${changeSign}${changePercent}%)</div><div class="forging-quality">Current Power: ${Math.round(sharpeningQuality)}</div>`;
            await conditionalSleep(800);
        }

        // Calculate final quality
        finalQuality = Math.max(1, Math.round(sharpeningQuality));
        qualityProgression.final = finalQuality;

        // Show final sharpening completion
        animationContent.innerHTML = `<div class="forging-anvil">✨</div><div class="forging-message forging-success">Sharpening complete!</div><div class="forging-quality">Final Power: ${finalQuality}</div>`;
        await conditionalSleep(1200);

        success = true;
        break;
    }

    // Show result
    if (success) {
        // Create new tool with material name in type
        const material = materials[forgeState.baseMaterial];
        const materialName = material ? material.name.replace(' Ingot', '') : 'Unknown';
        const newToolId = Math.max(...toolsInventory.map(t => t.id), 0) + 1;
        const newTool = {
            id: newToolId,
            type: `${materialName} Pickaxe`,
            level: finalQuality,
            power: finalQuality
        };

        // Add plating effect if plating was applied
        if (forgeState.platingMaterial && platingEffects[forgeState.platingMaterial]) {
            newTool.plating = forgeState.platingMaterial;
        }

        toolsInventory.push(newTool);

        // Check if this is the first time forging a tool with 100+ hardness material
        const materialHardness = material ? material.hardness : 0;
        if (!hasForgedHighHardnessTool && materialHardness >= 100) {
            hasForgedHighHardnessTool = true;
            saveGame(); // Save the flag immediately
        }

        // Build dwarf options with current tool info
        const dwarfOptions = dwarfs.map(d => {
            let label = d.name;
            if (d.toolId) {
                const currentTool = toolsInventory.find(t => t.id === d.toolId);
                if (currentTool) {
                    const currentPower = currentTool.power || currentTool.level || 0;
                    label += ` (⚒️ ${currentPower})`;
                }
            } else {
                label += ' (no tool)';
            }
            return `<option value="${d.name}">${label}</option>`;
        }).join('');

        // Build forging summary
        const platingMat = forgeState.platingMaterial ? materials[forgeState.platingMaterial] : null;
        const platingName = platingMat ? platingMat.name : null;

        let forgingSummary = `
            <div style="text-align: left; margin: 5px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 5px; max-height: 200px; overflow-y: auto; line-height: 1.3;">
                <strong>Forging Summary:</strong><br>
                Material: ${materialName} (Hardness: ${material.hardness})<br>
                Hammering: ${forgeState.hammeringCount} iteration${forgeState.hammeringCount > 1 ? 's' : ''}<br>
                Cooling Oil: Quality ${forgeState.coolingOilQuality}<br>`;

        if (platingName) {
            forgingSummary += `Plating: ${platingName}<br>`;
        }

        forgingSummary += `Handle: Quality ${forgeState.handleQuality}<br><br>`;

        // Add quality progression
        forgingSummary += `<strong>Quality Progression:</strong><br>`;
        forgingSummary += `<span style="font-size: 0.9em;">`;
        forgingSummary += `Initial: ${qualityProgression.initial}<br>`;
        forgingSummary += `After Hammering: ${qualityProgression.afterHammering} <span style="color: #4ade80;">(+${qualityProgression.afterHammering - qualityProgression.initial})</span><br>`;
        forgingSummary += `After Cooling: ${qualityProgression.afterCooling} <span style="color: #4ade80;">(+${qualityProgression.afterCooling - qualityProgression.afterHammering})</span><br>`;
        forgingSummary += `After Handle: ${qualityProgression.afterHandle} <span style="color: #4ade80;">(+${qualityProgression.afterHandle - qualityProgression.afterCooling})</span><br>`;

        const sharpeningChange = qualityProgression.final - qualityProgression.beforeSharpening;
        const sharpeningColor = sharpeningChange >= 0 ? '#4ade80' : '#ff6b6b';
        const sharpeningSign = sharpeningChange >= 0 ? '+' : '';
        forgingSummary += `After Sharpening: ${qualityProgression.final} <span style="color: ${sharpeningColor};">(${sharpeningSign}${sharpeningChange})</span><br>`;
        forgingSummary += `</span><br>`;

        if (failedAttempts > 0) {
            forgingSummary += `<span style="color: #ff6b6b;">Failed Attempts: ${failedAttempts}</span><br>`;
            if (failureReasons.length > 0) {
                forgingSummary += `<span style="color: #ff6b6b; font-size: 0.9em;">`;
                failureReasons.forEach((reason, i) => {
                    forgingSummary += `  ${i + 1}. ${reason}<br>`;
                });
                forgingSummary += `</span>`;
            }
        }

        forgingSummary += `Total Attempts: ${attemptsUsed}
            </div>`;

        animationContent.innerHTML = `
            <div class="forging-anvil" style="font-size: 2em; margin: 5px 0;">⚒️</div>
            <div class="forging-message forging-success" style="margin: 5px 0;">Success!</div>
            <div class="forging-result" style="margin: 5px 0;">
                <p style="margin: 2px 0;"><strong>${materialName} Pickaxe #${newToolId}</strong></p>
                <p style="margin: 2px 0;">Power: ${finalQuality}</p>
            </div>
            ${forgingSummary}
            <div class="forging-assign" style="margin: 8px 0;">
                <label>Name your tool:</label>
                <input type="text" id="forge-name-input" class="forge-name-input" placeholder="${materialName} Pickaxe" maxlength="30">
            </div>
            <div class="forging-assign" style="margin: 8px 0;">
                <label>Assign to dwarf:</label>
                <select id="forge-assign-select" class="assign-select-small">
                    <option value="">-- Don't assign --</option>
                    ${dwarfOptions}
                </select>
            </div>
            <button class="btn-primary" onclick="closeForging(${newToolId}, '${materialName} Pickaxe')">Done</button>
        `;

        logTransaction('income', 0, `Forged new tool with quality ${finalQuality}`);
    } else {
        // Build failure summary
        const material = materials[forgeState.baseMaterial];
        const materialName = material ? material.name.replace(' Ingot', '') : 'Unknown';
        const platingMat = forgeState.platingMaterial ? materials[forgeState.platingMaterial] : null;
        const platingName = platingMat ? platingMat.name : null;

        let failureSummary = `
            <div style="text-align: left; margin: 5px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 5px; max-height: 200px; overflow-y: auto; line-height: 1.3;">
                <strong>Forging Summary:</strong><br>
                Material: ${materialName} (Hardness: ${material.hardness})<br>
                Hammering: ${forgeState.hammeringCount} iteration${forgeState.hammeringCount > 1 ? 's' : ''}<br>
                Cooling Oil: Quality ${forgeState.coolingOilQuality}<br>`;

        if (platingName) {
            failureSummary += `Plating: ${platingName}<br>`;
        }

        failureSummary += `Handle: Quality ${forgeState.handleQuality}<br>`;
        failureSummary += `<span style="color: #ff6b6b;">All ${attemptsUsed} attempt${attemptsUsed > 1 ? 's' : ''} failed</span><br>`;

        if (failureReasons.length > 0) {
            failureSummary += `<span style="color: #ff6b6b; font-size: 0.9em;"><strong>Failure Reasons:</strong><br>`;
            failureReasons.forEach((reason, i) => {
                failureSummary += `  ${i + 1}. ${reason}<br>`;
            });
            failureSummary += `</span>`;
        }

        failureSummary += `
            </div>`;

        animationContent.innerHTML = `
            <div class="forging-anvil" style="font-size: 2em; margin: 5px 0;">💀</div>
            <div class="forging-message forging-failure" style="margin: 5px 0;">All forging attempts failed!</div>
            <div class="forging-result" style="margin: 5px 0;">
                <p style="margin: 2px 0;">Used ${attemptsUsed} materials</p>
                <p style="margin: 2px 0;">No tool created</p>
            </div>
            ${failureSummary}
            <button class="btn-primary" onclick="closeForging()">Return to Forge</button>
        `;
    }

    // Final save and sync after forging completes
    updateStockDisplay();
    saveGame();

    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                gold: gold,
                materialsStock: materialsStock,
                toolsInventory: toolsInventory
            }
        });
    }
}

/**
 * Close the forging animation and handle tool naming/assignment
 */
function closeForging(newToolId, defaultName) {
    // Check if a custom name was entered
    const nameInput = document.getElementById('forge-name-input');
    if (nameInput && newToolId) {
        const customName = nameInput.value.trim();
        if (customName) {
            const tool = toolsInventory.find(t => t.id === newToolId);
            if (tool) {
                tool.name = customName;
            }
        }
    }

    // Check if a dwarf was selected for assignment
    const selectElement = document.getElementById('forge-assign-select');
    if (selectElement && selectElement.value && newToolId) {
        const dwarfName = selectElement.value;
        const dwarf = dwarfs.find(d => d.name === dwarfName);
        if (dwarf) {
            dwarf.toolId = newToolId;
            logTransaction('income', 0, `Assigned tool #${newToolId} to ${dwarfName}`);

            // Sync with worker
            if (gameWorker && workerInitialized) {
                gameWorker.postMessage({
                    type: 'update-state',
                    data: {
                        dwarfs: dwarfs,
                        toolsInventory: toolsInventory
                    }
                });
            }
            saveGame();
        }
    }

    closeModal('forging-animation-modal');
    updateStockDisplay(); // Update stock display
    openModal('forge-modal');
    populateForge(); // Refresh forge UI with updated stock
}

// Note: Gem setting functions (openGemModal, populateGemModal, confirmGemSetting, unsetGem)
// are in main.js as they're called from the tools panel, not the forge modal

// ============================================================================
// Event Listeners
// ============================================================================

// Delegated event handler for forge button
document.addEventListener('click', (ev) => {
    const forgeBtn = ev.target.closest('#forge-button');
    if (!forgeBtn || forgeBtn.disabled) return;

    startForging();
});
