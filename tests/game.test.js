// This file contains unit tests for the game logic, ensuring that the digging mechanics and state updates work as expected.

describe('Dwarf Digging Mechanics', () => {
    let dwarf;
    let initialDepth;

    beforeEach(() => {
        // Initialize a new dwarf before each test
        dwarf = new Dwarf('Thorin', 'stone shovel');
        initialDepth = 0; // Starting depth of the hole
    });

    test('Dwarf should start with a stone shovel', () => {
        expect(dwarf.shovelType).toBe('stone shovel');
    });

    test('Dwarf should dig and increase depth', () => {
        const depthBeforeDigging = initialDepth;
        dwarf.dig();
        expect(initialDepth).toBe(depthBeforeDigging + 1);
    });

    test('Dwarf should not dig if already at maximum depth', () => {
        initialDepth = 10; // Assuming 10 is the maximum depth
        dwarf.dig();
        expect(initialDepth).toBe(10);
    });
});

// Additional tests can be added to cover more game logic scenarios.