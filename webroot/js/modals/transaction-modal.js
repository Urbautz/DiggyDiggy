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

    if (tab === 'summary') {
        summaryTab.className = 'finances-tab active';
        summaryTab.style.cssText = 'flex: 1; padding: 10px; background: #4a5f7a; border: none; color: #fff; cursor: pointer; border-bottom: 3px solid #ffd700; font-weight: bold;';
        recentTab.className = 'finances-tab';
        recentTab.style.cssText = 'flex: 1; padding: 10px; background: #2a3f5a; border: none; color: #9fbfe0; cursor: pointer; border-bottom: 3px solid transparent;';
    } else {
        recentTab.className = 'finances-tab active';
        recentTab.style.cssText = 'flex: 1; padding: 10px; background: #4a5f7a; border: none; color: #fff; cursor: pointer; border-bottom: 3px solid #ffd700; font-weight: bold;';
        summaryTab.className = 'finances-tab';
        summaryTab.style.cssText = 'flex: 1; padding: 10px; background: #2a3f5a; border: none; color: #9fbfe0; cursor: pointer; border-bottom: 3px solid transparent;';
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

    // Add the hourly summary to history
    transactionHistory.push({
        hour: currentHourTimestamp,
        transactions: hourlyData
    });

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
    } else {
        populateRecentTab(container);
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

    for (const transaction of transactionLog) {
        if (transaction.type === 'income') {
            currentHourIncome += transaction.amount;
        } else {
            currentHourExpense += transaction.amount;
        }
        currentHourCount++;
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

        // Aggregate current transactions by description
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
