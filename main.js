import * as THREE from 'three';

// Create scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); // Dark background
scene.fog = new THREE.Fog(0x1a1a1a, 20, 50); // Add fog to make light beam visible

// Set up camera for top-down view
const frustumSize = 100; // Size of the view frustum
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Create ground plane
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2c3e50,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Create obstacles
const obstacles = [];
const numObstacles = 20; // Number of obstacles to create

function createObstacle(x, z, width, depth, height) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: 0x95a5a6 });
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.position.set(x, height/2, z);
    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    
    // Add collision box properties
    obstacle.userData = {
        width: width,
        depth: depth,
        height: height
    };
    
    scene.add(obstacle);
    obstacles.push(obstacle);
}

// Generate random obstacles
for (let i = 0; i < numObstacles; i++) {
    const x = (Math.random() - 0.5) * 100; // Random position between -50 and 50
    const z = (Math.random() - 0.5) * 100;
    const width = 1 + Math.random() * 3; // Random size between 1 and 4
    const depth = 1 + Math.random() * 3;
    const height = 1 + Math.random() * 2; // Random height between 1 and 3
    
    createObstacle(x, z, width, depth, height);
}

// Create player character
const playerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = 0.5; // Half the height to place on ground
player.castShadow = true;
player.receiveShadow = true;
scene.add(player);

// Add player torch light
const playerLight = new THREE.PointLight(0xffffff, 1, 10);
playerLight.position.set(0, 1.5, 0); // Slightly above the player
player.add(playerLight); // Add light as child of player so it moves with player

// Add a small glow sphere to represent the torch
const torchGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const torchMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2
});
const torchGlow = new THREE.Mesh(torchGeometry, torchMaterial);
torchGlow.position.copy(playerLight.position);
player.add(torchGlow);

// Player movement variables
const moveSpeed = 0.2;
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Collision detection function
function checkCollision(newX, newZ) {
    const playerRadius = 0.5; // Player's radius
    
    for (const obstacle of obstacles) {
        const obstacleX = obstacle.position.x;
        const obstacleZ = obstacle.position.z;
        const obstacleWidth = obstacle.userData.width;
        const obstacleDepth = obstacle.userData.depth;
        
        // Calculate the closest point on the obstacle to the player
        const closestX = Math.max(obstacleX - obstacleWidth/2, Math.min(newX, obstacleX + obstacleWidth/2));
        const closestZ = Math.max(obstacleZ - obstacleDepth/2, Math.min(newZ, obstacleZ + obstacleDepth/2));
        
        // Calculate distance between player and closest point on obstacle
        const distanceX = newX - closestX;
        const distanceZ = newZ - closestZ;
        const distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
        
        // Check if player is too close to obstacle
        if (distance < playerRadius) {
            return true; // Collision detected
        }
    }
    
    return false; // No collision
}

// Keyboard event listeners
window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
    }
});

// Create lighthouse tower
const towerGeometry = new THREE.CylinderGeometry(1.5, 1.5, 8, 32);
const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xecf0f1 });
const tower = new THREE.Mesh(towerGeometry, towerMaterial);
tower.position.y = 4.5;
tower.castShadow = true;
tower.receiveShadow = true;
scene.add(tower);

// Create rotating spotlight
const spotlight = new THREE.SpotLight(0xffff00, 8);
spotlight.position.set(0, 12, 0);
spotlight.angle = Math.PI / 8;
spotlight.penumbra = 0.05;
spotlight.decay = 0.2;
spotlight.distance = 0;
spotlight.castShadow = true;
spotlight.shadow.mapSize.width = 2048;
spotlight.shadow.mapSize.height = 2048;
spotlight.shadow.bias = -0.0001;

// Create light bulb
const bulbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 5,
    metalness: 0.1,
    roughness: 0.1,
    transparent: true,
    opacity: 0.9
});
const lightBulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
lightBulb.position.set(0, 12, 0);
lightBulb.castShadow = true;
scene.add(lightBulb);

// Add a point light to enhance the glow effect
const pointLight = new THREE.PointLight(0xffff00, 2, 10);
pointLight.position.copy(lightBulb.position);
scene.add(pointLight);

// Add a helper to visualize the spotlight (for debugging)
const spotLightHelper = new THREE.SpotLightHelper(spotlight);
scene.add(spotLightHelper);

scene.add(spotlight);

// Create spotlight target
const targetObject = new THREE.Object3D();
scene.add(targetObject);
spotlight.target = targetObject;

// Create collectible orbs
const collectibles = [];
const numCollectibles = 10; // Number of orbs to create

function createCollectible(x, z) {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0 // Start with no glow
    });
    const collectible = new THREE.Mesh(geometry, material);
    collectible.position.set(x, 0.3, z); // Slightly above ground
    collectible.castShadow = true;
    collectible.receiveShadow = true;
    
    // Add a point light to make it glow
    const orbLight = new THREE.PointLight(0x00ff00, 0, 5); // Start with no intensity
    collectible.add(orbLight);
    
    scene.add(collectible);
    collectibles.push(collectible);
}

// Function to check if a position collides with any obstacles
function checkPositionCollision(x, z) {
    const orbRadius = 0.3; // Same as collectible radius
    
    for (const obstacle of obstacles) {
        const obstacleX = obstacle.position.x;
        const obstacleZ = obstacle.position.z;
        const obstacleWidth = obstacle.userData.width;
        const obstacleDepth = obstacle.userData.depth;
        
        // Calculate the closest point on the obstacle to the orb position
        const closestX = Math.max(obstacleX - obstacleWidth/2, Math.min(x, obstacleX + obstacleWidth/2));
        const closestZ = Math.max(obstacleZ - obstacleDepth/2, Math.min(z, obstacleZ + obstacleDepth/2));
        
        // Calculate distance between orb and closest point on obstacle
        const distanceX = x - closestX;
        const distanceZ = z - closestZ;
        const distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
        
        // Check if orb is too close to obstacle
        if (distance < orbRadius) {
            return true; // Collision detected
        }
    }
    
    return false; // No collision
}

// Function to find a valid position for a collectible
function findValidPosition() {
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        
        if (!checkPositionCollision(x, z)) {
            return { x, z };
        }
        
        attempts++;
    }
    
    // If no valid position found, return a position far from obstacles
    return { x: 0, z: 0 };
}

// Generate random collectibles
for (let i = 0; i < numCollectibles; i++) {
    const { x, z } = findValidPosition();
    createCollectible(x, z);
}

// Game state
const gameState = {
    score: 0,
    totalOrbs: numCollectibles,
    collectedOrbs: 0,
    health: 100,
    maxHealth: 100,
    isGameOver: false,
    isVictory: false,
    orbsToDropOff: 0,  // Track orbs that need to be dropped off
    startTime: Date.now(),
    endTime: null,
    highScore: localStorage.getItem('highScore') || null // Changed from Infinity to null
};
window['gameState'] = gameState;

// Add score display
const scoreDiv = document.createElement('div');
scoreDiv.style.position = 'absolute';
scoreDiv.style.top = '20px';
scoreDiv.style.left = '20px';
scoreDiv.style.color = 'white';
scoreDiv.style.fontFamily = 'Arial, sans-serif';
scoreDiv.style.fontSize = '24px';
scoreDiv.style.zIndex = '1000';
document.body.appendChild(scoreDiv);

// Add health meter display
const healthDiv = document.createElement('div');
healthDiv.style.position = 'absolute';
healthDiv.style.top = '20px';
healthDiv.style.right = '20px';
healthDiv.style.color = 'white';
healthDiv.style.fontFamily = 'Arial, sans-serif';
healthDiv.style.fontSize = '24px';
healthDiv.style.zIndex = '1000';
document.body.appendChild(healthDiv);

// Add high score display
const highScoreDiv = document.createElement('div');
highScoreDiv.style.position = 'absolute';
highScoreDiv.style.top = '20px';
highScoreDiv.style.left = '50%';
highScoreDiv.style.transform = 'translateX(-50%)';
highScoreDiv.style.color = 'white';
highScoreDiv.style.fontFamily = 'Arial, sans-serif';
highScoreDiv.style.fontSize = '24px';
highScoreDiv.style.zIndex = '1000';
document.body.appendChild(highScoreDiv);

// Add game over display
const gameOverDiv = document.createElement('div');
gameOverDiv.style.position = 'absolute';
gameOverDiv.style.top = '50%';
gameOverDiv.style.left = '50%';
gameOverDiv.style.transform = 'translate(-50%, -50%)';
gameOverDiv.style.color = 'red';
gameOverDiv.style.fontFamily = 'Arial, sans-serif';
gameOverDiv.style.fontSize = '48px';
gameOverDiv.style.zIndex = '1000';
gameOverDiv.style.display = 'none';
gameOverDiv.textContent = 'GAME OVER';
document.body.appendChild(gameOverDiv);

// Add victory screen display
const victoryDiv = document.createElement('div');
victoryDiv.style.position = 'absolute';
victoryDiv.style.top = '50%';
victoryDiv.style.left = '50%';
victoryDiv.style.transform = 'translate(-50%, -50%)';
victoryDiv.style.color = 'green';
victoryDiv.style.fontFamily = 'Arial, sans-serif';
victoryDiv.style.fontSize = '48px';
victoryDiv.style.zIndex = '1000';
victoryDiv.style.display = 'none';
victoryDiv.style.textAlign = 'center';

// Create restart button
const restartButton = document.createElement('button');
restartButton.textContent = 'Play Again';
restartButton.style.marginTop = '20px';
restartButton.style.padding = '10px 20px';
restartButton.style.fontSize = '24px';
restartButton.style.cursor = 'pointer';
restartButton.style.backgroundColor = '#4CAF50';
restartButton.style.color = 'white';
restartButton.style.border = 'none';
restartButton.style.borderRadius = '5px';
restartButton.onclick = restartGame;
victoryDiv.appendChild(restartButton);

document.body.appendChild(victoryDiv);

// Add current time display
const currentTimeDiv = document.createElement('div');
currentTimeDiv.style.position = 'absolute';
currentTimeDiv.style.top = '60px';
currentTimeDiv.style.left = '50%';
currentTimeDiv.style.transform = 'translateX(-50%)';
currentTimeDiv.style.color = 'white';
currentTimeDiv.style.fontFamily = 'Arial, sans-serif';
currentTimeDiv.style.fontSize = '24px';
currentTimeDiv.style.zIndex = '1000';
document.body.appendChild(currentTimeDiv);

function updateScore() {
    scoreDiv.textContent = `Orbs: ${gameState.collectedOrbs}/${gameState.totalOrbs}`;
}

function updateHealth() {
    healthDiv.textContent = `Health: ${Math.ceil(gameState.health)}%`;
}

function gameOver() {
    gameState.isGameOver = true;
    gameOverDiv.style.display = 'block';
}

// Check if player is near the lighthouse
function isNearLighthouse() {
    const distance = Math.sqrt(
        Math.pow(player.position.x - tower.position.x, 2) + 
        Math.pow(player.position.z - tower.position.z, 2)
    );
    return distance < 5; // Within 5 units of lighthouse
}

// Function to check if player is in light
function isPlayerInLight() {
    // Check if player is near the lighthouse (always safe near lighthouse)
    const distanceToLighthouse = Math.sqrt(
        Math.pow(player.position.x - tower.position.x, 2) + 
        Math.pow(player.position.z - tower.position.z, 2)
    );
    
    if (distanceToLighthouse < 5) {
        return true;
    }
    
    // Check spotlight with a more forgiving angle
    const spotlightPos = spotlight.position;
    const targetPos = spotlight.target.position;
    const toTarget = new THREE.Vector3().subVectors(targetPos, spotlightPos);
    const toPlayer = new THREE.Vector3().subVectors(player.position, spotlightPos);
    const angle = toTarget.angleTo(toPlayer);
    const isInSpotlight = angle <= spotlight.angle; // Removed the /2 to make it twice as forgiving
    
    return isInSpotlight;
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateHighScore() {
    const currentTime = gameState.endTime - gameState.startTime;
    if (!gameState.highScore || currentTime < gameState.highScore) {
        gameState.highScore = currentTime;
        localStorage.setItem('highScore', currentTime);
        highScoreDiv.textContent = `High Score: ${formatTime(currentTime)}`;
    } else {
        highScoreDiv.textContent = `High Score: ${formatTime(gameState.highScore)}`;
    }
}

function showVictoryScreen() {
    gameState.isVictory = true;
    gameState.endTime = Date.now();
    const timeElapsed = gameState.endTime - gameState.startTime;
    
    // Update high score
    updateHighScore();
    
    // Show if new high score was achieved
    const isNewHighScore = !gameState.highScore || timeElapsed < gameState.highScore;
    
    victoryDiv.innerHTML = `
        <div style="margin-bottom: 20px;">Victory!</div>
        <div style="font-size: 24px; margin-bottom: 10px;">Time: ${formatTime(timeElapsed)}</div>
        <div style="font-size: 24px; margin-bottom: 20px; color: ${isNewHighScore ? '#ffd700' : 'inherit'}">
            ${isNewHighScore ? 'New High Score!' : `High Score: ${formatTime(gameState.highScore)}`}
        </div>
    `;
    victoryDiv.appendChild(restartButton);
    victoryDiv.style.display = 'block';
}

function restartGame() {
    // Reset game state
    gameState.collectedOrbs = 0;
    gameState.health = 100;
    gameState.isGameOver = false;
    gameState.isVictory = false;
    gameState.orbsToDropOff = 0;
    gameState.startTime = Date.now();
    gameState.endTime = null;
    
    // Reset displays
    gameOverDiv.style.display = 'none';
    victoryDiv.style.display = 'none';
    healthDiv.style.color = 'white';
    currentTimeDiv.textContent = 'Time: 0:00';
    
    // Reset player position
    player.position.set(0, 0.5, 0);
    
    // Remove all collectibles
    collectibles.forEach(collectible => {
        scene.remove(collectible);
    });
    collectibles.length = 0;
    
    // Generate new collectibles with collision checking
    for (let i = 0; i < numCollectibles; i++) {
        const { x, z } = findValidPosition();
        createCollectible(x, z);
    }
    
    // Update displays
    updateScore();
    updateHealth();
    highScoreDiv.textContent = gameState.highScore ? `High Score: ${formatTime(gameState.highScore)}` : '';
}

// Check for collectible collision
function checkCollectibleCollision() {
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const collectible = collectibles[i];
        const distance = Math.sqrt(
            Math.pow(player.position.x - collectible.position.x, 2) + 
            Math.pow(player.position.z - collectible.position.z, 2)
        );
        
        if (distance < 1) { // Within 1 unit of orb
            scene.remove(collectible);
            collectibles.splice(i, 1);
            gameState.collectedOrbs++;
            gameState.orbsToDropOff++; // Increment orbs to drop off
            updateScore();
            
            // Check for victory
            if (gameState.collectedOrbs === gameState.totalOrbs) {
                showVictoryScreen();
            }
            
            // Visual feedback
            const flash = new THREE.PointLight(0x00ff00, 2, 10);
            flash.position.copy(collectible.position);
            scene.add(flash);
            
            // Remove flash after short delay
            setTimeout(() => {
                scene.remove(flash);
            }, 200);
        }
    }
}

// Update collectible visibility based on both light sources
function updateCollectibleVisibility() {
    collectibles.forEach(collectible => {
        const isInSpotlight = isInSpotlightCone(collectible.position);
        const isInTorchRange = isInPlayerTorchRange(collectible.position);
        
        // Glow if either light source is illuminating the orb
        const isIlluminated = isInSpotlight || isInTorchRange;
        
        // Update material emissive intensity
        collectible.material.emissiveIntensity = isIlluminated ? 2 : 0;
        
        // Update point light intensity
        const orbLight = collectible.children[0];
        orbLight.intensity = isIlluminated ? 1 : 0;
    });
}

// Function to check if a point is within the spotlight cone
function isInSpotlightCone(point) {
    const spotlightPos = spotlight.position;
    const targetPos = spotlight.target.position;
    
    // Calculate direction vectors
    const toTarget = new THREE.Vector3().subVectors(targetPos, spotlightPos);
    const toPoint = new THREE.Vector3().subVectors(point, spotlightPos);
    
    // Calculate angle between vectors
    const angle = toTarget.angleTo(toPoint);
    
    // Check if point is within spotlight cone
    return angle <= spotlight.angle / 2;
}

// Function to check if a point is within player's torch range
function isInPlayerTorchRange(point) {
    const distance = Math.sqrt(
        Math.pow(player.position.x - point.x, 2) + 
        Math.pow(player.position.z - point.z, 2)
    );
    return distance < 10; // Same as playerLight.distance
}

// Function to drop off orbs at lighthouse
function dropOffOrbs() {
    if (gameState.orbsToDropOff > 0) {
        // Heal player for each orb dropped off
        gameState.health = Math.min(gameState.maxHealth, gameState.health + (20 * gameState.orbsToDropOff));
        gameState.orbsToDropOff = 0;
        updateHealth();
        
        // Visual feedback
        const flash = new THREE.PointLight(0xffff00, 2, 10);
        flash.position.copy(tower.position);
        scene.add(flash);
        
        // Remove flash after short delay
        setTimeout(() => {
            scene.remove(flash);
        }, 200);
    }
}

// Update current time display
function updateCurrentTime() {
    if (!gameState.isGameOver && !gameState.isVictory) {
        const currentTime = Date.now() - gameState.startTime;
        currentTimeDiv.textContent = `Time: ${formatTime(currentTime)}`;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (!gameState.isGameOver && !gameState.isVictory) {
        // Handle player movement with collision detection
        const newX = player.position.x;
        const newZ = player.position.z;
        let moved = false;

        // Calculate movement direction
        let dx = 0;
        let dz = 0;

        if (keys.w) dz -= 1;
        if (keys.s) dz += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dz !== 0) {
            const length = Math.sqrt(dx * dx + dz * dz);
            dx = (dx / length) * moveSpeed;
            dz = (dz / length) * moveSpeed;
        } else {
            dx *= moveSpeed;
            dz *= moveSpeed;
        }

        // Apply movement with collision detection
        if (dx !== 0) {
            const nextX = newX + dx;
            if (!checkCollision(nextX, newZ)) {
                player.position.x = nextX;
                moved = true;
            }
        }
        if (dz !== 0) {
            const nextZ = newZ + dz;
            if (!checkCollision(newX, nextZ)) {
                player.position.z = nextZ;
                moved = true;
            }
        }

        // Check for collectible collisions
        checkCollectibleCollision();

        // Check for orb drop off at lighthouse
        if (isNearLighthouse()) {
            dropOffOrbs();
        }

        // Update health based on light exposure
        const isInLight = isPlayerInLight();
        if (!isInLight) {
            gameState.health -= 0.1; // Reduced drain rate to 0.1% per frame
            if (gameState.health <= 0) {
                gameState.health = 0;
                gameOver();
            }
            // Visual feedback when health is draining
            healthDiv.style.color = 'red';
        } else {
            healthDiv.style.color = 'white';
        }
        updateHealth();

        // Update current time display
        updateCurrentTime();

        // Rotate the spotlight and light bulb
        const time = Date.now() * 0.0005;
        const radius = 40;
        targetObject.position.x = Math.cos(time) * radius;
        targetObject.position.z = Math.sin(time) * radius;
        targetObject.position.y = 0;

        // Update the spotlight helper
        spotLightHelper.update();

        // Update collectible visibility based on spotlight
        updateCollectibleVisibility();
    }

    renderer.render(scene, camera);
}

// Initialize displays
updateScore();
updateHealth();
currentTimeDiv.textContent = 'Time: 0:00';
highScoreDiv.textContent = gameState.highScore ? `High Score: ${formatTime(gameState.highScore)}` : '';

// Handle window resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the animation
animate(); 