# Diggy Diggy - Architecture Documentation

## Project Overview
Diggy Diggy is a browser-based idle/incremental dwarf mining game. Dwarfs autonomously dig through procedurally generated underground layers, collecting materials and earning gold. The game features a **Web Worker architecture** to prevent UI blocking during complex game logic calculations.

---

## Critical Architecture Concepts

### Web Worker Pattern
**This is the most important architectural decision in the codebase.**

- **Main thread** (`main.js`): Handles all UI rendering, user input, and DOM manipulation
- **Worker thread** (`game-worker.js`): Runs the game loop, executes all dwarf AI logic, and performs game state calculations
- **Communication**: Bi-directional message passing via `postMessage()`
  - Main → Worker: State updates (research changes, smelter task ordering, tool assignments)
  - Worker → Main: Tick results (updated grid, dwarf positions, gold, materials, transactions)

**Key rule**: Game state is duplicated between threads. Main thread is authoritative for UI-managed data (toolsInventory, forge interface). Worker is authoritative for simulation (dwarf movement, digging, energy, AI decisions).

### Message Types
```javascript
// Worker accepts:
{ type: 'init', data: { grid, dwarfs, materials, ... } }
{ type: 'start-loop', interval: 300 }
{ type: 'set-pause', paused: true/false }
{ type: 'update-state', data: { researchtree, smelterTasks, ... } }

// Worker sends:
{ type: 'init-complete' }
{ type: 'tick-complete', data: { grid, dwarfs, gold, transactions, ... } }
{ type: 'tick-error', error: '...' }
```

---

## File Structure & Responsibilities

```
webroot/
├── index.html           # Main HTML structure (122 lines - modals loaded separately)
├── css/
│   └── styles.css       # All game styles including modal styles
├── js/
│   ├── constants.js     # All game balance constants
│   ├── defs.js          # All game data definitions (materials, tools, research, etc.)
│   ├── game.js          # Legacy grid generation (mostly superseded)
│   ├── game-worker.js   # Web Worker - game loop, dwarf AI, collision detection
│   ├── main.js          # Main thread - UI rendering, modals, localStorage, user actions
│   ├── utils.js         # Utility functions
│   └── modals/
│       └── modal-manager.js  # Loads modal HTML files dynamically
├── modals/              # All modal HTML templates (15 files)
│   ├── about-modal.html
│   ├── dwarfs-modal.html
│   ├── enchant-modal.html
│   ├── forge-modal.html
│   ├── forging-animation-modal.html
│   ├── gem-modal.html
│   ├── gems-modal.html
│   ├── levelup-modal.html
│   ├── research-modal.html
│   ├── sell-modal.html
│   ├── settings-modal.html
│   ├── smelter-modal.html
│   ├── task-details-modal.html
│   ├── transactions-modal.html
│   └── warehouse-sell-modal.html
└── version.html         # Version history content (loaded into about-modal)
```

### `constants.js` and `defs.js` - The Single Source of Truth
All game balance constants and data definitions live here.
- `constants.js`: Contains all game balance constants, prefixed with CAPITAL_SNAKE_CASE (e.g., `DWARF_BASE_POWER`, `DWARF_ENERGY_COST_PER_DIG`).
- `defs.js`: Contains all game data definitions, such as materials, tools, the research tree, and smelter tasks.
- **Important**: Constants from `constants.js` are duplicated at the top of `game-worker.js` for worker context.

---

## Modal System Architecture

**Modals are loaded dynamically to keep index.html maintainable.**

### Why This Architecture?

**Problem**: The original `index.html` had 14 modals embedded inline, totaling 477 lines of HTML (599 total).
**Solution**: Extract each modal into its own file, load them dynamically on page initialization.
**Result**: `index.html` reduced to 122 lines (80% reduction), much easier to navigate and maintain.

### Modal Files Reference

| File | Purpose | Key Elements |
|------|---------|--------------|
| `about-modal.html` | About/Version information | Loads content from `version.html` |
| `dwarf-detail-modal.html` | Dwarf stats and leveling | Dwarf details, skill points, tool assignment, task priorities |
| `enchant-modal.html` | Tool enchanting interface | Enchant tools to increase power |
| `forge-modal.html` | Tool forging interface | Hammer, cool, sharpen to create tools |
| `forging-animation-modal.html` | Forging animation overlay | Visual feedback during forging (skippable) |
| `gem-modal.html` | Gem setting interface | Set gems into tools for bonuses |
| `gems-modal.html` | Gems collection view | View all discovered gems, sell all button |
| `research-modal.html` | Research lab | Unlock technologies and upgrades, research queue |
| `sell-modal.html` | Individual material selling | Slider-based selling interface |
| `settings-modal.html` | Game settings | Cheat mode activation, save deletion, export |
| `smelter-modal.html` | Smelter task queue | Heat furnace, smelt ores, polish gems |
| `task-details-modal.html` | Smelter task details | Shows materials, temperature, requirements |
| `transactions-modal.html` | Finances/money flow | Hourly summary and transaction log |
| `warehouse-sell-modal.html` | Bulk selling options | Sell stones, ores, ingots, etc. |

### How Modal Loading Works

**Loading Sequence:**
1. **Page Load**: `index.html` loads with `<script src="js/modals/modal-manager.js"></script>` (non-deferred script in `<head>`)
2. **DOM Ready**: Modal manager waits for `DOMContentLoaded` or runs immediately if DOM already loaded
3. **Async Fetch**: All 15 modal HTML files are fetched in parallel using `Promise.all()`
4. **DOM Insertion**: Each modal HTML is parsed and appended to `document.body`
5. **Event Dispatch**: `modalsLoaded` custom event is fired on `window` when all modals are ready
6. **Game Init**: `main.js` (deferred) initializes the game, modals are already in DOM

**Modal Manager Class** (`js/modals/modal-manager.js`):
```javascript
class ModalManager {
    constructor() {
        this.modals = ['dwarfs-modal', 'forge-modal', ...]; // Array of modal IDs
        this.loadedModals = new Set();  // Track loaded modals
        this.loadPromises = new Map();  // Prevent duplicate loads
    }

    async initializeAll() { /* Loads all modals */ }
    async loadModal(modalName) { /* Fetches and inserts single modal */ }
    async ensureLoaded(modalName) { /* Lazy load if needed (future feature) */ }
}
```

Global instance: `window.modalManager`

### Key Implementation Details

- **Timing**: Modal manager must load BEFORE deferred scripts (`main.js`, `game.js`) to ensure modals are available when needed
- **Event Listener**: `main.js` listens for `modalsLoaded` event to enable cheat mode visibility (since `settings-modal` elements aren't in DOM initially)
- **Modal Functions**: All existing modal open/close functions in `main.js` work unchanged (e.g., `openAbout()`, `openSettings()`, `openLevelUp()`)
- **No Breaking Changes**: This refactor was purely organizational - no game logic changed

### Integration with main.js

All existing modal functions work unchanged:
- `openAbout()` - Shows about modal
- `openSettings()` - Shows settings modal
- `openLevelUp(dwarfId)` - Shows dwarf level up modal
- `openResearch()` - Shows research lab
- `openSmelter()` - Shows smelter
- `openForge()` - Shows forge
- `openTransactions()` - Shows finances
- etc.

These functions just call `document.getElementById('modal-id').setAttribute('aria-hidden', 'false')` - they don't care if the modal was inline or loaded dynamically.

### Cheat Mode Fix

**Problem**: `checkCheatMode()` in `main.js` runs immediately, but `settings-modal.html` isn't loaded yet, so the cheat button visibility couldn't be set.

**Solution**: Added event listener in `main.js`:
```javascript
window.addEventListener('modalsLoaded', () => {
    if (cheatModeEnabled) {
        const cheatSection = document.getElementById('settings-cheat-section');
        const cheatButton = document.getElementById('settings-cheat-button');
        if (cheatSection) cheatSection.classList.add('visible');
        if (cheatButton) cheatButton.classList.add('visible');
    }
});
```

Now cheat mode visibility is set twice:
1. On initial check (will fail if modal not loaded yet)
2. After `modalsLoaded` event (guaranteed to work)

### Adding New Modals

**1. Create the HTML file** - `modals/my-new-modal.html`:
```html
<!-- My New Modal -->
<div id="my-new-modal" class="modal" aria-hidden="true" role="dialog" aria-label="My New Feature">
    <div class="modal-backdrop" data-action="close-modal"></div>
    <div class="modal-dialog" role="document">
        <header class="modal-header">
            <h2>My Feature</h2>
            <button class="modal-close" aria-label="Close" data-action="close-modal">×</button>
        </header>
        <div class="modal-body">
            <div id="my-feature-content">
                <!-- Your content here -->
            </div>
        </div>
        <footer class="modal-footer">
            <button class="btn-secondary" data-action="close-modal">Close</button>
        </footer>
    </div>
</div>
```

**2. Register in modal-manager.js** - Add to the `modals` array (line 8-24):
```javascript
this.modals = [
    'dwarfs-modal',
    'forge-modal',
    // ... other modals ...
    'my-new-modal'  // Add here
];
```

**3. Create open/close functions in main.js**:
```javascript
window.openMyFeature = function openMyFeature() {
    const modal = document.getElementById('my-new-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    // Populate content as needed
    document.getElementById('my-feature-content').innerHTML = '...';
};
```

**4. Add trigger in UI** - In `index.html` or dynamically created element:
```html
<button onclick="openMyFeature()">Open My Feature</button>
```

### Debugging Modal Loading

Check browser console for:
```
Modal loaded: dwarfs-modal
Modal loaded: forge-modal
...
All modals loaded successfully
```

Inspect loaded modals:
```javascript
window.modalManager.loadedModals  // Set {'dwarfs-modal', 'forge-modal', ...}
```

Check if a specific modal loaded:
```javascript
window.modalManager.loadedModals.has('levelup-modal')  // true/false
```

If modals don't appear:
- Verify fetch path is correct (`modals/[name].html`)
- Check browser console for fetch errors
- Ensure modal ID in HTML matches the filename

### Styling Modals

**CSS stays in `css/styles.css`** - we didn't separate modal CSS because:
1. Modal styles are deeply integrated with the rest of the app styles
2. Many modals share common classes (`.modal`, `.modal-dialog`, `.modal-body`, etc.)
3. Separating would require careful refactoring to avoid breaking existing styles

Modal-specific styles use selectors like:
- `#levelup-modal .dwarf-stats-grid`
- `#smelter-modal .smelter-task-row`
- `#sell-modal .sell-slider`

---

## Game Mechanics

### Dwarfs
- **Leveling:** Dwarfs gain XP for actions like digging and smelting. XP requirements scale exponentially: Level 0 needs 25 XP, Level 10 needs 1000 XP, Level 50 needs 100,000 XP.
- **Stats:**
    - `digPower`: Increases digging damage by 10% per point.
    - `strength`: Increases bucket capacity (5kg per point).
    - `wisdom`: Improves research success chance (2% per point) and enables price negotiation bonuses.
- **Energy:** Dwarfs consume energy for actions (5 per dig, 1 per move, 10 per task). They rest when energy drops below 20, recovering 15 energy per tick. Max energy increases 20% per level.
- **Wages:** Base wage is 0.01 gold per dig, increasing 18% per level (reducible via "Wage Negotiation" research).
- **Task Priorities:** Each dwarf has customizable task priorities (digging, research, smelting) and can blacklist specific tasks.
- **Skill Points Reset:** Can reset skill points for 1000 gold per dwarf level.

### Combat
- **Critical Hits:** Dwarfs have a base chance to perform a critical hit, which deals double damage. This can be increased through research.
- **One-Hit Kills:** With the right research, critical hits have a chance to instantly destroy a block.

### Research
- **Structure:** Research definitions stored in `researchData` object in `defs.js`, display order in `researchTree` array.
- **Costs:** Research costs both research points and gold. Cost formula: `baseCost × (1.3^(level-1))` rounded.
- **Success Rate:** Based on wisdom and research hardness. Higher wisdom = better success chance. Minimum 5% success rate.
- **Research Queue:** Can queue up to 5 researches. Right-click to add follow-up levels to queue automatically.
- **Hardness Scaling:** Each research level increases hardness, making it harder (requires more wisdom).
- **Dependencies:** Many researches require other researches first (specified via `requires` field).
- **Depth Unlocks:** Some researches require minimum depth (e.g., Furnace requires depth 1000).
- **Key Research Paths:**
  - **Smelting:** Furnace → Alloys → Magma Furnace → Glass Metals → Ore Enrichment
  - **Tools:** Forge → Tool Enchanting → Gem Setting
  - **Economy:** Trading → Price Negotiations → Small Time Investments → Long Term Investments
  - **Combat:** Material Science → Stone/Ore Expertise (one-hit kill chances)

### Smelter
- **Structure:** Task definitions in `smelterTasksData` object, task order in `smelterTasks` array.
- **Task Categories:**
  - **Control:** Do nothing
  - **Heating:** Coal (100° per coal, max 2000°), Magma (heats to max temp based on research)
  - **Basic Processing:** Dry mud, sieve loose stone (8% chance for bonus ore from 2× depth)
  - **Grinding:** Sandstone → Sand, Limestone → Lime
  - **Gem Cutting:** Cut and polish gems (50 ticks, +80% value)
  - **Stone Polishing:** Marble, Granite, Obsidian (50% base break chance, reduced by research)
  - **Metal Smelting:** Soft metals (copper, zinc, bronze), Iron chain (ore→pig iron→iron→steel→hardened→dwarf steel)
  - **Alloys:** Brass, Glass Metals (Dwarfen Metallic Glass, Moonsilver, Incocel, Thornless Silver)
  - **Ore Enrichment:** Wolfram, Uranium, Plutonium
- **Temperature Management:** Heat loss 0.05% per tick (reducible via "Furnace Insulation"). Max temp 1500° base, +100° per "Furnace Temperature" research level.
- **Task Progress:** Based on dwarf wisdom. Higher wisdom = faster task completion.
- **Task Hardness:** Each task has hardness rating determining difficulty and time required.
- **Hysteresis:** Auto-heating uses min/max temperature settings to avoid constant toggling.

### Forge
- The forge is used to craft and upgrade tools.
- The process involves hammering, cooling, and sharpening.
- The quality of the materials and the skill of the dwarf affect the final quality of the tool.

### Enchanting & Plating
- **Enchanting:** Unlocked via "Tool Enchanting" research. Increases tool power by 8% per level. Cost increases exponentially.
- **Plating:** Apply processed metals to tools for special effects:
  - **Zinc Plating:** -2 energy cost per dig
  - **Silver Plating:** +40% gem find probability
  - **Gold Plating:** +10% critical strike chance
  - **Wolfram/Uranium/Plutonium:** Advanced plating options (requires "Ore Enrichment" research)

### Gems
- **Spawning:** 1.2% base chance to find gems when destroying stone materials. Improved by Silver Plating (+40%).
- **Cutting & Polishing:** Unlocked via "Gem Cutting" research. Takes 50 ticks, increases value by 80%.
- **Gem Setting:** Unlocked via "Gem Setting" research. Set up to 3 cut gems into tools for bonuses:
  - **Ruby:** +2% critical hit chance per carat
  - **Emerald:** +2% gem find chance per carat
  - **Sapphire:** -1 energy cost per dig per carat
  - **Diamond:** +3% dig power per carat
  - **Amethyst:** +2 bucket capacity per carat
- **Carat Size:** Determined by depth found (depth ÷ 2500 = max carats)
- **Selling:** Can sell individual gems or use "Sell All" button in gems modal.

### Materials
- **Structure:** Materials defined in `materials` object in `defs.js`, indexed by material ID.
- **Properties:**
  - `hardness`: HP before destroyed
  - `probability`: Spawn weight (higher = more common)
  - `worth`: Base sell price (modified by trading research and price negotiations)
  - `minlevel`/`maxlevel`: Depth range where material spawns
  - `type`: Material category (Loose, Stone Soft/Medium/Hard, Ore Soft/Medium/Hard, Ingot, Gem, Special, Processed)
  - `color`: CSS color for grid display
  - `weight`: Kg per unit (affects bucket capacity)
- **Material Types:** Affect expertise bonuses and gameplay mechanics.
- **Processed Materials:** Created via smelter (ingots, polished stones, enriched ores, lime).
- **Stock Tracking:** All materials stored in `materialsStock` object (material ID → quantity).

---

## Development Workflows

### Running the Game Locally
```powershell
# Using the included Node.js server (recommended)
node server.js
# Then open http://localhost:8000

# Or PowerShell HTTP server (from serverstart.txt)
$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add("http://localhost:8000/"); ...

# Or simply open index.html in browser (works, but modals need HTTP for fetch)
```

### Debugging Worker Issues
1. Check browser console for `Worker initialized with game state` message
2. Verify `workerInitialized` flag is true before calling `postMessage()`
3. Worker errors surface as `tick-error` messages to main thread
4. Use `?cheat` URL parameter to enable debug helpers

### Modifying Game Balance
1. Update constants in `constants.js`.
2. **Also update** the matching constants at the top of `game-worker.js`.
3. Increment `gameversion` in `constants.js` to invalidate old saves.
4. Test with a new game (old saves are auto-discarded on version mismatch).

### Adding New Materials
```javascript
// In defs.js materials array:
{
  id: 'mythril',           // Unique ID (used in materialsStock object)
  name: 'Mythril Ore',
  type: 'Ore Hard',        // Affects expertise research bonuses
  hardness: 2000,          // HP before destroyed
  probability: 25,         // Weight in random spawn (higher = more common)
  worth: 5000,             // Sell price
  minlevel: 50000,         // First appears at this depth
  maxlevel: 999999,        // Stops appearing after this depth (optional)
  color: '#4a90e2'         // CSS color for grid cell
}
```

### Adding Research Items
Research uses object-based data structure with separate display order array:

**1. Add to `researchData` object in `defs.js`:**
```javascript
'my-research': {
  name: 'My New Research',
  description: 'Does something cool',
  cost: 500,                           // Base research points
  goldCost: 1000,                      // Base gold cost
  level: 0,                            // Current level
  maxlevel: 5,                         // Optional: max levels (omit for endless)
  hardness: 75,                        // Difficulty rating (affects success chance)
  requires: [{'furnace': 1}],          // Optional: prerequisite research + level
  min_depth: 5000,                     // Optional: minimum depth to unlock
  unlock_requires: 'some_event'        // Optional: special unlock condition
}
```

**2. Add ID to `researchTree` array for display order:**
```javascript
let researchTree = [
  'improved-digging',
  'my-research',  // Add here in desired display position
  'better-housing',
  // ...
];
```

**3. Implement effect in game code:**
- Main thread: Update relevant calculations in `main.js`
- Worker thread: Update duplicated logic in `game-worker.js`

**Cost formula:** `baseCost × (1.3^(level-1))` rounded to nearest integer.
**Hardness scaling:** Increases by 1 per level (up to 9999 max).
**Success chance:** Based on dwarf wisdom and research hardness (minimum 5%).

---

## Common Gotchas

1. **Forgetting to sync with worker**: When changing game state in main thread (e.g., starting research), always send `update-state` message:
   ```javascript
   gameWorker.postMessage({ type: 'update-state', data: { activeResearch } });
   ```

2. **Constants out of sync**: `game-worker.js` duplicates constants from `constants.js` because workers can't import ES modules. Keep them synchronized manually. Always update both files!

3. **Modal pause state**: Opening a settings modal auto-pauses the game via the `gamePaused` flag. Don't forget to unpause in the close handler.

4. **Grid rendering thrash**: `updateGridDisplay()` rebuilds the entire grid HTML. For animations, manipulate CSS classes instead (see `triggerCritAnimation()`).

5. **Save/load version mismatch**: Changing the save schema requires bumping the `gameversion` string in `constants.js` (currently `0.20.2`).

6. **Modal timing issues**: If accessing modal elements before they load, listen for `modalsLoaded` event instead of relying on DOMContentLoaded.

7. **Research vs Research Tree confusion**: `researchData` is the object with research definitions (indexed by ID), `researchTree` is the array controlling display order. Always update both when adding new research.

8. **Smelter task structure**: `smelterTasksData` contains task definitions, `smelterTasks` array controls priority order. Same pattern as research.

9. **Material ID changes**: Materials use string IDs as keys. Changing IDs breaks save compatibility and requires version bump.

10. **Dwarf task priorities**: Each dwarf has `taskPriority` array and `taskBlacklist` array. These are user-configurable via dwarf detail modal.

---

## Testing Strategies

- **Cheat mode**: Add `?cheat` to the URL or run on localhost to enable fast-forward helpers.
- **Manual tick inspection**: Set a breakpoint in `actForDwarf()` to step through the AI.
- **Worker console**: Worker errors show in the main console; prefix messages with "Worker:" for clarity.
- **State inspection**: Type `dwarfs`, `grid`, or `materialsStock` in the browser console (main thread globals).

---

## Performance Considerations

### Modal System
- **Initial Load**: 15 HTTP requests for modal files (could be optimized with bundling if needed)
- **Load Time**: ~50-150ms on localhost (varies by system), happens asynchronously during page init
- **Memory**: Negligible - same HTML that was previously inline
- **Caching**: Browser caches modal HTML files, subsequent loads are instant

### Game Loop
- Worker runs at 300ms intervals by default
- Dwarf AI decisions are O(n) where n = number of dwarfs
- Grid updates are batched and sent once per tick

---

## Economy System

### Price Mechanics
- **Base Prices:** Defined in `materials` object via `worth` property
- **Trading Research:** +3% sell price per level
- **Price Negotiations:** Highest wisdom dwarf gives +1% per wisdom point
- **Sell Options:**
  - Individual materials via `sell-modal.html` (slider interface)
  - Bulk selling via `warehouse-sell-modal.html` (stones, ores, ingots, etc.)
  - Sell all gems via button in `gems-modal.html`

### Investment Systems
- **Small Time Investments:** Passive interest on gold reserves (requires research)
  - Tier 1: 0.0125% rate up to 100 gold
  - Tier 2: 0.000135% rate from 100 to 10,100 gold
  - Tier 3: 0.0000000875% rate from 10,100 to 110,100 gold
- **One-Time Investments:** Active investments that pay back over 12 hours (requires research)
  - Tracked in `oneTimeInvestments` array
  - Each investment has ID, amount, timestamp, and payout tracking

### Transaction Tracking
- **Transaction Log:** Real-time log of all income/expenses in current hour
- **Transaction History:** Hourly summaries saved permanently (format: `{ hour: timestamp, transactions: {} }`)
- **Hourly Rollup:** Transactions grouped by description with income/expense/count
- **Viewing:** Access via `transactions-modal.html`

---

## Version History & Migration Notes

### v0.20.05 (2026-01-0x) - Current
- Added counter badges to GUI
- Rebalanced ore and gem probability
- Fixed smelter heat display visibility

### v0.20.04 (2026-01-01) - Glass Metals & Investments
- **New Feature:** Advanced alloys (Glass Metals research tree)
- **New Feature:** One-time investments system
- Fixed gems spawning at correct depth (5000)
- Fixed smelter task reset bug when dwarfs rest

### v0.20.03 (2025-12-30) - Research Queue
- Added research queue system (up to 5 researches)
- Added enrichable materials (Wolfram, Uranium, Plutonium)
- Research data structure refactored to object-based system
- Forging animation now skippable
- Research hardness rebalancing

### v0.20.02 (2025-12-28) - Export & Rebalancing
- Added savegame export functionality
- Materials rebalance
- Smelter and research XP rebalancing
- Various bug fixes

### v0.20.01 (2025-12-28) - Task Management
- **New Feature:** Dwarf task priorities and blacklist system
- **New Feature:** Loose stone sieving with random ore bonus (8% chance, 2× depth)
- Dwarfs now start at level 0
- Added more stone types and rebalanced stone values

### v0.20.0 (2025-12-27) - Wisdom & Economy
- Smelter progress now wisdom-dependent
- Added "Gem sell all" button
- Added "Price Negotiations" research
- Added "Small Time Investments" research

### v0.14.2 (2025-12-24) - Plating System
- **New Feature:** Tool plating system (Zinc, Silver, Gold effects)
- Fixed dwarf pathfinding bugs (no more getting stuck)
- Material IDs implemented for better performance
- Improved smelter and gem cutting UI

### v0.14.1 (2024-12-23) - Modal System Refactor
- **New Feature:** Research queue system
- Modal system refactored to separate HTML files (see Modal System Architecture section)
- Level up modal improvements
- Selling fixes

This refactor was completed on 2024-12-23. No game logic changed - purely organizational.

**What Changed**:
- Modals moved from `index.html` to `modals/*.html`
- Added `modal-manager.js` to handle loading
- Added `modalsLoaded` event for timing-dependent initialization
- Fixed cheat mode visibility bug

**What Didn't Change**:
- Modal open/close functions in `main.js`
- Modal styling in `css/styles.css`
- Modal event handlers and data population logic
- Game state management
- Any game mechanics

**Benefits**:
- ✅ **Easier Maintenance**: Find the modal you want to edit instantly
- ✅ **Smaller Files**: `index.html` went from 599 → 122 lines (80% reduction)
- ✅ **Better Git Diffs**: Changes to one modal don't pollute diffs with unrelated code
- ✅ **Parallel Development**: Multiple developers can work on different modals without merge conflicts
- ✅ **Lazy Loading Ready**: Can easily add on-demand loading for rarely-used modals
- ✅ **Clearer Separation**: HTML structure vs JavaScript logic vs Styling
- ✅ **No Breaking Changes**: All existing modal code works unchanged

### Earlier Versions
- **v0.14.0:** Bucket weight system, non-linear XP, research hardness, wisdom-based rolls
- **v0.13.x:** Gems, gem cutting, enchanting, skill point reset, iron smelting, alloys, magma furnace
- **v0.12.x:** Forging system implementation
- **v0.11.x:** Research system, critical hits, wages, money flow tracking
- **v0.10.0:** Web Worker architecture, background tab support

### See `version.html` for full changelog
GitHub issues are tracked at https://github.com/Urbautz/DiggyDiggy/issues.

---

## Data Structure Patterns

### Object + Array Pattern
Many game systems use a **dual structure** for flexibility and performance:

1. **Data Object:** Contains full definitions, indexed by ID
2. **Order Array:** Controls display/priority order, contains only IDs

**Examples:**
```javascript
// Research system
const researchData = { 'furnace': { name: '...', cost: 750, ... } };
let researchTree = ['furnace', 'forge', ...];  // Display order

// Smelter system
const smelterTasksData = { 'heat-furnace': { name: '...', ... } };
let smelterTasks = ['heat-furnace', 'smelt-copper', ...];  // Priority order

// Materials system
const materials = { 'copper ore': { hardness: 1800, ... } };
// Note: Materials only use object, no separate array
```

**Benefits:**
- Easy to reorder without touching definitions
- User can customize order (smelter task priority)
- Lookup by ID is O(1) via object
- Iteration order controlled via array

### Adding New Items to These Systems
1. Add full definition to data object
2. Add ID to order array at desired position
3. Update any dependent code (rendering, calculations)

---

## Future Improvements

### Modal System
- [ ] Lazy load rarely-used modals (gems, warehouse-sell) only when first opened
- [ ] Bundle modal HTML into a single file for production to reduce HTTP requests
- [ ] Add loading spinner during modal initialization
- [ ] Preload critical modals (dwarf-detail, settings) before others
- [ ] Add hot-reload during development for faster iteration

### Gameplay
- [ ] Add achievement system
- [ ] Implement save game cloud sync
- [ ] Add more depth-based progression (deeper = new mechanics)
- [ ] Expand investment system with more options

### Technical
- [ ] Optimize grid rendering for large grids (virtualization?)
- [ ] Add service worker for offline play
- [ ] Consider webpack/vite bundling for production
- [ ] Add automated testing for game mechanics

---

## Key Takeaway

**When implementing features, think "where does this logic belong?"**
- **Main thread** = UI/user actions
- **Worker** = simulation/AI
- **Keep both in sync via explicit message passing**

For modals:
- **HTML structure** = `modals/*.html`
- **Loading logic** = `modal-manager.js`
- **Open/close functions** = `main.js`
- **Styling** = `styles.css`
