function dig(dwarfs, grid) {
    // Check if there are any dwarfs available to dig
    if (dwarfs.length === 0) {
        console.log("No dwarfs available to dig.");
        return;
    }

    // Loop through each dwarf and perform digging action
    dwarfs.forEach(dwarf => {
        // Find the first available depth to dig
        for (let depth = 0; depth < grid.length; depth++) {
            if (grid[depth].isDug === false) {
                grid[depth].isDug = true; // Mark the square as dug
                console.log(`${dwarf.name} dug at depth ${depth + 1} with a ${dwarf.shovelType}.`);
                break; // Exit the loop after digging
            }
        }
    });
}

// Export the dig function for use in other modules
export { dig };