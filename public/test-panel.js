// Test Panel for API Testing
let testPanelVisible = true;

function toggleTestPanel() {
    const panel = document.getElementById('test-panel');
    const reopenBtn = document.getElementById('test-reopen-btn');
    const toggleBtn = document.getElementById('test-toggle-panel');
    
    testPanelVisible = !testPanelVisible;
    
    if (testPanelVisible) {
        // Show panel, hide reopen button
        panel.style.display = 'block';
        reopenBtn.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'Hide Panel';
    } else {
        // Hide panel, show reopen button
        panel.style.display = 'none';
        reopenBtn.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = 'Show Panel';
    }
}

function logTestResult(title, data) {
    const results = document.getElementById('test-results');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${title}:</strong><br><pre style="font-size: 10px; margin: 5px 0;">${JSON.stringify(data, null, 2)}</pre>`;
    div.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    div.style.marginBottom = '5px';
    div.style.paddingBottom = '5px';
    results.appendChild(div);
    results.scrollTop = results.scrollHeight;
}

async function testGetPlayer() {
    try {
        logTestResult('Getting Player', 'Loading...');
        const result = await window.getPlayer();
        const data = JSON.parse(result);
        logTestResult('Get Player Result', data);
    } catch (error) {
        logTestResult('Get Player Error', error.message);
    }
}

async function testGetEnemy() {
    try {
        logTestResult('Getting Enemy', 'Loading...');
        const result = await window.getEnemy();
        const data = JSON.parse(result);
        logTestResult('Get Enemy Result', data);
    } catch (error) {
        logTestResult('Get Enemy Error', error.message);
    }
}

async function testUpdatePlayer() {
    try {
        logTestResult('Updating Player', 'Loading...');
        // Test update: give player some gold and experience
        const updates = {
            gold: 100,
            experience: 25,
            hitPoints: 95
        };
        const result = await window.updatePlayer(JSON.stringify(updates));
        const data = JSON.parse(result);
        logTestResult('Update Player Result', data);
        updateDisplayedStats(data.playerCharacter);
    } catch (error) {
        logTestResult('Update Player Error', error.message);
    }
}

// Update the displayed stats in the UI
function updateDisplayedStats(playerCharacter) {
    if (playerCharacter && playerCharacter.stats) {
        const goldSpan = document.getElementById('current-gold');
        const levelSpan = document.getElementById('current-level');
        
        if (goldSpan) goldSpan.textContent = playerCharacter.stats.gold;
        if (levelSpan) levelSpan.textContent = playerCharacter.stats.level;
    }
}

// Get current player and update display
async function refreshPlayerDisplay() {
    try {
        const result = await window.getPlayer();
        const data = JSON.parse(result);
        if (data.status === 'success') {
            updateDisplayedStats(data.playerCharacter);
        }
    } catch (error) {
        console.error('Error refreshing player display:', error);
    }
}

// Increment/Decrement functions
async function adjustGold(amount) {
    try {
        // First get current player
        const playerResult = await window.getPlayer();
        const playerData = JSON.parse(playerResult);
        
        if (playerData.status === 'success') {
            const currentGold = playerData.playerCharacter.stats.gold;
            const newGold = Math.max(0, currentGold + amount); // Don't go below 0
            
            const updates = { gold: newGold };
            const result = await window.updatePlayer(JSON.stringify(updates));
            const data = JSON.parse(result);
            
            logTestResult(`Gold ${amount > 0 ? '+' : ''}${amount}`, `${currentGold} → ${newGold}`);
            updateDisplayedStats(data.playerCharacter);
        }
    } catch (error) {
        logTestResult('Gold Adjust Error', error.message);
    }
}

async function adjustLevel(amount) {
    try {
        // First get current player
        const playerResult = await window.getPlayer();
        const playerData = JSON.parse(playerResult);
        
        if (playerData.status === 'success') {
            const currentLevel = playerData.playerCharacter.stats.level;
            const newLevel = Math.max(1, currentLevel + amount); // Don't go below 1
            
            const updates = { level: newLevel };
            const result = await window.updatePlayer(JSON.stringify(updates));
            const data = JSON.parse(result);
            
            logTestResult(`Level ${amount > 0 ? '+' : ''}${amount}`, `${currentLevel} → ${newLevel}`);
            updateDisplayedStats(data.playerCharacter);
        }
    } catch (error) {
        logTestResult('Level Adjust Error', error.message);
    }
}

// Battle system variables
let currentBattleId = null;

// Battle test functions
async function testStartBattle() {
    try {
        logTestResult('Starting Battle', 'Loading...');
        const result = await window.startBattle();
        const data = JSON.parse(result);
        
        if (data.status === 'success') {
            currentBattleId = data.battleState.battleId;
            logTestResult('Battle Started', {
                battleId: currentBattleId,
                player: data.battleState.player.username,
                enemy: data.battleState.enemy.username,
                playerHP: `${data.battleState.player.stats.hitPoints}/${data.battleState.player.stats.maxHitPoints}`,
                enemyHP: `${data.battleState.enemy.stats.hitPoints}/${data.battleState.enemy.stats.maxHitPoints}`
            });
            
            // Notify Unity about the battle
            try {
                SendMessage('BattleUIManager', 'OnBattleStarted', result);
                console.log('[Test Panel] Notified Unity about battle start');
            } catch (e) {
                console.log('[Test Panel] Could not notify Unity:', e.message);
            }
        } else {
            logTestResult('Battle Start Failed', data);
        }
    } catch (error) {
        logTestResult('Battle Start Error', error.message);
    }
}

async function testBattleAction(action) {
    if (!currentBattleId) {
        logTestResult('Battle Action Error', 'No active battle. Start a battle first!');
        return;
    }
    
    try {
        logTestResult(`Battle Action: ${action}`, 'Processing...');
        const result = await window.battleAction(currentBattleId, action);
        const data = JSON.parse(result);
        
        if (data.status === 'success') {
            // Log player turn
            if (data.playerTurn) {
                logTestResult('Player Turn', data.playerTurn.message);
            }
            
            // Log enemy turn with delay for better UX
            if (data.enemyTurn) {
                setTimeout(() => {
                    logTestResult('Enemy Turn', data.enemyTurn.message);
                }, 800); // Show enemy action after 0.8 seconds
            }
            
            // Check if battle ended
            if (data.battleEnded) {
                logTestResult('Battle Ended', {
                    winner: data.winner,
                    rewards: data.rewards
                });
                currentBattleId = null; // Reset battle
                refreshPlayerDisplay(); // Update player stats
            } else {
                // Show current HP status
                logTestResult('Battle Status', {
                    playerHP: `${data.battleState.player.stats.hitPoints}/${data.battleState.player.stats.maxHitPoints}`,
                    enemyHP: `${data.battleState.enemy.stats.hitPoints}/${data.battleState.enemy.stats.maxHitPoints}`,
                    turn: data.battleState.turnNumber
                });
            }
            
            // Notify Unity about the battle action
            try {
                SendMessage('BattleUIManager', 'OnBattleAction', result);
                console.log('[Test Panel] Notified Unity about battle action');
            } catch (e) {
                console.log('[Test Panel] Could not notify Unity:', e.message);
            }
        } else {
            logTestResult('Battle Action Failed', data);
        }
    } catch (error) {
        logTestResult('Battle Action Error', error.message);
    }
}

// Set up event listeners when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to load
    setTimeout(() => {
        const getPlayerBtn = document.getElementById('test-get-player');
        const getEnemyBtn = document.getElementById('test-get-enemy');
        const updatePlayerBtn = document.getElementById('test-update-player');
        const toggleBtn = document.getElementById('test-toggle-panel');
        
        // New increment/decrement buttons
        const goldPlusBtn = document.getElementById('test-gold-plus');
        const goldMinusBtn = document.getElementById('test-gold-minus');
        const levelUpBtn = document.getElementById('test-level-up');
        const levelDownBtn = document.getElementById('test-level-down');
        
        // Battle system buttons
        const startBattleBtn = document.getElementById('test-start-battle');
        const attackBtn = document.getElementById('test-attack');
        const defendBtn = document.getElementById('test-defend');
        const specialBtn = document.getElementById('test-special');
        const healBtn = document.getElementById('test-heal');
        
        // Reopen button
        const reopenBtn = document.getElementById('test-reopen-btn');

        if (getPlayerBtn) getPlayerBtn.addEventListener('click', () => {
            testGetPlayer().then(() => refreshPlayerDisplay());
        });
        if (getEnemyBtn) getEnemyBtn.addEventListener('click', testGetEnemy);
        if (updatePlayerBtn) updatePlayerBtn.addEventListener('click', testUpdatePlayer);
        if (toggleBtn) toggleBtn.addEventListener('click', toggleTestPanel);
        
        // Increment/Decrement event listeners
        if (goldPlusBtn) goldPlusBtn.addEventListener('click', () => adjustGold(10));
        if (goldMinusBtn) goldMinusBtn.addEventListener('click', () => adjustGold(-5));
        if (levelUpBtn) levelUpBtn.addEventListener('click', () => adjustLevel(1));
        if (levelDownBtn) levelDownBtn.addEventListener('click', () => adjustLevel(-1));
        
        // Battle system event listeners
        if (startBattleBtn) startBattleBtn.addEventListener('click', testStartBattle);
        if (attackBtn) attackBtn.addEventListener('click', () => testBattleAction('attack'));
        if (defendBtn) defendBtn.addEventListener('click', () => testBattleAction('defend'));
        if (specialBtn) specialBtn.addEventListener('click', () => testBattleAction('special'));
        if (healBtn) healBtn.addEventListener('click', () => testBattleAction('heal'));
        
        // Reopen button event listener
        if (reopenBtn) reopenBtn.addEventListener('click', toggleTestPanel);

        logTestResult('System', 'Test panel ready! Unity API functions available.');
        
        // Auto-load player stats on startup
        refreshPlayerDisplay();
    }, 2000);
});