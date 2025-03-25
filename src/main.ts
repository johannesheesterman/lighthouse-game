import { Application, Container, Graphics, Text } from 'pixi.js';
import nipplejs, { EventData, JoystickOutputData } from 'nipplejs';

// Game dimensions
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// Create the PIXI application
const app = new Application();
await app.init({
    background: '#000',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    antialias: true,
    resolution: 1,
    powerPreference: 'high-performance',
    autoDensity: true,
});

// Add the application's view to the DOM
document.body.appendChild(app.canvas);

// Style the page
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.backgroundColor = '#000000';
document.body.style.overflow = 'hidden';

// Add responsive scaling
const resize = () => {
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate scale ratio to maintain aspect ratio
    const scale = Math.min(windowWidth / GAME_WIDTH, windowHeight / GAME_HEIGHT);

    // Calculate centered position
    const newWidth = Math.round(GAME_WIDTH * scale);
    const newHeight = Math.round(GAME_HEIGHT * scale);
    const x = Math.floor((windowWidth - newWidth) / 2);
    const y = Math.floor((windowHeight - newHeight) / 2);

    // Apply styles
    app.canvas.style.position = 'absolute';
    app.canvas.style.width = `${newWidth}px`;
    app.canvas.style.height = `${newHeight}px`;
    app.canvas.style.left = `${x}px`;
    app.canvas.style.top = `${y}px`;
};

// Initial resize and add window listener
resize();
window.addEventListener('resize', resize);

// Create a container for our game objects
const gameContainer = new Container();
app.stage.addChild(gameContainer);
gameContainer.alpha = 0; // Hide game container initially

// Create orb counter text
const orbCountText = new Text('Orbs: 0/10', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: 'white',
});
orbCountText.position.set(10, 10);
gameContainer.addChild(orbCountText);

// Create health display
const maxHealth = 100;
let health = maxHealth;
const healthText = new Text(`Health: ${health}`, {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: 'white',
});
healthText.position.set(GAME_WIDTH - 150, 10);
gameContainer.addChild(healthText);

let orbsCollected = 0;

// Create the lighthouse sphere
const lighthouse = new Graphics();
lighthouse.beginFill(0xFFFFFF);
lighthouse.drawCircle(0, 0, 20);
lighthouse.endFill();
gameContainer.addChild(lighthouse);

// Create the visible light cone
const visibleLightCone = new Graphics();
visibleLightCone.beginFill(0xFFFF00, 0.4);
visibleLightCone.moveTo(0, 0);
// Calculate the distance to the corners
const maxDistance = Math.sqrt(Math.pow(GAME_WIDTH, 2) + Math.pow(GAME_HEIGHT, 2));
// Calculate the angle for the cone (in radians)
const coneAngle = Math.PI / 12;
visibleLightCone.lineTo(maxDistance, -maxDistance * Math.tan(coneAngle));
visibleLightCone.lineTo(maxDistance, maxDistance * Math.tan(coneAngle));
visibleLightCone.endFill();
gameContainer.addChild(visibleLightCone);

// Create a separate masking cone
const maskCone = new Graphics();
maskCone.beginFill(0xFFFFFF);
maskCone.moveTo(0, 0);
maskCone.lineTo(maxDistance, -maxDistance * Math.tan(coneAngle));
maskCone.lineTo(maxDistance, maxDistance * Math.tan(coneAngle));
maskCone.endFill();
gameContainer.addChild(maskCone);

// Constants
const playerSpeed = 2;
const boxSize = 30;
const orbRadius = 8;
const lighthouseRadius = 40; // Safe zone around lighthouse
const healthRestoreAmount = 25; // Health restored when dropping off an orb
const keys = new Set<string>();

let carriedOrbs = 0; // Track number of orbs being carried
let orbsDelivered = 0; // Track orbs delivered to lighthouse

// Create player sphere
const playerRadius = 5;
const player = new Graphics();
player.beginFill(0xFF0000);  // Red color
player.drawCircle(0, 0, playerRadius);  // Smaller than lighthouse
player.endFill();
player.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);  // Start at center
gameContainer.addChild(player);

// Create carried orbs counter text
const carriedOrbsText = new Text('0', {
    fontFamily: 'Arial',
    fontSize: 16,
    fill: '#00FFFF', // Cyan color to match orbs
});
carriedOrbsText.position.set(0, -20); // Position above player
carriedOrbsText.anchor.set(0.5, 0.5); // Center the text
carriedOrbsText.visible = false;
player.addChild(carriedOrbsText);

// Key press handlers
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Create a container for boxes and orbs that will be masked
const maskedContainer = new Container();
gameContainer.addChild(maskedContainer);

// Create a container for box glows
const boxGlowsContainer = new Container();
gameContainer.addChild(boxGlowsContainer);

// Check if a position is valid for spawning (not overlapping with lighthouse or boxes)
const isValidSpawnPosition = (x: number, y: number, width: number, height: number): boolean => {
    // Check lighthouse distance - use the object's corners
    const corners = [
        { x, y },
        { x: x + width, y },
        { x, y: y + height },
        { x: x + width, y: y + height }
    ];
    
    // Check collision with lighthouse
    for (const corner of corners) {
        const dx = corner.x - GAME_WIDTH / 2;
        const dy = corner.y - GAME_HEIGHT / 2;
        if (dx * dx + dy * dy < lighthouseRadius * lighthouseRadius) {
            return false;
        }
    }

    // Check collision with boxes
    for (let i = 0; i < maskedContainer.children.length; i++) {
        const box = maskedContainer.children[i];
        if (box instanceof Graphics && box.width === boxSize) {  // Check if it's a box
            // Check if the object's corners intersect with the box
            for (const corner of corners) {
                if (corner.x >= box.x && 
                    corner.x <= box.x + boxSize && 
                    corner.y >= box.y && 
                    corner.y <= box.y + boxSize) {
                    return false;
                }
            }
        }
    }

    return true;
};

// Create random boxes with glow effects
const numBoxes = 20;
const boxGlows = new Map<Graphics, Graphics>(); // Map to track box-glow pairs
const boxGlowDistance = 100; // Distance at which boxes start to glow

for (let i = 0; i < numBoxes; i++) {
    let x, y;
    do {
        x = Math.random() * (GAME_WIDTH - boxSize);
        y = Math.random() * (GAME_HEIGHT - boxSize);
    } while (!isValidSpawnPosition(x, y, boxSize, boxSize));

    const box = new Graphics();
    box.beginFill(0x00FF00);
    box.drawRect(0, 0, boxSize, boxSize);
    box.endFill();
    box.position.set(x, y);
    maskedContainer.addChild(box);

    // Create glow effect for this box
    const glow = new Graphics();
    glow.beginFill(0x00FF00, 0.3);
    glow.drawRect(-5, -5, boxSize + 10, boxSize + 10);
    glow.endFill();
    glow.position.set(x, y);
    glow.visible = false;
    boxGlowsContainer.addChild(glow);
    boxGlows.set(box, glow);
}

// Create a container for orbs
const orbsContainer = new Container();
maskedContainer.addChild(orbsContainer);

// Create a container for orb glows
const orbGlowsContainer = new Container();
gameContainer.addChild(orbGlowsContainer);

// Create random orbs with valid positions
const numOrbs = 10;
const orbGlowDistance = 100; // Distance at which orbs start to glow
const orbGlows = new Map<Graphics, Graphics>(); // Map to track orb-glow pairs

for (let i = 0; i < numOrbs; i++) {
    let x, y;
    do {
        x = Math.random() * (GAME_WIDTH - 2 * orbRadius) + orbRadius;
        y = Math.random() * (GAME_HEIGHT - 2 * orbRadius) + orbRadius;
    } while (!isValidSpawnPosition(x, y, orbRadius * 2, orbRadius * 2));

    const orb = new Graphics();
    orb.beginFill(0x00FFFF);  // Cyan color
    orb.drawCircle(0, 0, orbRadius);
    orb.endFill();
    orb.position.set(x, y);
    orbsContainer.addChild(orb);

    // Create glow effect for this orb
    const glow = new Graphics();
    glow.beginFill(0x00FFFF, 0.3);
    glow.drawCircle(0, 0, orbRadius * 2);
    glow.endFill();
    glow.position.set(x, y);
    glow.visible = false;
    orbGlowsContainer.addChild(glow);
    orbGlows.set(orb, glow);
}

// Collision detection helper
const checkBoxCollision = (playerX: number, playerY: number): boolean => {
    for (let i = 0; i < maskedContainer.children.length; i++) {
        const box = maskedContainer.children[i];
        if (box instanceof Graphics && box.width === boxSize) {  // Check if it's a box
            // Check if player circle intersects with box rectangle
            const closestX = Math.max(box.x, Math.min(playerX, box.x + boxSize));
            const closestY = Math.max(box.y, Math.min(playerY, box.y + boxSize));
            
            const distanceX = playerX - closestX;
            const distanceY = playerY - closestY;
            const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
            
            if (distanceSquared < (playerRadius * playerRadius)) {
                return true;
            }
        }
    }
    return false;
};

// Update orb glows
const updateOrbGlows = () => {
    for (const [orb, glow] of orbGlows) {
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < orbGlowDistance) {
            // Calculate glow intensity based on distance
            const intensity = 1 - (distance / orbGlowDistance);
            glow.visible = true;
            glow.alpha = intensity * 0.3;
        } else {
            glow.visible = false;
        }
    }
};

// Update box glows
const updateBoxGlows = () => {
    for (const [box, glow] of boxGlows) {
        // Calculate distance from player to box center
        const boxCenterX = box.x + boxSize / 2;
        const boxCenterY = box.y + boxSize / 2;
        const dx = player.x - boxCenterX;
        const dy = player.y - boxCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < boxGlowDistance) {
            // Calculate glow intensity based on distance
            const intensity = 1 - (distance / boxGlowDistance);
            glow.visible = true;
            glow.alpha = intensity * 0.3;
        } else {
            glow.visible = false;
        }
    }
};

// Check for orb collection
const checkOrbCollection = () => {
    for (let i = orbsContainer.children.length - 1; i >= 0; i--) {
        const orb = orbsContainer.children[i] as Graphics;
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < playerRadius + orbRadius) {
            orbsContainer.removeChild(orb);
            // Remove glow effect
            const glow = orbGlows.get(orb);
            if (glow) {
                orbGlowsContainer.removeChild(glow);
                orbGlows.delete(orb);
            }
            carriedOrbs++;
            carriedOrbsText.visible = true;
            carriedOrbsText.text = carriedOrbs.toString();
            break;
        }
    }
};

// Check for orb delivery to lighthouse
const checkOrbDelivery = () => {
    if (carriedOrbs > 0) {
        const dx = player.x - GAME_WIDTH / 2;
        const dy = player.y - GAME_HEIGHT / 2;
        const distanceToLighthouse = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceToLighthouse < lighthouseRadius) {
            // Deliver all carried orbs
            orbsDelivered += carriedOrbs;
            orbsCollected += carriedOrbs;
            orbCountText.text = `Orbs: ${orbsCollected}/${numOrbs}`;
            
            // Restore health for each orb delivered
            const totalHealthRestore = Math.min(healthRestoreAmount * carriedOrbs, maxHealth - health);
            health = Math.min(maxHealth, health + totalHealthRestore);
            healthText.text = `Health: ${Math.round(health)}`;
            lastHealth = health;
            
            // Update health text color
            if (health >= 50) {
                healthText.style.fill = '#FFFFFF';
            } else if (health >= 25) {
                healthText.style.fill = '#FFFF00';
            }

            // Reset carried orbs
            carriedOrbs = 0;
            carriedOrbsText.visible = false;

            // Check for victory condition
            if (orbsCollected >= numOrbs) {
                isGameOver = true;
                victoryContainer.visible = true;
            }
        }
    }
};

// Set up masking with the separate mask cone
maskedContainer.mask = maskCone;

// Center the lighthouse and light cones
const centerObjects = () => {
    lighthouse.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    visibleLightCone.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    maskCone.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
};

// Initial centering
centerObjects();

// Check if player is in light or safe zone
const isPlayerSafe = (): boolean => {
    // Check if player is near lighthouse
    const dx = player.x - GAME_WIDTH / 2;
    const dy = player.y - GAME_HEIGHT / 2;
    const distanceToLighthouse = Math.sqrt(dx * dx + dy * dy);
    if (distanceToLighthouse < lighthouseRadius * 1.5) { // Safe zone slightly larger than lighthouse radius
        return true;
    }

    // Check if player is in light cone
    // Convert player position to lighthouse-relative coordinates
    const relativeX = player.x - GAME_WIDTH / 2;
    const relativeY = player.y - GAME_HEIGHT / 2;
    
    // Calculate angle between player and light cone's current direction
    const playerAngle = Math.atan2(relativeY, relativeX);
    let lightAngle = rotation % (2 * Math.PI);
    
    // Normalize angles
    const normalizedPlayerAngle = (playerAngle + 2 * Math.PI) % (2 * Math.PI);
    const normalizedLightAngle = (lightAngle + 2 * Math.PI) % (2 * Math.PI);
    
    // Calculate angular difference
    let angleDiff = Math.abs(normalizedPlayerAngle - normalizedLightAngle);
    if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
    }
    
    return angleDiff <= coneAngle;
};

// Add game state flag
let isGameOver = false;

// Add timer variables
let startTime = Date.now();
let gameTime = 0;

// Create timer display
const timerText = new Text('Time: 0:00', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: 'white',
});
timerText.anchor.set(0.5, 0); // Center horizontally, align to top
timerText.position.set(GAME_WIDTH / 2, 10);
gameContainer.addChild(timerText);

// Format time as MM:SS
const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Animation loop
let rotation = 0;
let lastHealth = health;
const healthDecreaseRate = 0.1; // Health points lost per frame when in darkness

// Create start screen
const startContainer = new Container();
app.stage.addChild(startContainer);

// Create game title
const titleText = new Text('LONE BEACON', {
    fontFamily: 'Arial',
    fontSize: 64,
    fill: '#FFFFFF',
    align: 'center',
    fontWeight: 'bold',
});
titleText.anchor.set(0.5);
titleText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 3);
startContainer.addChild(titleText);

// Create start button
const startButton = new Graphics();
startButton.beginFill(0x00FF00);
startButton.drawRoundedRect(-60, -25, 120, 50, 10);
startButton.endFill();
startButton.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
startContainer.addChild(startButton);

// Create start button text
const startButtonText = new Text('START GAME', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: '#FFFFFF',
    align: 'center',
});
startButtonText.anchor.set(0.5);
startButtonText.position.set(0, 0);
startButton.addChild(startButtonText);

// Make start button interactive
startButton.eventMode = 'static';
startButton.cursor = 'pointer';

// Create game info text
const gameInfoText = new Text(
    'Game Information:\n' +
    '• Collect orbs in the darkness\n' +
    '• Return to the lighthouse to restore health\n' +
    '• Stay in the light or near the lighthouse\n' +
    '• Collect all orbs to win',
    {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: '#FFFFFF',
        align: 'right',
    }
);
gameInfoText.anchor.set(1, 1); // Align to bottom right
gameInfoText.position.set(GAME_WIDTH - 20, GAME_HEIGHT - 20);
startContainer.addChild(gameInfoText);

// Create controls text
const controlsText = new Text(
    'Controls:\n' +
    'WASD or Arrow Keys to move\n' +
    'Collect orbs to restore health\n' +
    'Return to lighthouse to deliver orbs',
    {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: '#FFFFFF',
        align: 'left',
    }
);
controlsText.anchor.set(0, 1); // Align to bottom left
controlsText.position.set(20, GAME_HEIGHT - 20);
startContainer.addChild(controlsText);

// Function to detect touch screen support
const isTouchDevice = () => {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            // @ts-ignore
            (navigator.msMaxTouchPoints > 0));
};

// Add NippleJS for mobile controls only if touch is supported
let joystick: any = null;
if (isTouchDevice()) {
    const joystickOptions = {
        zone: document.body,
        mode: 'static' as const,
        position: { left: '50%', bottom: '20%' },
        color: 'white',
        size: 120,
        lockY: false,
        fadeTime: 250
    };

    // Create joystick
    joystick = nipplejs.create(joystickOptions);

    // Add joystick event listeners
    joystick.on('start', () => {
        // Optional: Add visual feedback when joystick is active
    });

    joystick.on('move', (evt: EventData, data: JoystickOutputData) => {
        // Use direction data directly from NippleJS
        const dx = data.vector.x;
        const dy = data.vector.y;
        
        // Update movement keys based on joystick input
        keys.clear(); // Clear existing keys
        if (Math.abs(dx) > 0.5) {
            keys.add(dx > 0 ? 'arrowright' : 'arrowleft');
        }
        if (Math.abs(dy) > 0.5) {
            keys.add(dy < 0 ? 'arrowup' : 'arrowdown'); // Fixed the inverted controls
        }
    });

    joystick.on('end', () => {
        // Clear movement keys when joystick is released
        keys.clear();
    });

    // Add CSS for joystick
    const style = document.createElement('style');
    style.textContent = `
        .nipple {
            opacity: 0.6;
        }
        .nipple.active {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    // Update controls text for touch devices
    controlsText.text = 'Controls:\n' +
        'WASD or Arrow Keys to move\n' +
        'Virtual joystick for touch\n' +
        'Collect orbs to restore health\n' +
        'Return to lighthouse to deliver orbs';
}

app.ticker.add(() => {
    if (!isGameOver) {
        rotation += 0.01;
        visibleLightCone.rotation = rotation;
        maskCone.rotation = rotation;

        // Update timer
        gameTime = Date.now() - startTime;
        timerText.text = `Time: ${formatTime(gameTime)}`;
    }

    // Update health based on player position
    if (!isPlayerSafe() && !isGameOver) {
        health = Math.max(0, health - healthDecreaseRate);
        if (health !== lastHealth) {
            healthText.text = `Health: ${Math.round(health)}`;
            lastHealth = health;
            
            // Update text color based on health
            if (health < 25) {
                healthText.style.fill = '#FF0000';
            } else if (health < 50) {
                healthText.style.fill = '#FFFF00';
            }

            // Check for game over
            if (health <= 0) {
                isGameOver = true;
                gameOverContainer.visible = true;
            }
        }
    }

    // Update orb and box glows
    updateOrbGlows();
    updateBoxGlows();

    // Player movement
    if (!isGameOver) {
        let dx = 0;
        let dy = 0;

        // Handle keyboard input
        if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
        if (keys.has('arrowright') || keys.has('d')) dx += 1;
        if (keys.has('arrowup') || keys.has('w')) dy -= 1;
        if (keys.has('arrowdown') || keys.has('s')) dy += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const normalizer = 1 / Math.sqrt(2);
            dx *= normalizer;
            dy *= normalizer;
        }

        // Calculate new position
        const newX = Math.max(playerRadius, Math.min(GAME_WIDTH - playerRadius, player.x + dx * playerSpeed));
        const newY = Math.max(playerRadius, Math.min(GAME_HEIGHT - playerRadius, player.y + dy * playerSpeed));

        // Only move if no collision
        if (!checkBoxCollision(newX, newY)) {
            player.x = newX;
            player.y = newY;
        }

        // Check for orb collection and delivery
        checkOrbCollection();
        checkOrbDelivery();
    }
});

// Function to reset game state
const resetGame = () => {
    // Reset game state
    isGameOver = false;

    // Reset timer
    startTime = Date.now();
    gameTime = 0;
    timerText.text = 'Time: 0:00';

    // Reset player position
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT / 2;

    // Reset health
    health = maxHealth;
    lastHealth = health;
    healthText.text = `Health: ${health}`;
    healthText.style.fill = '#FFFFFF';

    // Reset orb counters
    orbsCollected = 0;
    carriedOrbs = 0;
    orbsDelivered = 0;
    orbCountText.text = `Orbs: 0/${numOrbs}`;
    carriedOrbsText.visible = false;

    // Reset rotation
    rotation = 0;
    visibleLightCone.rotation = 0;
    maskCone.rotation = 0;

    // Clear existing orbs, boxes, and glows
    while (orbsContainer.children.length > 0) {
        orbsContainer.removeChildAt(0);
    }
    while (orbGlowsContainer.children.length > 0) {
        orbGlowsContainer.removeChildAt(0);
    }
    while (boxGlowsContainer.children.length > 0) {
        boxGlowsContainer.removeChildAt(0);
    }
    while (maskedContainer.children.length > 0) {
        maskedContainer.removeChildAt(0);
    }

    // Recreate boxes with glows
    for (let i = 0; i < numBoxes; i++) {
        let x, y;
        do {
            x = Math.random() * (GAME_WIDTH - boxSize);
            y = Math.random() * (GAME_HEIGHT - boxSize);
        } while (!isValidSpawnPosition(x, y, boxSize, boxSize));

        const box = new Graphics();
        box.beginFill(0x00FF00);
        box.drawRect(0, 0, boxSize, boxSize);
        box.endFill();
        box.position.set(x, y);
        maskedContainer.addChild(box);

        // Create glow effect for this box
        const glow = new Graphics();
        glow.beginFill(0x00FF00, 0.3);
        glow.drawRect(-5, -5, boxSize + 10, boxSize + 10);
        glow.endFill();
        glow.position.set(x, y);
        glow.visible = false;
        boxGlowsContainer.addChild(glow);
        boxGlows.set(box, glow);
    }

    // Recreate orbs
    for (let i = 0; i < numOrbs; i++) {
        let x, y;
        do {
            x = Math.random() * (GAME_WIDTH - 2 * orbRadius) + orbRadius;
            y = Math.random() * (GAME_HEIGHT - 2 * orbRadius) + orbRadius;
        } while (!isValidSpawnPosition(x, y, orbRadius * 2, orbRadius * 2));

        const orb = new Graphics();
        orb.beginFill(0x00FFFF);
        orb.drawCircle(0, 0, orbRadius);
        orb.endFill();
        orb.position.set(x, y);
        orbsContainer.addChild(orb);

        const glow = new Graphics();
        glow.beginFill(0x00FFFF, 0.3);
        glow.drawCircle(0, 0, orbRadius * 2);
        glow.endFill();
        glow.position.set(x, y);
        glow.visible = false;
        orbGlowsContainer.addChild(glow);
        orbGlows.set(orb, glow);
    }

    // Hide game over and victory screens
    gameOverContainer.visible = false;
    victoryContainer.visible = false;

    // Show start screen and hide game
    startContainer.visible = true;
    gameContainer.alpha = 0;
};

// Create game over screen
const gameOverContainer = new Container();
gameOverContainer.visible = false;
gameContainer.addChild(gameOverContainer);

// Create game over text
const gameOverText = new Text('GAME OVER', {
    fontFamily: 'Arial',
    fontSize: 48,
    fill: '#FF0000',
    align: 'center',
});
gameOverText.anchor.set(0.5);
gameOverText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
gameOverContainer.addChild(gameOverText);

// Create restart button
const restartButton = new Graphics();
restartButton.beginFill(0x00FF00);
restartButton.drawRoundedRect(-60, -25, 120, 50, 10);
restartButton.endFill();
restartButton.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
gameOverContainer.addChild(restartButton);

// Create restart text
const restartText = new Text('Restart Game', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: '#FFFFFF',
    align: 'center',
});
restartText.anchor.set(0.5);
restartText.position.set(0, 0);
restartButton.addChild(restartText);

// Make button interactive
restartButton.eventMode = 'static';
restartButton.cursor = 'pointer';

// Add click handler for restart button
restartButton.on('pointerdown', resetGame);

// Create victory screen
const victoryContainer = new Container();
victoryContainer.visible = false;
gameContainer.addChild(victoryContainer);

// Create victory text
const victoryText = new Text('VICTORY!', {
    fontFamily: 'Arial',
    fontSize: 48,
    fill: '#00FF00',
    align: 'center',
});
victoryText.anchor.set(0.5);
victoryText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
victoryContainer.addChild(victoryText);

// Create victory message
const victoryMessage = new Text('', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: '#FFFFFF',
    align: 'center',
});
victoryMessage.anchor.set(0.5);
victoryMessage.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
victoryContainer.addChild(victoryMessage);

// Create victory restart button
const victoryRestartButton = new Graphics();
victoryRestartButton.beginFill(0x00FF00);
victoryRestartButton.drawRoundedRect(-60, -25, 120, 50, 10);
victoryRestartButton.endFill();
victoryRestartButton.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
victoryContainer.addChild(victoryRestartButton);

// Create victory restart text
const victoryRestartText = new Text('Play Again', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: '#FFFFFF',
    align: 'center',
});
victoryRestartText.anchor.set(0.5);
victoryRestartText.position.set(0, 0);
victoryRestartButton.addChild(victoryRestartText);

// Make victory button interactive
victoryRestartButton.eventMode = 'static';
victoryRestartButton.cursor = 'pointer';

// Add click handler for victory restart button
victoryRestartButton.on('pointerdown', resetGame);

// Check for victory condition
if (orbsCollected >= numOrbs) {
    isGameOver = true;
    victoryMessage.text = `You collected all the orbs!\nTime: ${formatTime(gameTime)}`;
    victoryContainer.visible = true;
}

// Hide game elements initially
gameContainer.alpha = 0;

// Function to start the game
const startGame = () => {
    startContainer.visible = false;
    gameContainer.alpha = 1;
    startTime = Date.now();
};

// Add click handler for start button
startButton.on('pointerdown', startGame);

// Check for victory condition
if (orbsCollected >= numOrbs) {
    isGameOver = true;
    victoryMessage.text = `You collected all the orbs!\nTime: ${formatTime(gameTime)}`;
    victoryContainer.visible = true;
} 