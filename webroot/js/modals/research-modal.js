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
 * Get all research IDs that depend on a given research
 * @param {string} researchId - The research ID to check dependencies for
 * @param {number} requiredLevel - The minimum level required
 * @returns {string[]} - Array of research IDs that depend on this research
 */
function getDependentResearches(researchId, requiredLevel) {
    const dependents = [];

    for (const [id, research] of Object.entries(researchData)) {
        if (!research.requires) continue;

        for (const req of research.requires) {
            for (const [reqId, reqLevel] of Object.entries(req)) {
                if (reqId === researchId && reqLevel > requiredLevel) {
                    dependents.push(id);
                }
            }
        }
    }

    return dependents;
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
            const requiredResearch = researchData[reqId];
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

        const researchItem = researchData[researchId];
        if (!researchItem) return;

        // Calculate current state
        const currentLevel = researchItem.level || 0;
        const targetLevel = currentLevel + 1;
        const maxLevel = researchItem.maxlevel || Infinity;
        const actualGoldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));

        const isActive = activeResearch && activeResearch.id === researchItem.id;
        const requirementsMet = checkResearchRequirements(researchItem);
        const hasEnoughGold = gold >= actualGoldCost;

        // Determine what the button state should be
        let newClassName, newText, newDisabled, newTitle;

        if (isActive) {
            newClassName = 'btn-research active';
            newText = 'Active';
            newDisabled = true;
            newTitle = '';
        } else if (!hasEnoughGold) {
            newClassName = 'btn-research disabled';
            newText = activeResearch ? 'Queue' : 'Research';
            newDisabled = true;
            newTitle = `Not enough gold! Required: ${formatNumber(actualGoldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`;
        } else if (activeResearch) {
            newClassName = 'btn-research';
            // Check how many levels are available for this research
            // Calculate effective level including active and queued
            const activeCount = (activeResearch && activeResearch.id === researchId) ? 1 : 0;
            const queuedCount = researchQueue.filter(r => r.id === researchId).length;
            const effectiveLevel = currentLevel + activeCount + queuedCount;
            const canQueueMore = effectiveLevel < maxLevel;

            newText = researchQueue.length >= 5 ? 'Queue Full' : 'Queue';
            newDisabled = researchQueue.length >= 5 || !canQueueMore;
            newTitle = researchQueue.length >= 5 ? 'Research queue is full (max 5)' :
                       !canQueueMore ? `Max level (${maxLevel}) will be reached` :
                       `Add to queue (${researchQueue.length}/5 slots used)`;
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

    //console.log('Populating research, researchTree has', researchTree.length, 'items:', researchTree);

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
            <p><strong id="research-name" class="active-research-name">${activeResearch.name}</strong> (Level ${targetLevel}) • <span id="research-percent">${progressPercent}%</span> complete</p>
            <p><small>Progress: <span id="research-progress">${formatNumber(progress, 'material')}</span> / <span id="research-cost">${formatNumber(actualCost,'material')}</span></small></p>
            <div class="active-research-progress-row">
                <div class="progress-bar"><div class="progress-fill" id="research-progress-fill" style="width: ${progressPercent}%"></div></div>
                <button class="btn-cancel-research">✖ Cancel</button>
            </div>
        `;

        // Add cancel button click handler
        const cancelBtn = activeDiv.querySelector('.btn-cancel-research');
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

        let queueHTML = '<h3>📋 Research Queue</h3>';
        queueHTML += '<div class="research-queue-list">';

        researchQueue.forEach((queuedResearch, index) => {
            queueHTML += `
                <div class="research-queue-item">
                    <div class="research-queue-item-info">
                        <strong>${index + 1}. ${queuedResearch.name}</strong> (Level ${queuedResearch.targetLevel})
                        <span class="research-queue-item-gold">Gold paid: ${formatNumber(queuedResearch.goldCost, 'gold')} 💰</span>
                    </div>
                    <button class="btn-remove-from-queue" data-index="${index}">✖ Remove</button>
                </div>
            `;
        });

        queueHTML += '</div>';
        queueHTML += `<p class="research-queue-slots">Queue: ${researchQueue.length}/5 slots used</p>`;
        queueDiv.innerHTML = queueHTML;

        // Add remove button handlers
        container.appendChild(queueDiv);
        queueDiv.querySelectorAll('.btn-remove-from-queue').forEach(btn => {
            const index = parseInt(btn.dataset.index);
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
    for (const researchId of researchTree) {
        const researchItem = researchData[researchId];
        if (!researchItem) continue;

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
        nameDiv.className = 'research-name-cell';
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

        // Check if requirements are met
        const requirementsMet = checkResearchRequirements(researchItem);

        // If research is impossible, show warning instead of button
        if (isImpossible) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'research-warning';
            warningDiv.innerHTML = `⚠️ Dwarf with<br>Wisdom ${minWisdomRequired} required`;
            warningDiv.title = `No dwarf can complete this research!\nRequired hardness: ${effectiveHardness}\nMax possible: ${maxPossiblePower} (Wisdom ${maxWisdom} × 100)\n\nYou need a dwarf with at least Wisdom ${minWisdomRequired}\nor use Amethyst gems to reduce hardness.`;
            actionTd.appendChild(warningDiv);
        } else if (!requirementsMet.met) {
            // Requirements not met - show warning text instead of button
            const warningDiv = document.createElement('div');
            warningDiv.className = 'research-warning';
            warningDiv.innerHTML = `Requires ${requirementsMet.reason.replace('Requires: ', '')}`;
            warningDiv.title = requirementsMet.reason;
            actionTd.appendChild(warningDiv);
        } else {
            const researchBtn = document.createElement('button');

            // Check if this research is already active
            const isActive = activeResearch && activeResearch.id === researchItem.id;

            // Check if player has enough gold
            const hasEnoughGold = gold >= actualGoldCost;

            if (isActive) {
                researchBtn.className = 'btn-research active';
                researchBtn.textContent = 'Active';
                researchBtn.disabled = true;
            } else if (!hasEnoughGold) {
                // Not enough gold
                researchBtn.className = 'btn-research disabled';
                researchBtn.textContent = activeResearch ? 'Queue' : 'Research';
                researchBtn.disabled = true;
                researchBtn.title = `Not enough gold! Required: ${formatNumber(actualGoldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`;
            } else if (activeResearch) {
                // Another research is active - show queue button
                // Check how many levels are available for this research
                // Calculate effective level including active and queued
                const activeCount = (activeResearch && activeResearch.id === researchId) ? 1 : 0;
                const queuedCount = researchQueue.filter(r => r.id === researchId).length;
                const effectiveLevel = currentLevel + activeCount + queuedCount;
                const canQueueMore = effectiveLevel < maxLevel;

                researchBtn.className = 'btn-research';
                researchBtn.textContent = researchQueue.length >= 5 ? 'Queue Full' : 'Queue';
                researchBtn.disabled = researchQueue.length >= 5 || !canQueueMore;
                researchBtn.dataset.researchId = researchId;
                if (researchQueue.length >= 5) {
                    researchBtn.className = 'btn-research disabled';
                    researchBtn.title = 'Research queue is full (max 5)';
                } else if (!canQueueMore) {
                    researchBtn.className = 'btn-research disabled';
                    researchBtn.title = `Max level (${maxLevel}) will be reached`;
                } else {
                    researchBtn.title = `Add to queue (${researchQueue.length}/5 slots used)`;
                }
            } else {
                researchBtn.className = 'btn-research';
                researchBtn.textContent = 'Research';
                researchBtn.dataset.researchId = researchId;
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
    const completedResearches = researchTree.map(id => ({id, ...researchData[id]})).filter(r => {
        const currentLevel = r.level || 0;
        const maxLevel = r.maxlevel || Infinity;
        return currentLevel >= maxLevel && maxLevel !== Infinity;
    });

    if (completedResearches.length > 0) {
        const completedSection = document.createElement('div');
        completedSection.className = 'completed-research-section';
        completedSection.innerHTML = '<h3>✓ Completed Researches</h3>';

        const completedTable = document.createElement('table');
        completedTable.className = 'research-table completed';

        const completedThead = document.createElement('thead');
        completedThead.innerHTML = '<tr><th>Research</th><th>Level</th><th>Status</th></tr>';
        completedTable.appendChild(completedThead);

        const completedTbody = document.createElement('tbody');

        for (const researchItem of completedResearches) {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            const nameDiv = document.createElement('div');
            nameDiv.className = 'research-name-cell';
            nameDiv.innerHTML = `<strong>${researchItem.name}</strong><br><small>${researchItem.description}</small>`;
            nameTd.appendChild(nameDiv);

            const levelTd = document.createElement('td');
            levelTd.textContent = `${researchItem.level} / ${researchItem.maxlevel}`;

            const statusTd = document.createElement('td');
            statusTd.innerHTML = '<span class="research-status-maxed">✓ Maxed</span>';

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
    const researchItem = researchData[researchId];
    if (!researchItem) {
        console.error('Research not found:', researchId);
        return;
    }

    // Allow multiple levels of the same research to be queued
    // Calculate the effective current level (base level + active + queued)
    const baseLevel = researchItem.level || 0;
    const activeCount = (activeResearch && activeResearch.id === researchId) ? 1 : 0;
    const queuedCount = researchQueue.filter(r => r.id === researchId).length;
    const effectiveLevel = baseLevel + activeCount + queuedCount;
    const maxLevel = researchItem.maxlevel || Infinity;

    // Check if we can queue another level
    if (effectiveLevel >= maxLevel) {
        console.error('Cannot queue more levels - max level will be reached');
        return;
    }

    // If ANY research is active (including this one), add to queue
    if (activeResearch) {
        if (researchQueue.length >= 5) {
            alert('Research queue is full! Maximum 5 researches can be queued.');
            return;
        }

        // Calculate gold cost for next level
        // Target level is effective level + 1 (accounts for active and queued levels)
        const targetLevel = effectiveLevel + 1;
        const goldCost = Math.round(researchItem.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));

        // Check if player has enough gold
        if (gold < goldCost) {
            console.error(`Not enough gold to queue research. Required: ${goldCost}, Available: ${gold}`);
            alert(`Not enough gold! Required: ${formatNumber(goldCost, 'gold')} 💰, Available: ${formatNumber(gold, 'gold')} 💰`);
            return;
        }

        // Deduct gold cost and add to queue
        gold -= goldCost;
        pendingGoldDelta -= goldCost;  // Track for sync reconciliation
        goldSyncToken++;  // Increment sync token
        logTransaction('expense', goldCost, `Queued research: ${researchItem.name} (Level ${targetLevel})`);

        researchQueue.push({
            id: researchId,
            name: researchItem.name,
            level: effectiveLevel,  // Use effective level to show correct progression
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
                    gold: gold,
                    goldSyncToken: goldSyncToken
                }
            });
        } else {
            console.warn('[MAIN] Worker not initialized, queue not synced');
        }

        populateResearch();
        saveGame();
        return;
    }

    // Calculate gold cost for next level (when starting immediately, no active/queued levels)
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
    pendingGoldDelta -= goldCost;  // Track for sync reconciliation
    goldSyncToken++;  // Increment sync token
    logTransaction('expense', goldCost, `Started research: ${researchItem.name} (Level ${targetLevel})`);

    // Initialize progress if not set
    if (researchItem.progress === undefined) {
        researchItem.progress = 0;
    }

    // Set as active (include id so worker can save completion)
    activeResearch = { ...researchItem, id: researchId };

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: activeResearch,
                researchData: researchData,
                gold: gold,
                goldSyncToken: goldSyncToken,
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
    const researchItem = researchData[nextResearch.id];

    if (!researchItem) {
        console.error('Queued research not found:', nextResearch.id);
        startNextQueuedResearch(); // Try next in queue
        return;
    }

    // Initialize progress if not set
    if (researchItem.progress === undefined) {
        researchItem.progress = 0;
    }

    // Set as active (include id so worker can save completion)
    activeResearch = { ...researchItem, id: nextResearch.id };

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                activeResearch: activeResearch,
                researchData: researchData,
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
    const researchId = activeResearch.id;

    // Refund gold cost
    const currentLevel = activeResearch.level || 0;
    const targetLevel = currentLevel + 1;
    const goldCost = Math.round(activeResearch.goldCost * Math.pow(RESEARCH_COST_MULTIPLIER, Math.max(0, targetLevel - 1)));
    let totalRefund = goldCost;
    gold += goldCost;
    logTransaction('income', goldCost, `Cancelled research: ${researchName} (Level ${targetLevel}) - refund`);

    // Remove all queued levels of the same research (since we're canceling the active one)
    const removedSameLevels = [];
    for (let i = researchQueue.length - 1; i >= 0; i--) {
        if (researchQueue[i].id === researchId) {
            const removed = researchQueue.splice(i, 1)[0];
            gold += removed.goldCost;
            totalRefund += removed.goldCost;
            logTransaction('income', removed.goldCost, `Auto-removed dependent: ${removed.name} (Level ${removed.targetLevel}) - refund`);
            removedSameLevels.push(removed);
        }
    }

    // Find dependent researches and remove them from queue
    const dependents = getDependentResearches(researchId, currentLevel);
    const removedDependents = [];
    for (let i = researchQueue.length - 1; i >= 0; i--) {
        if (dependents.includes(researchQueue[i].id)) {
            const removed = researchQueue.splice(i, 1)[0];
            gold += removed.goldCost;
            totalRefund += removed.goldCost;
            logTransaction('income', removed.goldCost, `Auto-removed dependent: ${removed.name} (Level ${removed.targetLevel}) - refund`);
            removedDependents.push(removed);
        }
    }

    // Track for sync reconciliation (all refunds combined)
    pendingGoldDelta += totalRefund;
    goldSyncToken++;

    // Clear active research
    activeResearch = null;

    // Make all researching dwarfs idle
    for (const dwarf of dwarfs) {
        if (dwarf.status === 'researching') {
            dwarf.status = 'idle';
        }
    }

    // Notify user if dependents were removed
    if (removedSameLevels.length > 0 || removedDependents.length > 0) {
        const messages = [];
        if (removedSameLevels.length > 0) {
            messages.push(`${removedSameLevels.length} queued level(s) of ${researchName}`);
        }
        if (removedDependents.length > 0) {
            const depNames = removedDependents.map(r => r.name).join(', ');
            messages.push(`Dependent researches: ${depNames}`);
        }
        console.log(`Also removed from queue: ${messages.join('; ')}`);
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
                goldSyncToken: goldSyncToken,
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
 * Also removes any queued researches that depend on this one or are higher levels of the same research
 * @param {number} index - The index of the queued research to remove
 */
function removeFromResearchQueue(index) {
    if (index < 0 || index >= researchQueue.length) {
        console.error('Invalid queue index:', index);
        return;
    }

    const removed = researchQueue.splice(index, 1)[0];
    const removedId = removed.id;
    const removedLevel = removed.level;

    // Refund gold
    let totalRefund = removed.goldCost;
    gold += removed.goldCost;
    logTransaction('income', removed.goldCost, `Removed from queue: ${removed.name} (Level ${removed.targetLevel}) - refund`);

    // Remove any subsequent levels of the same research (they come after this level)
    const removedSameLevels = [];
    for (let i = researchQueue.length - 1; i >= 0; i--) {
        if (researchQueue[i].id === removedId && researchQueue[i].targetLevel > removed.targetLevel) {
            const dep = researchQueue.splice(i, 1)[0];
            gold += dep.goldCost;
            totalRefund += dep.goldCost;
            logTransaction('income', dep.goldCost, `Auto-removed dependent level: ${dep.name} (Level ${dep.targetLevel}) - refund`);
            removedSameLevels.push(dep);
        }
    }

    // Find researches that depend on this research and remove them
    const dependents = getDependentResearches(removedId, removedLevel);
    const removedDependents = [];
    for (let i = researchQueue.length - 1; i >= 0; i--) {
        if (dependents.includes(researchQueue[i].id)) {
            const dep = researchQueue.splice(i, 1)[0];
            gold += dep.goldCost;
            totalRefund += dep.goldCost;
            logTransaction('income', dep.goldCost, `Auto-removed dependent: ${dep.name} (Level ${dep.targetLevel}) - refund`);
            removedDependents.push(dep);
        }
    }

    // Track for sync reconciliation (all refunds combined)
    pendingGoldDelta += totalRefund;
    goldSyncToken++;

    // Notify user if dependents were removed
    if (removedSameLevels.length > 0 || removedDependents.length > 0) {
        const messages = [];
        if (removedSameLevels.length > 0) {
            messages.push(`${removedSameLevels.length} higher level(s) of ${removed.name}`);
        }
        if (removedDependents.length > 0) {
            const depNames = removedDependents.map(r => r.name).join(', ');
            messages.push(`Dependent researches: ${depNames}`);
        }
        console.log(`Also removed from queue: ${messages.join('; ')}`);
    }

    // Sync with worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: {
                researchQueue: researchQueue,
                gold: gold,
                goldSyncToken: goldSyncToken
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
