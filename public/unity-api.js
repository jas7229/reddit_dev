// Unity-Devvit API Bridge
// This file provides JavaScript functions that Unity can call via jslib

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

    // Get leaderboard
    async getLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            const data = await response.json();
            return JSON.stringify(data);
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return JSON.stringify({ status: 'error', message: error.message });
        }
    },

    // Get user avatar URL (set by unity-setup.js or fetched from server)
    async getUserAvatar() {
        // First try the client-side avatar
        if (window.userAvatar && window.userAvatar !== "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png") {
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
        
        return window.userAvatar || "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
    },

    // Get username (set by unity-setup.js)
    getUsername() {
        return window.username || "RedditUser";
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

// Also create a synchronous version for immediate access
window.getUserAvatarSync = function() {
    return window.userAvatar || "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
};