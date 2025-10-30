mergeInto(LibraryManager.library, {
    GetPlayerData: function() {
        getPlayer().then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Player data received:', data);
            
            if (data.status === 'success' && data.playerCharacter) {
                // Try multiple possible GameObject names
                const possibleNames = ['PlayerManager', 'GameManager', 'Player Manager', 'Manager'];
                let messageSent = false;
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnPlayerDataReceived', result);
                        console.log(`[JSLib] Message sent to: ${name}`);
                        messageSent = true;
                        break;
                    } catch (e) {
                        // Try next name
                    }
                }
                
                if (!messageSent) {
                    console.error('[JSLib] Could not find PlayerManager GameObject');
                    return;
                }
                
                // Start loading avatar image
                const avatarUrl = data.playerCharacter.avatarUrl;
                if (avatarUrl) {
                    console.log('[JSLib] Loading avatar image:', avatarUrl);
                    // Call the helper function defined in this library
                    _LoadImageAsBase64(avatarUrl, possibleNames[0], 'OnPlayerAvatarLoaded');
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error getting player:', error);
        });
    },

     // Add this new function to refresh player data
    RefreshPlayerData: function() {
        console.log('[JSLib] Refreshing player data from server...');
        // This calls the same function but forces a fresh server request
        getPlayer().then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Refreshed player data received:', data);
            
            if (data.status === 'success' && data.playerCharacter) {
                const possibleNames = ['PlayerManager', 'GameManager', 'Player Manager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnPlayerDataReceived', result);
                        console.log(`[JSLib] Refresh message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error refreshing player:', error);
        });
    },
    
    GetEnemyData: function() {
        getEnemy().then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Enemy data received:', data);
            
            if (data.status === 'success' && data.enemy) {
                // Try multiple possible GameObject names
                const possibleNames = ['PlayerManager', 'GameManager', 'Player Manager', 'Manager'];
                let messageSent = false;
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnEnemyDataReceived', result);
                        console.log(`[JSLib] Enemy message sent to: ${name}`);
                        messageSent = true;
                        break;
                    } catch (e) {
                        // Try next name
                    }
                }
                
                if (!messageSent) {
                    console.error('[JSLib] Could not find PlayerManager GameObject for enemy');
                    return;
                }
                
                // Load enemy avatar
                const avatarUrl = data.enemy.avatarUrl;
                if (avatarUrl) {
                    console.log('[JSLib] Loading enemy avatar:', avatarUrl);
                    _LoadImageAsBase64(avatarUrl, possibleNames[0], 'OnEnemyAvatarLoaded');
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error getting enemy:', error);
        });
    },
    
    UpdatePlayerData: function(statsJsonPtr) {
        const statsJson = UTF8ToString(statsJsonPtr);
        console.log('[JSLib] Updating player with:', statsJson);
        
        updatePlayer(statsJson).then(result => {
            console.log('[JSLib] Player updated:', result);
            
            // Try multiple possible GameObject names
            const possibleNames = ['PlayerManager', 'GameManager', 'Player Manager', 'Manager'];
            for (let name of possibleNames) {
                try {
                    SendMessage(name, 'OnPlayerUpdated', result);
                    console.log(`[JSLib] Update message sent to: ${name}`);
                    break;
                } catch (e) {
                    // Try next name
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error updating player:', error);
        });
    },
    
    // Helper function for loading images - defined within the library
    _LoadImageAsBase64: function(imageUrl, gameObjectName, callbackMethod) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const base64Data = canvas.toDataURL('image/png');
                console.log('[JSLib] Image loaded and converted to base64');
                
                SendMessage(gameObjectName, callbackMethod, base64Data);
            } catch (error) {
                console.error('[JSLib] Error converting image to base64:', error);
                SendMessage(gameObjectName, callbackMethod, '');
            }
        };
        
        img.onerror = function() {
            console.error('[JSLib] Failed to load image:', imageUrl);
            SendMessage(gameObjectName, callbackMethod, '');
        };
        
        img.src = imageUrl;
    },




    StartBattle: function() {  
        startBattle().then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Battle start result:', data);
            
            if (data.status === 'success') {
                const possibleNames = ['BattleUIManager', 'PlayerManager', 'GameManager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnBattleStarted', result);
                        console.log(`[JSLib] Battle start message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error starting battle:', error);
        });
    },
    
    BattleAction: function(battleIdPtr, actionPtr) {  
        const battleId = UTF8ToString(battleIdPtr);
        const action = UTF8ToString(actionPtr);
        
        battleAction(battleId, action).then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Battle action result:', data);
            
            if (data.status === 'success') {
                const possibleNames = ['BattleUIManager', 'PlayerManager', 'GameManager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnBattleAction', result);
                        console.log(`[JSLib] Battle action message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error in battle action:', error);
        });
    },

    ProcessEnemyTurn: function(battleIdPtr) {  
        const battleId = UTF8ToString(battleIdPtr);
        
        console.log('[JSLib] Processing enemy turn for:', battleId);
        
        processEnemyTurn(battleId).then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Enemy turn result:', data);
            
            if (data.status === 'success') {
                const possibleNames = ['BattleUIManager', 'PlayerManager', 'GameManager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnEnemyTurn', result);
                        console.log(`[JSLib] Enemy turn message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error in enemy turn:', error);
        });
    },

    GetEnemyPreview: function(difficultyPtr, reroll) {
        const difficulty = UTF8ToString(difficultyPtr);
        
        console.log('[JSLib] Getting enemy preview:', difficulty, 'reroll:', reroll);
        
        getEnemyPreview(difficulty, reroll).then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Enemy preview result:', data);
            
            if (data.status === 'success') {
                const possibleNames = ['BattleSelectionManager', 'BattleUIManager', 'GameManager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnEnemyPreviewReceived', result);
                        console.log(`[JSLib] Enemy preview message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error getting enemy preview:', error);
        });
    },

    StartBattleWithDifficulty: function(difficultyPtr) {
        const difficulty = UTF8ToString(difficultyPtr);
        
        console.log('[JSLib] Starting battle with difficulty:', difficulty);
        
        startBattleWithDifficulty(difficulty).then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Battle start with difficulty result:', data);
            
            if (data.status === 'success') {
                const possibleNames = ['BattleUIManager', 'PlayerManager', 'GameManager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnBattleStarted', result);
                        console.log(`[JSLib] Battle start message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error starting battle with difficulty:', error);
        });
    },

    GetLeaderboard: function() {
        console.log('[JSLib] Getting leaderboard data');
        
        getLeaderboard().then(result => {
            const data = JSON.parse(result);
            console.log('[JSLib] Leaderboard result:', data);
            
            if (data.status === 'success') {
                const possibleNames = ['LeaderboardManager', 'GameManager', 'Manager'];
                
                for (let name of possibleNames) {
                    try {
                        SendMessage(name, 'OnLeaderboardReceived', result);
                        console.log(`[JSLib] Leaderboard message sent to: ${name}`);
                        break;
                    } catch (e) {
                        console.log(`[JSLib] GameObject '${name}' not found, trying next...`);
                    }
                }
            }
        }).catch(error => {
            console.error('[JSLib] Error getting leaderboard:', error);
        });
    }

});