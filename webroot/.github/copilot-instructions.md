# Diggy Diggy - AI Coding Agent Instructions

## Project Overview
Diggy Diggy is a browser-based idle/incremental dwarf mining game. Dwarfs autonomously dig through procedurally generated underground layers, collecting materials and earning gold. The game features a **Web Worker architecture** to prevent UI blocking during complex game logic calculations.

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

## File Structure & Responsibilities

```
js/
├── defs.js         # All game constants, material definitions, initial state
├── game.js         # Legacy grid generation (mostly superseded)
├── game-worker.js  # Web Worker - game loop, dwarf AI, collision detection
└── main.js         # Main thread - UI rendering, modals, localStorage, user actions
```

### `defs.js` - The Single Source of Truth
All game balance constants live here (prefixed with CAPITAL_SNAKE_CASE):
- `DWARF_BASE_POWER`, `DWARF_ENERGY_COST_PER_DIG`, etc.
- Material definitions (`materials` array with hardness, probability, depth ranges)
- Initial dwarf roster, tool definitions, research tree, smelter tasks
- **Important**: Constants are duplicated at the top of `game-worker.js` for worker context

### `game-worker.js` - The Game Engine
Contains the entire dwarf AI state machine:
- **States**: `idle`, `moving`, `digging`, `resting`, `researching`, `smelting`, `striking`, `unloading`
- **Core functions**:
  - `actForDwarf(dwarf)` - Main AI decision loop for each dwarf
  - `tick()` - Called every 300ms via internal `setInterval`
  - `getDwarfToolPower(dwarf)` - Calculates damage output
  - `scheduleMove(dwarf, x, y)` - Path planning
  - `checkAndShiftTopRows()` - Infinite downward scrolling mechanic

**Reservation system**: Prevents dwarfs from colliding or double-booking:
- `reservedDigBy` Map - cell coordinates → dwarf name
- `researchReservedBy` - single dwarf can reserve research building
- `smelterReservedBy` - single dwarf can reserve smelter

**Stuck detection**: If dwarf is at same position with same cell hardness for 100 ticks → teleport to house

### `main.js` - The UI Controller (4100+ lines)
Organized into logical sections:
- **Lines 1-1000**: Grid rendering, dwarf display, material panel updates
- **Lines 1000-2000**: Research tree UI, smelter task ordering, forge modal
- **Lines 2000-3000**: Modal management, settings, transaction log
- **Lines 3000-4000**: Worker initialization, save/load, game loop interface
- **Lines 4000+**: Cheat code system

**Critical UI patterns**:
- Modals use `aria-hidden="true/false"` for accessibility
- `data-action` attributes drive modal close buttons
- Dynamic content uses `aria-live="polite"` regions
- Grid cells use `data-row` and `data-col` attributes for coordinate mapping

## Development Workflows

### Running the Game Locally
```powershell
# Single-line PowerShell HTTP server (from serverstart.txt)
$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add("http://localhost:8000/"); ...
```
Or just open `index.html` in a browser (works due to no server dependencies).

### Debugging Worker Issues
1. Check browser console for `Worker initialized with game state` message
2. Verify `workerInitialized` flag is true before calling `postMessage()`
3. Worker errors surface as `tick-error` messages to main thread
4. Use `?cheat` URL parameter to enable debug helpers

### Modifying Game Balance
1. Update constants in `defs.js` (e.g., `DWARF_BASE_POWER = 3`)
2. **Also update** matching constant at top of `game-worker.js` (worker doesn't import modules)
3. Increment `gameversion` in `defs.js` to invalidate old saves
4. Test with new game (old saves auto-discard on version mismatch)

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

## Game-Specific Patterns

### Grid Coordinate System
- Grid is `Array<Array<{materialId: string, hardness: number}>>`
- Visual grid is 10 columns × 10 visible rows
- Actual grid is 11 rows deep (extra buffer row)
- `startX` tracks how many rows have been "dug past" (for infinite depth)
- When top row is fully cleared → shift grid up, add new row at bottom, increment `startX`

### Dwarf AI Priority System
1. **Energy < 25** → Return to house for rest (overrides all tasks)
2. **Bucket full** → Return to warehouse to unload
3. **At idle with 50% chance** → Check for research/smelting tasks
4. **Standing on diggable cell** → Start digging
5. **No valid target** → Random walk to find diggable cell

### Smelter Task Priority
`smelterTasks` array is user-sortable (drag-to-reorder UI):
- Tasks execute in array order (top-to-bottom)
- `do-nothing` task acts as a **stop marker** (tasks below it are disabled)
- Worker checks for `task.requires` research unlock before executing
- Temperature-gated tasks (e.g., `minTemp: 1200`) skip if furnace too cold

### Transaction Logging System
Worker queues events in `pendingTransactions[]`, main thread logs to localStorage:
```javascript
// In worker:
pendingTransactions.push({ type: 'expense', amount: wage, description: 'Digging wage' });

// In main.js:
function logTransaction(type, amount, desc) {
  transactionLog.push({ type, amount, description: desc, timestamp: Date.now() });
  // Hourly rollup for performance
}
```

## Common Gotchas

1. **Forgetting to sync with worker**: When changing game state in main thread (e.g., starting research), always send `update-state` message:
   ```javascript
   gameWorker.postMessage({ type: 'update-state', data: { activeResearch } });
   ```

2. **Constants out of sync**: `game-worker.js` duplicates ~40 constants from `defs.js` because workers can't import ES modules. Keep them synchronized manually.

3. **Modal pause state**: Opening settings modal auto-pauses game via `gamePaused` flag. Don't forget to unpause in close handler.

4. **Grid rendering thrash**: `updateGridDisplay()` rebuilds entire grid HTML. For animations, manipulate CSS classes instead (see `triggerCritAnimation()`).

5. **Save/load version mismatch**: Changing save schema requires bumping `gameversion` string in `defs.js`.

## Testing Strategies

- **Cheat mode**: Add `?cheat` to URL to enable fast-forward helpers
- **Manual tick inspection**: Set breakpoint in `actForDwarf()` to step through AI
- **Worker console**: Worker errors show in main console, prefix messages with "Worker:"
- **State inspection**: Type `dwarfs`, `grid`, or `materialsStock` in browser console (main thread globals)

## Version History Location
See `version.html` for changelog (rendered inside About modal). GitHub issues tracked at https://github.com/Urbautz/DiggyDiggy/issues.

---

**Key takeaway**: When implementing features, think "where does this logic belong?" Main thread = UI/user actions. Worker = simulation/AI. Keep both in sync via explicit message passing.
