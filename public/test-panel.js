// Test Panel for API Testing (ADMIN ONLY)
let testPanelVisible = false;
let isAdmin = false;
let currentUsername = null;

// Check if current user is admin
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/init');
        const data = await response.json();
        currentUsername = data.username;
        
        // Enable for dreamingcolors only
        isAdmin = (currentUsername === 'dreamingcolors');
        
        // Show admin button if user is admin
        if (isAdmin) {
            showAdminButton();
        }
        
        return isAdmin;
    } catch (error) {
        console.error('[Admin Check] Error:', error);
        return false;
    }
}

// Show admin button instead of auto-opening panel
function showAdminButton() {
    const adminBtn = document.getElementById('admin-access-btn');
    if (adminBtn) {
        adminBtn.style.display = 'block';
        adminBtn.style.visibility = 'visible';
        console.log('[Admin] Button shown for dreamingcolors');
    }
}

// Toggle test panel visibility
function toggleTestPanel() {
    if (!isAdmin) {
        console.log('[Test Panel] Access denied - admin only');
        return;
    }
    
    const panel = document.getElementById('test-panel');
    const adminBtn = document.getElementById('admin-access-btn');
    
    testPanelVisible = !testPanelVisible;
    
    if (testPanelVisible) {
        // Show panel, hide admin button
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        if (adminBtn) adminBtn.style.display = 'none';
        console.log('[Admin Panel] Opened');
    } else {
        // Hide panel, show admin button
        panel.style.display = 'none';
        panel.style.visibility = 'hidden';
        if (adminBtn) {
            adminBtn.style.display = 'block';
            adminBtn.style.visibility = 'visible';
        }
        console.log('[Admin Panel] Closed');
    }
}

// Show admin panel
function showAdminPanel() {
    const panel = document.getElementById('test-panel');
    const adminBtn = document.getElementById('admin-access-btn');
    
    if (panel) {
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        if (adminBtn) adminBtn.style.display = 'none';
        testPanelVisible = true;
        console.log('[Admin Panel] Opened');
        
        // Add admin-specific features
        addAdminFeatures();
    }
}

// Show admin panel
function showAdminPanel() {
    const panel = document.getElementById('test-panel');
    const reopenBtn = document.getElementById('test-reopen-btn');
    const adminBtn = document.getElementById('admin-access-btn');
    
    if (panel && reopenBtn) {
        // Override the hidden styles for admin
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        reopenBtn.style.display = 'none'; // Start with panel open, reopen button hidden
        reopenBtn.style.visibility = 'hidden';
        
        // Hide the admin access button when panel is open
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
        
        testPanelVisible = true;
        console.log('[Admin Panel] Opened for admin user');
        
        // Add admin-specific features
        addAdminFeatures();
        
        // Set up the reopen button click handler
        reopenBtn.addEventListener('click', toggleTestPanel);
        
        // Update toggle button text
        const toggleBtn = document.getElementById('test-toggle-panel');
        if (toggleBtn) {
            toggleBtn.textContent = 'Hide Panel';
        }
    }
}

function toggleTestPanel() {
    if (!isAdmin) {
        console.log('[Test Panel] Access denied - admin only');
        return;
    }
    
    const panel = document.getElementById('test-panel');
    const reopenBtn = document.getElementById('test-reopen-btn');
    const toggleBtn = document.getElementById('test-toggle-panel');
    const adminBtn = document.getElementById('admin-access-btn');
    
    testPanelVisible = !testPanelVisible;
    
    if (testPanelVisible) {
        // Show panel, hide reopen button and admin button
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        reopenBtn.style.display = 'none';
        reopenBtn.style.visibility = 'hidden';
        if (adminBtn) adminBtn.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'Hide Panel';
        console.log('[Admin Panel] Opened');
    } else {
        // Hide panel, show admin button (not reopen button)
        panel.style.display = 'none';
        panel.style.visibility = 'hidden';
        reopenBtn.style.display = 'none';
        reopenBtn.style.visibility = 'hidden';
        if (adminBtn) {
            adminBtn.style.display = 'block';
            adminBtn.style.visibility = 'visible';
        }
        if (toggleBtn) toggleBtn.textContent = 'Show Panel';
        console.log('[Admin Panel] Closed - showing admin button');
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

async function testGetLeaderboard() {
    try {
        logTestResult('Getting Leaderboard', 'Loading...');
        const result = await window.getLeaderboard();
        const data = JSON.parse(result);
        
        if (data.status === 'success') {
            logTestResult('Leaderboard Result', {
                totalPlayers: data.totalPlayers,
                playerRank: data.playerRank,
                topPlayers: data.leaderboard?.slice(0, 5) // Show top 5
            });
        } else {
            logTestResult('Leaderboard Error', data);
        }
    } catch (error) {
        logTestResult('Leaderboard Error', error.message);
    }
}

// Test leaderboard management functions
async function testCreateTestEntries() {
    try {
        logTestResult('Creating Test Entries', 'Loading...');
        const response = await fetch('/api/admin/create-test-entries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        logTestResult('Create Test Entries Result', data);
    } catch (error) {
        logTestResult('Create Test Entries Error', error.message);
    }
}

async function testRemoveTestEntries() {
    try {
        logTestResult('Removing Test Entries', 'Loading...');
        const response = await fetch('/api/admin/remove-test-entries', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        logTestResult('Remove Test Entries Result', data);
    } catch (error) {
        logTestResult('Remove Test Entries Error', error.message);
    }
}

async function testDebugLeaderboard() {
    try {
        logTestResult('Debug Leaderboard', 'Loading...');
        const response = await fetch('/api/admin/debug-leaderboard');
        const data = await response.json();
        logTestResult('Debug Leaderboard Result', data);
    } catch (error) {
        logTestResult('Debug Leaderboard Error', error.message);
    }
}

async function testNuclearCleanup() {
    try {
        logTestResult('☢️ NUCLEAR CLEANUP', 'Wiping entire leaderboard...');
        const response = await fetch('/api/admin/nuclear-cleanup-leaderboard', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const data = await response.json();
        logTestResult('Nuclear Cleanup Result', data);
    } catch (error) {
        logTestResult('Nuclear Cleanup Error', error.message);
    }
}

async function testEnemyPreview(difficulty) {
    try {
        logTestResult(`Getting ${difficulty} Enemy Preview`, 'Loading...');
        const result = await window.getEnemyPreview(difficulty, false);
        const data = JSON.parse(result);
        
        if (data.status === 'success') {
            logTestResult(`${difficulty} Enemy Preview`, {
                enemy: data.enemy.username,
                level: data.enemy.stats.level,
                levelDiff: data.levelDifference,
                rewards: data.expectedRewards,
                stats: {
                    hp: `${data.enemy.stats.hitPoints}/${data.enemy.stats.maxHitPoints}`,
                    attack: data.enemy.stats.attack,
                    defense: data.enemy.stats.defense
                }
            });
        } else {
            logTestResult('Enemy Preview Error', data);
        }
    } catch (error) {
        logTestResult('Enemy Preview Error', error.message);
    }
}

async function testResetPlayer() {
    try {
        logTestResult('Resetting Player Stats', 'Resetting to defaults...');
        console.log('[Test Panel] Calling resetPlayer...');
        const result = await window.resetPlayer();
        console.log('[Test Panel] Reset result:', result);
        const data = JSON.parse(result);
        console.log('[Test Panel] Parsed reset data:', data);
        
        if (data.status === 'success') {
            logTestResult('Reset Success', {
                message: data.message,
                newStats: {
                    level: data.playerCharacter.stats.level,
                    gold: data.playerCharacter.stats.gold,
                    hp: `${data.playerCharacter.stats.hitPoints}/${data.playerCharacter.stats.maxHitPoints}`,
                    attack: data.playerCharacter.stats.attack,
                    defense: data.playerCharacter.stats.defense
                }
            });
            
            // Force refresh player data from server
            setTimeout(async () => {
                try {
                    if (typeof window.getPlayer !== 'function') {
                        console.error('[Test Panel] getPlayer function not available');
                        refreshPlayerDisplay();
                        return;
                    }
                    
                    const freshPlayerResult = await window.getPlayer();
                    const freshPlayerData = JSON.parse(freshPlayerResult);
                    console.log('[Test Panel] Fresh player data after reset:', freshPlayerData);
                    
                    // Refresh the display with fresh data
                    refreshPlayerDisplay();
                    
                    // Notify Unity with fresh data
                    try {
                        SendMessage('PlayerManager', 'OnPlayerDataUpdated', freshPlayerResult);
                        console.log('[Test Panel] Notified Unity about fresh player data');
                    } catch (e) {
                        console.log('[Test Panel] Could not notify Unity:', e.message);
                    }
                } catch (error) {
                    console.error('[Test Panel] Error getting fresh player data:', error);
                    // Fallback to original refresh
                    refreshPlayerDisplay();
                }
            }, 500); // Wait 500ms for server to complete the reset
        } else {
            logTestResult('Reset Failed', data);
        }
    } catch (error) {
        logTestResult('Reset Error', error.message);
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

// Check if current user is admin
async function checkAdminStatus() {
    try {
        const result = await window.getPlayer();
        const data = JSON.parse(result);
        if (data.status === 'success' && data.playerCharacter) {
            const username = data.playerCharacter.username;
            const allowedAdmins = ['dreamingcolors']; // Must match server list
            return allowedAdmins.includes(username);
        }
    } catch (error) {
        console.log('[Test Panel] Could not check admin status:', error);
    }
    return false;
}

// Set up event listeners when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to load
    setTimeout(async () => {
        // Check if Unity API functions are available
        if (typeof window.getPlayer !== 'function') {
            console.error('[Test Panel] Unity API functions not loaded yet, retrying...');
            setTimeout(arguments.callee, 1000); // Retry in 1 second
            return;
        }
        
        console.log('[Test Panel] Unity API functions loaded successfully');
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
        
        // Leaderboard button
        const leaderboardBtn = document.getElementById('test-leaderboard');
        
        // Test leaderboard management buttons
        const createEntriesBtn = document.getElementById('test-create-entries');
        const removeEntriesBtn = document.getElementById('test-remove-entries');
        const debugLeaderboardBtn = document.getElementById('test-debug-leaderboard');
        const nuclearCleanupBtn = document.getElementById('test-nuclear-cleanup');
        
        // Enemy preview buttons
        const previewEasyBtn = document.getElementById('test-preview-easy');
        const previewMediumBtn = document.getElementById('test-preview-medium');
        const previewHardBtn = document.getElementById('test-preview-hard');
        
        // Reset buttons
        const resetBtn = document.getElementById('test-reset-player');
        const resetConfirmBtn = document.getElementById('test-reset-confirm');
        const resetCancelBtn = document.getElementById('test-reset-cancel');
        console.log('[Test Panel] Looking for buttons:', {previewEasyBtn, previewMediumBtn, previewHardBtn, resetBtn});
        
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
        
        // Enemy preview button event listeners
        if (previewEasyBtn) previewEasyBtn.addEventListener('click', () => testEnemyPreview('easy'));
        if (previewMediumBtn) previewMediumBtn.addEventListener('click', () => testEnemyPreview('medium'));
        if (previewHardBtn) previewHardBtn.addEventListener('click', () => testEnemyPreview('hard'));
        
        // Leaderboard button event listener
        if (leaderboardBtn) leaderboardBtn.addEventListener('click', testGetLeaderboard);
        
        // Test leaderboard management button event listeners
        if (createEntriesBtn) createEntriesBtn.addEventListener('click', testCreateTestEntries);
        if (removeEntriesBtn) removeEntriesBtn.addEventListener('click', testRemoveTestEntries);
        if (debugLeaderboardBtn) debugLeaderboardBtn.addEventListener('click', testDebugLeaderboard);
        if (nuclearCleanupBtn) nuclearCleanupBtn.addEventListener('click', testNuclearCleanup);
        
        // Check admin status and hide admin-only buttons for non-admins
        checkAdminStatus().then(isAdmin => {
            if (!isAdmin) {
                console.log('[Test Panel] Non-admin user detected, hiding admin-only buttons');
                if (createEntriesBtn) createEntriesBtn.style.display = 'none';
                if (removeEntriesBtn) removeEntriesBtn.style.display = 'none';
                if (nuclearCleanupBtn) nuclearCleanupBtn.style.display = 'none';
                // Keep debug button visible for all users
            } else {
                console.log('[Test Panel] Admin user detected, showing all buttons');
            }
        });
        
        // Reset button event listeners (custom confirmation)
        if (resetBtn) {
            console.log('[Test Panel] Reset button found, adding event listener');
            resetBtn.addEventListener('click', () => {
                console.log('[Test Panel] Reset button clicked!');
                // Show confirmation buttons
                resetBtn.style.display = 'none';
                if (resetConfirmBtn) resetConfirmBtn.style.display = 'inline-block';
                if (resetCancelBtn) resetCancelBtn.style.display = 'inline-block';
                logTestResult('Reset Confirmation', 'Click CONFIRM RESET to proceed or Cancel to abort');
            });
        } else {
            console.error('[Test Panel] Reset button not found! ID: test-reset-player');
        }
        
        // Confirm reset button
        if (resetConfirmBtn) {
            resetConfirmBtn.addEventListener('click', () => {
                console.log('[Test Panel] Reset confirmed!');
                // Hide confirmation buttons
                resetBtn.style.display = 'inline-block';
                resetConfirmBtn.style.display = 'none';
                resetCancelBtn.style.display = 'none';
                // Execute reset
                testResetPlayer();
            });
        }
        
        // Cancel reset button
        if (resetCancelBtn) {
            resetCancelBtn.addEventListener('click', () => {
                console.log('[Test Panel] Reset cancelled');
                // Hide confirmation buttons
                resetBtn.style.display = 'inline-block';
                resetConfirmBtn.style.display = 'none';
                resetCancelBtn.style.display = 'none';
                logTestResult('Reset Cancelled', 'Player stats were not reset');
            });
        }
        
        // Admin access button event listener
        const adminBtn = document.getElementById('admin-access-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                console.log('[Admin Button] Clicked - opening admin panel');
                showAdminPanel();
            });
        }
        
        // Toggle panel button event listener already handled above

        logTestResult('System', 'Test panel ready! Unity API functions available.');
        
        // Check admin status after Unity loads
        setTimeout(() => {
            console.log('[Admin] Checking admin status after 15 seconds...');
            checkAdminStatus();
        }, 15000); // Wait 15 seconds for Unity to fully load
        
        // Auto-load player stats on startup
        refreshPlayerDisplay();
    }, 2000);
});
// Add 
admin-specific features to the test panel
function addAdminFeatures() {
    const panel = document.getElementById('test-panel');
    if (!panel) return;
    
    // Add admin section to the panel
    const adminSection = document.createElement('div');
    adminSection.innerHTML = `
        <div style="border-top: 1px solid #666; margin: 10px 0; padding-top: 10px;">
            <div style="font-weight: bold; color: #ff6b6b; margin-bottom: 5px;">🔧 ADMIN TOOLS</div>
            
            <div style="margin-bottom: 10px;">
                <input type="text" id="admin-username" placeholder="Username to reset" 
                       style="width: 150px; padding: 3px; font-size: 11px; margin-right: 5px;">
                <button id="admin-reset-user" style="padding: 3px 8px; font-size: 11px; background: #ff6b6b; color: white; border: none; cursor: pointer;">
                    Reset User Stats
                </button>
            </div>
            
            <div style="margin-bottom: 10px;">
                <button id="admin-list-players" style="padding: 3px 8px; font-size: 11px; background: #4ecdc4; color: white; border: none; cursor: pointer; margin-right: 5px;">
                    List All Players
                </button>
                <button id="admin-cleanup-exploiters" style="padding: 3px 8px; font-size: 11px; background: #ff9f43; color: white; border: none; cursor: pointer;">
                    Reset High Level Players
                </button>
            </div>
            
            <div id="admin-results" style="max-height: 150px; overflow-y: auto; background: rgba(255,100,100,0.1); padding: 5px; border-radius: 3px; font-size: 10px;">
                Admin tools ready
            </div>
        </div>
    `;
    
    panel.appendChild(adminSection);
    
    // Add event listeners for admin functions
    document.getElementById('admin-reset-user').addEventListener('click', resetUserStats);
    document.getElementById('admin-list-players').addEventListener('click', listAllPlayers);
    document.getElementById('admin-cleanup-exploiters').addEventListener('click', cleanupExploiters);
}

// Reset specific user's stats
async function resetUserStats() {
    const username = document.getElementById('admin-username').value.trim();
    if (!username) {
        logAdminResult('Error', 'Please enter a username');
        return;
    }
    
    try {
        logAdminResult('Resetting User', `Resetting stats for: ${username}`);
        
        const response = await fetch('/api/admin/reset-user-stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ targetUsername: username })
        });
        
        const data = await response.json();
        logAdminResult('Reset User Result', data);
        
        // Clear the input
        document.getElementById('admin-username').value = '';
        
    } catch (error) {
        logAdminResult('Reset User Error', error.message);
    }
}

// List all players for admin review
async function listAllPlayers() {
    try {
        logAdminResult('Listing Players', 'Fetching all player data...');
        
        const response = await fetch('/api/admin/list-players');
        const data = await response.json();
        logAdminResult('All Players', data);
        
    } catch (error) {
        logAdminResult('List Players Error', error.message);
    }
}

// Cleanup exploiters (reset players with suspiciously high levels)
async function cleanupExploiters() {
    try {
        logAdminResult('Cleanup Exploiters', 'Resetting players with level > 50...');
        
        const response = await fetch('/api/admin/cleanup-exploiters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        logAdminResult('Cleanup Result', data);
        
    } catch (error) {
        logAdminResult('Cleanup Error', error.message);
    }
}

// Log admin results
function logAdminResult(title, data) {
    const results = document.getElementById('admin-results');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color: #ff6b6b;">${title}:</strong><br><pre style="font-size: 9px; margin: 3px 0; color: #ccc;">${JSON.stringify(data, null, 2)}</pre>`;
    div.style.borderBottom = '1px solid rgba(255,100,100,0.3)';
    div.style.marginBottom = '3px';
    div.style.paddingBottom = '3px';
    results.appendChild(div);
    results.scrollTop = results.scrollHeight;
}

// Initialize admin check when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for Unity to load, then check admin status
    setTimeout(checkAdminStatus, 2000);
    
    // Add keyboard shortcut for admin (Ctrl+Shift+T)
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'T') {
            if (isAdmin) {
                toggleTestPanel();
                event.preventDefault();
            }
        }
    });
});

// Also check when Unity is ready (backup)
if (typeof window.unityInstance !== 'undefined') {
    setTimeout(checkAdminStatus, 1000);
}