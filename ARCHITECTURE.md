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
| `dwarfs-modal.html` | Dwarfs overview list | Shows all dwarfs with level, tool, status |
| `enchant-modal.html` | Tool enchanting interface | Enchant tools to increase power |
| `forge-modal.html` | Tool forging interface | Hammer, cool, sharpen to create tools |
| `forging-animation-modal.html` | Forging animation overlay | Visual feedback during forging |
| `gem-modal.html` | Gem setting interface | Set gems into tools for bonuses |
| `gems-modal.html` | Gems collection view | View all discovered gems |
| `levelup-modal.html` | Dwarf stats and leveling | Largest modal (5.6KB) - dwarf details, skill points, tool assignment |
| `research-modal.html` | Research lab | Unlock technologies and upgrades |
| `sell-modal.html` | Individual material selling | Slider-based selling interface |
| `settings-modal.html` | Game settings | Cheat mode activation, save deletion |
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
- **Leveling:** Dwarfs gain XP for actions like digging and smelting. They level up after reaching a certain XP threshold.
- **Stats:**
    - `digPower`: Increases digging damage.
    - `strength`: Increases bucket capacity.
    - `wisdom`: Reduces research costs.
- **Energy:** Dwarfs consume energy for actions and must rest to replenish it.
- **Wages:** Dwarfs have a base wage that increases with their level. They may go on strike if they are not paid.

### Combat
- **Critical Hits:** Dwarfs have a base chance to perform a critical hit, which deals double damage. This can be increased through research.
- **One-Hit Kills:** With the right research, critical hits have a chance to instantly destroy a block.

### Research
- The research tree in `defs.js` defines all available research options.
- Research can unlock new abilities, improve dwarf stats, and provide various bonuses.
- Research has a cost in research points and gold, and some research has dependencies on other research or a minimum depth.

### Smelter
- The smelter is used to process materials.
- **Tasks:** The `smelterTasks` array in `defs.js` defines the available tasks, such as heating the furnace, smelting ore into ingots, and polishing stones.
- **Temperature:** The smelter has a temperature that must be managed. Different smelting tasks require different temperatures.
- **Polishing:** Some materials can be polished to increase their value, but there is a chance of the item breaking during the process.

### Forge
- The forge is used to craft and upgrade tools.
- The process involves hammering, cooling, and sharpening.
- The quality of the materials and the skill of the dwarf affect the final quality of the tool.

### Enchanting
- Tools can be enchanted to increase their power.
- Enchanting costs gold and the cost increases with each enchantment level.

### Gems
- Gems have a chance to spawn when a stone material is destroyed.
- They can be cut and polished at the smelter to increase their value.

### Materials
- The `materials` array in `defs.js` defines all the materials in the game, including their hardness, probability, worth, and the depth at which they can be found.

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
Research tree uses dependency chains via `requires` field:
```javascript
researchtree.push({
  id: 'advanced-smelting',
  name: 'Advanced Smelting',
  description: 'Unlock high-temperature smelting',
  cost: 500,                    // Base research points needed
  level: 0,                     // Current level (0 = not researched)
  progress: 0,                  // Current progress toward next level
  requires: 'furnace',          // Must complete 'furnace' research first
  category: 'technology'
});
```
**Research cost doubles each level** via `RESEARCH_COST_MULTIPLIER`.

---

## Common Gotchas

1. **Forgetting to sync with worker**: When changing game state in main thread (e.g., starting research), always send `update-state` message:
   ```javascript
   gameWorker.postMessage({ type: 'update-state', data: { activeResearch } });
   ```

2. **Constants out of sync**: `game-worker.js` duplicates constants from `constants.js` because workers can't import ES modules. Keep them synchronized manually.

3. **Modal pause state**: Opening a settings modal auto-pauses the game via the `gamePaused` flag. Don't forget to unpause in the close handler.

4. **Grid rendering thrash**: `updateGridDisplay()` rebuilds the entire grid HTML. For animations, manipulate CSS classes instead (see `triggerCritAnimation()`).

5. **Save/load version mismatch**: Changing the save schema requires bumping the `gameversion` string in `constants.js`.

6. **Modal timing issues**: If accessing modal elements before they load, listen for `modalsLoaded` event instead of relying on DOMContentLoaded.

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

## Version History & Migration Notes

### v0.14.1 (2024-12-23) - Modal System Refactor

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

### See `version.html` for full changelog
GitHub issues are tracked at https://github.com/Urbautz/DiggyDiggy/issues.

---

## Future Improvements

### Modal System
- [ ] Lazy load rarely-used modals (gems, warehouse-sell) only when first opened
- [ ] Bundle modal HTML into a single file for production to reduce HTTP requests
- [ ] Add loading spinner during modal initialization
- [ ] Preload critical modals (levelup, settings) before others
- [ ] Add hot-reload during development for faster iteration

### General
- [ ] Optimize grid rendering for large grids
- [ ] Add service worker for offline play
- [ ] Implement save game cloud sync
- [ ] Add achievement system

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
