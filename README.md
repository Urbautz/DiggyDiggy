# Dwarfs Digging Game

Welcome to the Dwarfs Digging Game! This is a web-based incremental game where players manage a team of dwarfs as they dig a hole deeper and deeper into the ground. 

## Project Structure

The project is organized as follows:

```
diggy-diggy
├── webroot
│   ├── index.html          # Main entry point for the web application
│   ├── game.html           # Game interface displaying the digging progress
│   ├── css
│   │   └── styles.css      # Styles for the game interface
│   └── js
│       ├── main.js         # Initializes the game and handles the game loop
│       ├── game.js         # Core game logic for managing dwarfs and digging
│       └── ui.js           # User interface interactions and updates
├── src
│   ├── models
│   │   └── dwarf.js        # Dwarf character model with properties and methods
│   ├── systems
│   │   └── digSystem.js     # Manages the digging process and game state updates
│   └── data
│       └── initialState.json # Initial game state data
├── tests
│   └── game.test.js        # Unit tests for game logic
├── package.json            # npm configuration file
├── .gitignore              # Files and directories to ignore by Git
└── README.md               # Project documentation
```

## Gameplay

- Start with one dwarf equipped with a simple stone shovel.
- The goal is to dig a hole that is 10 squares wide and as deep as possible.
- Manage your dwarfs and their digging actions to progress in the game.

## Setup Instructions

1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Open `webroot/index.html` in your web browser to start playing.

## Contribution Guidelines

Feel free to contribute to the project by submitting issues or pull requests. Your feedback and contributions are welcome!

Enjoy digging!