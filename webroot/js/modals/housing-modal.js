// ============================================================================
// HOUSING MODAL FUNCTIONS
// ============================================================================
// This file contains all functions related to the housing/furniture modal

// Open the housing modal
function openHousing() {
    openModal('housing-modal');
    populateHousing();
}

// Populate the housing modal with furniture items
function populateHousing() {
    const commonRoomContainer = document.getElementById('common-room-furniture');
    const individualRoomsContainer = document.getElementById('individual-rooms-container');

    if (!commonRoomContainer || !individualRoomsContainer) return;

    // Save expanded/collapsed state before clearing
    const expandedRooms = new Set();
    const commonRoomSection = commonRoomContainer.closest('.housing-section.collapsible');
    const isCommonRoomExpanded = commonRoomSection && !commonRoomSection.classList.contains('collapsed');

    individualRoomsContainer.querySelectorAll('.individual-room').forEach(section => {
        const roomId = section.dataset.roomId;
        if (roomId && !section.classList.contains('collapsed')) {
            expandedRooms.add(roomId);
        }
    });

    // Clear existing content
    commonRoomContainer.innerHTML = '';
    individualRoomsContainer.innerHTML = '';

    // Populate common room furniture
    commonRoomFurniture.forEach(furnitureId => {
        const furniture = furnitureData[furnitureId];
        if (!furniture) return;

        const level = commonRoom.furniture[furnitureId]?.level || 0;
        const furnitureCard = createFurnitureCard(furnitureId, furniture, level, 'common', null);
        commonRoomContainer.appendChild(furnitureCard);
    });

    // Restore common room collapsed state if it was collapsed
    if (commonRoomSection && !isCommonRoomExpanded) {
        commonRoomSection.classList.add('collapsed');
        const icon = commonRoomSection.querySelector('.collapse-icon');
        if (icon) icon.textContent = '▶';
    } else if (commonRoomSection && isCommonRoomExpanded) {
        commonRoomSection.classList.remove('collapsed');
        const icon = commonRoomSection.querySelector('.collapse-icon');
        if (icon) icon.textContent = '▼';
    }

    // Populate individual rooms (collapsible)
    Object.keys(individualRooms).forEach(roomId => {
        const room = individualRooms[roomId];
        const roomSection = createIndividualRoomSection(roomId, room, expandedRooms.has(roomId));
        individualRoomsContainer.appendChild(roomSection);
    });
}

// Create a collapsible individual room section
function createIndividualRoomSection(roomId, room, isExpanded = false) {
    const section = document.createElement('div');
    section.className = 'housing-section collapsible individual-room' + (isExpanded ? '' : ' collapsed');
    section.dataset.roomId = roomId;

    // Find the dwarf assigned to this room
    const assignedDwarf = dwarfs.find(d => d.roomId === roomId);
    const dwarfName = assignedDwarf ? assignedDwarf.name : 'Unassigned';

    // Calculate total furniture level for room summary
    const totalLevel = Object.values(room.furniture).reduce((sum, f) => sum + (f.level || 0), 0);

    section.innerHTML = `
        <div class="housing-section-header" onclick="toggleHousingSection(this)">
            <span class="collapse-icon">${isExpanded ? '▼' : '▶'}</span>
            <h3 class="housing-section-title">🚪 ${room.name}</h3>
            <span class="room-dwarf">👷 ${dwarfName}</span>
            <span class="room-summary">Total Quality: ${totalLevel}</span>
        </div>
        <div class="housing-section-content">
            <div class="furniture-grid room-furniture-grid" id="furniture-${roomId}">
            </div>
        </div>
    `;

    // Populate furniture for this room
    const furnitureGrid = section.querySelector('.furniture-grid');
    individualRoomFurniture.forEach(furnitureId => {
        const furniture = furnitureData[furnitureId];
        if (!furniture) return;

        const level = room.furniture[furnitureId]?.level || 0;
        const furnitureCard = createFurnitureCard(furnitureId, furniture, level, 'individual', roomId);
        furnitureGrid.appendChild(furnitureCard);
    });

    return section;
}

// Toggle collapsible housing section
function toggleHousingSection(header) {
    const section = header.closest('.collapsible');
    if (!section) return;

    const isCollapsed = section.classList.contains('collapsed');
    const icon = header.querySelector('.collapse-icon');

    if (isCollapsed) {
        section.classList.remove('collapsed');
        if (icon) icon.textContent = '▼';
    } else {
        section.classList.add('collapsed');
        if (icon) icon.textContent = '▶';
    }
}

// Check if furniture is unlocked (research and depth requirements)
function isFurnitureUnlocked(furnitureId) {
    const furniture = furnitureData[furnitureId];
    if (!furniture) return { unlocked: false, reason: 'invalid', required: null };

    // Check depth requirement
    if (furniture.minDepth && startX < furniture.minDepth) {
        return { unlocked: false, reason: 'depth', required: furniture.minDepth };
    }

    // Check research requirement
    if (furniture.requires) {
        const research = researchData[furniture.requires];
        if (!research || (research.level || 0) < 1) {
            return { unlocked: false, reason: 'research', required: furniture.requires };
        }
    }

    return { unlocked: true };
}

// Get the cost to level up furniture to the next level (based on furniture baseCost)
function getFurnitureLevelUpCost(furnitureId, currentLevel) {
    const furniture = furnitureData[furnitureId];
    if (!furniture) return Infinity;

    const baseCost = furniture.baseCost || 10000;
    const nextLevel = currentLevel + 1;
    // Cost scales: baseCost * nextLevel * (1.15 ^ nextLevel) for exponential growth
    return Math.round(baseCost * nextLevel * Math.pow(1.15, nextLevel));
}

// Create a furniture card element
function createFurnitureCard(furnitureId, furniture, level, roomType, roomId) {
    const card = document.createElement('div');
    card.className = 'furniture-card';
    card.dataset.furnitureId = furnitureId;
    if (roomId) card.dataset.roomId = roomId;

    const unlockStatus = isFurnitureUnlocked(furnitureId);
    const cost = getFurnitureLevelUpCost(furnitureId, level);
    const canAfford = gold >= cost;

    const levelUpArgs = roomType === 'common'
        ? `'${furnitureId}', 'common', null`
        : `'${furnitureId}', 'individual', '${roomId}'`;

    // Format cost with gold icon
    const costFormatted = formatNumber(cost, 'gold');

    // Build effect description (only show if unlocked)
    let effectHtml = '';
    if (unlockStatus.unlocked && furniture.effect) {
        const effects = [];
        if (furniture.effect.restBonus) effects.push(`+${(furniture.effect.restBonus * 100).toFixed(1)}% rest`);
        if (furniture.effect.maxEnergyBonus) effects.push(`+${furniture.effect.maxEnergyBonus} max energy`);
        if (furniture.effect.digPowerBonus) effects.push(`+${(furniture.effect.digPowerBonus * 100).toFixed(1)}% dig power`);
        if (furniture.effect.critChanceBonus) effects.push(`+${(furniture.effect.critChanceBonus * 100).toFixed(1)}% crit`);
        if (furniture.effect.strengthBonus) effects.push(`+${furniture.effect.strengthBonus} strength`);
        if (furniture.effect.wisdomBonus) effects.push(`+${furniture.effect.wisdomBonus} wisdom`);
        if (furniture.effect.xpGainBonus) effects.push(`+${(furniture.effect.xpGainBonus * 100).toFixed(1)}% XP gain`);
        if (effects.length > 0) {
            effectHtml = `<div class="furniture-effect">Per quality: ${effects.join(', ')}</div>`;
        }
    }

    // Determine button state and text
    let buttonHtml;
    let lockReasonHtml = '';

    if (!unlockStatus.unlocked) {
        card.classList.add('locked');
        if (unlockStatus.reason === 'depth') {
            lockReasonHtml = `<div class="furniture-lock-reason">🔒 Requires depth ${formatNumber(unlockStatus.required, 'material')}</div>`;
            buttonHtml = `<button class="btn-levelup disabled" disabled title="Requires depth ${unlockStatus.required}">
                Locked
            </button>`;
        } else if (unlockStatus.reason === 'research') {
            const researchName = researchData[unlockStatus.required]?.name || unlockStatus.required;
            lockReasonHtml = `<div class="furniture-lock-reason">🔒 Requires: ${researchName}</div>`;
            buttonHtml = `<button class="btn-levelup disabled" disabled title="Requires ${researchName} research">
                Locked
            </button>`;
        }
    } else {
        const btnClass = canAfford ? 'btn-levelup' : 'btn-levelup cannot-afford';
        buttonHtml = `<button class="${btnClass}" onclick="levelUpFurniture(${levelUpArgs})" title="Cost: ${cost.toLocaleString()} gold">
            Improve<br><span class="levelup-cost">💰 ${costFormatted}</span>
        </button>`;
    }

    card.innerHTML = `
        <div class="furniture-icon">${furniture.icon}</div>
        <div class="furniture-info">
            <div class="furniture-name">${furniture.name}</div>
            <div class="furniture-description">${furniture.description}</div>
            ${effectHtml}
            ${lockReasonHtml}
        </div>
        <div class="furniture-actions">
            <div class="furniture-level">
                <span class="level-label">Quality:</span>
                <span class="level-value">${level}</span>
            </div>
            ${buttonHtml}
        </div>
    `;

    return card;
}

// Level up furniture
function levelUpFurniture(furnitureId, roomType, roomId) {
    const furniture = furnitureData[furnitureId];
    if (!furniture) return;

    // Check if furniture is unlocked
    const unlockStatus = isFurnitureUnlocked(furnitureId);
    if (!unlockStatus.unlocked) {
        if (unlockStatus.reason === 'depth') {
            alert(`This furniture requires reaching depth ${unlockStatus.required} first!`);
        } else if (unlockStatus.reason === 'research') {
            const researchName = researchData[unlockStatus.required]?.name || unlockStatus.required;
            alert(`This furniture requires the "${researchName}" research!`);
        }
        return;
    }

    // Get current level based on room type
    let currentLevel;
    if (roomType === 'common') {
        currentLevel = commonRoom.furniture[furnitureId]?.level || 0;
    } else {
        const room = individualRooms[roomId];
        if (!room) return;
        currentLevel = room.furniture[furnitureId]?.level || 0;
    }

    // Check cost
    const cost = getFurnitureLevelUpCost(furnitureId, currentLevel);
    if (gold < cost) {
        alert(`Not enough gold! You need ${cost.toLocaleString()} gold.`);
        return;
    }

    // Deduct gold and increase level
    gold -= cost;

    if (roomType === 'common') {
        commonRoom.furniture[furnitureId].level = currentLevel + 1;
    } else {
        individualRooms[roomId].furniture[furnitureId].level = currentLevel + 1;
    }

    // Log transaction
    if (typeof logTransaction === 'function') {
        logTransaction(`Furniture: ${furniture.name}`, 0, cost);
    }

    // Update UI
    updateGoldDisplay();
    populateHousing();
    saveGame();

    // Send updated furniture data to worker
    if (gameWorker && workerInitialized) {
        gameWorker.postMessage({
            type: 'update-state',
            data: { commonRoom, individualRooms, gold }
        });
    }
}

// Initialize furniture levels for common room and individual rooms
// Called on both new games and when loading saves (to ensure all furniture exists)
function initializeFurniture() {
    // Initialize common room furniture (ensure all furniture types exist)
    commonRoomFurniture.forEach(furnitureId => {
        if (!commonRoom.furniture[furnitureId]) {
            commonRoom.furniture[furnitureId] = { level: 0 };
        }
    });

    // Initialize individual room furniture (ensure all furniture types exist in each room)
    Object.keys(individualRooms).forEach(roomId => {
        const room = individualRooms[roomId];
        individualRoomFurniture.forEach(furnitureId => {
            if (!room.furniture[furnitureId]) {
                room.furniture[furnitureId] = { level: 0 };
            }
        });
    });
}
