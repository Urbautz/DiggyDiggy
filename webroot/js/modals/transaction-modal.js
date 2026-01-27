// ============================================================================
// TRANSACTION MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the transaction/finances modal

// Track current investment amount for the form
let currentInvestmentAmount = 100000;

function openTransactions() {
    openModal('transactions-modal');

    // Default to summary tab
    if (!window.currentFinancesTab) {
        window.currentFinancesTab = 'summary';
    }

    switchFinancesTab(window.currentFinancesTab);

    // Set up auto-refresh
    if (window.transactionRefreshInterval) {
        clearInterval(window.transactionRefreshInterval);
    }
    window.transactionRefreshInterval = setInterval(() => {
        // Only refresh if modal is still open
        const modal = document.getElementById('transactions-modal');
        if (modal && modal.getAttribute('aria-hidden') === 'false') {
            populateTransactions();
        } else {
            // Modal closed, stop refreshing
            clearInterval(window.transactionRefreshInterval);
            window.transactionRefreshInterval = null;
        }
    }, AUTO_REFRESH_INTERVAL);
}

function switchFinancesTab(tab) {
    window.currentFinancesTab = tab;

    // Update tab button styles
    const tabs = ['summary', 'recent', 'investments'];
    tabs.forEach(t => {
        const btn = document.getElementById(`finances-tab-${t}`);
        if (btn) {
            btn.className = t === tab ? 'finances-tab active' : 'finances-tab';
        }
    });

    // Populate content based on selected tab
    populateTransactions();
}

function logTransaction(type, amount, description) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-GB', { hour12: false });

    transactionLog.unshift({
        type: type, // 'income' or 'expense'
        amount: amount,
        description: description,
        timestamp: timestamp,
        timestampMs: now.getTime(),
        balance: gold
    });

    // Initialize current hour if not set
    if (currentHourTimestamp === null) {
        currentHourTimestamp = getHourTimestamp(now);
    }

    // Check if we need to roll up to a new hour
    const currentHour = getHourTimestamp(now);
    if (currentHour !== currentHourTimestamp) {
        processHourlyRollup();
        currentHourTimestamp = currentHour;
    }

    // Limit transaction log to 1,000 entries to prevent storage issues
    if (transactionLog.length > 1000) {
        aggregateOldTransactions(transactionLog.slice(1000));
        transactionLog = transactionLog.slice(0, 1000);
    }
}

function aggregateOldTransactions(transactionsToRemove) {
    if (transactionsToRemove.length === 0) return;

    const hourlyGroups = {};

    for (const transaction of transactionsToRemove) {
        const txHour = getHourTimestamp(new Date(transaction.timestampMs));

        if (!hourlyGroups[txHour]) {
            hourlyGroups[txHour] = {};
        }

        const desc = transaction.description;
        if (!hourlyGroups[txHour][desc]) {
            hourlyGroups[txHour][desc] = { income: 0, expense: 0, count: 0 };
        }

        if (transaction.type === 'income') {
            hourlyGroups[txHour][desc].income += transaction.amount;
        } else {
            hourlyGroups[txHour][desc].expense += transaction.amount;
        }
        hourlyGroups[txHour][desc].count++;
    }

    // Merge into transaction history
    for (const hour in hourlyGroups) {
        const hourTimestamp = parseInt(hour);
        const existingHourIndex = transactionHistory.findIndex(h => h.hour === hourTimestamp);

        if (existingHourIndex >= 0) {
            const existingHour = transactionHistory[existingHourIndex];
            for (const desc in hourlyGroups[hour]) {
                if (!existingHour.transactions[desc]) {
                    existingHour.transactions[desc] = hourlyGroups[hour][desc];
                } else {
                    existingHour.transactions[desc].income += hourlyGroups[hour][desc].income;
                    existingHour.transactions[desc].expense += hourlyGroups[hour][desc].expense;
                    existingHour.transactions[desc].count += hourlyGroups[hour][desc].count;
                }
            }
        } else {
            transactionHistory.push({
                hour: hourTimestamp,
                transactions: hourlyGroups[hour]
            });
        }
    }
}

function getHourTimestamp(date) {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d.getTime();
}

function processHourlyRollup() {
    if (transactionLog.length === 0) return;

    const hourlyData = {};

    for (const transaction of transactionLog) {
        const desc = transaction.description;

        if (!hourlyData[desc]) {
            hourlyData[desc] = { income: 0, expense: 0, count: 0 };
        }

        if (transaction.type === 'income') {
            hourlyData[desc].income += transaction.amount;
        } else {
            hourlyData[desc].expense += transaction.amount;
        }
        hourlyData[desc].count++;
    }

    const existingHourIndex = transactionHistory.findIndex(h => h.hour === currentHourTimestamp);

    if (existingHourIndex >= 0) {
        const existingHour = transactionHistory[existingHourIndex];
        for (const desc in hourlyData) {
            if (!existingHour.transactions[desc]) {
                existingHour.transactions[desc] = hourlyData[desc];
            } else {
                existingHour.transactions[desc].income += hourlyData[desc].income;
                existingHour.transactions[desc].expense += hourlyData[desc].expense;
                existingHour.transactions[desc].count += hourlyData[desc].count;
            }
        }
    } else {
        transactionHistory.push({
            hour: currentHourTimestamp,
            transactions: hourlyData
        });
    }

    // Prune old history
    const cutoffTime = Date.now() - (TRANSACTION_HISTORY_MAX_HOURS * 60 * 60 * 1000);
    const originalLength = transactionHistory.length;
    transactionHistory = transactionHistory.filter(entry => entry.hour >= cutoffTime);
    if (transactionHistory.length < originalLength) {
        console.log(`Pruned ${originalLength - transactionHistory.length} old transaction history entries`);
    }

    transactionLog = [];
}

function populateTransactions() {
    const container = document.getElementById('transactions-content');
    if (!container) return;

    container.innerHTML = '';

    const tab = window.currentFinancesTab || 'summary';

    if (tab === 'summary') {
        populateSummaryTab(container);
    } else if (tab === 'recent') {
        populateRecentTab(container);
    } else if (tab === 'investments') {
        populateInvestmentsTab(container);
    }
}

// Helper to clone a template
function cloneTemplate(templateId) {
    const template = document.getElementById(templateId);
    if (!template) return null;
    return template.content.cloneNode(true);
}

function populateSummaryTab(container) {
    // Check if we're viewing hour details
    if (window.viewingHourDetails) {
        populateHourDetails(container, window.viewingHourDetails);
        return;
    }

    // Calculate current hour totals
    const currentHourTotals = calculateCurrentHourTotals();
    const hasCurrentHour = currentHourTotals.count > 0;
    const hasHistory = transactionHistory.length > 0;

    if (!hasCurrentHour && !hasHistory) {
        const empty = cloneTemplate('template-transactions-empty');
        if (empty) container.appendChild(empty);
        return;
    }

    const tableFragment = cloneTemplate('template-transactions-table');
    if (!tableFragment) return;

    const table = tableFragment.querySelector('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // Add header
    const headerTemplate = cloneTemplate('template-summary-header');
    if (headerTemplate) thead.appendChild(headerTemplate);

    // Add current hour row
    if (hasCurrentHour) {
        const row = createSummaryRow(
            'Current Hour',
            currentHourTotals.income,
            currentHourTotals.expense,
            'current',
            true
        );
        tbody.appendChild(row);
    }

    // Add historical hours (most recent first)
    const sortedHistory = [...transactionHistory].reverse();

    for (const hourData of sortedHistory) {
        const hourDate = new Date(hourData.hour);
        const hourStr = hourDate.toLocaleString('en-GB', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        let hourIncome = 0;
        let hourExpense = 0;
        for (const desc in hourData.transactions) {
            hourIncome += hourData.transactions[desc].income;
            hourExpense += hourData.transactions[desc].expense;
        }

        const row = createSummaryRow(hourStr, hourIncome, hourExpense, hourData.hour, false);
        tbody.appendChild(row);
    }

    container.appendChild(tableFragment);
}

function calculateCurrentHourTotals() {
    let income = 0;
    let expense = 0;
    let count = 0;

    for (const transaction of transactionLog) {
        if (transaction.type === 'income') {
            income += transaction.amount;
        } else {
            expense += transaction.amount;
        }
        count++;
    }

    // Also check existing history for current hour
    if (currentHourTimestamp !== null) {
        const existingCurrentHour = transactionHistory.find(h => h.hour === currentHourTimestamp);
        if (existingCurrentHour) {
            for (const desc in existingCurrentHour.transactions) {
                income += existingCurrentHour.transactions[desc].income;
                expense += existingCurrentHour.transactions[desc].expense;
                count += existingCurrentHour.transactions[desc].count;
            }
        }
    }

    return { income, expense, count };
}

function createSummaryRow(hourText, income, expense, hourId, isCurrent) {
    const tr = document.createElement('tr');
    if (isCurrent) tr.className = 'row-current';

    const net = income - expense;

    tr.innerHTML = `
        <td class="cell-hour">${hourText}</td>
        <td class="${isCurrent ? 'cell-income-bold' : 'cell-income'}">+${formatNumber(income, 'gold')}</td>
        <td class="${isCurrent ? 'cell-expense-bold' : 'cell-expense'}">-${formatNumber(expense, 'gold')}</td>
        <td class="cell-net ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${formatNumber(net, 'gold')}</td>
        <td class="cell-actions"><button class="btn-secondary btn-details" onclick="showHourDetails('${hourId}')">Details</button></td>
    `;

    return tr;
}

function showHourDetails(hourIdentifier) {
    window.viewingHourDetails = hourIdentifier;
    populateTransactions();
}

function closeHourDetails() {
    window.viewingHourDetails = null;
    populateTransactions();
}

function populateHourDetails(container, hourIdentifier) {
    // Back button and header
    const backFragment = cloneTemplate('template-hour-details-back');
    if (!backFragment) return;

    const header = backFragment.querySelector('.transactions-details-header');
    let transactionData = {};

    if (hourIdentifier === 'current') {
        header.textContent = 'Current Hour - Transaction Details';
        transactionData = aggregateCurrentHourTransactions();
    } else {
        const hourData = transactionHistory.find(h => h.hour === hourIdentifier);
        if (hourData) {
            const hourDate = new Date(hourData.hour);
            const hourStr = hourDate.toLocaleString('en-GB', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            header.textContent = `${hourStr} - Transaction Details`;
            transactionData = hourData.transactions;
        }
    }

    container.appendChild(backFragment);

    if (Object.keys(transactionData).length === 0) {
        const empty = cloneTemplate('template-transactions-empty');
        if (empty) {
            empty.querySelector('.transactions-empty').textContent = 'No transactions for this hour.';
            container.appendChild(empty);
        }
        return;
    }

    // Create table
    const tableFragment = cloneTemplate('template-transactions-table');
    if (!tableFragment) return;

    const table = tableFragment.querySelector('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    const headerTemplate = cloneTemplate('template-details-header');
    if (headerTemplate) thead.appendChild(headerTemplate);

    // Sort by absolute value descending
    const descriptions = Object.keys(transactionData).sort((a, b) => {
        const amountA = Math.max(transactionData[a].income, transactionData[a].expense);
        const amountB = Math.max(transactionData[b].income, transactionData[b].expense);
        return amountB - amountA;
    });

    for (const desc of descriptions) {
        const data = transactionData[desc];
        const tr = document.createElement('tr');

        let amountClass, amountText;
        if (data.income > 0) {
            amountClass = 'cell-income-bold';
            amountText = '+' + formatNumber(data.income, 'gold');
        } else if (data.expense > 0) {
            amountClass = 'cell-expense-bold';
            amountText = '-' + formatNumber(data.expense, 'gold');
        } else {
            amountClass = '';
            amountText = '-';
        }

        tr.innerHTML = `
            <td>${desc}</td>
            <td class="${amountClass}">${amountText}</td>
            <td class="cell-balance">${data.count}</td>
        `;

        tbody.appendChild(tr);
    }

    container.appendChild(tableFragment);
}

function aggregateCurrentHourTransactions() {
    const transactionData = {};

    for (const transaction of transactionLog) {
        const desc = transaction.description;
        if (!transactionData[desc]) {
            transactionData[desc] = { income: 0, expense: 0, count: 0 };
        }
        if (transaction.type === 'income') {
            transactionData[desc].income += transaction.amount;
        } else {
            transactionData[desc].expense += transaction.amount;
        }
        transactionData[desc].count++;
    }

    // Merge existing history for current hour
    if (currentHourTimestamp !== null) {
        const existingCurrentHour = transactionHistory.find(h => h.hour === currentHourTimestamp);
        if (existingCurrentHour) {
            for (const desc in existingCurrentHour.transactions) {
                if (!transactionData[desc]) {
                    transactionData[desc] = { ...existingCurrentHour.transactions[desc] };
                } else {
                    transactionData[desc].income += existingCurrentHour.transactions[desc].income;
                    transactionData[desc].expense += existingCurrentHour.transactions[desc].expense;
                    transactionData[desc].count += existingCurrentHour.transactions[desc].count;
                }
            }
        }
    }

    return transactionData;
}

function populateRecentTab(container) {
    if (transactionLog.length === 0) {
        const empty = cloneTemplate('template-transactions-empty');
        if (empty) {
            empty.querySelector('.transactions-empty').textContent = 'No recent transactions.';
            container.appendChild(empty);
        }
        return;
    }

    const tableFragment = cloneTemplate('template-transactions-table');
    if (!tableFragment) return;

    const table = tableFragment.querySelector('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    const headerTemplate = cloneTemplate('template-recent-header');
    if (headerTemplate) thead.appendChild(headerTemplate);

    for (const transaction of transactionLog) {
        const tr = document.createElement('tr');
        const isIncome = transaction.type === 'income';

        tr.innerHTML = `
            <td>${transaction.timestamp}</td>
            <td>${transaction.description}</td>
            <td class="${isIncome ? 'cell-income-bold' : 'cell-expense-bold'}">${isIncome ? '+' : '-'}${formatNumber(transaction.amount, 'gold')}</td>
            <td class="cell-balance">${formatNumber(transaction.balance, 'gold')}</td>
        `;

        tbody.appendChild(tr);
    }

    container.appendChild(tableFragment);
}

function populateInvestmentsTab(container) {
    const smallTimeInvestments = researchData['small-time-investments'];
    const isUnlocked = smallTimeInvestments && (smallTimeInvestments.level || 0) > 0;

    if (!isUnlocked) {
        const locked = cloneTemplate('template-investments-locked');
        if (locked) container.appendChild(locked);
        return;
    }

    const content = cloneTemplate('template-investments-content');
    if (!content) return;

    // Calculate interest rates
    const interestData = calculateInterestRates();

    // Update total interest
    const totalEl = content.getElementById('investments-interest-total');
    if (totalEl) totalEl.textContent = '+' + formatNumber(interestData.total, 'gold');

    // Add tier rows
    const tiersContainer = content.getElementById('investments-tiers');
    if (tiersContainer) {
        const tiers = [
            { interest: interestData.tier1, limit: RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT, rate: RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_RATE, show: interestData.tier1 > 0 || gold < RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT },
            { interest: interestData.tier2, limit: RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT, rate: RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_RATE, show: interestData.tier2 > 0 || (gold >= RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT && gold < RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT) },
            { interest: interestData.tier3, limit: RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_LIMIT, rate: RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_RATE, show: interestData.tier3 > 0 || gold >= RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT }
        ];

        tiers.forEach((tier, index) => {
            if (!tier.show) return;

            const tierFragment = cloneTemplate('template-investments-tier');
            if (!tierFragment) return;

            const label = tierFragment.querySelector('.investments-tier-label');
            const value = tierFragment.querySelector('.investments-tier-value');

            const ratePercent = (tier.rate * 100).toFixed(index === 0 ? 4 : (index === 1 ? 6 : 8));
            label.textContent = `Tier ${index + 1} (up to ${formatNumber(tier.limit, 'gold')}: ${ratePercent}%)`;
            value.textContent = '+' + formatNumber(tier.interest, 'gold');

            tiersContainer.appendChild(tierFragment);
        });
    }

    // One-time investments section
    const oneTimeResearch = researchData['one-time-investments'];
    const isOneTimeUnlocked = oneTimeResearch && (oneTimeResearch.level || 0) > 0;

    if (isOneTimeUnlocked) {
        const oneTimeSection = content.getElementById('one-time-investments-section');
        if (oneTimeSection) {
            oneTimeSection.hidden = false;
            populateOneTimeInvestments(content);
        }
    }

    container.appendChild(content);
}

function calculateInterestRates() {
    let total = 0;
    let tier1 = 0;
    let tier2 = 0;
    let tier3 = 0;

    if (gold > 0) {
        const tier1Amount = Math.min(gold, RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT);
        tier1 = tier1Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_RATE;
        total += tier1;

        if (gold > RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT) {
            const tier2Amount = Math.min(gold - RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT,
                                         RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT - RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT);
            tier2 = tier2Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_RATE;
            total += tier2;
        }

        if (gold > RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT) {
            const tier3Amount = Math.min(gold - RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT,
                                         RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_LIMIT - RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT);
            tier3 = tier3Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_RATE;
            total += tier3;
        }
    }

    return { total, tier1, tier2, tier3 };
}

function populateOneTimeInvestments(content) {
    const formContent = content.getElementById('investment-form-content');
    if (!formContent) return;

    const minInvestment = 100000;
    const maxInvestment = Math.floor(gold * 0.75 / 100000) * 100000;

    if (gold >= minInvestment) {
        const controls = cloneTemplate('template-investment-form-controls');
        if (controls) {
            formContent.appendChild(controls);
            // Clamp current amount to valid range
            currentInvestmentAmount = Math.max(minInvestment, Math.min(maxInvestment, currentInvestmentAmount));
            updateInvestmentDisplay();
        }
    } else {
        const notEnough = cloneTemplate('template-investment-not-enough');
        if (notEnough) formContent.appendChild(notEnough);
    }

    // Active investments
    if (oneTimeInvestments && oneTimeInvestments.length > 0) {
        const activeSection = content.getElementById('active-investments-section');
        const activeList = content.getElementById('active-investments-list');

        if (activeSection && activeList) {
            activeSection.hidden = false;

            for (const investment of oneTimeInvestments) {
                const card = cloneTemplate('template-investment-card');
                if (!card) continue;

                const title = card.querySelector('.investment-card-title');
                const amount = card.querySelector('.investment-card-amount');
                const progressFill = card.querySelector('.investment-progress-fill');
                const details = card.querySelector('.investment-card-details');

                title.textContent = `Investment #${investment.id}`;
                amount.textContent = formatNumber(investment.amount, 'gold');

                const percentComplete = ((120000 - investment.ticksRemaining) / 120000) * 100;
                progressFill.style.width = `${percentComplete}%`;

                const ticksElapsed = 120000 - investment.ticksRemaining;
                const totalPayout = investment.payoutPerTick * 120000;
                const payoutSoFar = investment.payoutPerTick * ticksElapsed;

                details.innerHTML = `
                    <div>Progress: ${formatNumber(ticksElapsed)} / 120,000 ticks (${percentComplete.toFixed(1)}%)</div>
                    <div>Payout per tick: ${formatNumber(investment.payoutPerTick, 'gold')}</div>
                    <div>Paid out so far: ${formatNumber(payoutSoFar, 'gold')} / ${formatNumber(totalPayout, 'gold')}</div>
                    <div>Remaining: ${formatNumber(investment.ticksRemaining)} ticks (~${(investment.ticksRemaining * 0.3 / 3600).toFixed(1)} hours)</div>
                `;

                activeList.appendChild(card);
            }
        }
    }
}

function updateInvestmentDisplay() {
    const amountDisplay = document.getElementById('investment-amount-display');
    const infoDisplay = document.getElementById('investment-info-display');

    if (amountDisplay) {
        amountDisplay.textContent = formatNumber(currentInvestmentAmount, 'gold');
    }

    if (infoDisplay) {
        const payoutPerTick = currentInvestmentAmount / 100000;
        const totalPayout = payoutPerTick * 120000;
        const roi = ((totalPayout - currentInvestmentAmount) / currentInvestmentAmount * 100).toFixed(1);
        infoDisplay.textContent = `Payout: ${formatNumber(payoutPerTick, 'gold')}/tick × 120,000 ticks = ${formatNumber(totalPayout, 'gold')} total (${roi}% ROI)`;
    }
}

function adjustInvestmentAmount(delta) {
    const minInvestment = 100000;
    const maxInvestment = Math.floor(gold * 0.75 / 100000) * 100000;

    currentInvestmentAmount = Math.max(minInvestment, Math.min(maxInvestment, currentInvestmentAmount + delta));
    updateInvestmentDisplay();
}

function setInvestmentPercent(percent) {
    const minInvestment = 100000;
    const maxInvestment = Math.floor(gold * 0.75 / 100000) * 100000;

    currentInvestmentAmount = Math.floor(gold * (percent / 100) / 100000) * 100000;
    currentInvestmentAmount = Math.max(minInvestment, Math.min(maxInvestment, currentInvestmentAmount));
    updateInvestmentDisplay();
}

function createInvestment() {
    const minInvestment = 100000;
    const maxInvestment = Math.floor(gold * 0.75 / 100000) * 100000;

    if (currentInvestmentAmount < minInvestment) {
        alert(`Minimum investment is ${formatNumber(minInvestment, 'gold')}`);
        return;
    }
    if (currentInvestmentAmount > maxInvestment) {
        alert(`Maximum investment is 75% of your gold (${formatNumber(maxInvestment, 'gold')})`);
        return;
    }
    if (currentInvestmentAmount > gold) {
        alert('Not enough gold!');
        return;
    }

    if (gameWorker) {
        gameWorker.postMessage({
            type: 'create-investment',
            data: { amount: currentInvestmentAmount }
        });
        currentInvestmentAmount = minInvestment;
        setTimeout(() => populateTransactions(), 100);
    }
}
