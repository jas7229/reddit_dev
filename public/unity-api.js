// Unity-Devvit API Bridge
// This file provides JavaScript functions that Unity can call via jslib

// Default avatar for users without custom Snoovatars (custom Snoo)
const DEFAULT_AVATAR_URL = "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfNDhhM2EwNDI0Nzg0N2VkMzUwOGI4YjRjZjdlNzIwMjViNDY5NTcwMl8z_rare_2ac1bb56-63fc-4837-8cde-c443fb602a3b.png";

window.UnityDevvitAPI = {
    // Initialize and get user data
    async getUserData() {
        try {
            const response = await fetch('/api/user-data');
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting user data:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Save player score
    async saveScore(score) {
        try {
            const response = await fetch('/api/save-score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ score: parseInt(score) })
            });
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error saving score:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Get leaderboard with player levels and avatars
    async getLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            const data = await response.json();
            console.log('[Unity API] Leaderboard data:', data);
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Get user avatar URL (set by unity-setup.js or fetched from server)
    async getUserAvatar() {
        // First try the client-side avatar
        if (window.userAvatar && window.userAvatar !== DEFAULT_AVATAR_URL) {
            return window.userAvatar;
        }

        // Fallback to server-side data
        try {
            console.log('[Unity API] Fetching user data from server...');
            const response = await fetch('/api/user-data');
            const data = await response.json();
            console.log('[Unity API] Server response:', data);

            if (data.status === 'success' && data.avatarUrl) {
                window.userAvatar = data.avatarUrl; // Cache it
                console.log('[Unity API] Updated avatar to:', data.avatarUrl);
                return data.avatarUrl;
            }
        } catch (error) {
            console.error('Error fetching avatar from server:', error);
        }

        return window.userAvatar || DEFAULT_AVATAR_URL;
    },

    // Get username (set by unity-setup.js)
    getUsername() {
        return window.username || "RedditUser";
    },

    // Get player character data
    async getPlayer(retryCount = 0) {
        try {
            const response = await fetch('/api/player');
            
            // Handle 401 authentication errors with retry
            if (response.status === 401 && retryCount < 3) {
                console.warn(`[Unity API] Auth error (401), retrying in ${Math.pow(2, retryCount)} seconds...`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return this.getPlayer(retryCount + 1);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting player:', error);
            
            // If it's a JSON parsing error and we haven't retried much, try again
            if (error.message.includes('Unexpected token') && retryCount < 2) {
                console.warn('[Unity API] JSON parse error, retrying...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.getPlayer(retryCount + 1);
            }
            
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Update player stats
    async updatePlayer(statsJson) {
        try {
            const stats = JSON.parse(statsJson);
            const response = await fetch('/api/player/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(stats)
            });
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error updating player:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Reset player stats to default values
    async resetPlayer() {
        try {
            const response = await fetch('/api/player/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const data = await response.json();
            console.log('[Unity API] Player reset result:', data);
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error resetting player:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Get random enemy
    async getEnemy() {
        try {
            const response = await fetch('/api/enemy');
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting enemy:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Get enemy preview for battle selection
    async getEnemyPreview(difficulty = 'medium', reroll = false) {
        try {
            const response = await fetch('/api/enemy/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ difficulty, reroll })
            });
            const data = await response.json();
            console.log('[Unity API] Enemy preview:', data);
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting enemy preview:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Battle System Functions
    async startBattle(retryCount = 0) {
        try {
            console.log('[Unity API] Starting battle...');
            const response = await fetch('/api/battle/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            // Handle 401 authentication errors with retry
            if (response.status === 401 && retryCount < 3) {
                console.warn(`[Unity API] Auth error starting battle, retrying in ${Math.pow(2, retryCount)} seconds...`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return this.startBattle(retryCount + 1);
            }
            
            console.log('[Unity API] Battle start response status:', response.status);
            const data = await response.json();
            console.log('[Unity API] Battle start data:', data);

            // Call Unity callback if battle started successfully
            if (data.status === 'success' && data.battleState) {
                console.log('[Unity API] Calling Unity OnBattleStarted callback');
                if (window.unityInstance) {
                    window.unityInstance.SendMessage('BattleUIManager', 'OnBattleStarted', JSON.stringify(data));
                } else {
                    console.error('[Unity API] Unity instance not found');
                }
            }

            return JSON.stringify(data);
        } catch (error) {
            console.error('Error starting battle:', error);
            
            // Retry on JSON parse errors
            if (error.message.includes('Unexpected token') && retryCount < 2) {
                console.warn('[Unity API] JSON parse error in battle start, retrying...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.startBattle(retryCount + 1);
            }
            
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    async battleAction(battleId, action) {
        try {
            console.log('[Unity API] Sending battle action:', { battleId, action });
            const response = await fetch('/api/battle/action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ battleId, action })
            });

            console.log('[Unity API] Battle action response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Unity API] Battle action failed:', response.status, errorText);
                return JSON.stringify({ status: 'error', message: `Server error: ${response.status}` });
            }

            const data = await response.json();
            console.log('[Unity API] Battle action data:', data);

            // Call Unity callback if action was successful
            if (data.status === 'success') {
                console.log('[Unity API] Calling Unity OnBattleAction callback');
                if (window.unityInstance) {
                    window.unityInstance.SendMessage('BattleUIManager', 'OnBattleAction', JSON.stringify(data));
                } else {
                    console.error('[Unity API] Unity instance not found');
                }
            }

            return JSON.stringify(data);
        } catch (error) {
            console.error('Error performing battle action:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    async getBattle(battleId) {
        try {
            const response = await fetch(`/api/battle/${battleId}`);
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting battle:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    async processEnemyTurn(battleId) {
        try {
            console.log('[Unity API] Processing enemy turn for battle:', battleId);
            const response = await fetch('/api/battle/enemy-turn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ battleId })
            });

            const data = await response.json();
            console.log('[Unity API] Enemy turn result:', data);

            // Call Unity callback if successful
            if (data.status === 'success' && window.unityInstance) {
                window.unityInstance.SendMessage('BattleUIManager', 'OnEnemyTurn', JSON.stringify(data));
            }

            return JSON.stringify(data);
        } catch (error) {
            console.error('Error processing enemy turn:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Log message to browser console (useful for debugging)
    log(message) {
        console.log('[Unity]', message);
    },

    // Show alert (for debugging - remove in production)
    alert(message) {
        alert('[Unity] ' + message);
    }
};

// Make functions available globally for Unity to call
window.getUserData = window.UnityDevvitAPI.getUserData;
window.saveScore = window.UnityDevvitAPI.saveScore;
window.getLeaderboard = window.UnityDevvitAPI.getLeaderboard;
window.getUserAvatar = window.UnityDevvitAPI.getUserAvatar;
window.getUsername = window.UnityDevvitAPI.getUsername;
window.unityLog = window.UnityDevvitAPI.log;
window.unityAlert = window.UnityDevvitAPI.alert;

// Player Character System functions
window.getPlayer = window.UnityDevvitAPI.getPlayer;
window.updatePlayer = window.UnityDevvitAPI.updatePlayer;
window.getEnemy = window.UnityDevvitAPI.getEnemy;

// Battle System functions - expose both lowercase and uppercase versions
window.startBattle = function () {
    console.log('[Unity API] window.startBattle called');
    return window.UnityDevvitAPI.startBattle();
};
window.StartBattle = function () {
    console.log('[Unity API] window.StartBattle called');
    return window.UnityDevvitAPI.startBattle();
};
window.battleAction = function (battleId, action) {
    console.log('[Unity API] window.battleAction called with:', battleId, action);
    return window.UnityDevvitAPI.battleAction(battleId, action);
};
window.BattleAction = function (battleId, action) {
    console.log('[Unity API] window.BattleAction called with:', battleId, action);
    return window.UnityDevvitAPI.battleAction(battleId, action);
};
window.getBattle = window.UnityDevvitAPI.getBattle;
window.processEnemyTurn = window.UnityDevvitAPI.processEnemyTurn;

// Player reset function
window.resetPlayer = window.UnityDevvitAPI.resetPlayer;

// Enemy preview function
window.getEnemyPreview = window.UnityDevvitAPI.getEnemyPreview;

// Battle start with difficulty
window.startBattleWithDifficulty = async function(difficulty) {
    try {
        console.log('[Unity API] Starting battle with difficulty:', difficulty);
        const response = await fetch('/api/battle/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ difficulty })
        });
        
        const data = await response.json();
        console.log('[Unity API] Battle start with difficulty result:', data);
        
        // Call Unity callback if battle started successfully
        if (data.status === 'success' && data.battleState) {
            if (window.unityInstance) {
                window.unityInstance.SendMessage('BattleUIManager', 'OnBattleStarted', JSON.stringify(data));
            }
        }
        
        return JSON.stringify(data);
    } catch (error) {
        console.error('Error starting battle with difficulty:', error);
        return JSON.stringify({ status: 'error', message: error.message });
    }
};

// Battle start with specific enemy
window.startBattleWithEnemy = async function(enemyUsername, difficulty = 'medium') {
    try {
        console.log('[Unity API] Starting battle with enemy:', enemyUsername, 'at difficulty:', difficulty);
        const response = await fetch('/api/battle/start-with-enemy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enemyUsername, difficulty })
        });
        
        const data = await response.json();
        console.log('[Unity API] Battle start with enemy result:', data);
        
        // Call Unity callback if battle started successfully
        if (data.status === 'success' && data.battleState) {
            if (window.unityInstance) {
                window.unityInstance.SendMessage('BattleUIManager', 'OnBattleStarted', JSON.stringify(data));
            }
        }
        
        return JSON.stringify(data);
    } catch (error) {
        console.error('Error starting battle with enemy:', error);
        return JSON.stringify({ status: 'error', message: error.message });
    }
};

// Shop System Functions
window.getShopData = async function() {
    try {
        console.log('[Unity API] Getting shop data...');
        const response = await fetch('/api/shop');
        const data = await response.json();
        console.log('[Unity API] Shop data received:', data);
        return JSON.stringify(data);
    } catch (error) {
        console.error('[Unity API] Error getting shop data:', error);
        return JSON.stringify({ status: 'error', message: error.message });
    }
};

window.purchaseItem = async function(itemId) {
    try {
        console.log('[Unity API] Purchasing item:', itemId);
        const response = await fetch('/api/shop/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemId })
        });
        const data = await response.json();
        console.log('[Unity API] Purchase result:', data);
        return JSON.stringify(data);
    } catch (error) {
        console.error('[Unity API] Error purchasing item:', error);
        return JSON.stringify({ status: 'error', message: error.message });
    }
};

// Also create a synchronous version for immediate access
window.getUserAvatarSync = function () {
    return window.userAvatar || DEFAULT_AVATAR_URL;
};

// Admin System - Initialize after everything loads
setTimeout(() => {
    console.log('[Admin] Initializing admin system...');
    
    fetch('/api/init')
        .then(response => response.json())
        .then(data => {
            const username = data.username;
            const isAdmin = (username === 'dreamingcolors');
            
            console.log('[Admin] Username:', username, 'IsAdmin:', isAdmin);
            
            if (isAdmin) {
                const adminBtn = document.getElementById('admin-access-btn');
                if (adminBtn) {
                    adminBtn.style.display = 'block';
                    adminBtn.style.visibility = 'visible';
                    
                    adminBtn.addEventListener('click', () => {
                        const panel = document.getElementById('test-panel');
                        if (panel) {
                            panel.style.display = 'block';
                            panel.style.visibility = 'visible';
                            adminBtn.style.display = 'none';
                            console.log('[Admin] Panel opened');
                            
                            // Initialize test panel button functionality
                            initializeTestPanelButtons();
                            
                            // Fix input field for Unity environment
                            setTimeout(() => {
                                const usernameInput = document.getElementById('admin-username');
                                if (usernameInput) {
                                    // Prevent Unity from capturing input events
                                    usernameInput.addEventListener('focus', (e) => {
                                        e.stopPropagation();
                                        console.log('[Admin] Username input focused');
                                    });
                                    
                                    usernameInput.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        usernameInput.focus();
                                    });
                                    
                                    usernameInput.addEventListener('mousedown', (e) => {
                                        e.stopPropagation();
                                    });
                                    
                                    usernameInput.addEventListener('keydown', (e) => {
                                        e.stopPropagation();
                                    });
                                    
                                    usernameInput.addEventListener('keyup', (e) => {
                                        e.stopPropagation();
                                    });
                                    
                                    usernameInput.addEventListener('input', (e) => {
                                        e.stopPropagation();
                                    });
                                    
                                    console.log('[Admin] Username input field configured');
                                }
                            }, 100);
                            
                            // Add hide panel functionality
                            const hideBtn = document.getElementById('test-toggle-panel');
                            if (hideBtn) {
                                // Remove any existing event listeners
                                hideBtn.replaceWith(hideBtn.cloneNode(true));
                                const newHideBtn = document.getElementById('test-toggle-panel');
                                
                                newHideBtn.addEventListener('click', () => {
                                    panel.style.display = 'none';
                                    panel.style.visibility = 'hidden';
                                    adminBtn.style.display = 'block';
                                    adminBtn.style.visibility = 'visible';
                                    console.log('[Admin] Panel closed');
                                });
                                
                                console.log('[Admin] Hide button functionality added');
                            }
                            
                            // Add tab switching functionality
                            const testingTab = document.getElementById('tab-testing');
                            const adminTab = document.getElementById('tab-admin');
                            const testingPage = document.getElementById('page-testing');
                            const adminPage = document.getElementById('page-admin');
                            
                            if (testingTab && adminTab && testingPage && adminPage) {
                                testingTab.onclick = () => {
                                    testingTab.style.background = '#4CAF50';
                                    adminTab.style.background = '#666';
                                    testingPage.style.display = 'block';
                                    adminPage.style.display = 'none';
                                };
                                
                                adminTab.onclick = () => {
                                    adminTab.style.background = '#ff6b6b';
                                    testingTab.style.background = '#666';
                                    adminPage.style.display = 'block';
                                    testingPage.style.display = 'none';
                                };
                                
                                console.log('[Admin] Tab switching configured');
                            }
                        }
                    });
                    
                    console.log('[Admin] Button enabled for dreamingcolors');
                } else {
                    console.log('[Admin] Admin button element not found');
                }
            } else {
                console.log('[Admin] User is not admin');
            }
        })
        .catch(error => {
            console.error('[Admin] Error checking admin status:', error);
        });
}, 20000); // Wait 20 seconds for everything to fully load

// Initialize test panel button functionality
function initializeTestPanelButtons() {
    console.log('[Admin] Initializing test panel buttons...');
    
    // Helper function to log results
    function logTestResult(title, data) {
        const results = document.getElementById('test-results');
        if (results) {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${title}:</strong><br><pre style="font-size: 10px; margin: 5px 0;">${JSON.stringify(data, null, 2)}</pre>`;
            div.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
            div.style.marginBottom = '5px';
            div.style.paddingBottom = '5px';
            results.appendChild(div);
            results.scrollTop = results.scrollHeight;
        }
    }
    
    // Get Player button
    const getPlayerBtn = document.getElementById('test-get-player');
    if (getPlayerBtn) {
        getPlayerBtn.onclick = async () => {
            try {
                logTestResult('Getting Player', 'Loading...');
                const result = await window.getPlayer();
                const data = JSON.parse(result);
                logTestResult('Get Player Result', data);
            } catch (error) {
                logTestResult('Get Player Error', error.message);
            }
        };
    }
    
    // Get Leaderboard button
    const leaderboardBtn = document.getElementById('test-leaderboard');
    if (leaderboardBtn) {
        leaderboardBtn.onclick = async () => {
            try {
                logTestResult('Getting Leaderboard', 'Loading...');
                const result = await window.getLeaderboard();
                const data = JSON.parse(result);
                logTestResult('Leaderboard Result', {
                    totalPlayers: data.totalPlayers,
                    playerRank: data.playerRank,
                    topPlayers: data.leaderboard?.slice(0, 5)
                });
            } catch (error) {
                logTestResult('Leaderboard Error', error.message);
            }
        };
    }
    
    // Admin: Reset Specific Problem Users with custom confirmation
    const resetSpecificBtn = document.getElementById('admin-reset-specific-users');
    const resetConfirmBtn = document.getElementById('admin-reset-confirm');
    const resetCancelBtn = document.getElementById('admin-reset-cancel');
    
    if (resetSpecificBtn && resetConfirmBtn && resetCancelBtn) {
        console.log('[Admin] Found reset specific users buttons');
        
        // Initial reset button click - show confirmation
        resetSpecificBtn.onclick = () => {
            console.log('[Admin] Reset specific users button clicked!');
            logTestResult('Confirmation', '⚠️ Click CONFIRM RESET to proceed or Cancel to abort');
            
            // Hide main button, show confirmation buttons
            resetSpecificBtn.style.display = 'none';
            resetConfirmBtn.style.display = 'block';
            resetCancelBtn.style.display = 'block';
        };
        
        // Confirm button - actually do the reset
        resetConfirmBtn.onclick = async () => {
            console.log('[Admin] Reset confirmed!');
            
            // Real problematic users
            const problemUsers = ['joemari5', 'usernamehighasfuck']; // Actual exploiters
            
            // Hide confirmation buttons, show main button
            resetSpecificBtn.style.display = 'block';
            resetConfirmBtn.style.display = 'none';
            resetCancelBtn.style.display = 'none';
            
            try {
                logTestResult('Resetting Problem Users', `Resetting: ${problemUsers.join(', ')}`);
                
                for (const username of problemUsers) {
                    console.log(`[Admin] Resetting user: ${username}`);
                    const response = await fetch('/api/admin/reset-user-stats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetUsername: username })
                    });
                    const data = await response.json();
                    console.log(`[Admin] Reset response for ${username}:`, data);
                    logTestResult(`Reset ${username}`, data);
                }
                
                logTestResult('All Resets Complete', `Successfully reset ${problemUsers.length} problem users`);
            } catch (error) {
                console.error('[Admin] Reset error:', error);
                logTestResult('Reset Error', error.message);
            }
        };
        
        // Cancel button - abort the reset
        resetCancelBtn.onclick = () => {
            console.log('[Admin] Reset cancelled');
            logTestResult('Reset Cancelled', 'User cancelled the reset operation');
            
            // Hide confirmation buttons, show main button
            resetSpecificBtn.style.display = 'block';
            resetConfirmBtn.style.display = 'none';
            resetCancelBtn.style.display = 'none';
        };
    } else {
        console.log('[Admin] Reset specific users buttons NOT found');
    }
    
    // Admin: List All Players
    const listPlayersBtn = document.getElementById('admin-list-players');
    if (listPlayersBtn) {
        listPlayersBtn.onclick = async () => {
            try {
                logTestResult('Listing Players', 'Fetching all player data...');
                const response = await fetch('/api/admin/list-players');
                const data = await response.json();
                logTestResult('All Players', data);
            } catch (error) {
                logTestResult('List Players Error', error.message);
            }
        };
    }
    
    // Admin: Refresh Leaderboard
    const refreshLeaderboardBtn = document.getElementById('admin-refresh-leaderboard');
    if (refreshLeaderboardBtn) {
        refreshLeaderboardBtn.onclick = async () => {
            try {
                logTestResult('Refreshing Leaderboard', 'Forcing Unity to reload leaderboard...');
                
                // Call the leaderboard API to get fresh data
                const result = await window.getLeaderboard();
                const data = JSON.parse(result);
                
                if (data.status === 'success') {
                    logTestResult('Fresh Leaderboard Data', {
                        totalPlayers: data.totalPlayers,
                        playerRank: data.playerRank,
                        topPlayers: data.leaderboard?.slice(0, 10) // Show top 10
                    });
                    
                    // Try to notify Unity to refresh its leaderboard display
                    if (window.unityInstance) {
                        try {
                            window.unityInstance.SendMessage('LeaderboardManager', 'OnLeaderboardReceived', result);
                            logTestResult('Unity Notified', 'Sent fresh leaderboard data to Unity');
                        } catch (e) {
                            logTestResult('Unity Notification', 'Could not notify Unity: ' + e.message);
                        }
                    }
                } else {
                    logTestResult('Leaderboard Error', data);
                }
            } catch (error) {
                logTestResult('Refresh Leaderboard Error', error.message);
            }
        };
    }
    
    // Admin: Rebuild Leaderboard
    const rebuildLeaderboardBtn = document.getElementById('admin-rebuild-leaderboard');
    if (rebuildLeaderboardBtn) {
        rebuildLeaderboardBtn.onclick = async () => {
            try {
                logTestResult('Rebuilding Leaderboard', 'Recalculating all scores from player data...');
                
                const response = await fetch('/api/admin/rebuild-leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                logTestResult('Rebuild Complete', data);
                
                // Auto-refresh the leaderboard after rebuild
                setTimeout(async () => {
                    const result = await window.getLeaderboard();
                    const leaderboardData = JSON.parse(result);
                    logTestResult('Updated Leaderboard', {
                        totalPlayers: leaderboardData.totalPlayers,
                        topPlayers: leaderboardData.leaderboard?.slice(0, 10)
                    });
                }, 1000);
                
            } catch (error) {
                logTestResult('Rebuild Leaderboard Error', error.message);
            }
        };
    }
    
    // Admin: Remove Duplicate Users
    const dedupeBtn = document.getElementById('admin-dedupe-leaderboard');
    if (dedupeBtn) {
        console.log('[Admin] Found dedupe button');
        dedupeBtn.onclick = async () => {
            console.log('[Admin] Dedupe button clicked!');
            try {
                logTestResult('Checking Duplicates', 'Analyzing leaderboard for duplicate entries...');
                
                // Get current leaderboard
                console.log('[Admin] Getting leaderboard data...');
                const result = await window.getLeaderboard();
                console.log('[Admin] Leaderboard result:', result);
                const data = JSON.parse(result);
                
                if (data.status === 'success' && data.leaderboard) {
                    console.log('[Admin] Processing leaderboard entries:', data.leaderboard.length);
                    const usernames = data.leaderboard.map(entry => entry.username);
                    console.log('[Admin] All usernames:', usernames);
                    
                    // Check for exact duplicates
                    const exactDuplicates = usernames.filter((name, index) => usernames.indexOf(name) !== index);
                    console.log('[Admin] Exact duplicates found:', exactDuplicates);
                    
                    // Check for case-insensitive duplicates
                    const lowercaseNames = usernames.map(name => name.toLowerCase());
                    const caseDuplicates = [];
                    for (let i = 0; i < usernames.length; i++) {
                        for (let j = i + 1; j < usernames.length; j++) {
                            if (lowercaseNames[i] === lowercaseNames[j]) {
                                caseDuplicates.push(`"${usernames[i]}" vs "${usernames[j]}"`);
                            }
                        }
                    }
                    console.log('[Admin] Case-insensitive duplicates:', caseDuplicates);
                    
                    // Show all usernames and their positions
                    logTestResult('All Usernames', usernames.map((name, index) => `${index + 1}. ${name}`));
                    
                    if (exactDuplicates.length > 0) {
                        logTestResult('Exact Duplicates Found', `Found exact duplicates: ${[...new Set(exactDuplicates)].join(', ')}`);
                    }
                    
                    if (caseDuplicates.length > 0) {
                        logTestResult('Case Duplicates Found', caseDuplicates);
                        logTestResult('Fix Needed', 'Found case-sensitive duplicates! Use "Rebuild Leaderboard" to fix.');
                    }
                    
                    if (exactDuplicates.length === 0 && caseDuplicates.length === 0) {
                        logTestResult('No Duplicates', 'Leaderboard looks clean - no duplicate usernames found');
                    }
                    
                    // Show detailed breakdown
                    const userCounts = {};
                    usernames.forEach(name => {
                        userCounts[name] = (userCounts[name] || 0) + 1;
                    });
                    
                    const multipleEntries = Object.entries(userCounts).filter(([name, count]) => count > 1);
                    if (multipleEntries.length > 0) {
                        logTestResult('Multiple Entries', multipleEntries.map(([name, count]) => `${name}: ${count} entries`));
                    }
                } else {
                    logTestResult('Error', 'Could not get leaderboard data: ' + JSON.stringify(data));
                }
                
            } catch (error) {
                console.error('[Admin] Dedupe error:', error);
                logTestResult('Dedupe Error', error.message);
            }
        };
    } else {
        console.log('[Admin] Dedupe button NOT found');
    }
    
    // Admin: Delete Specific User
    const deleteUserBtn = document.getElementById('admin-delete-user');
    if (deleteUserBtn) {
        deleteUserBtn.onclick = async () => {
            try {
                const userToDelete = 'LIFT_TICKET_BOT'; // The uppercase duplicate
                logTestResult('Deleting User', `Completely removing ${userToDelete} from database...`);
                
                const response = await fetch('/api/admin/delete-specific-user', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                console.log('[Admin] Delete response status:', response.status);
                console.log('[Admin] Delete response headers:', response.headers);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    logTestResult('Delete Error', `Server error ${response.status}: ${errorText}`);
                    return;
                }
                
                const responseText = await response.text();
                console.log('[Admin] Raw response:', responseText);
                
                try {
                    const data = JSON.parse(responseText);
                    logTestResult('Delete Result', data);
                } catch (parseError) {
                    logTestResult('Parse Error', `Could not parse response: ${responseText}`);
                    return;
                }
                
                if (data.status === 'success') {
                    // Auto-refresh leaderboard to show the change
                    setTimeout(async () => {
                        const result = await window.getLeaderboard();
                        const leaderboardData = JSON.parse(result);
                        logTestResult('Updated Leaderboard', {
                            totalPlayers: leaderboardData.totalPlayers,
                            message: `${userToDelete} should be gone now`
                        });
                    }, 1000);
                }
                
            } catch (error) {
                logTestResult('Delete Error', error.message);
            }
        };
    }
    
    // Admin: Cleanup Exploiters function removed - level 50 threshold too arbitrary
    
    // Nuclear Cleanup
    const nuclearBtn = document.getElementById('test-nuclear-cleanup');
    if (nuclearBtn) {
        nuclearBtn.onclick = async () => {
            if (confirm('⚠️ This will DELETE the entire leaderboard! Are you sure?')) {
                try {
                    logTestResult('☢️ NUCLEAR CLEANUP', 'Wiping entire leaderboard...');
                    const response = await fetch('/api/admin/nuclear-cleanup-leaderboard', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    logTestResult('Nuclear Cleanup Result', data);
                } catch (error) {
                    logTestResult('Nuclear Cleanup Error', error.message);
                }
            }
        };
    }
    
    console.log('[Admin] Test panel buttons initialized');
}