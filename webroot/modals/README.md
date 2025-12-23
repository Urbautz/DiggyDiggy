# Modal System - Quick Reference

**For complete modal system documentation, see [`ARCHITECTURE.md`](../../ARCHITECTURE.md#modal-system-architecture) in the project root.**

This directory contains all modal HTML templates for Diggy Diggy Dwarf. The modal system was refactored in v0.14.1 to improve maintainability.

---

## Modal Files (15 total)

| File | Purpose |
|------|---------|
| `about-modal.html` | About/Version information |
| `dwarfs-modal.html` | Dwarfs overview list |
| `enchant-modal.html` | Tool enchanting interface |
| `forge-modal.html` | Tool forging interface |
| `forging-animation-modal.html` | Forging animation overlay |
| `gem-modal.html` | Gem setting interface |
| `gems-modal.html` | Gems collection view |
| `levelup-modal.html` | Dwarf stats and leveling (largest - 5.6KB) |
| `research-modal.html` | Research lab |
| `sell-modal.html` | Individual material selling |
| `settings-modal.html` | Game settings |
| `smelter-modal.html` | Smelter task queue |
| `task-details-modal.html` | Smelter task details |
| `transactions-modal.html` | Finances/money flow |
| `warehouse-sell-modal.html` | Bulk selling options |

---

## Quick How-To

### How Modals Load
1. `modal-manager.js` loads on page load (before deferred scripts)
2. Fetches all 15 modal HTML files asynchronously in parallel
3. Inserts each modal into `document.body`
4. Dispatches `modalsLoaded` event when complete
5. Game initializes - modals are ready

### Adding a New Modal

**1. Create HTML file**:
```html
<!-- modals/my-modal.html -->
<div id="my-modal" class="modal" aria-hidden="true" role="dialog">
    <div class="modal-backdrop" data-action="close-modal"></div>
    <div class="modal-dialog" role="document">
        <header class="modal-header">
            <h2>My Feature</h2>
            <button class="modal-close" data-action="close-modal">×</button>
        </header>
        <div class="modal-body">
            <div id="my-content"></div>
        </div>
        <footer class="modal-footer">
            <button class="btn-secondary" data-action="close-modal">Close</button>
        </footer>
    </div>
</div>
```

**2. Register in `js/modals/modal-manager.js`**:
```javascript
this.modals = [
    'dwarfs-modal',
    // ... existing modals ...
    'my-modal'  // Add here
];
```

**3. Create open function in `main.js`**:
```javascript
window.openMyModal = function() {
    const modal = document.getElementById('my-modal');
    modal.setAttribute('aria-hidden', 'false');
};
```

**4. Add trigger in UI**:
```html
<button onclick="openMyModal()">Open Feature</button>
```

### Debugging

Check console for:
```
Modal loaded: dwarfs-modal
Modal loaded: forge-modal
...
All modals loaded successfully
```

Check loaded modals:
```javascript
window.modalManager.loadedModals  // Set of loaded modal names
window.modalManager.loadedModals.has('levelup-modal')  // true
```

---

## Benefits of This Architecture

✅ `index.html` reduced from 599 → 122 lines (80% smaller)
✅ Easy to find and edit specific modals
✅ Better git diffs (changes isolated to single files)
✅ No merge conflicts when multiple devs work on different modals
✅ Ready for lazy-loading optimizations

---

**For complete documentation including:**
- Technical architecture details
- Loading sequence
- Cheat mode fix explanation
- Performance considerations
- Future improvements

**See [`ARCHITECTURE.md`](../../ARCHITECTURE.md#modal-system-architecture)**
