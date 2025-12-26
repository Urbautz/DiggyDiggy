/**
 * Research Modal
 * Handles research tree interface, active research tracking, and research queue
 */

/**
 * Opens the research modal and populates it with current research state
 */
function openResearch() {
    openModal('research-modal');
    populateResearch();
    // Add event listener to refresh research modal when checkbox is toggled
    const hideCheckbox = document.getElementById('hide-endless-research');
    if (hideCheckbox && !hideCheckbox._diggyListenerAttached) {
        hideCheckbox.addEventListener('change', populateResearch);
        hideCheckbox._diggyListenerAttached = true;
    }
}

/**
 * Check if research requirements are met
 * @param {Object} researchItem - The research item to check
 * @returns {Object} - { met: boolean, reason?: string }
 */
function checkResearchRequirements(researchItem) {
    // No requirements - always available
    if (!researchItem.requires || researchItem.requires.length === 0) {
        return { met: true };
    }

    const missingReqs = [];

    for (const req of researchItem.requires) {
        // Each requirement is an object like {'material-science': 1}
        for (const [reqId, reqLevel] of Object.entries(req)) {
            const requiredResearch = researchtree.find(r => r.id === reqId);
            if (!requiredResearch) {
                missingReqs.push(`Unknown research: ${reqId}`);
                continue;
            }

            const currentLevel = requiredResearch.level || 0;
            if (currentLevel < reqLevel) {
                missingReqs.push(`${requiredResearch.name} level ${reqLevel}`);
            }
        }
    }

    if (missingReqs.length > 0) {
        return {
            met: false,
            reason: `Requires: ${missingReqs.join(', ')}`
        };
    }

    return { met: true };
}

/**
 * Updates the active research progress display (lightweight update)
 */
function updateResearchProgress() {
    // Lightweight function to update only the active research progress without redrawing the entire panel
    if (!activeResearch) return;

    const progressElement = document.getElementById('research-progress');
    const percentElement = document.getElementById('research-percent');
    const fillElement = document.getElementById('research-progress-fill');

    if (!progressElement || !percentElement || !fillElement) return;

    const progress = activeResearch.progress || 0;
    const currentLevel = activeResearch.level || 0;
    const targetLevel = currentLevel + 1;
    const actualCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
    const progressPercent = Math.floor((progress / actualCost) * 100);

    progressElement.textContent = formatNumber(progress, 'material');
    percentElement.textContent = `${progressPercent}%`;
    fillElement.style.width = `${progressPercent}%`;
}

/**
 * Updates only the research button states without redrawing the entire table
 * This prevents buttons from becoming unclickable during frequent updates
 * Only updates DOM when button state actually changes
 */
function updateResearchButtons() {
    const researchTable = document.querySelector('.research-table tbody');
    if (!researchTable) return false;

    // Process each research row
    const rows = researchTable.querySelectorAll('tr');
    rows.forEach((row) => {
        const actionTd = row.querySelector('td:last-child');
        if (!actionTd) return;

        const researchBtn = actionTd.querySelector('.btn-research');
        if (!researchBtn) return; // Skip rows with warnings instead of buttons

        const researchId = researchBtn.dataset.researchId;
        if (!researchId) return; // Skip already disabled buttons

        const researchItem = researchtree.find(r => r.id === researchId);
        if (!researchItem) return;

        // Calculate current state
        const currentLevel = researchItem.level || 0;
        const targetLevel = currentLevel + 1;
        const actualGoldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));

        const isActive = activeResearch && activeResearch.id === researchItem.id;
        const isInQueue = researchQueue.some(r => r.id === researchItem.id);
        const requirementsMet = checkResearchRequirements(researchItem);
        const hasEnoughGold = gold >= actualGoldCost;

        // Determine what the button state should be
        let newClassName, newText, newDisabled, newTitle;

        if (isActive) {
            newClassName = 'btn-research active';
            newText = 'Active';
            newDisabled = true;
            newTitle = '';
        } else if (isInQueue) {
            newClassName = 'btn-research active';
            newText = 'Queued';
            newDisabled = true;
            const queuePos = researchQueue.findIndex(r => r.id === researchItem.id) + 1;
            newTitle = `In queue (position ${queuePos})`;
        } else if (!requirementsMet.met) {
            newClassName = 'btn-research disabled';
            newText = 'Locked';
            newDisabled = true;
            newTitle = requirementsMet.reason;
        } else if (!hasEnoughGold) {
            newClassName = 'btn-research disabled';
            newText = activeResearch ? 'Queue' : 'Research';
            newDisabled = true;
            newTitle = `Not enough gold! Required: ${formatNumber(actualGoldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`;
        } else if (activeResearch) {
            newClassName = 'btn-research';
            newText = researchQueue.length >= 5 ? 'Queue Full' : 'Queue';
            newDisabled = researchQueue.length >= 5;
            newTitle = researchQueue.length >= 5 ? 'Research queue is full (max 5)' : `Add to queue (${researchQueue.length}/5 slots used)`;
            if (newDisabled) {
                newClassName = 'btn-research disabled';
            }
        } else {
            newClassName = 'btn-research';
            newText = 'Research';
            newDisabled = false;
            newTitle = '';
        }

        // Only update DOM if state actually changed
        if (researchBtn.className !== newClassName) {
            researchBtn.className = newClassName;
        }
        if (researchBtn.textContent !== newText) {
            researchBtn.textContent = newText;
        }
        if (researchBtn.disabled !== newDisabled) {
            researchBtn.disabled = newDisabled;
        }
        if (researchBtn.title !== newTitle) {
            researchBtn.title = newTitle;
        }
    });
}

/**
 * Populates the research modal with research tree, active research, and queue
 */
function populateResearch() {
    const container = document.getElementById('research-content');
    if (!container) return;

    container.innerHTML = '';

    const hideEndless = document.getElementById('hide-endless-research').checked;

    //console.log('Populating research, researchtree has', researchtree.length, 'items:', researchtree.map(r => r.id));

    // Show active research if any
    if (activeResearch) {
        const activeDiv = document.createElement('div');
        activeDiv.className = 'active-research';
        activeDiv.id = 'active-research-display';
        const progress = activeResearch.progress || 0;
        // Calculate actual cost using formula: baseCost * (1.15^(targetLevel-1))
        const currentLevel = activeResearch.level || 0;
        const targetLevel = currentLevel + 1;
        const actualCost = Math.round(activeResearch.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        const actualGoldCost = Math.round(activeResearch.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        const progressPercent = Math.floor((progress / actualCost) * 100);
        activeDiv.innerHTML = `
            <h3>🔬 Currently Researching</h3>
            <p><strong id="research-name">${activeResearch.name}</strong> (Level ${targetLevel}) • <span id="research-percent">${progressPercent}%</span> complete</p>
            <p style="font-size: 12px; opacity: 0.9;">${activeResearch.description}</p>
            <p><small>Progress: <span id="research-progress">${formatNumber(progress, 'material')}</span> / <span id="research-cost">${formatNumber(actualCost,'material')}</span> 🔬<br>Gold paid: ${actualGoldCost} 💰</small></p>
            <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
                <div class="progress-bar" style="flex: 1; margin-top: 0;"><div class="progress-fill" id="research-progress-fill" style="width: ${progressPercent}%"></div></div>
                <button class="btn-cancel-research" style="padding: 6px 10px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; white-space: nowrap; flex-shrink: 0;">✖ Cancel</button>
            </div>
        `;

        // Add cancel button click handler
        const cancelBtn = activeDiv.querySelector('.btn-cancel-research');
        cancelBtn.onmouseover = () => { cancelBtn.style.background = '#ff5252'; };
        cancelBtn.onmouseout = () => { cancelBtn.style.background = '#ff6b6b'; };
        cancelBtn.onclick = () => {
            if (confirm(`Cancel research on ${activeResearch.name}?\n\nProgress will be lost, but ${actualGoldCost} 💰 will be refunded.`)) {
                cancelResearch();
            }
        };

        container.appendChild(activeDiv);
    }

    // Show research queue if any
    if (researchQueue.length > 0) {
        const queueDiv = document.createElement('div');
        queueDiv.className = 'research-queue';
        queueDiv.style.cssText = 'background: #2a2a3e; padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #444;';

        let queueHTML = '<h3 style="margin-top: 0; color: #ffa500;">📋 Research Queue</h3>';
        queueHTML += '<div style="display: flex; flex-direction: column; gap: 8px;">';

        researchQueue.forEach((queuedResearch, index) => {
            queueHTML += `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #1e1e2e; padding: 8px 12px; border-radius: 4px; border: 1px solid #555;">
                    <div style="flex: 1;">
                        <strong>${index + 1}. ${queuedResearch.name}</strong> (Level ${queuedResearch.targetLevel})
                        <span style="color: #888; font-size: 11px; margin-left: 8px;">Gold paid: ${formatNumber(queuedResearch.goldCost, 'gold')} 💰</span>
                    </div>
                    <button class="btn-remove-from-queue" data-index="${index}" style="padding: 4px 8px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap;">✖ Remove</button>
                </div>
            `;
        });

        queueHTML += '</div>';
        queueHTML += `<p style="margin-top: 8px; margin-bottom: 0; font-size: 11px; color: #888;">Queue: ${researchQueue.length}/5 slots used</p>`;
        queueDiv.innerHTML = queueHTML;

        // Add remove button handlers
        container.appendChild(queueDiv);
        queueDiv.querySelectorAll('.btn-remove-from-queue').forEach(btn => {
            const index = parseInt(btn.dataset.index);
            btn.onmouseover = () => { btn.style.background = '#ff5252'; };
            btn.onmouseout = () => { btn.style.background = '#ff6b6b'; };
            btn.onclick = () => {
                const research = researchQueue[index];
                if (confirm(`Remove ${research.name} from queue?\n\n${formatNumber(research.goldCost, 'gold')} 💰 will be refunded.`)) {
                    removeFromResearchQueue(index);
                }
            };
        });
    }

    const researchTable = document.createElement('table');
    researchTable.className = 'research-table';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Research</th><th>Level</th><th>Cost</th><th>Action</th></tr>';
    researchTable.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Show all researchable items
    for (const researchItem of researchtree) {
        const currentLevel = researchItem.level || 0;
        const maxLevel = researchItem.maxlevel || Infinity;

        // Skip if max level reached
        if (currentLevel >= maxLevel) continue;

        // Skip if min_depth not reached
        if (researchItem.min_depth && startX < researchItem.min_depth) {
            continue;
        }

        if (hideEndless && (researchItem.maxlevel === Infinity || !researchItem.maxlevel)) {
            continue;
        }

        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.innerHTML = `<strong>${researchItem.name}</strong><br><small>${researchItem.description}</small>`;
        nameTd.appendChild(nameDiv);

        const levelTd = document.createElement('td');
        // Calculate effective hardness for display
        const baseHardness = researchItem.hardness || 10;
        const levelHardnessIncrease = currentLevel * RESEARCH_HARDNESS_SCALING_PER_LEVEL;
        const effectiveHardness = Math.min(RESEARCH_HARDNESS_MAX, baseHardness + levelHardnessIncrease);

        // Check if research is possible: max wisdom * 100 must be >= hardness
        // Find max wisdom from all dwarfs
        const maxWisdom = dwarfs.reduce((max, d) => Math.max(max, d.wisdom || 0), 0);
        const maxPossiblePower = maxWisdom * 100; // Best case: wisdom * roll(100)
        const isImpossible = maxPossiblePower < effectiveHardness;
        const minWisdomRequired = Math.ceil(effectiveHardness / 100);

        levelTd.innerHTML = `${currentLevel} / ${maxLevel === Infinity ? '∞' : maxLevel}<br><small style="opacity: 0.7;">Hardness: ${effectiveHardness}</small>`;

        const costTd = document.createElement('td');
        // Calculate actual cost for next level using formula: baseCost * (1.15^(targetLevel-1))
        const targetLevel = currentLevel + 1;
        const actualCost = Math.round(researchItem.cost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        const actualGoldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
        costTd.innerHTML = `${actualCost} 🔬<br>${actualGoldCost} 💰`;
        costTd.title = 'Research points\nGold required';

        const actionTd = document.createElement('td');

        // If research is impossible, show warning instead of button
        if (isImpossible) {
            const warningDiv = document.createElement('div');
            warningDiv.style.color = '#ff6b6b';
            warningDiv.style.fontWeight = 'bold';
            warningDiv.style.fontSize = '12px';
            warningDiv.style.textAlign = 'center';
            warningDiv.innerHTML = `⚠️ Dwarf with<br>Wisdom ${minWisdomRequired} required`;
            warningDiv.title = `No dwarf can complete this research!\nRequired hardness: ${effectiveHardness}\nMax possible: ${maxPossiblePower} (Wisdom ${maxWisdom} × 100)\n\nYou need a dwarf with at least Wisdom ${minWisdomRequired}\nor use Amethyst gems to reduce hardness.`;
            actionTd.appendChild(warningDiv);
        } else {
            const researchBtn = document.createElement('button');

            // Check if this research is already active or in queue
            const isActive = activeResearch && activeResearch.id === researchItem.id;
            const isInQueue = researchQueue.some(r => r.id === researchItem.id);

            // Check if requirements are met
            const requirementsMet = checkResearchRequirements(researchItem);

            // Check if player has enough gold
            const hasEnoughGold = gold >= actualGoldCost;

            if (isActive) {
                researchBtn.className = 'btn-research active';
                researchBtn.textContent = 'Active';
                researchBtn.disabled = true;
            } else if (isInQueue) {
                researchBtn.className = 'btn-research active';
                researchBtn.textContent = 'Queued';
                researchBtn.disabled = true;
                const queuePos = researchQueue.findIndex(r => r.id === researchItem.id) + 1;
                researchBtn.title = `In queue (position ${queuePos})`;
            } else if (!requirementsMet.met) {
                // Requirements not met - gray out
                researchBtn.className = 'btn-research disabled';
                researchBtn.textContent = 'Locked';
                researchBtn.disabled = true;
                researchBtn.title = requirementsMet.reason;
            } else if (!hasEnoughGold) {
                // Not enough gold
                researchBtn.className = 'btn-research disabled';
                researchBtn.textContent = activeResearch ? 'Queue' : 'Research';
                researchBtn.disabled = true;
                researchBtn.title = `Not enough gold! Required: ${formatNumber(actualGoldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`;
            } else if (activeResearch) {
                // Another research is active - show queue button
                researchBtn.className = 'btn-research';
                researchBtn.textContent = researchQueue.length >= 5 ? 'Queue Full' : 'Queue';
                researchBtn.disabled = researchQueue.length >= 5;
                researchBtn.dataset.researchId = researchItem.id;
                if (researchQueue.length >= 5) {
                    researchBtn.className = 'btn-research disabled';
                    researchBtn.title = 'Research queue is full (max 5)';
                } else {
                    researchBtn.title = `Add to queue (${researchQueue.length}/5 slots used)`;
                }
            } else {
                researchBtn.className = 'btn-research';
                researchBtn.textContent = 'Research';
                researchBtn.dataset.researchId = researchItem.id;
            }

            actionTd.appendChild(researchBtn);
        }

        tr.appendChild(nameTd);
        tr.appendChild(levelTd);
        tr.appendChild(costTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }

    researchTable.appendChild(tbody);
    container.appendChild(researchTable);

    // Show completed researches section
    const completedResearches = researchtree.filter(r => {
        const currentLevel = r.level || 0;
        const maxLevel = r.maxlevel || Infinity;
        return currentLevel >= maxLevel && maxLevel !== Infinity;
    });

    if (completedResearches.length > 0) {
        const completedSection = document.createElement('div');
        completedSection.className = 'completed-research-section';
        completedSection.innerHTML = '<h3 style="color: #4CAF50; margin: 20px 0 10px 0;">✓ Completed Researches</h3>';

        const completedTable = document.createElement('table');
        completedTable.className = 'research-table completed';

        const completedThead = document.createElement('thead');
        completedThead.innerHTML = '<tr><th>Research</th><th>Level</th><th>Status</th></tr>';
        completedTable.appendChild(completedThead);

        const completedTbody = document.createElement('tbody');

        for (const researchItem of completedResearches) {
            const tr = document.createElement('tr');
            tr.style.opacity = '0.7';

            const nameTd = document.createElement('td');
            const nameDiv = document.createElement('div');
            nameDiv.innerHTML = `<strong>${researchItem.name}</strong><br><small>${researchItem.description}</small>`;
            nameTd.appendChild(nameDiv);

            const levelTd = document.createElement('td');
            levelTd.textContent = `${researchItem.level} / ${researchItem.maxlevel}`;

            const statusTd = document.createElement('td');
            statusTd.innerHTML = '<span style="color: #4CAF50; font-weight: bold;">✓ Maxed</span>';

            tr.appendChild(nameTd);
            tr.appendChild(levelTd);
            tr.appendChild(statusTd);
            completedTbody.appendChild(tr);
        }

        completedTable.appendChild(completedTbody);
        completedSection.appendChild(completedTable);
        container.appendChild(completedSection);
    }
}

/**
 * Starts a new research or adds it to the queue
 * @param {string} researchId - The ID of the research to start
 */
function startResearch(researchId) {
    const researchItem = researchtree.find(r => r.id === researchId);
    if (!researchItem) {
        console.error('Research not found:', researchId);
        return;
    }

    // Check if research is already in queue or active
    if (activeResearch && activeResearch.id === researchId) {
        console.error('This research is already active');
        return;
    }
    if (researchQueue.some(r => r.id === researchId)) {
        console.error('This research is already in the queue');
        return;
    }

    // If another research is active, add to queue
    if (activeResearch) {
        if (researchQueue.length >= 5) {
            alert('Research queue is full! Maximum 5 researches can be queued.');
            return;
        }

        // Calculate gold cost for next level
        const currentLevel = researchItem.level || 0;
        const targetLevel = currentLevel + 1;
        const goldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));

        // Check if player has enough gold
        if (gold < goldCost) {
            console.error(`Not enough gold to queue research. Required: ${goldCost}, Available: ${gold}`);
            alert(`Not enough gold! Required: ${formatNumber(goldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`);
            return;
        }

        // Deduct gold cost and add to queue
        gold -= goldCost;
        logTransaction('expense', goldCost, `Queued research: ${researchItem.name} (Level ${targetLevel})`);

        researchQueue.push({
            id: researchItem.id,
            name: researchItem.name,
            level: currentLevel,
            targetLevel: targetLevel,
            goldCost: goldCost
        });

        console.log(`[MAIN] Added to research queue: ${researchItem.name} (Position ${researchQueue.length})`);
        console.log('[MAIN] Current queue:', researchQueue);

        // Sync with worker
        if (gameWorker && workerInitialized) {
            console.log('[MAIN] Syncing queue to worker...');
            gameWorker.postMessage({
                type: 'update-state',
                data: {
                    researchQueue: researchQueue,
                    gold: gold
                }
            });
        } else {
            console.warn('[MAIN] Worker not initialized, queue not synced');
        }

        populateResearch();
        saveGame();
        return;
    }

    // Calculate gold cost for next level
    const currentLevel = researchItem.level || 0;
    const targetLevel = currentLevel + 1;
    const goldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));

    // Check if player has enough gold
    if (gold < goldCost) {
        console.error(`Not enough gold to start research. Required: ${goldCost}, Available: ${gold}`);
        alert(`Not enough gold! Required: ${formatNumber(goldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`);
        return;
    }

    // Deduct gold cost
    gold -= goldCost;
    logTransaction('expense', goldCost, `Started research: ${researchItem.name} (Level ${targetLevel})`);

    // Initialize progress if not set
    if (researchItem.progress === undefined) {
        researchItem.progress = 0;
    }

    // Set as active
    activeResearch = researchItem;

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: activeResearch,
                researchtree: researchtree,
                gold: gold,
                researchQueue: researchQueue
            }
        });
    }

    // Update displays
    populateResearch();
    saveGame();

    console.log(`Started researching: ${researchItem.name}`);
}

/**
 * Starts the next queued research (called when active research completes)
 */
function startNextQueuedResearch() {
    if (researchQueue.length === 0) {
        console.log('No more researches in queue');
        return;
    }

    const nextResearch = researchQueue.shift();
    const researchItem = researchtree.find(r => r.id === nextResearch.id);

    if (!researchItem) {
        console.error('Queued research not found:', nextResearch.id);
        startNextQueuedResearch(); // Try next in queue
        return;
    }

    // Initialize progress if not set
    if (researchItem.progress === undefined) {
        researchItem.progress = 0;
    }

    // Set as active
    activeResearch = researchItem;

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: activeResearch,
                researchtree: researchtree,
                researchQueue: researchQueue
            }
        });
    }

    // Update displays
    populateResearch();
    saveGame();

    console.log(`Started next queued research: ${researchItem.name} (${researchQueue.length} remaining in queue)`);
}

/**
 * Cancels the active research and refunds gold
 */
function cancelResearch() {
    if (!activeResearch) {
        console.warn('No active research to cancel');
        return;
    }

    const researchName = activeResearch.name;

    // Refund gold cost
    const currentLevel = activeResearch.level || 0;
    const targetLevel = currentLevel + 1;
    const goldCost = Math.round(activeResearch.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
    gold += goldCost;
    logTransaction('income', goldCost, `Cancelled research: ${researchName} (Level ${targetLevel}) - refund`);

    // Clear active research
    activeResearch = null;

    // Make all researching dwarfs idle
    for (const dwarf of dwarfs) {
        if (dwarf.status === 'researching') {
            dwarf.status = 'idle';
        }
    }

    // Start next queued research
    startNextQueuedResearch();

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: activeResearch,
                dwarfs: dwarfs,
                gold: gold,
                researchQueue: researchQueue
            }
        });
    }

    // Update displays
    populateResearch();
    saveGame();

    console.log(`Cancelled research: ${researchName}`);
}

/**
 * Removes a research from the queue and refunds gold
 * @param {number} index - The index of the queued research to remove
 */
function removeFromResearchQueue(index) {
    if (index < 0 || index >= researchQueue.length) {
        console.error('Invalid queue index:', index);
        return;
    }

    const removed = researchQueue.splice(index, 1)[0];

    // Refund gold
    gold += removed.goldCost;
    logTransaction('income', removed.goldCost, `Removed from queue: ${removed.name} (Level ${removed.targetLevel}) - refund`);

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                researchQueue: researchQueue,
                gold: gold
            }
        });
    }

    // Update displays
    populateResearch();
    saveGame();

    console.log(`Removed from queue: ${removed.name}`);
}

// ============================================================================
// Event Listeners
// ============================================================================

// Delegated event handler for research buttons
document.addEventListener('click', (ev) => {
    const researchBtn = ev.target.closest('.btn-research');
    if (!researchBtn || researchBtn.disabled) return;

    const researchId = researchBtn.dataset.researchId;
    if (researchId) {
        console.log(`Research button clicked: ${researchId}`);
        startResearch(researchId);
    }
});
