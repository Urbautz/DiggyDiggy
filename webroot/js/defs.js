// Base data}
const gridWidth = 20;
const gridDepth = 25; // full data depth
const visibleDepth = 10; // show only 10 rows in the UI

// Material registry — easy to extend later
const materials = [
    { id: 'earth', name: 'Earth', hardness: 1, color: '#6b4b2c' },
    { id: 'clay', name: 'Clay', hardness: 3, color: '#a57f61' },
    { id: 'gravel', name: 'Sandstone', hardness: 4, color: '#443232' },
];

// Tools
const tools = [
    { name: 'Stone', power: 0.4 },
    { name: 'Bronce', power: 0.6 },
    { name: 'Copper', power: 0.8 },
]

let dwarfs = [
    { name: "Diggingston", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0},
    { name: "Shovelli", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0},
    { name: "Diggmaster", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0},
     { name: "Burrower", 
      shovelType: "Stone", 
      level: 1, xp: 0,
      x: 0, y: 0},
]
    
let grid = [];