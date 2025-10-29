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
    async getPlayer() {
        try {
            const response = await fetch('/api/player');
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting player:', error);
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
    async startBattle() {
        try {
            console.log('[Unity API] Starting battle...');
            const response = await fetch('/api/battle/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
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

// Leaderboard function
window.getLeaderboard = window.UnityDevvitAPI.getLeaderboard;

// Player reset function
window.resetPlayer = window.UnityDevvitAPI.resetPlayer;

// Enemy preview function
window.getEnemyPreview = window.UnityDevvitAPI.getEnemyPreview;

// Also create a synchronous version for immediate access
window.getUserAvatarSync = function () {
    return window.userAvatar || DEFAULT_AVATAR_URL;
};