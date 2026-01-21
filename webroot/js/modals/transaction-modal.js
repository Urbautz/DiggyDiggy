// ============================================================================
// TRANSACTION MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the transaction/finances modal

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
    const summaryTab = document.getElementById('finances-tab-summary');
    const recentTab = document.getElementById('finances-tab-recent');
    const investmentsTab = document.getElementById('finances-tab-investments');

    // Reset all tabs to inactive
    summaryTab.className = 'finances-tab';
    recentTab.className = 'finances-tab';
    investmentsTab.className = 'finances-tab';

    // Activate the selected tab
    if (tab === 'summary') {
        summaryTab.className = 'finances-tab active';
    } else if (tab === 'recent') {
        recentTab.className = 'finances-tab active';
    } else if (tab === 'investments') {
        investmentsTab.className = 'finances-tab active';
    }

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
    // Before deleting old transactions, ensure they're captured in hourly statistics
    if (transactionLog.length > 1000) {
        // Get the oldest transactions that will be removed
        const transactionsToRemove = transactionLog.slice(1000);

        // Always aggregate removed transactions into hourly statistics
        if (transactionsToRemove.length > 0) {
            // Group removed transactions by hour
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

            // Add or merge these hourly groups into transaction history
            for (const hour in hourlyGroups) {
                const hourTimestamp = parseInt(hour);
                const existingHourIndex = transactionHistory.findIndex(h => h.hour === hourTimestamp);

                if (existingHourIndex >= 0) {
                    // Merge with existing hour data
                    const existingHour = transactionHistory[existingHourIndex];
                    for (const desc in hourlyGroups[hour]) {
                        if (!existingHour.transactions[desc]) {
                            existingHour.transactions[desc] = hourlyGroups[hour][desc];
                        } else {
                            // Merge the data
                            existingHour.transactions[desc].income += hourlyGroups[hour][desc].income;
                            existingHour.transactions[desc].expense += hourlyGroups[hour][desc].expense;
                            existingHour.transactions[desc].count += hourlyGroups[hour][desc].count;
                        }
                    }
                } else {
                    // Add as new hour entry
                    transactionHistory.push({
                        hour: hourTimestamp,
                        transactions: hourlyGroups[hour]
                    });
                }
            }
        }

        // Now trim the transaction log to 1,000 entries
        transactionLog = transactionLog.slice(0, 1000);
    }
}

// Get timestamp for the start of the hour
function getHourTimestamp(date) {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d.getTime();
}

// Process hourly rollup: aggregate transactions and clean up old detailed log
function processHourlyRollup() {
    if (transactionLog.length === 0) return;

    // Group transactions by description for the completed hour
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

    // Add or merge the hourly summary to history
    const existingHourIndex = transactionHistory.findIndex(h => h.hour === currentHourTimestamp);

    if (existingHourIndex >= 0) {
        // Merge with existing hour data
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
        // Add as new hour entry
        transactionHistory.push({
            hour: currentHourTimestamp,
            transactions: hourlyData
        });
    }

    // Prune transaction history to keep only the last TRANSACTION_HISTORY_MAX_HOURS hours
    const cutoffTime = Date.now() - (TRANSACTION_HISTORY_MAX_HOURS * 60 * 60 * 1000);
    const originalLength = transactionHistory.length;
    transactionHistory = transactionHistory.filter(entry => entry.hour >= cutoffTime);
    if (transactionHistory.length < originalLength) {
        console.log(`Pruned ${originalLength - transactionHistory.length} old transaction history entries`);
    }

    // Clear the detailed transaction log for the completed hour
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

function populateSummaryTab(container) {
    // Check if we're viewing hour details
    if (window.viewingHourDetails) {
        populateHourDetails(container, window.viewingHourDetails);
        return;
    }

    // Calculate current hour totals (if any transactions exist)
    let currentHourIncome = 0;
    let currentHourExpense = 0;
    let currentHourCount = 0;

    // First, add up transactions currently in the log
    for (const transaction of transactionLog) {
        if (transaction.type === 'income') {
            currentHourIncome += transaction.amount;
        } else {
            currentHourExpense += transaction.amount;
        }
        currentHourCount++;
    }

    // Also check if there's already a history entry for the current hour
    // (happens when we exceed 10,000 transactions in the current hour)
    if (currentHourTimestamp !== null) {
        const existingCurrentHour = transactionHistory.find(h => h.hour === currentHourTimestamp);
        if (existingCurrentHour) {
            // Add the historical data to current hour totals
            for (const desc in existingCurrentHour.transactions) {
                currentHourIncome += existingCurrentHour.transactions[desc].income;
                currentHourExpense += existingCurrentHour.transactions[desc].expense;
                currentHourCount += existingCurrentHour.transactions[desc].count;
            }
        }
    }

    const hasCurrentHour = currentHourCount > 0;
    const hasHistory = transactionHistory.length > 0;

    if (!hasCurrentHour && !hasHistory) {
        container.innerHTML = '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No financial data yet.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; padding-right: 10px;';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Hour</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Income</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Expense</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Net</th><th style="text-align: center; padding: 8px; border-bottom: 2px solid #5b6d7a;">Actions</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Add current hour first (if exists)
    if (hasCurrentHour) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';
        tr.style.background = '#2d3f52';

        const hourTd = document.createElement('td');
        hourTd.style.padding = '8px';
        hourTd.style.fontWeight = 'bold';
        hourTd.textContent = 'Current Hour';

        const incomeTd = document.createElement('td');
        incomeTd.style.cssText = 'padding: 8px; text-align: right; color: #4ade80; font-weight: bold;';
        incomeTd.textContent = '+' + formatNumber(currentHourIncome, 'gold');

        const expenseTd = document.createElement('td');
        expenseTd.style.cssText = 'padding: 8px; text-align: right; color: #ff6b6b; font-weight: bold;';
        expenseTd.textContent = '-' + formatNumber(currentHourExpense, 'gold');

        const netTd = document.createElement('td');
        const net = currentHourIncome - currentHourExpense;
        netTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';
        netTd.style.color = net >= 0 ? '#4ade80' : '#ff6b6b';
        netTd.textContent = (net >= 0 ? '+' : '') + formatNumber(net, 'gold');

        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'padding: 8px; text-align: center;';
        const detailsBtn = document.createElement('button');
        detailsBtn.textContent = 'Details';
        detailsBtn.className = 'btn-secondary';
        detailsBtn.style.cssText = 'padding: 4px 12px; font-size: 12px;';
        detailsBtn.onclick = () => showHourDetails('current');
        actionTd.appendChild(detailsBtn);

        tr.appendChild(hourTd);
        tr.appendChild(incomeTd);
        tr.appendChild(expenseTd);
        tr.appendChild(netTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
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

        // Calculate totals for this hour
        let hourIncome = 0;
        let hourExpense = 0;

        for (const desc in hourData.transactions) {
            hourIncome += hourData.transactions[desc].income;
            hourExpense += hourData.transactions[desc].expense;
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';

        const hourTd = document.createElement('td');
        hourTd.style.padding = '8px';
        hourTd.textContent = hourStr;

        const incomeTd = document.createElement('td');
        incomeTd.style.cssText = 'padding: 8px; text-align: right; color: #4ade80;';
        incomeTd.textContent = '+' + formatNumber(hourIncome, 'gold');

        const expenseTd = document.createElement('td');
        expenseTd.style.cssText = 'padding: 8px; text-align: right; color: #ff6b6b;';
        expenseTd.textContent = '-' + formatNumber(hourExpense, 'gold');

        const netTd = document.createElement('td');
        const net = hourIncome - hourExpense;
        netTd.style.cssText = 'padding: 8px; text-align: right;';
        netTd.style.color = net >= 0 ? '#4ade80' : '#ff6b6b';
        netTd.textContent = (net >= 0 ? '+' : '') + formatNumber(net, 'gold');

        const actionTd = document.createElement('td');
        actionTd.style.cssText = 'padding: 8px; text-align: center;';
        const detailsBtn = document.createElement('button');
        detailsBtn.textContent = 'Details';
        detailsBtn.className = 'btn-secondary';
        detailsBtn.style.cssText = 'padding: 4px 12px; font-size: 12px;';
        detailsBtn.onclick = () => showHourDetails(hourData.hour);
        actionTd.appendChild(detailsBtn);

        tr.appendChild(hourTd);
        tr.appendChild(incomeTd);
        tr.appendChild(expenseTd);
        tr.appendChild(netTd);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

function showHourDetails(hourIdentifier) {
    window.viewingHourDetails = hourIdentifier;
    populateTransactions();
}

function populateHourDetails(container, hourIdentifier) {
    // Back button - fixed position, doesn't scroll
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Summary';
    backBtn.className = 'btn-secondary';
    backBtn.style.cssText = 'margin-bottom: 15px; position: sticky; top: 0; z-index: 10; background: #2a3f5a;';
    backBtn.onclick = () => {
        window.viewingHourDetails = null;
        populateTransactions();
    };
    container.appendChild(backBtn);

    // Header
    const header = document.createElement('h3');
    header.style.cssText = 'color: #ffd700; margin-bottom: 10px; font-size: 16px;';

    let transactionData = {};

    if (hourIdentifier === 'current') {
        header.textContent = 'Current Hour - Transaction Details';

        // Aggregate current transactions by description from the log
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

        // Also merge in any existing history for the current hour
        // (happens when we exceed 10,000 transactions in the current hour)
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
    } else {
        // Find the historical hour
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

    container.appendChild(header);

    if (Object.keys(transactionData).length === 0) {
        container.innerHTML += '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No transactions for this hour.</p>';
        return;
    }

    // Create details table
    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; padding-right: 10px;';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Description</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Amount</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Count</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Sort by absolute value descending
    const descriptions = Object.keys(transactionData).sort((a, b) => {
        const amountA = Math.max(transactionData[a].income, transactionData[a].expense);
        const amountB = Math.max(transactionData[b].income, transactionData[b].expense);
        return amountB - amountA;
    });

    for (const desc of descriptions) {
        const data = transactionData[desc];
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';

        const descTd = document.createElement('td');
        descTd.style.padding = '8px';
        descTd.textContent = desc;

        const amountTd = document.createElement('td');
        amountTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';

        if (data.income > 0) {
            amountTd.style.color = '#4ade80';
            amountTd.textContent = '+' + formatNumber(data.income, 'gold');
        } else if (data.expense > 0) {
            amountTd.style.color = '#ff6b6b';
            amountTd.textContent = '-' + formatNumber(data.expense, 'gold');
        } else {
            amountTd.textContent = '-';
        }

        const countTd = document.createElement('td');
        countTd.style.cssText = 'padding: 8px; text-align: right;';
        countTd.textContent = data.count;

        tr.appendChild(descTd);
        tr.appendChild(amountTd);
        tr.appendChild(countTd);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

function populateRecentTab(container) {
    if (transactionLog.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #9fbfe0; padding: 20px;">No recent transactions.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'transactions-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; padding-right: 10px;';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Time</th><th style="text-align: left; padding: 8px; border-bottom: 2px solid #5b6d7a;">Description</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Amount</th><th style="text-align: right; padding: 8px; border-bottom: 2px solid #5b6d7a;">Balance</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    for (const transaction of transactionLog) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #3a4a57';

        const timeTd = document.createElement('td');
        timeTd.style.padding = '8px';
        timeTd.textContent = transaction.timestamp;

        const descTd = document.createElement('td');
        descTd.style.padding = '8px';
        descTd.textContent = transaction.description;

        const amountTd = document.createElement('td');
        amountTd.style.cssText = 'padding: 8px; text-align: right; font-weight: bold;';
        amountTd.style.color = transaction.type === 'income' ? '#4ade80' : '#ff6b6b';
        amountTd.textContent = (transaction.type === 'income' ? '+' : '-') + formatNumber(transaction.amount, 'gold');

        const balanceTd = document.createElement('td');
        balanceTd.style.cssText = 'padding: 8px; text-align: right;';
        balanceTd.textContent = formatNumber(transaction.balance, 'gold');

        tr.appendChild(timeTd);
        tr.appendChild(descTd);
        tr.appendChild(amountTd);
        tr.appendChild(balanceTd);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

function populateInvestmentsTab(container) {
    // Check if Small Time Investments research is unlocked
    const smallTimeInvestments = researchData['small-time-investments'];
    const isUnlocked = smallTimeInvestments && (smallTimeInvestments.level || 0) > 0;

    if (!isUnlocked) {
        const lockedDiv = document.createElement('div');
        lockedDiv.className = 'investments-locked';
        lockedDiv.innerHTML = '<h3>📊 Investments</h3><p>Research "Small Time Investments" to unlock passive interest income.</p>';
        container.appendChild(lockedDiv);
        return;
    }

    // Calculate current interest rate per tick
    let totalInterest = 0;
    let tier1Interest = 0;
    let tier2Interest = 0;
    let tier3Interest = 0;

    if (gold > 0) {
        // Tier 1: First portion gets the highest rate
        const tier1Amount = Math.min(gold, RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT);
        tier1Interest = tier1Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_RATE;
        totalInterest += tier1Interest;

        // Tier 2: Middle portion gets the second rate
        if (gold > RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT) {
            const tier2Amount = Math.min(gold - RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT,
                                         RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT - RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT);
            tier2Interest = tier2Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_RATE;
            totalInterest += tier2Interest;
        }

        // Tier 3: Largest portion gets the third rate
        if (gold > RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT) {
            const tier3Amount = Math.min(gold - RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT,
                                         RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_LIMIT - RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT);
            tier3Interest = tier3Amount * RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_RATE;
            totalInterest += tier3Interest;
        }
    }

    // Create investments overview
    const header = document.createElement('h3');
    header.className = 'investments-header';
    header.textContent = '📊 Investment Portfolio';
    container.appendChild(header);

    // Interest rate card
    const interestCard = document.createElement('div');
    interestCard.className = 'investments-interest-card';

    const interestHeader = document.createElement('div');
    interestHeader.className = 'investments-interest-header';
    interestHeader.textContent = 'Small time investments';

    const totalInterestValue = document.createElement('div');
    totalInterestValue.className = 'investments-interest-total';
    totalInterestValue.textContent = '+' + formatNumber(totalInterest, 'gold');

    interestCard.appendChild(interestHeader);
    interestCard.appendChild(totalInterestValue);

    // Tier breakdown
    const breakdownHeader = document.createElement('div');
    breakdownHeader.className = 'investments-breakdown-header';
    breakdownHeader.textContent = 'Tier Breakdown (lower interest the more money you have):';
    interestCard.appendChild(breakdownHeader);

    // Tier 1
    if (tier1Interest > 0 || gold < RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT) {
        const tier1Div = document.createElement('div');
        tier1Div.className = 'investments-tier';

        const tier1Label = document.createElement('div');
        tier1Label.className = 'investments-tier-label';
        tier1Label.textContent = `Tier 1 (up to  ${formatNumber(RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT, 'gold')}: ${(RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_RATE * 100).toFixed(4)}%)`;

        const tier1Value = document.createElement('div');
        tier1Value.className = 'investments-tier-value';
        tier1Value.textContent = '+' + formatNumber(tier1Interest, 'gold');

        tier1Div.appendChild(tier1Label);
        tier1Div.appendChild(tier1Value);
        interestCard.appendChild(tier1Div);
    }

    // Tier 2
    if (tier2Interest > 0 || (gold >= RESEARCH_SMALL_TIME_INVESTMENTS_TIER1_LIMIT && gold < RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT)) {
        const tier2Div = document.createElement('div');
        tier2Div.className = 'investments-tier';

        const tier2Label = document.createElement('div');
        tier2Label.className = 'investments-tier-label';
        tier2Label.textContent = `Tier 2 (up to ${formatNumber(RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT, 'gold')}) ${(RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_RATE * 100).toFixed(6)}%)`;

        const tier2Value = document.createElement('div');
        tier2Value.className = 'investments-tier-value';
        tier2Value.textContent = '+' + formatNumber(tier2Interest, 'gold');

        tier2Div.appendChild(tier2Label);
        tier2Div.appendChild(tier2Value);
        interestCard.appendChild(tier2Div);
    }

    // Tier 3
    if (tier3Interest > 0 || gold >= RESEARCH_SMALL_TIME_INVESTMENTS_TIER2_LIMIT) {
        const tier3Div = document.createElement('div');
        tier3Div.className = 'investments-tier';

        const tier3Label = document.createElement('div');
        tier3Label.className = 'investments-tier-label';
        tier3Label.textContent = `Tier 3 (up to ${formatNumber(RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_LIMIT, 'gold')}: ${(RESEARCH_SMALL_TIME_INVESTMENTS_TIER3_RATE * 100).toFixed(8)}%)`;

        const tier3Value = document.createElement('div');
        tier3Value.className = 'investments-tier-value';
        tier3Value.textContent = '+' + formatNumber(tier3Interest, 'gold');

        tier3Div.appendChild(tier3Label);
        tier3Div.appendChild(tier3Value);
        interestCard.appendChild(tier3Div);
    }

    container.appendChild(interestCard);

    // Check if One Time Investments research is unlocked
    const oneTimeInvestmentsResearch = researchData['one-time-investments'];
    const isOneTimeUnlocked = oneTimeInvestmentsResearch && (oneTimeInvestmentsResearch.level || 0) > 0;

    if (isOneTimeUnlocked) {
        // One-time investments section
        const oneTimeHeader = document.createElement('h3');
        oneTimeHeader.className = 'investments-header';
        oneTimeHeader.style.marginTop = '30px';
        oneTimeHeader.textContent = '💰 One-Time Investments';
        container.appendChild(oneTimeHeader);

        // Create investment form
        const investmentForm = document.createElement('div');
        investmentForm.className = 'investment-form';
        investmentForm.style.cssText = 'background: #1e2a35; padding: 20px; border-radius: 8px; margin-bottom: 20px;';

        const formTitle = document.createElement('div');
        formTitle.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #9fbfe0;';
        formTitle.textContent = 'Create New Investment';
        investmentForm.appendChild(formTitle);

        const formDesc = document.createElement('div');
        formDesc.style.cssText = 'font-size: 0.9em; color: #7a8a99; margin-bottom: 15px;';
        formDesc.textContent = 'Invest 100,000 to 75% of your gold. Receive 1 gold per 100k invested for 120,000 ticks (10 hours).';
        investmentForm.appendChild(formDesc);

        // Min and max investment amounts
        const minInvestment = 100000;
        const maxInvestment = Math.floor(gold * 0.75 / 100000) * 100000;

        if (gold >= minInvestment) {
            // Track current investment amount - preserve across refreshes
            if (!window.currentInvestmentAmount || window.currentInvestmentAmount < minInvestment) {
                window.currentInvestmentAmount = minInvestment;
            }
            // Clamp to valid range
            window.currentInvestmentAmount = Math.max(minInvestment, Math.min(maxInvestment, window.currentInvestmentAmount));
            let currentAmount = window.currentInvestmentAmount;

            // Amount label
            const amountLabel = document.createElement('label');
            amountLabel.textContent = 'Amount:';
            amountLabel.style.cssText = 'color: #9fbfe0; margin-bottom: 8px; display: block;';
            investmentForm.appendChild(amountLabel);

            // Amount display
            const amountDisplay = document.createElement('div');
            amountDisplay.style.cssText = 'font-size: 1.5em; font-weight: bold; color: #4ade80; text-align: center; margin-bottom: 10px;';
            amountDisplay.id = 'investment-amount-display';
            investmentForm.appendChild(amountDisplay);

            // Button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px;';

            // Minus button
            const minusBtn = document.createElement('button');
            minusBtn.textContent = '-';
            minusBtn.className = 'btn-secondary';
            minusBtn.style.cssText = 'padding: 8px; font-size: 1.2em; font-weight: bold;';
            buttonContainer.appendChild(minusBtn);

            // Plus button
            const plusBtn = document.createElement('button');
            plusBtn.textContent = '+';
            plusBtn.className = 'btn-secondary';
            plusBtn.style.cssText = 'padding: 8px; font-size: 1.2em; font-weight: bold;';
            buttonContainer.appendChild(plusBtn);

            // 50% button
            const fiftyPercentBtn = document.createElement('button');
            fiftyPercentBtn.textContent = '50%';
            fiftyPercentBtn.className = 'btn-secondary';
            fiftyPercentBtn.style.cssText = 'padding: 8px;';
            buttonContainer.appendChild(fiftyPercentBtn);

            // Max button
            const maxBtn = document.createElement('button');
            maxBtn.textContent = 'Max';
            maxBtn.className = 'btn-secondary';
            maxBtn.style.cssText = 'padding: 8px;';
            buttonContainer.appendChild(maxBtn);

            investmentForm.appendChild(buttonContainer);

            // Info display
            const infoDisplay = document.createElement('div');
            infoDisplay.style.cssText = 'font-size: 0.9em; color: #7a8a99; margin-bottom: 15px; text-align: center;';
            infoDisplay.id = 'investment-info-display';
            investmentForm.appendChild(infoDisplay);

            // Update info when amount changes
            const updateInfo = () => {
                amountDisplay.textContent = formatNumber(currentAmount, 'gold');
                const payoutPerTick = currentAmount / 100000;
                const totalPayout = payoutPerTick * 120000;
                const roi = ((totalPayout - currentAmount) / currentAmount * 100).toFixed(1);
                infoDisplay.textContent = `Payout: ${formatNumber(payoutPerTick, 'gold')}/tick × 120,000 ticks = ${formatNumber(totalPayout, 'gold')} total (${roi}% ROI)`;
            };

            // Button handlers
            minusBtn.onclick = () => {
                currentAmount = Math.max(minInvestment, currentAmount - 100000);
                window.currentInvestmentAmount = currentAmount;
                updateInfo();
            };

            plusBtn.onclick = () => {
                currentAmount = Math.min(maxInvestment, currentAmount + 100000);
                window.currentInvestmentAmount = currentAmount;
                updateInfo();
            };

            fiftyPercentBtn.onclick = () => {
                currentAmount = Math.floor(gold * 0.5 / 100000) * 100000;
                currentAmount = Math.max(minInvestment, Math.min(maxInvestment, currentAmount));
                window.currentInvestmentAmount = currentAmount;
                updateInfo();
            };

            maxBtn.onclick = () => {
                currentAmount = maxInvestment;
                window.currentInvestmentAmount = currentAmount;
                updateInfo();
            };

            updateInfo();

            // Create button
            const createButton = document.createElement('button');
            createButton.textContent = 'Create Investment';
            createButton.className = 'btn-primary';
            createButton.style.cssText = 'width: 100%;';
            createButton.onclick = () => {
                if (currentAmount < minInvestment) {
                    alert(`Minimum investment is ${formatNumber(minInvestment, 'gold')}`);
                    return;
                }
                if (currentAmount > maxInvestment) {
                    alert(`Maximum investment is 75% of your gold (${formatNumber(maxInvestment, 'gold')})`);
                    return;
                }
                if (currentAmount > gold) {
                    alert('Not enough gold!');
                    return;
                }

                // Send message to worker to create investment
                if (gameWorker) {
                    gameWorker.postMessage({
                        type: 'create-investment',
                        data: { amount: currentAmount }
                    });
                    // Reset the amount to minimum after creating
                    window.currentInvestmentAmount = minInvestment;
                    // Refresh modal after creating
                    setTimeout(() => {
                        populateTransactions();
                    }, 100);
                }
            };
            investmentForm.appendChild(createButton);
        } else {
            const notEnoughGold = document.createElement('div');
            notEnoughGold.style.cssText = 'color: #ff6b6b; text-align: center; padding: 10px;';
            notEnoughGold.textContent = `You need at least ${formatNumber(minInvestment, 'gold')} to create an investment.`;
            investmentForm.appendChild(notEnoughGold);
        }

        container.appendChild(investmentForm);

        // Active investments list
        if (oneTimeInvestments && oneTimeInvestments.length > 0) {
            const activeHeader = document.createElement('h4');
            activeHeader.style.cssText = 'margin-top: 20px; margin-bottom: 10px; color: #9fbfe0;';
            activeHeader.textContent = 'Active Investments';
            container.appendChild(activeHeader);

            for (const investment of oneTimeInvestments) {
                const investmentCard = document.createElement('div');
                investmentCard.style.cssText = 'background: #1e2a35; padding: 15px; border-radius: 8px; margin-bottom: 10px;';

                const investmentHeader = document.createElement('div');
                investmentHeader.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';

                const investmentTitle = document.createElement('div');
                investmentTitle.style.cssText = 'font-weight: bold; color: #9fbfe0;';
                investmentTitle.textContent = `Investment #${investment.id}`;
                investmentHeader.appendChild(investmentTitle);

                const investmentAmount = document.createElement('div');
                investmentAmount.style.cssText = 'color: #4ade80;';
                investmentAmount.textContent = formatNumber(investment.amount, 'gold');
                investmentHeader.appendChild(investmentAmount);

                investmentCard.appendChild(investmentHeader);

                const progressBar = document.createElement('div');
                progressBar.style.cssText = 'background: #2a3f5a; height: 20px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;';

                const progressFill = document.createElement('div');
                const percentComplete = ((120000 - investment.ticksRemaining) / 120000) * 100;
                progressFill.style.cssText = `background: #4ade80; height: 100%; width: ${percentComplete}%; transition: width 0.3s;`;
                progressBar.appendChild(progressFill);

                investmentCard.appendChild(progressBar);

                const investmentDetails = document.createElement('div');
                investmentDetails.style.cssText = 'font-size: 0.9em; color: #7a8a99;';
                const ticksElapsed = 120000 - investment.ticksRemaining;
                const totalPayout = investment.payoutPerTick * 120000;
                const payoutSoFar = investment.payoutPerTick * ticksElapsed;
                investmentDetails.innerHTML = `
                    <div>Progress: ${formatNumber(ticksElapsed)} / 120,000 ticks (${percentComplete.toFixed(1)}%)</div>
                    <div>Payout per tick: ${formatNumber(investment.payoutPerTick, 'gold')}</div>
                    <div>Paid out so far: ${formatNumber(payoutSoFar, 'gold')} / ${formatNumber(totalPayout, 'gold')}</div>
                    <div>Remaining: ${formatNumber(investment.ticksRemaining)} ticks (~${(investment.ticksRemaining * 0.3 / 3600).toFixed(1)} hours)</div>
                `;
                investmentCard.appendChild(investmentDetails);

                container.appendChild(investmentCard);
            }
        }
    }
}
