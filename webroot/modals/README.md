# Modal System

This directory contains all modal HTML templates for the Diggy Diggy Dwarf game.

## Structure

Each modal is stored in its own HTML file for better maintainability:

- `about-modal.html` - About/Version information
- `dwarfs-modal.html` - Dwarfs overview
- `enchant-modal.html` - Tool enchanting
- `forge-modal.html` - Forging interface
- `forging-animation-modal.html` - Forging animation
- `gem-modal.html` - Gem setting
- `gems-modal.html` - Gems collection view
- `levelup-modal.html` - Dwarf level up and stats
- `research-modal.html` - Research lab
- `sell-modal.html` - Sell material dialog
- `settings-modal.html` - Game settings
- `smelter-modal.html` - Smelter interface
- `task-details-modal.html` - Smelter task details
- `transactions-modal.html` - Finances view
- `warehouse-sell-modal.html` - Warehouse bulk sell options

## How It Works

1. The `modal-manager.js` script loads all modal HTML files asynchronously
2. Modals are inserted into the DOM when the page loads
3. The existing modal functionality (opening, closing, etc.) works unchanged

## Adding a New Modal

1. Create a new HTML file in this directory (e.g., `new-modal.html`)
2. Add the modal ID to the `modals` array in `js/modals/modal-manager.js`
3. The modal will be automatically loaded on page load

## Benefits

- **Maintainability**: Each modal is isolated in its own file
- **Organization**: Easy to find and edit specific modals
- **Performance**: Modals can be lazy-loaded if needed
- **Collaboration**: Multiple developers can work on different modals without conflicts
- **Cleaner HTML**: Main index.html is much smaller and focused on layout
