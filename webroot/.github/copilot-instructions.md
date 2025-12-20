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
├── constants.js    # All game balance constants
├── defs.js         # All game data definitions (materials, tools, research, etc.)
├── game.js         # Legacy grid generation (mostly superseded)
├── game-worker.js  # Web Worker - game loop, dwarf AI, collision detection
└── main.js         # Main thread - UI rendering, modals, localStorage, user actions
```

### `constants.js` and `defs.js` - The Single Source of Truth
All game balance constants and data definitions live here.
- `constants.js`: Contains all game balance constants, prefixed with CAPITAL_SNAKE_CASE (e.g., `DWARF_BASE_POWER`, `DWARF_ENERGY_COST_PER_DIG`).
- `defs.js`: Contains all game data definitions, such as materials, tools, the research tree, and smelter tasks.
- **Important**: Constants from `constants.js` are duplicated at the top of `game-worker.js` for worker context.

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

## Common Gotchas

1. **Forgetting to sync with worker**: When changing game state in main thread (e.g., starting research), always send `update-state` message:
   ```javascript
   gameWorker.postMessage({ type: 'update-state', data: { activeResearch } });
   ```

2. **Constants out of sync**: `game-worker.js` duplicates constants from `constants.js` because workers can't import ES modules. Keep them synchronized manually.

3. **Modal pause state**: Opening a settings modal auto-pauses the game via the `gamePaused` flag. Don't forget to unpause in the close handler.

4. **Grid rendering thrash**: `updateGridDisplay()` rebuilds the entire grid HTML. For animations, manipulate CSS classes instead (see `triggerCritAnimation()`).

5. **Save/load version mismatch**: Changing the save schema requires bumping the `gameversion` string in `constants.js`.

## Testing Strategies

- **Cheat mode**: Add `?cheat` to the URL to enable fast-forward helpers.
- **Manual tick inspection**: Set a breakpoint in `actForDwarf()` to step through the AI.
- **Worker console**: Worker errors show in the main console; prefix messages with "Worker:" for clarity.
- **State inspection**: Type `dwarfs`, `grid`, or `materialsStock` in the browser console (main thread globals).

## Version History Location
See `version.html` for the changelog (rendered inside the "About" modal). GitHub issues are tracked at https://github.com/Urbautz/DiggyDiggy/issues.

---

**Key takeaway**: When implementing features, think "where does this logic belong?" Main thread = UI/user actions. Worker = simulation/AI. Keep both in sync via explicit message passing.