import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { DEFAULT_AVATAR_URL } from '../shared/config';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

// Unity-specific endpoints
router.post('/api/save-score', async (req, res): Promise<void> => {
  const { postId } = context;
  const { score } = req.body;
  
  if (!postId) {
    res.status(400).json({
      status: 'error',
      message: 'postId is required',
    });
    return;
  }

  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({
        status: 'error',
        message: 'Username required'
      });
      return;
    }
    
    const scoreKey = `score:${postId}:${username}`;
    const highScoreKey = `highscore:${postId}:${username}`;
    const leaderboardKey = `leaderboard:${postId}`;
    
    // Save current score
    await redis.set(scoreKey, score.toString());
    
    // Update high score if this is better
    const currentHighScore = await redis.get(highScoreKey);
    if (!currentHighScore || parseInt(score) > parseInt(currentHighScore)) {
      await redis.set(highScoreKey, score.toString());
      // Update leaderboard hash with new high score
      await redis.hSet(leaderboardKey, { [username || 'anonymous']: score.toString() });
      // Also update global leaderboard for cross-post leaderboard
      await redis.hSet('global_leaderboard', { [username || 'anonymous']: score.toString() });
    }
    
    res.json({
      status: 'success',
      score: parseInt(score),
      highScore: Math.max(parseInt(score), parseInt(currentHighScore || '0')),
      username: username ?? 'anonymous'
    });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save score'
    });
  }
});

router.get('/api/leaderboard', async (_req, res): Promise<void> => {
  try {
    console.log('[Leaderboard] Starting leaderboard request...');
    
    const currentUsername = await reddit.getCurrentUsername();
    console.log(`[Leaderboard] Current username: ${currentUsername}`);
    
    const leaderboardEntries = [];
    
    try {
      // Devvit Redis doesn't support keys() method, so we'll use a leaderboard hash instead
      console.log('[Leaderboard] Getting leaderboard from hash...');
      const leaderboardHash = await redis.hGetAll('global_leaderboard');
      console.log(`[Leaderboard] Found ${Object.keys(leaderboardHash).length} entries in leaderboard hash`);
      
      if (Object.keys(leaderboardHash).length === 0) {
        console.log('[Leaderboard] Leaderboard hash is empty, no entries to process');
        console.log('[Leaderboard] This means no players have saved scores yet');
        
        // Add current player to leaderboard if they exist
        if (currentUsername) {
          console.log(`[Leaderboard] Adding current player ${currentUsername} to empty leaderboard`);
          const currentPlayer = await getOrCreatePlayer(currentUsername);
          if (currentPlayer) {
            // Add them to the global leaderboard with their current stats
            const playerScore = currentPlayer.stats?.level * 100 || 100; // Use level as score fallback
            await redis.hSet('global_leaderboard', { [currentUsername]: playerScore.toString() });
            console.log(`[Leaderboard] Added ${currentUsername} with score ${playerScore}`);
            
            // Refresh the leaderboard hash
            const refreshedHash = await redis.hGetAll('global_leaderboard');
            Object.assign(leaderboardHash, refreshedHash);
          }
        }
      }
      
      // Process each player in the leaderboard
      let processedCount = 0;
      let errorCount = 0;
      
      for (const [username, scoreStr] of Object.entries(leaderboardHash)) {
        try {
          if (!username) continue; // Skip invalid usernames
          
          console.log(`[Leaderboard] Processing player: ${username} with score: ${scoreStr}`);
          const playerKey = `player:${username}`;
          const playerDataStr = await redis.get(playerKey);
          
          if (playerDataStr) {
            const playerData = JSON.parse(playerDataStr);
            const battlesWonKey = `battles_won:${username}`;
            const battlesWon = await redis.get(battlesWonKey);
            
            console.log(`[Leaderboard] Found player data for ${username}: Level ${playerData.stats?.level}, Battles: ${battlesWon}`);
            
            leaderboardEntries.push({
              username: playerData.username || username,
              score: parseInt(scoreStr) || 0,
              level: playerData.stats?.level || 1,
              avatarUrl: playerData.avatarUrl || DEFAULT_AVATAR_URL,
              fallbackAvatarUrls: generateFallbackAvatarUrls(username, playerData.avatarUrl),
              battlesWon: battlesWon ? parseInt(battlesWon) : 0,
              lastPlayed: playerData.lastPlayed || playerData.createdAt
            });
            processedCount++;
          } else {
            console.log(`[Leaderboard] No player data found for ${username}`);
            errorCount++;
          }
        } catch (playerError) {
          console.error(`[Leaderboard] Error processing player ${username}:`, playerError);
          errorCount++;
        }
      }
      
      console.log(`[Leaderboard] Processing complete: ${processedCount} successful, ${errorCount} errors`);
    } catch (hashError) {
      console.error('[Leaderboard] Error getting leaderboard hash, falling back to current player only:', hashError);
      
      // Fallback: just get current player
      if (currentUsername) {
        const playerKey = `player:${currentUsername}`;
        const playerDataStr = await redis.get(playerKey);
        if (playerDataStr) {
          const playerData = JSON.parse(playerDataStr);
          const [highScore, battlesWon] = await Promise.all([
            redis.get(`score:${currentUsername}`),
            redis.get(`battles_won:${currentUsername}`)
          ]);
          
          leaderboardEntries.push({
            username: playerData.username || currentUsername,
            score: highScore ? parseInt(highScore) : 0,
            level: playerData.stats?.level || 1,
            avatarUrl: playerData.avatarUrl || DEFAULT_AVATAR_URL,
            fallbackAvatarUrls: generateFallbackAvatarUrls(currentUsername, playerData.avatarUrl),
            battlesWon: battlesWon ? parseInt(battlesWon) : 0,
            lastPlayed: playerData.lastPlayed || playerData.createdAt
          });
        }
      }
    }
    
    // Sort by level first, then by battles won (score is hidden/unused)
    leaderboardEntries.sort((a, b) => {
      if (a.level !== b.level) return b.level - a.level;
      if (a.battlesWon !== b.battlesWon) return b.battlesWon - a.battlesWon;
      // Score as tiebreaker (but it's hidden in UI)
      return b.score - a.score;
    });
    
    // Find current player's rank
    let playerRank = -1;
    if (currentUsername) {
      const playerIndex = leaderboardEntries.findIndex(entry => entry.username === currentUsername);
      playerRank = playerIndex >= 0 ? playerIndex + 1 : -1;
    }
    
    // Smart leaderboard limiting with current player inclusion
    const maxEntries = 25; // Increased slightly to allow for current player
    let finalLeaderboard = [];
    
    // Always include top players
    const topPlayers = leaderboardEntries.slice(0, Math.min(maxEntries - 1, leaderboardEntries.length));
    finalLeaderboard = [...topPlayers];
    
    // Add current player if they're not in the top entries and we have their data
    if (currentUsername && playerRank > 0 && playerRank > topPlayers.length) {
      const currentPlayerEntry = leaderboardEntries[playerRank - 1]; // Convert to 0-based index
      if (currentPlayerEntry && !finalLeaderboard.some(entry => entry.username === currentUsername)) {
        finalLeaderboard.push(currentPlayerEntry);
        console.log(`[Leaderboard] Added current player ${currentUsername} at rank ${playerRank} to leaderboard`);
      }
    }
    
    console.log(`[Leaderboard] Returning ${finalLeaderboard.length} players, current player rank: ${playerRank}`);
    
    // Ensure totalPlayers is at least the number of entries we're returning
    const calculatedTotalPlayers = Math.max(leaderboardEntries.length, finalLeaderboard.length);
    
    res.json({
      status: 'success',
      leaderboard: finalLeaderboard,
      playerRank: playerRank,
      totalPlayers: calculatedTotalPlayers,
      isCurrentPlayerIncluded: finalLeaderboard.some(entry => entry.username === currentUsername)
    });
    
  } catch (error) {
    console.error('[Leaderboard] Error getting leaderboard:', error);
    if (error instanceof Error) {
      console.error('[Leaderboard] Error stack:', error.stack);
    }
    res.status(500).json({
      status: 'error',
      message: `Failed to get leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

// Helper function to update leaderboard when player stats change
async function updatePlayerLeaderboard(username: string | undefined, battlesWon?: number): Promise<void> {
  if (!username) {
    console.warn('[Leaderboard] No username provided to updatePlayerLeaderboard');
    return;
  }
  try {
    // Update battles won counter if provided
    if (battlesWon !== undefined) {
      const battlesWonKey = `battles_won:${username}`;
      await redis.set(battlesWonKey, battlesWon.toString());
      console.log(`[Leaderboard] Updated battles won for ${username}: ${battlesWon}`);
      
      // Add player to global leaderboard hash if not already there
      const currentScore = await redis.get(`score:${username}`) || '0';
      await redis.hSet('global_leaderboard', { [username]: currentScore });
    }
    
    console.log(`[Leaderboard] Player ${username} stats updated`);
    
  } catch (error) {
    console.error(`[Leaderboard] Error updating leaderboard for ${username}:`, error);
  }
}

// Helper function to fetch user's public profile for avatar
async function fetchUserAvatar(username: string): Promise<string> {
  console.log(`[Server] Reddit APIs don't expose custom Snoo avatars for: ${username}`);
  
  // Unfortunately, Reddit's developer APIs (both public and Devvit) don't expose 
  // custom Snoo avatar URLs. This is a known limitation.
  // 
  // Options for getting custom avatars:
  // 1. User manually provides their avatar URL
  // 2. Use a default/placeholder system
  // 3. Generate avatars based on username
  
  // For now, return default avatar
  return DEFAULT_AVATAR_URL;
}

// Helper function to get user's Snoovatar with enhanced fallback
async function getUserSnoovatar(username?: string): Promise<string> {
  try {
    const user = username ? await reddit.getUserByUsername(username) : await reddit.getCurrentUser();
    if (user) {
      const userAny = user as any;
      if (typeof userAny.getSnoovatarUrl === 'function') {
        const snoovatarUrl = await userAny.getSnoovatarUrl();
        if (snoovatarUrl && snoovatarUrl !== DEFAULT_AVATAR_URL) {
          console.log(`[Server] Got Snoovatar for ${username}: ${snoovatarUrl}`);
          return snoovatarUrl;
        }
      }
    }
  } catch (error) {
    console.error(`[Server] Error getting Snoovatar for ${username}:`, error);
  }
  
  // Enhanced fallback logic
  if (username) {
    console.log(`[Server] Using fallback avatar strategy for ${username}`);
    
    // Try Reddit user avatar endpoint as fallback
    const fallbackUrl = `https://www.reddit.com/user/${username}/avatar`;
    console.log(`[Server] Fallback avatar URL for ${username}: ${fallbackUrl}`);
    return fallbackUrl;
  }
  
  return DEFAULT_AVATAR_URL;
}

// Generate fallback avatar URLs for a user
function generateFallbackAvatarUrls(username: string, primaryUrl?: string): string[] {
  const fallbacks: string[] = [];
  
  // Note: primaryUrl parameter is available for future use
  console.log(`[Server] Generating fallback URLs for ${username} (primary: ${primaryUrl})`);
  
  if (username) {
    // Reddit user avatar endpoint (often works when Snoovatar fails)
    fallbacks.push(`https://www.reddit.com/user/${username}/avatar`);
    
    // Alternative Reddit avatar formats
    fallbacks.push(`https://styles.redditmedia.com/t5_2qh1i/styles/profileIcon_${username}.png`);
    
    // Gravatar-style identicon (generates consistent avatar based on username)
    const hash = simpleHash(username);
    fallbacks.push(`https://www.gravatar.com/avatar/${hash}?d=identicon&s=128`);
  }
  
  // Always include default as final fallback
  fallbacks.push(DEFAULT_AVATAR_URL);
  
  return fallbacks;
}

// Simple hash function for consistent avatar generation
function simpleHash(input: string): string {
  if (!input) return 'default';
  
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Player Character System
function createNewPlayer(username: string, avatarUrl: string): any {
  return {
    username,
    avatarUrl,
    stats: {
      level: 1,
      experience: 0,
      experienceToNext: 100,
      hitPoints: 100,
      maxHitPoints: 100,
      specialPoints: 20,
      maxSpecialPoints: 20,
      attack: 10,
      defense: 5,
      skillPoints: 0,
      gold: 100 // Start with some gold for testing
    },
    purchasedItems: [], // Track purchased shop items
    createdAt: new Date().toISOString(),
    lastPlayed: new Date().toISOString()
  };
}

async function getOrCreatePlayer(username: string): Promise<any> {
  const playerKey = `player:${username}`;
  const existingPlayer = await redis.get(playerKey);
  
  if (existingPlayer) {
    const player = JSON.parse(existingPlayer);
    // Update last played time
    player.lastPlayed = new Date().toISOString();
    await redis.set(playerKey, JSON.stringify(player));
    return player;
  }
  
  // Create new player
  const avatarUrl = await getUserSnoovatar(username);
  const newPlayer = createNewPlayer(username, avatarUrl);
  await redis.set(playerKey, JSON.stringify(newPlayer));
  return newPlayer;
}

async function updatePlayer(username: string, updates: any): Promise<any> {
  const playerKey = `player:${username}`;
  const existingPlayer = await redis.get(playerKey);
  
  if (!existingPlayer) {
    throw new Error('Player not found');
  }
  
  const player = JSON.parse(existingPlayer);
  player.stats = { ...player.stats, ...updates };
  player.lastPlayed = new Date().toISOString();
  
  await redis.set(playerKey, JSON.stringify(player));
  return player;
}

// Battle System Functions
function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function calculateDamage(attacker: any, defender: any, action: string): number {
  let baseDamage = attacker.stats.attack;
  let defense = defender.stats.defense;
  
  switch (action) {
    case 'attack':
      baseDamage = Math.floor(attacker.stats.attack * 1.0); // Full attack power for faster battles
      break;
    case 'special':
      baseDamage = Math.floor(attacker.stats.attack * 1.8); // Increased special damage for impact
      break;
    case 'defend':
      return 0; // Defending does no damage
    default:
      baseDamage = Math.floor(attacker.stats.attack * 1.0); // Full default attack power
  }
  
  // Add some randomness (80-120% of base damage)
  const randomMultiplier = 0.8 + (Math.random() * 0.4);
  let damage = Math.floor(baseDamage * randomMultiplier);
  
  // Apply defense (reduce damage by defense amount, minimum 1 damage)
  damage = Math.max(1, damage - defense);
  
  return damage;
}


function getEnemyAction(): string {
  const actions = ['attack', 'attack', 'special', 'defend']; // Weighted toward attack
  return actions[Math.floor(Math.random() * actions.length)];
}

async function createBattle(player: any, enemy: any): Promise<any> {
  const battleId = generateBattleId();
  
  // Prepare battle copies of player and enemy
  const battlePlayer = { ...player };
  const battleEnemy = { ...enemy };
  
  // Reset SP to 0 at battle start for strategic SP system
  battlePlayer.stats.specialPoints = 0;
  battleEnemy.stats.specialPoints = 0;
  
  // Restore HP to full for both players at battle start
  battlePlayer.stats.hitPoints = battlePlayer.stats.maxHitPoints;
  battleEnemy.stats.hitPoints = battleEnemy.stats.maxHitPoints;
  
  console.log(`[Battle] Battle start - HP restored to full, SP reset to 0 for both players`);
  
  const battleState = {
    battleId,
    player: battlePlayer,
    enemy: battleEnemy,
    currentTurn: 'player',
    turnNumber: 1,
    isActive: true,
    winner: null,
    battleLog: [],
    createdAt: new Date().toISOString()
  };
  
  // Store battle state in Redis
  await redis.set(`battle:${battleId}`, JSON.stringify(battleState));
  
  return battleState;
}

async function processBattleTurn(battleId: string, playerAction: string): Promise<any> {
  const battleKey = `battle:${battleId}`;
  const battleData = await redis.get(battleKey);
  
  if (!battleData) {
    throw new Error('Battle not found');
  }
  
  const battle = JSON.parse(battleData);
  
  if (!battle.isActive) {
    throw new Error('Battle is not active');
  }
  
  if (battle.currentTurn !== 'player') {
    throw new Error('Not player turn');
  }
  
  const results: any = {
    playerTurn: null,
    enemyTurn: null,
    battleEnded: false,
    winner: null,
    rewards: null
  };
  
  // Process player turn
  let playerDamage = 0;
  let playerHealing = 0;

  
  console.log(`[Battle] === PLAYER TURN START ===`);
  console.log(`[Battle] Player turn: ${playerAction}`);
  console.log(`[Battle] Player HP before: ${battle.player.stats.hitPoints}/${battle.player.stats.maxHitPoints}`);
  console.log(`[Battle] Enemy HP before: ${battle.enemy.stats.hitPoints}/${battle.enemy.stats.maxHitPoints}`);
  
  // SP charging system: gain SP from regular actions, lose SP from special attacks
  const spGainPercent = 0.45; // Gain 45% of max SP per action (increased for faster special attacks)
  const spGainPerAction = Math.max(1, Math.floor(battle.player.stats.maxSpecialPoints * spGainPercent));
  const spCostSpecial = Math.floor(battle.player.stats.maxSpecialPoints * 0.8); // Special costs 80% of max SP
  
  if (playerAction === 'heal') {
    playerHealing = Math.floor(battle.player.stats.maxHitPoints * 0.3); // Heal 30%
    battle.player.stats.hitPoints = Math.min(
      battle.player.stats.maxHitPoints, 
      battle.player.stats.hitPoints + playerHealing
    );
    
    // Gain SP for healing
    battle.player.stats.specialPoints = Math.min(
      battle.player.stats.maxSpecialPoints,
      battle.player.stats.specialPoints + spGainPerAction
    );
    
    // Player healed for ${playerHealing} HP and gained ${spGainPerAction} SP
  } else if (playerAction === 'defend') {
    // Gain SP for defending
    battle.player.stats.specialPoints = Math.min(
      battle.player.stats.maxSpecialPoints,
      battle.player.stats.specialPoints + spGainPerAction
    );
    
    // Player is defending and gained ${spGainPerAction} SP
  } else {
    playerDamage = calculateDamage(battle.player, battle.enemy, playerAction);
    console.log(`[Battle] Player damage calculated: ${playerDamage}`);
    
    const enemyHpBefore = battle.enemy.stats.hitPoints;
    battle.enemy.stats.hitPoints = Math.max(0, battle.enemy.stats.hitPoints - playerDamage);
    console.log(`[Battle] Enemy HP: ${enemyHpBefore} -> ${battle.enemy.stats.hitPoints} (damage: ${playerDamage})`);
    
    if (playerAction === 'special') {
      // Check if player has enough SP for special attack
      if (battle.player.stats.specialPoints >= spCostSpecial) {
        battle.player.stats.specialPoints = Math.max(0, battle.player.stats.specialPoints - spCostSpecial);
        // Player used special attack for ${playerDamage} damage and lost ${spCostSpecial} SP
      } else {
        // Not enough SP - treat as regular attack but still consume some SP
        battle.player.stats.specialPoints = 0;
        playerDamage = Math.floor(playerDamage * 0.7); // Reduced damage if not enough SP
        battle.enemy.stats.hitPoints = Math.max(0, enemyHpBefore - playerDamage); // Recalculate with reduced damage
        // Player attempted special attack but had low SP, weak attack for ${playerDamage} damage
      }
    } else {
      // Regular attack - gain SP
      battle.player.stats.specialPoints = Math.min(
        battle.player.stats.maxSpecialPoints,
        battle.player.stats.specialPoints + spGainPerAction
      );
      // Player attacked for ${playerDamage} damage and gained ${spGainPerAction} SP
    }
  }
  
  console.log(`[Battle] === PLAYER TURN END ===`);
  console.log(`[Battle] Player HP after: ${battle.player.stats.hitPoints}/${battle.player.stats.maxHitPoints}`);
  console.log(`[Battle] Enemy HP after: ${battle.enemy.stats.hitPoints}/${battle.enemy.stats.maxHitPoints}`);
  
  // Check if enemy is defeated after player turn
  if (battle.enemy.stats.hitPoints <= 0) {
    console.log(`[Battle] Enemy defeated! Player wins!`);
    battle.isActive = false;
    battle.winner = 'player';
    results.battleEnded = true;
    results.winner = 'player';
    
    // Calculate rewards
    const expGain = battle.enemy.stats.level * 25;
    const goldGain = battle.enemy.stats.level * 15;
    
    results.rewards = {
      experience: expGain,
      gold: goldGain,
      levelUp: false
    };
    
    // Update battles won counter for leaderboard
    const playerUsername = battle.player.username || 'anonymous';
    const battlesWonKey = `battles_won:${playerUsername}`;
    const currentWins = await redis.get(battlesWonKey);
    const newWins = currentWins ? parseInt(currentWins) + 1 : 1;
    await updatePlayerLeaderboard(playerUsername, newWins);
    
    // Check for level up
    const newExp = battle.player.stats.experience + expGain;
    if (newExp >= battle.player.stats.experienceToNext) {
      battle.player.stats.level += 1;
      battle.player.stats.experience = newExp - battle.player.stats.experienceToNext;
      battle.player.stats.experienceToNext = battle.player.stats.level * 100;
      battle.player.stats.maxHitPoints += 20;
      battle.player.stats.hitPoints = battle.player.stats.maxHitPoints; // Full heal on level up
      battle.player.stats.maxSpecialPoints += 5;
      battle.player.stats.specialPoints = battle.player.stats.maxSpecialPoints;
      battle.player.stats.attack += 3;
      battle.player.stats.defense += 2;
      battle.player.stats.skillPoints += 1;
      results.rewards.levelUp = true;
    } else {
      battle.player.stats.experience = newExp;
    }
    
    battle.player.stats.gold += goldGain;
    battle.currentTurn = null; // Battle over
  } else {
    // Enemy still alive, switch to enemy turn
    battle.currentTurn = 'enemy';
  }
  
  battle.turnNumber += 1;
  
  await redis.set(battleKey, JSON.stringify(battle));
  
  return {
    battleState: battle,
    ...results
  };
  
  // COMMENTED OUT: Enemy turn processing (this was causing the HP bug)
  /*
  
  results.playerTurn = {
    attacker: battle.player.username,
    defender: battle.enemy.username,
    action: playerAction,
    damage: playerDamage,
    healing: playerHealing,
    message: playerMessage,
    attackerHpAfter: battle.player.stats.hitPoints,
    defenderHpAfter: battle.enemy.stats.hitPoints
  };
  
  battle.battleLog.push(results.playerTurn);
  
  // Check if enemy is defeated
  if (battle.enemy.stats.hitPoints <= 0) {
    battle.isActive = false;
    battle.winner = 'player';
    results.battleEnded = true;
    results.winner = 'player';
    
    // Calculate rewards
    const expGain = battle.enemy.stats.level * 25;
    const goldGain = battle.enemy.stats.level * 15;
    
    results.rewards = {
      experience: expGain,
      gold: goldGain,
      levelUp: false
    };
    
    // Update battles won counter for leaderboard
    const playerUsername = battle.player.username || 'anonymous';
    const battlesWonKey = `battles_won:${playerUsername}`;
    const currentWins = await redis.get(battlesWonKey);
    const newWins = currentWins ? parseInt(currentWins) + 1 : 1;
    await updatePlayerLeaderboard(playerUsername, newWins);
    
    // Check for level up
    const newExp = battle.player.stats.experience + expGain;
    if (newExp >= battle.player.stats.experienceToNext) {
      battle.player.stats.level += 1;
      battle.player.stats.experience = newExp - battle.player.stats.experienceToNext;
      battle.player.stats.experienceToNext = battle.player.stats.level * 100;
      battle.player.stats.maxHitPoints += 20;
      battle.player.stats.hitPoints = battle.player.stats.maxHitPoints; // Full heal on level up
      battle.player.stats.maxSpecialPoints += 5;
      battle.player.stats.specialPoints = battle.player.stats.maxSpecialPoints;
      battle.player.stats.attack += 3;
      battle.player.stats.defense += 2;
      battle.player.stats.skillPoints += 1;
      results.rewards.levelUp = true;
    } else {
      battle.player.stats.experience = newExp;
    }
    
    battle.player.stats.gold += goldGain;
  // Enemy turn code commented out to fix HP bug
  */
}

// Enemy Preview/Selection System
router.post('/api/enemy/preview', async (req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const currentPlayer = await getOrCreatePlayer(currentUsername || 'anonymous');
    const { difficulty = 'medium' } = req.body;
    
    console.log(`[Enemy Preview] Generating ${difficulty} enemy for level ${currentPlayer.stats.level} player`);
    
    // Generate enemy based on difficulty
    const enemy = await generateEnemyByDifficulty(currentPlayer, difficulty);
    
    // Calculate expected rewards
    const levelDifference = enemy.stats.level - currentPlayer.stats.level;
    const baseExperience = enemy.stats.level * 25;
    const baseGold = enemy.stats.level * 15;
    
    let riskLevel = 'balanced';
    if (levelDifference >= 2) riskLevel = 'high';
    else if (levelDifference <= -2) riskLevel = 'low';
    
    res.json({
      status: 'success',
      enemy,
      difficulty,
      levelDifference,
      expectedRewards: {
        baseExperience,
        baseGold,
        riskLevel
      }
    });
    
  } catch (error) {
    console.error('[Enemy Preview] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate enemy preview' });
  }
});

// Get random enemy (legacy endpoint)
router.get('/api/enemy', async (_req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const currentPlayer = await getOrCreatePlayer(currentUsername || 'anonymous');
    
    // Use medium difficulty as default
    const enemy = await generateEnemyByDifficulty(currentPlayer, 'medium');
    
    res.json({
      status: 'success',
      enemy
    });
    
  } catch (error) {
    console.error('[Enemy] Error getting random enemy:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get enemy' });
  }
});

// Battle start endpoint
router.post('/api/battle/start', async (req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const currentPlayer = await getOrCreatePlayer(currentUsername || 'anonymous');
    const { difficulty = 'medium' } = req.body;
    
    console.log(`[Battle Start] Starting ${difficulty} battle for ${currentUsername}`);
    
    // Generate enemy for battle
    const enemy = await generateEnemyByDifficulty(currentPlayer, difficulty);
    
    // Create battle
    const battleState = await createBattle(currentPlayer, enemy);
    
    res.json({
      status: 'success',
      battleState,
      message: `Battle started against ${enemy.username}!`
    });
    
  } catch (error) {
    console.error('[Battle Start] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to start battle' });
  }
});

// Battle start with specific enemy endpoint
router.post('/api/battle/start-with-enemy', async (req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    if (!currentUsername) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }

    const { enemyUsername, difficulty = 'medium' } = req.body;
    if (!enemyUsername) {
      res.status(400).json({ status: 'error', message: 'Enemy username required' });
      return;
    }
    
    console.log(`[Battle Start] Starting ${difficulty} battle with specific enemy: ${enemyUsername} for ${currentUsername}`);
    
    const player = await getOrCreatePlayer(currentUsername);
    
    // Use the selected difficulty to generate the enemy with appropriate stats
    const enemy = await generateSpecificEnemyWithDifficulty(enemyUsername, player, difficulty);
    
    // Create battle
    const battleState = await createBattle(player, enemy);
    
    res.json({
      status: 'success',
      battleState,
      message: `Battle started against ${enemy.username}!`
    });
    
  } catch (error) {
    console.error('[Battle Start with Enemy] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to start battle with specific enemy' });
  }
});

// Generate enemy with specific difficulty
async function generateEnemyByDifficulty(player: any, difficulty: string): Promise<any> {
  const playerLevel = player.stats.level;
  let enemyLevel: number;
  
  // Determine enemy level based on difficulty
  switch (difficulty) {
    case 'easy':
      enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 3) - 1); // 1-3 levels lower (easier)
      break;
    case 'hard':
      enemyLevel = playerLevel + Math.floor(Math.random() * 3) + 1; // 1-3 levels higher
      break;
    case 'medium':
    default:
      enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 2)); // 0-1 levels lower (easier)
      break;
  }
  
  // CURATED ENEMY LIST - DO NOT REPLACE - These users have verified custom Snoo avatars
  const famousEnemies = [
    // Reddit Legends
    'spez', 'kn0thing',
    
    // Devvit Team Members  
    'pl00h', 'lift_ticket',
    
    // Reddit Staff
    'KeyserSosa', 'powerlanguage', 'bsimpson',
    
    // Reddit Celebrities
    'shittymorph',
    
    // Avatar Artists (Verified Custom Avatars)
    'penguitt', 'PRguitarman', 'artofbrentos', 'salt_the_wizard', 'StutterVoid', 
    'iamdeirdre', 'Hoppy_Doodle', 'Tandizojere', 'kinnester', 'artofmajon', 
    'tinymischiefs', 'kristyglas', 'WorstTwitchEver', 'Qugmo', 'sabet76', 
    'Conall-in-Space', 'TheFattyBagz', 'giftedocean', 'NatAltDesign', '_ships', 
    'OniCowboy', 'tfoust10',
    
    // Additional Avatar Artists
    'mantrakid', 'sixthrodeo', 'PotatoNahh', 'aerynlynne', 'AkuDreams', 'ImAlekBan',
    'AliciaFreemanDesigns', 'OhBenny', 'anaeho', 'ChristineMendoza', 'Substantial-Law-910',
    'AVIRENFT', 'NateBearArt', 'bodegacatceo', 'Bumblebon', 'BunnyPrecious',
    'Canetoonist', 'ChipperdoodlesComic', 'Civort', 'Cool_Cats_NFT',
    'entropyre', 'Potstar1', 'Frayz', 'The_GeoffreyK', 'GlowyMushroom', 'GwynnArts',
    'slugfive', 'Jenniichii', 'hessicajansen', 'Josh_Brandon', 'karonuke', 'killjoyink',
    'Koyangi2018', 'anondoodles', 'NaoTajigen', 'Pollila1', 'OpenFren', 'Oue',
    'phobox91', 'razbonix', 'rocketMoonApe', 'RyeHardyDesigns', 'rylar', 'Saiyre-Art_Official',
    'Shadowjom', 'darth-weedy', 'Wurlawyrm'
  ];
  
  const randomEnemy = famousEnemies[Math.floor(Math.random() * famousEnemies.length)];
  const enemyAvatarUrl = await getUserSnoovatar(randomEnemy);
  
  // Determine HP based on difficulty for balanced battles
  let hitPoints: number;
  switch (difficulty) {
    case 'easy':
      hitPoints = 30 + (enemyLevel * 5); // Easy HP: 3-4 turn battles
      break;
    case 'hard':
      hitPoints = 50 + (enemyLevel * 10); // Hard HP: 6-8 turn battles
      break;
    case 'medium':
    default:
      hitPoints = 40 + (enemyLevel * 7); // Medium HP: 4-6 turn battles
      break;
  }

  // Create enemy stats based on level and difficulty
  const enemyCharacter = {
    username: randomEnemy,
    avatarUrl: enemyAvatarUrl,
    stats: {
      level: enemyLevel,
      experience: 0,
      experienceToNext: enemyLevel * 100,
      hitPoints: hitPoints,
      maxHitPoints: hitPoints,
      specialPoints: 15 + (enemyLevel * 5),
      maxSpecialPoints: 15 + (enemyLevel * 5),
      attack: 8 + (enemyLevel * 3),
      defense: 3 + (enemyLevel * 2),
      skillPoints: 0,
      gold: enemyLevel * 10
    },
    isNPC: true
  };
  
  console.log(`[Enemy Preview] Generated ${difficulty} enemy: ${randomEnemy} (Level ${enemyLevel})`);
  return enemyCharacter;
}

// Generate specific enemy by username with difficulty
async function generateSpecificEnemyWithDifficulty(enemyUsername: string, player: any, difficulty: string): Promise<any> {
  const playerLevel = player.stats.level;
  let enemyLevel: number;
  let hitPoints: number;
  let maxHitPoints: number;
  
  // Determine enemy level and HP based on difficulty (balanced for good pacing)
  switch (difficulty) {
    case 'easy':
      enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 3) - 1); // 1-3 levels lower
      hitPoints = 30 + (enemyLevel * 5); // Easy HP: 3-4 turn battles
      break;
    case 'hard':
      enemyLevel = playerLevel + Math.floor(Math.random() * 3) + 1; // 1-3 levels higher
      hitPoints = 50 + (enemyLevel * 10); // Hard HP: 6-8 turn battles
      break;
    case 'medium':
    default:
      enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 2)); // 0-1 levels lower
      hitPoints = 40 + (enemyLevel * 7); // Medium HP: 4-6 turn battles
      break;
  }
  
  maxHitPoints = hitPoints;
  
  const enemyAvatarUrl = await getUserSnoovatar(enemyUsername);
  
  // Create enemy stats based on level and difficulty
  const enemyCharacter = {
    username: enemyUsername,
    avatarUrl: enemyAvatarUrl,
    stats: {
      level: enemyLevel,
      experience: 0,
      experienceToNext: enemyLevel * 100,
      hitPoints: hitPoints,
      maxHitPoints: maxHitPoints,
      specialPoints: 15 + (enemyLevel * 5),
      maxSpecialPoints: 15 + (enemyLevel * 5),
      attack: 8 + (enemyLevel * 3),
      defense: 3 + (enemyLevel * 2),
      skillPoints: 0,
      gold: enemyLevel * 10
    },
    isNPC: true
  };
  
  console.log(`[Enemy Generation] Generated ${difficulty} enemy: ${enemyUsername} (Level ${enemyLevel}, ${hitPoints} HP)`);
  return enemyCharacter;
}

// Generate specific enemy by username (legacy function, kept for compatibility)
async function generateSpecificEnemy(enemyUsername: string, player: any): Promise<any> {
  return generateSpecificEnemyWithDifficulty(enemyUsername, player, 'medium');
}

// Test endpoint to check profile fetching
router.get('/api/test-profile/:username', async (req, res): Promise<void> => {
  const { username } = req.params;
  console.log(`[Test] Testing profile fetch for: ${username}`);
  
  const avatar = await fetchUserAvatar(username);
  res.json({
    username,
    avatar,
    success: !!avatar
  });
});

// Player Character API Endpoints
router.get('/api/player', async (_req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }
    
    const player = await getOrCreatePlayer(username);
    res.json({
      status: 'success',
      playerCharacter: player
    });
  } catch (error) {
    console.error('[Server] Error getting player:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get player data' });
  }
});

router.post('/api/player/update', async (req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }
    
    const updates = req.body;
    const player = await updatePlayer(username, updates);
    res.json({
      status: 'success',
      playerCharacter: player
    });
  } catch (error) {
    console.error('[Server] Error updating player:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update player' });
  }
});

router.post('/api/player/reset', async (_req, res): Promise<void> => {
  console.log('[Server] Reset endpoint called!');
  try {
    const username = await reddit.getCurrentUsername();
    console.log(`[Server] Reset request for username: ${username}`);
    if (!username) {
      console.log('[Server] No username found, returning error');
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }

    // TypeScript assertion: username is guaranteed to be string after the null check
    const validUsername: string = username;
    console.log(`[Server] Resetting player stats for: ${validUsername}`);
    
    // Get current player to preserve username and avatar
    const playerKey = `player:${validUsername}`;
    const existingPlayerStr = await redis.get(playerKey);
    let avatarUrl = DEFAULT_AVATAR_URL;
    
    if (existingPlayerStr) {
      const existingPlayer = JSON.parse(existingPlayerStr);
      console.log(`[Server] Current player before reset:`, existingPlayer.stats);
      avatarUrl = existingPlayer.avatarUrl || DEFAULT_AVATAR_URL;
    }
    
    // Create fresh player with default stats
    const resetPlayer = createNewPlayer(validUsername, avatarUrl);
    console.log(`[Server] New reset player stats:`, resetPlayer.stats);
    
    // Save reset player
    await redis.set(playerKey, JSON.stringify(resetPlayer));
    
    // Reset battles won counter
    const battlesWonKey = `battles_won:${validUsername}`;
    await redis.set(battlesWonKey, '0');
    
    // Reset high score
    const scoreKey = `score:${validUsername}`;
    await redis.set(scoreKey, '0');
    
    // Verify the reset worked
    const verifyPlayerStr = await redis.get(playerKey);
    if (verifyPlayerStr) {
      const verifyPlayer = JSON.parse(verifyPlayerStr);
      console.log(`[Server] Verified reset player stats:`, verifyPlayer.stats);
    }
    
    console.log(`[Server] Player ${validUsername} stats reset to defaults`);
    
    res.json({
      status: 'success',
      playerCharacter: resetPlayer,
      message: 'Player stats reset to default values'
    });
    
  } catch (error) {
    console.error('[Server] Error resetting player:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reset player stats' });
  }
});

router.get('/api/enemy', async (_req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const currentPlayer = await getOrCreatePlayer(currentUsername || 'anonymous');
    
    let randomEnemy;
    
    // 60% chance to fight a real player from leaderboard, 40% chance for famous accounts
    if (Math.random() < 0.6) {
      try {
        // Get real players from the leaderboard hash
        const leaderboardHash = await redis.hGetAll('global_leaderboard');
        const realPlayers = [];
        
        for (const [username, scoreStr] of Object.entries(leaderboardHash)) {
          // Don't fight yourself
          if (username !== currentUsername) {
            const playerKey = `player:${username}`;
            const playerDataStr = await redis.get(playerKey);
            if (playerDataStr) {
              const playerData = JSON.parse(playerDataStr);
              realPlayers.push({
                username: playerData.username || username,
                level: playerData.stats?.level || 1,
                stats: playerData.stats,
                avatarUrl: playerData.avatarUrl
              });
            }
          }
        }
        
        if (realPlayers.length > 0) {
          // Sort by level (fight players near your level more often)
          realPlayers.sort((a, b) => Math.abs(a.level - currentPlayer.stats.level) - Math.abs(b.level - currentPlayer.stats.level));
          
          // Pick from top 5 closest level players (or all if less than 5)
          const candidatePlayers = realPlayers.slice(0, Math.min(5, realPlayers.length));
          const selectedPlayer = candidatePlayers[Math.floor(Math.random() * candidatePlayers.length)];
          
          if (selectedPlayer) {
            randomEnemy = selectedPlayer.username;
            console.log(`[Enemy] Selected real player: ${randomEnemy} (Level ${selectedPlayer.level})`);
          }
        }
      } catch (error) {
        console.error('[Enemy] Error getting real players:', error);
      }
    }
    
    // Fallback to famous accounts if no real players found or 40% chance
    if (!randomEnemy) {
      const famousEnemies = [
        // Reddit Founders & Legends (with custom avatars)
        'spez', 'kn0thing',
        
        // Devvit Team Members (with custom avatars)
        'pl00h', 'lift_ticket',
        
        // Reddit Avatar Artists (with custom avatars)
        'penguitt', 'PRguitarman', 'artofbrentos', 'salt_the_wizard', 'StutterVoid', 
        'iamdeirdre', 'Hoppy_Doodle', 'Tandizojere', 'kinnester', 'artofmajon', 
        'tinymischiefs', 'kristyglas', 'WorstTwitchEver', 'Qugmo', 'sabet76', 
        'Conall-in-Space', 'TheFattyBagz', 'giftedocean', 'NatAltDesign', '_ships', 
        'OniCowboy', 'tfoust10',
        
        // More Avatar Artists
        'mantrakid', 'sixthrodeo', 'PotatoNahh', 'aerynlynne', 'AkuDreams', 'ImAlekBan',
        'AliciaFreemanDesigns', 'OhBenny', 'anaeho', 'ChristineMendoza', 'Substantial-Law-910',
        'AVIRENFT', 'NateBearArt', 'bodegacatceo', 'Bumblebon', 'BunnyPrecious',
        'Canetoonist', 'ChipperdoodlesComic', 'Civort', 'Cool_Cats_NFT',
        'entropyre', 'Potstar1', 'Frayz', 'The_GeoffreyK', 'GlowyMushroom', 'GwynnArts',
        'slugfive', 'Jenniichii', 'hessicajansen', 'Josh_Brandon', 'karonuke', 'killjoyink',
        'Koyangi2018', 'anondoodles', 'NaoTajigen', 'Pollila1', 'OpenFren', 'Oue',
        'phobox91', 'razbonix', 'rocketMoonApe', 'RyeHardyDesigns', 'rylar', 'Saiyre-Art_Official',
        'Shadowjom', 'darth-weedy', 'Wurlawyrm',
        
        // Popular Reddit Accounts (with custom avatars)
        'shittymorph',
        
        // Reddit Staff & Admins (with custom avatars)
        'KeyserSosa', 'powerlanguage', 'bsimpson'
      ];
      randomEnemy = famousEnemies[Math.floor(Math.random() * famousEnemies.length)];
      console.log(`[Enemy] Selected famous account: ${randomEnemy}`);
    }
    
    const enemyAvatarUrl = await getUserSnoovatar(randomEnemy);
    
    // Create enemy stats based on player level (slightly weaker)
    const playerLevel = currentPlayer.stats.level;
    const enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 3) - 1); // Enemy is 1-3 levels lower
    
    const enemyCharacter = {
      username: randomEnemy,
      avatarUrl: enemyAvatarUrl,
      stats: {
        level: enemyLevel,
        experience: 0,
        experienceToNext: 0,
        hitPoints: 25 + (enemyLevel * 4), // Much faster battles: 25 + 4*level
        maxHitPoints: 25 + (enemyLevel * 4),
        specialPoints: 5 + enemyLevel, // Much less SP: 5 + level
        maxSpecialPoints: 5 + enemyLevel,
        attack: 4 + Math.floor(enemyLevel / 2), // Much weaker attack: 4 + level/2
        defense: 1 + Math.floor(enemyLevel / 3), // Very low defense: 1 + level/3
        skillPoints: 0,
        gold: 0
      },
      isNPC: true
    };
    
    res.json({
      status: 'success',
      enemy: enemyCharacter
    });
  } catch (error) {
    console.error('[Server] Error generating enemy:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate enemy' });
  }
});

// Enemy Preview System for Battle Selection
router.post('/api/enemy/preview', async (req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const currentPlayer = await getOrCreatePlayer(currentUsername || 'anonymous');
    const { difficulty = 'medium', reroll = false } = req.body;
    
    console.log(`[Enemy Preview] ${currentUsername} requesting ${difficulty} enemy (reroll: ${reroll})`);
    
    // Get enemy using existing logic
    let randomEnemy;
    
    // 60% chance for real player, 40% for famous accounts
    if (Math.random() < 0.6) {
      try {
        const leaderboardHash = await redis.hGetAll('global_leaderboard');
        const realPlayers = [];
        
        for (const [username, scoreStr] of Object.entries(leaderboardHash)) {
          if (username !== currentUsername) {
            const playerKey = `player:${username}`;
            const playerDataStr = await redis.get(playerKey);
            if (playerDataStr) {
              const playerData = JSON.parse(playerDataStr);
              realPlayers.push({
                username: playerData.username || username,
                level: playerData.stats?.level || 1,
                stats: playerData.stats,
                avatarUrl: playerData.avatarUrl
              });
            }
          }
        }
        
        if (realPlayers.length > 0) {
          // Filter by difficulty preference
          let filteredPlayers = realPlayers;
          const playerLevel = currentPlayer.stats.level;
          
          if (difficulty === 'easy') {
            filteredPlayers = realPlayers.filter(p => p.level <= playerLevel);
          } else if (difficulty === 'hard') {
            filteredPlayers = realPlayers.filter(p => p.level >= playerLevel);
          }
          
          if (filteredPlayers.length > 0) {
            const selectedPlayer = filteredPlayers[Math.floor(Math.random() * filteredPlayers.length)];
            if (selectedPlayer) {
              randomEnemy = selectedPlayer.username;
            }
          }
        }
      } catch (error) {
        console.error('[Enemy Preview] Error getting real players:', error);
      }
    }
    
    // Fallback to famous accounts
    if (!randomEnemy) {
      const famousEnemies = [
        'spez', 'kn0thing', 'pl00h', 'lift_ticket', 'penguitt', 'PRguitarman',
        'artofbrentos', 'salt_the_wizard', 'StutterVoid', 'iamdeirdre', 'Hoppy_Doodle',
        'Tandizojere', 'kinnester', 'artofmajon', 'tinymischiefs', 'kristyglas',
        'WorstTwitchEver', 'Qugmo', 'sabet76', 'Conall-in-Space', 'TheFattyBagz',
        'giftedocean', 'NatAltDesign', '_ships', 'OniCowboy', 'tfoust10',
        'shittymorph', 'KeyserSosa', 'powerlanguage', 'bsimpson'
      ];
      randomEnemy = famousEnemies[Math.floor(Math.random() * famousEnemies.length)];
    }
    
    // Get enemy avatar
    const enemyAvatarUrl = await getUserSnoovatar(randomEnemy);
    
    // Scale enemy stats based on difficulty
    const playerLevel = currentPlayer.stats.level;
    let enemyLevel = playerLevel; // Default to same level
    
    switch (difficulty) {
      case 'easy':
        enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 3 + 1)); // 1-3 levels below (easier)
        break;
      case 'medium':
        enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 2)); // 0-1 levels below (easier)
        break;
      case 'hard':
        enemyLevel = playerLevel + Math.floor(Math.random() * 3 + 1); // 1-3 levels above
        break;
    }
    
    enemyLevel = Math.max(1, enemyLevel); // Ensure minimum level 1
    
    // Create enemy character with scaled stats
    const enemy = {
      username: randomEnemy,
      avatarUrl: enemyAvatarUrl,
      stats: {
        level: enemyLevel,
        experience: 0,
        experienceToNext: enemyLevel * 100,
        hitPoints: 35 + (enemyLevel * 5), // Much faster battles: 35 + 5*level
        maxHitPoints: 35 + (enemyLevel * 5),
        specialPoints: 15 + Math.floor(enemyLevel * 1.5),
        maxSpecialPoints: 15 + Math.floor(enemyLevel * 1.5),
        attack: 8 + Math.floor(enemyLevel * 1.2),
        defense: 3 + Math.floor(enemyLevel * 0.8),
        skillPoints: 0,
        gold: 0
      },
      isNPC: true
    };
    
    // Calculate expected rewards
    const levelDifference = enemyLevel - playerLevel;
    const baseExperience = Math.max(10, enemyLevel * 25 + (levelDifference * 10));
    const baseGold = Math.max(5, enemyLevel * 15 + (levelDifference * 5));
    
    let riskLevel = 'Balanced';
    if (levelDifference <= -2) riskLevel = 'Low Risk';
    else if (levelDifference >= 2) riskLevel = 'High Risk';
    
    console.log(`[Enemy Preview] Generated ${difficulty} enemy: ${randomEnemy} (Level ${enemyLevel}, ${riskLevel})`);
    
    res.json({
      status: 'success',
      enemy: enemy,
      difficulty: difficulty,
      levelDifference: levelDifference,
      expectedRewards: {
        baseExperience: baseExperience,
        baseGold: baseGold,
        riskLevel: riskLevel
      }
    });
    
  } catch (error) {
    console.error('[Enemy Preview] Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to generate enemy preview' 
    });
  }
});

// Battle System API Endpoints (duplicate removed - using newer endpoint above)

router.post('/api/battle/action', async (req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }
    
    const { battleId, action } = req.body;
    
    if (!battleId || !action) {
      res.status(400).json({ status: 'error', message: 'Battle ID and action required' });
      return;
    }
    
    const result = await processBattleTurn(battleId, action);
    
    // If battle ended, update player stats
    if (result.battleEnded && result.winner === 'player' && result.rewards) {
      await updatePlayer(username, result.battleState.player.stats);
    }
    
    res.json({
      status: 'success',
      ...result
    });
  } catch (error) {
    console.error('[Server] Error processing battle action:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process battle action';
    res.status(500).json({ status: 'error', message: errorMessage });
  }
});

router.get('/api/battle/:battleId', async (req, res): Promise<void> => {
  try {
    const { battleId } = req.params;
    const battleData = await redis.get(`battle:${battleId}`);
    
    if (!battleData) {
      res.status(404).json({ status: 'error', message: 'Battle not found' });
      return;
    }
    
    const battle = JSON.parse(battleData);
    res.json({
      status: 'success',
      battleState: battle
    });
  } catch (error) {
    console.error('[Server] Error getting battle:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get battle' });
  }
});

// New endpoint for processing enemy turns
router.post('/api/battle/enemy-turn', async (req, res): Promise<void> => {
  try {
    const { battleId } = req.body;
    
    if (!battleId) {
      res.status(400).json({ status: 'error', message: 'Battle ID required' });
      return;
    }
    
    const battleKey = `battle:${battleId}`;
    const battleData = await redis.get(battleKey);
    
    if (!battleData) {
      res.status(404).json({ status: 'error', message: 'Battle not found' });
      return;
    }
    
    const battle = JSON.parse(battleData);
    
    if (!battle.isActive || battle.currentTurn !== 'enemy') {
      res.json({
        status: 'success',
        battleState: battle,
        message: 'Not enemy turn or battle not active'
      });
      return;
    }
    
    // Process enemy turn with SP system
    const enemyAction = getEnemyAction();
    let enemyDamage = 0;
    let enemyHealing = 0;
    let enemyMessage = '';
    const spGainPercent = 0.2; // Same 20% gain as player
    const spGainPerAction = Math.max(1, Math.floor(battle.enemy.stats.maxSpecialPoints * spGainPercent));
    const spCostSpecial = Math.floor(battle.enemy.stats.maxSpecialPoints * 0.8);
    
    console.log(`[Battle] === ENEMY TURN START ===`);
    console.log(`[Battle] Enemy action: ${enemyAction}`);
    console.log(`[Battle] Enemy SP before: ${battle.enemy.stats.specialPoints}/${battle.enemy.stats.maxSpecialPoints}`);
    
    if (enemyAction === 'heal') {
      enemyHealing = Math.floor(battle.enemy.stats.maxHitPoints * 0.2);
      battle.enemy.stats.hitPoints = Math.min(
        battle.enemy.stats.maxHitPoints,
        battle.enemy.stats.hitPoints + enemyHealing
      );
      
      // Enemy gains SP for healing
      battle.enemy.stats.specialPoints = Math.min(
        battle.enemy.stats.maxSpecialPoints,
        battle.enemy.stats.specialPoints + spGainPerAction
      );
      
      enemyMessage = `${battle.enemy.username} healed for ${enemyHealing} HP!`;
    } else if (enemyAction === 'defend') {
      // Enemy gains SP for defending
      battle.enemy.stats.specialPoints = Math.min(
        battle.enemy.stats.maxSpecialPoints,
        battle.enemy.stats.specialPoints + spGainPerAction
      );
      
      enemyMessage = `${battle.enemy.username} is defending!`;
    } else {
      enemyDamage = calculateDamage(battle.enemy, battle.player, enemyAction);
      console.log(`[Battle] Enemy damage: ${enemyDamage}`);
      
      const playerHpBefore = battle.player.stats.hitPoints;
      battle.player.stats.hitPoints = Math.max(0, battle.player.stats.hitPoints - enemyDamage);
      console.log(`[Battle] Player HP: ${playerHpBefore} -> ${battle.player.stats.hitPoints}`);
      
      if (enemyAction === 'special') {
        // Enemy special attack with SP cost
        if (battle.enemy.stats.specialPoints >= spCostSpecial) {
          battle.enemy.stats.specialPoints = Math.max(0, battle.enemy.stats.specialPoints - spCostSpecial);
          enemyMessage = `${battle.enemy.username} used special attack for ${enemyDamage} damage!`;
        } else {
          // Not enough SP - weaker attack
          battle.enemy.stats.specialPoints = 0;
          enemyDamage = Math.floor(enemyDamage * 0.7);
          battle.player.stats.hitPoints = Math.max(0, playerHpBefore - enemyDamage);
          enemyMessage = `${battle.enemy.username} attempted special attack but low SP! Weak attack for ${enemyDamage} damage!`;
        }
      } else {
        // Regular attack - enemy gains SP
        battle.enemy.stats.specialPoints = Math.min(
          battle.enemy.stats.maxSpecialPoints,
          battle.enemy.stats.specialPoints + spGainPerAction
        );
        enemyMessage = `${battle.enemy.username} attacked for ${enemyDamage} damage!`;
      }
    }
    
    console.log(`[Battle] Enemy SP after: ${battle.enemy.stats.specialPoints}/${battle.enemy.stats.maxSpecialPoints}`);
    
    const enemyTurn = {
      attacker: battle.enemy.username,
      defender: battle.player.username,
      action: enemyAction,
      damage: enemyDamage,
      healing: enemyHealing,
      message: enemyMessage,
      attackerHpAfter: battle.enemy.stats.hitPoints,
      defenderHpAfter: battle.player.stats.hitPoints
    };
    
    battle.battleLog.push(enemyTurn);
    
    // Check if player is defeated
    let battleEnded = false;
    let winner = null;
    
    if (battle.player.stats.hitPoints <= 0) {
      battle.isActive = false;
      battle.winner = 'enemy';
      battleEnded = true;
      winner = 'enemy';
    } else {
      // Back to player turn
      battle.currentTurn = 'player';
    }
    
    battle.turnNumber += 1;
    
    await redis.set(battleKey, JSON.stringify(battle));
    
    res.json({
      status: 'success',
      battleState: battle,
      enemyTurn: enemyTurn,
      battleEnded: battleEnded,
      winner: winner
    });
    
  } catch (error) {
    console.error('[Server] Error processing enemy turn:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process enemy turn' });
  }
});

router.get('/api/user-data', async (_req, res): Promise<void> => {
  const { postId } = context;
  
  if (!postId) {
    res.status(400).json({
      status: 'error',
      message: 'postId is required',
    });
    return;
  }

  try {
    const [username, currentUser] = await Promise.all([
      reddit.getCurrentUsername(),
      reddit.getCurrentUser()
    ]);
    
    const scoreKey = `score:${postId}:${username}`;
    const highScoreKey = `highscore:${postId}:${username}`;
    
    const [currentScore, highScore] = await Promise.all([
      redis.get(scoreKey),
      redis.get(highScoreKey)
    ]);
    
    // Try to get the best avatar URL from multiple sources
    let avatarUrl = DEFAULT_AVATAR_URL;
    let debugInfo = {};
    
    // Try the Discord-suggested method for getting Snoovatar
    let snoovatarUrl = null;
    if (currentUser) {
      try {
        console.log('[Server] Trying getSnoovatarUrl() method...');
        const userAny = currentUser as any;
        
        // Try the Discord suggestion
        if (typeof userAny.getSnoovatarUrl === 'function') {
          snoovatarUrl = await userAny.getSnoovatarUrl();
          console.log('[Server] getSnoovatarUrl() result:', snoovatarUrl);
        } else {
          console.log('[Server] getSnoovatarUrl() method not available');
        }
      } catch (error) {
        console.error('[Server] Error calling getSnoovatarUrl():', error);
      }
      
      console.log('[Server] Current user object:', JSON.stringify(currentUser, null, 2));
      
      // Access user properties safely using bracket notation to avoid TypeScript errors
      const userAny = currentUser as any;
      
      debugInfo = {
        userProperties: Object.keys(currentUser),
        snoovatarUrl: snoovatarUrl,
        hasGetSnoovatarUrl: typeof userAny.getSnoovatarUrl === 'function',
        snoovatar_img: userAny.snoovatar_img,
        snoo_img: userAny.snoo_img,
        avatar_img: userAny.avatar_img,
        avatarUrl: userAny.avatarUrl,
        icon_img: userAny.icon_img,
        icon: userAny.icon,
        snoovatar_full_body: userAny.snoovatar_full_body,
        snoovatar_outfit_img: userAny.snoovatar_outfit_img,
        profile_img: userAny.profile_img,
        subreddit: userAny.subreddit
      };
      
      // Prioritize the Discord-suggested method, then try other sources
      avatarUrl = snoovatarUrl ||
                 userAny.snoovatar_full_body ||
                 userAny.snoovatar_outfit_img ||
                 userAny.snoovatar_img || 
                 userAny.snoo_img ||
                 userAny.profile_img ||
                 userAny.avatar_img ||
                 userAny.avatarUrl ||
                 userAny.icon_img ||
                 userAny.icon ||
                 avatarUrl;
                 
      console.log('[Server] Selected avatar URL:', avatarUrl);
      console.log('[Server] Debug info:', debugInfo);
    }
    
    // Also get player character data
    const playerCharacter = username ? await getOrCreatePlayer(username) : null;
    
    // Update player character with fresh avatar URL
    if (playerCharacter && avatarUrl) {
      playerCharacter.avatarUrl = avatarUrl;
      console.log('[Server] Updated player character avatar URL to:', avatarUrl);
    }
    
    res.json({
      status: 'success',
      username: username ?? 'anonymous',
      currentScore: currentScore ? parseInt(currentScore) : 0,
      highScore: highScore ? parseInt(highScore) : 0,
      avatarUrl: avatarUrl,
      playerCharacter: playerCharacter,
      debug: debugInfo
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user data'
    });
  }
});

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Duplicate endpoint removed - using newer version above

// Shop System Data
const SHOP_ITEMS = [
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy blade that increases attack power',
    cost: 100,
    stats: { attack: 2 },
    icon: '⚔️'
  },
  {
    id: 'steel_shield',
    name: 'Steel Shield',
    description: 'Protective gear that boosts defense',
    cost: 150,
    stats: { defense: 3 },
    icon: '🛡️'
  },
  {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'Permanently increases maximum health',
    cost: 200,
    stats: { maxHitPoints: 20 },
    icon: '🧪'
  },
  {
    id: 'power_ring',
    name: 'Power Ring',
    description: 'Magical ring that enhances combat abilities',
    cost: 250,
    stats: { attack: 1, defense: 1 },
    icon: '💍'
  },
  {
    id: 'champion_armor',
    name: "Champion's Armor",
    description: 'Elite armor for seasoned warriors',
    cost: 400,
    stats: { defense: 5, maxHitPoints: 10 },
    icon: '🛡️'
  }
];

// Shop API Endpoints
router.get('/api/shop', async (_req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }

    const player = await getOrCreatePlayer(username);
    
    // Get player's purchased items
    const purchasedItems = player.purchasedItems || [];
    
    // Add purchase status to shop items
    const shopItemsWithStatus = SHOP_ITEMS.map(item => ({
      ...item,
      purchased: purchasedItems.includes(item.id),
      canAfford: player.stats.gold >= item.cost
    }));

    res.json({
      status: 'success',
      shopItems: shopItemsWithStatus,
      playerGold: player.stats.gold,
      playerStats: {
        attack: player.stats.attack,
        defense: player.stats.defense,
        maxHitPoints: player.stats.maxHitPoints,
        level: player.stats.level
      }
    });
  } catch (error) {
    console.error('[Shop] Error getting shop data:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get shop data' });
  }
});

router.post('/api/shop/purchase', async (req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }

    const { itemId } = req.body;
    if (!itemId) {
      res.status(400).json({ status: 'error', message: 'Item ID required' });
      return;
    }

    const player = await getOrCreatePlayer(username);
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    
    if (!item) {
      res.status(404).json({ status: 'error', message: 'Item not found' });
      return;
    }

    // Check if already purchased
    const purchasedItems = player.purchasedItems || [];
    if (purchasedItems.includes(itemId)) {
      res.status(400).json({ status: 'error', message: 'Item already purchased' });
      return;
    }

    // Check if player can afford it
    if (player.stats.gold < item.cost) {
      res.status(400).json({ status: 'error', message: 'Not enough gold' });
      return;
    }

    // Process purchase
    player.stats.gold -= item.cost;
    player.purchasedItems = [...purchasedItems, itemId];

    // Apply stat bonuses
    Object.entries(item.stats).forEach(([stat, bonus]) => {
      if (player.stats[stat] !== undefined) {
        player.stats[stat] += bonus;
        
        // If maxHitPoints increased, also increase current hitPoints
        if (stat === 'maxHitPoints') {
          player.stats.hitPoints += bonus;
        }
      }
    });

    // Save updated player data
    await redis.set(`player:${username}`, JSON.stringify(player));

    console.log(`[Shop] ${username} purchased ${item.name} for ${item.cost} gold`);

    res.json({
      status: 'success',
      message: `Purchased ${item.name}!`,
      item: item,
      newGold: player.stats.gold,
      newStats: {
        attack: player.stats.attack,
        defense: player.stats.defense,
        maxHitPoints: player.stats.maxHitPoints,
        hitPoints: player.stats.hitPoints
      }
    });
  } catch (error) {
    console.error('[Shop] Error purchasing item:', error);
    res.status(500).json({ status: 'error', message: 'Failed to purchase item' });
  }
});

// Test/Demo endpoints for leaderboard population (ADMIN ONLY)
router.post('/api/admin/create-test-entries', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors']; // Add more admin usernames here if needed
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] CREATE TEST ENTRIES DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin privileges required' 
      });
      return;
    }
    
    console.log(`[Admin] Creating test leaderboard entries for authorized user ${currentUsername}...`);
    
    // First, let's check if we can access Redis at all
    try {
      const testKey = 'test_redis_connection';
      await redis.set(testKey, 'test_value');
      const testValue = await redis.get(testKey);
      console.log(`[Admin] Redis connection test: ${testValue}`);
      await redis.del(testKey);
    } catch (redisError) {
      console.error('[Admin] Redis connection test failed:', redisError);
      throw new Error('Redis connection failed');
    }
    
    // Create test bots based on real curated enemies for authentic avatars
    const testEntries = [
      {
        username: 'spez_bot',
        realUser: 'spez',
        level: 15,
        battlesWon: 42,
        score: 8500
      },
      {
        username: 'kn0thing_bot', 
        realUser: 'kn0thing',
        level: 12,
        battlesWon: 28,
        score: 6200
      },
      {
        username: 'PRguitarman_bot',
        realUser: 'PRguitarman',
        level: 20,
        battlesWon: 67,
        score: 12000,
        fallbackAvatar: 'https://www.reddit.com/user/PRguitarman/avatar' // Fallback for the nyancat avatar
      },
      {
        username: 'pl00h_bot',
        realUser: 'pl00h',
        level: 8,
        battlesWon: 15,
        score: 2400
      },
      {
        username: 'lift_ticket_bot',
        realUser: 'lift_ticket',
        level: 18,
        battlesWon: 55,
        score: 9800
      },
      {
        username: 'artofbrentos_bot',
        realUser: 'artofbrentos',
        level: 14,
        battlesWon: 38,
        score: 7200
      },
      {
        username: 'shittymorph_bot',
        realUser: 'shittymorph',
        level: 22,
        battlesWon: 89,
        score: 15600
      }
    ];
    
    for (const entry of testEntries) {
      // Get the real user's avatar for authentic look
      console.log(`[Admin] Fetching avatar for ${entry.realUser}...`);
      let realAvatarUrl = await getUserSnoovatar(entry.realUser);
      console.log(`[Admin] Fetched avatar for ${entry.realUser}: ${realAvatarUrl}`);
      
      // Check if avatar URL looks valid, use fallback if available
      if ((!realAvatarUrl || realAvatarUrl === DEFAULT_AVATAR_URL) && entry.fallbackAvatar) {
        console.log(`[Admin] Using fallback avatar for ${entry.realUser}: ${entry.fallbackAvatar}`);
        realAvatarUrl = entry.fallbackAvatar;
      } else if (!realAvatarUrl || realAvatarUrl === DEFAULT_AVATAR_URL) {
        console.log(`[Admin] WARNING: ${entry.realUser} returned default/invalid avatar, using default`);
        realAvatarUrl = DEFAULT_AVATAR_URL;
      }
      
      // Create player data
      const playerData = {
        username: entry.username,
        avatarUrl: realAvatarUrl,
        stats: {
          level: entry.level,
          experience: entry.level * 100,
          experienceToNext: (entry.level + 1) * 100,
          hitPoints: 100 + (entry.level * 20),
          maxHitPoints: 100 + (entry.level * 20),
          specialPoints: 20 + (entry.level * 5),
          maxSpecialPoints: 20 + (entry.level * 5),
          attack: 10 + (entry.level * 2),
          defense: 5 + entry.level,
          skillPoints: 0,
          gold: entry.level * 50
        },
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString()
      };
      
      // Store player data
      try {
        await redis.set(`player:${entry.username}`, JSON.stringify(playerData));
        console.log(`[Admin] ✓ Stored player data for ${entry.username}`);
      } catch (error) {
        console.error(`[Admin] ✗ Failed to store player data for ${entry.username}:`, error);
        throw error;
      }
      
      // Add to leaderboard
      try {
        await redis.hSet('global_leaderboard', { [entry.username]: entry.score.toString() });
        console.log(`[Admin] ✓ Added ${entry.username} to leaderboard with score ${entry.score}`);
      } catch (error) {
        console.error(`[Admin] ✗ Failed to add ${entry.username} to leaderboard:`, error);
        throw error;
      }
      
      // Set battles won
      try {
        await redis.set(`battles_won:${entry.username}`, entry.battlesWon.toString());
        console.log(`[Admin] ✓ Set battles won for ${entry.username}: ${entry.battlesWon}`);
      } catch (error) {
        console.error(`[Admin] ✗ Failed to set battles won for ${entry.username}:`, error);
        throw error;
      }
      
      console.log(`[Admin] ✓ Created test entry: ${entry.username} (Level ${entry.level}, ${entry.battlesWon} battles won)`);
    }
    
    // Verify the entries were created
    console.log('[Admin] Verifying test entries were created...');
    const leaderboardHash = await redis.hGetAll('global_leaderboard');
    console.log(`[Admin] Leaderboard hash now contains ${Object.keys(leaderboardHash).length} entries:`, Object.keys(leaderboardHash));
    
    res.json({
      status: 'success',
      message: `Created ${testEntries.length} test leaderboard entries`,
      entries: testEntries.map(e => ({ username: e.username, level: e.level, battlesWon: e.battlesWon })),
      verification: {
        leaderboardHashSize: Object.keys(leaderboardHash).length,
        leaderboardEntries: Object.keys(leaderboardHash)
      }
    });
    
  } catch (error) {
    console.error('[Admin] Error creating test entries:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create test entries' });
  }
});

router.delete('/api/admin/remove-test-entries', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors']; // Add more admin usernames here if needed
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] REMOVE TEST ENTRIES DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin privileges required' 
      });
      return;
    }
    
    console.log(`[Admin] Removing test leaderboard entries for authorized user ${currentUsername}...`);
    
    const testUsernames = [
      'spez_bot',
      'kn0thing_bot',
      'PRguitarman_bot',
      'pl00h_bot',
      'lift_ticket_bot',
      'artofbrentos_bot',
      'shittymorph_bot'
    ];
    
    for (const username of testUsernames) {
      // Remove player data
      await redis.del(`player:${username}`);
      
      // Remove from leaderboard
      await redis.hDel('global_leaderboard', [username]);
      
      // Remove battles won
      await redis.del(`battles_won:${username}`);
      
      console.log(`[Admin] Removed test entry: ${username}`);
    }
    
    // Also clean up the corrupted character entries (0-17 from "battle_veteran_bot")
    console.log('[Admin] Cleaning up corrupted character entries...');
    for (let i = 0; i < 20; i++) {
      try {
        await redis.hDel('global_leaderboard', [i.toString()]);
      } catch (error) {
        // Ignore errors for non-existent keys
      }
    }
    
    res.json({
      status: 'success',
      message: `Removed ${testUsernames.length} test leaderboard entries`,
      removed: testUsernames
    });
    
  } catch (error) {
    console.error('[Admin] Error removing test entries:', error);
    res.status(500).json({ status: 'error', message: 'Failed to remove test entries' });
  }
});

// One-time nuclear cleanup endpoint to fix corrupted leaderboard (ADMIN ONLY)
router.delete('/api/admin/nuclear-cleanup-leaderboard', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors']; // Add more admin usernames here if needed
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] NUCLEAR CLEANUP DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin privileges required' 
      });
      return;
    }
    
    console.log(`[Admin] NUCLEAR CLEANUP: Authorized user ${currentUsername} wiping entire leaderboard hash...`);
    
    // Get current leaderboard to see what we're deleting
    const currentHash = await redis.hGetAll('global_leaderboard');
    console.log(`[Admin] Current leaderboard has ${Object.keys(currentHash).length} entries:`, Object.keys(currentHash));
    
    // Delete the entire leaderboard hash
    await redis.del('global_leaderboard');
    console.log('[Admin] ✓ Deleted entire global_leaderboard hash');
    
    // Verify it's gone
    const afterHash = await redis.hGetAll('global_leaderboard');
    console.log(`[Admin] After cleanup, leaderboard has ${Object.keys(afterHash).length} entries`);
    
    res.json({
      status: 'success',
      message: `Nuclear cleanup complete - entire leaderboard wiped by ${currentUsername}`,
      deletedEntries: Object.keys(currentHash),
      deletedCount: Object.keys(currentHash).length,
      authorizedBy: currentUsername
    });
    
  } catch (error) {
    console.error('[Admin] Error during nuclear cleanup:', error);
    res.status(500).json({ status: 'error', message: 'Nuclear cleanup failed' });
  }
});

// Debug endpoint to check Redis data
router.get('/api/admin/debug-leaderboard', async (_req, res): Promise<void> => {
  try {
    console.log('[Debug] Checking leaderboard data...');
    
    // Get leaderboard hash
    const leaderboardHash = await redis.hGetAll('global_leaderboard');
    console.log('[Debug] Leaderboard hash:', leaderboardHash);
    
    // Check each entry
    const debugData = [];
    for (const [username, score] of Object.entries(leaderboardHash)) {
      const playerData = await redis.get(`player:${username}`);
      const battlesWon = await redis.get(`battles_won:${username}`);
      
      debugData.push({
        username,
        score,
        hasPlayerData: !!playerData,
        playerDataPreview: playerData ? JSON.parse(playerData).stats : null,
        battlesWon
      });
    }
    
    res.json({
      status: 'success',
      leaderboardHashSize: Object.keys(leaderboardHash).length,
      entries: debugData
    });
    
  } catch (error) {
    console.error('[Debug] Error checking leaderboard:', error);
    res.status(500).json({ status: 'error', message: 'Debug failed' });
  }
});

// Admin endpoint to reset specific user's stats
router.post('/api/admin/reset-user-stats', async (req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors']; // Add more admin usernames here if needed
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] RESET USER STATS DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin only' 
      });
      return;
    }
    
    const { targetUsername } = req.body;
    if (!targetUsername) {
      res.status(400).json({ status: 'error', message: 'Target username required' });
      return;
    }
    
    console.log(`[Admin] ${currentUsername} resetting stats for user: ${targetUsername}`);
    
    // Get current player data to preserve avatar
    const playerKey = `player:${targetUsername}`;
    const existingPlayerStr = await redis.get(playerKey);
    let avatarUrl = DEFAULT_AVATAR_URL;
    
    if (existingPlayerStr) {
      const existingPlayer = JSON.parse(existingPlayerStr);
      avatarUrl = existingPlayer.avatarUrl || DEFAULT_AVATAR_URL;
    }
    
    // Create fresh player with default stats
    const resetPlayer = createNewPlayer(targetUsername, avatarUrl);
    
    // Save reset player
    await redis.set(playerKey, JSON.stringify(resetPlayer));
    
    // Keep battles won counter (don't reset it)
    // const battlesWonKey = `battles_won:${targetUsername}`;
    // await redis.set(battlesWonKey, '0'); // Commented out to preserve battle history
    
    // Reset high score
    const scoreKey = `score:${targetUsername}`;
    await redis.set(scoreKey, '0');
    
    // Update leaderboard with reset stats (recalculate score based on new level)
    const newScore = resetPlayer.stats.level * 100; // Level 1 = score 100
    await redis.hSet('global_leaderboard', { [targetUsername]: newScore.toString() });
    console.log(`[Admin] Updated leaderboard score for ${targetUsername}: ${newScore}`);
    
    console.log(`[Admin] Successfully reset stats for ${targetUsername}`);
    
    res.json({
      status: 'success',
      message: `Successfully reset stats for ${targetUsername}`,
      resetPlayer: {
        username: resetPlayer.username,
        level: resetPlayer.stats.level,
        experience: resetPlayer.stats.experience,
        gold: resetPlayer.stats.gold
      }
    });
    
  } catch (error) {
    console.error('[Admin] Error resetting user stats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reset user stats' });
  }
});

// Admin endpoint to list all players
router.get('/api/admin/list-players', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors'];
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] LIST PLAYERS DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin only' 
      });
      return;
    }
    
    console.log(`[Admin] ${currentUsername} requesting player list`);
    
    // Get all players from leaderboard
    const leaderboardHash = await redis.hGetAll('global_leaderboard');
    const players = [];
    
    for (const [username, scoreStr] of Object.entries(leaderboardHash)) {
      const playerKey = `player:${username}`;
      const playerDataStr = await redis.get(playerKey);
      
      if (playerDataStr) {
        const playerData = JSON.parse(playerDataStr);
        const battlesWonKey = `battles_won:${username}`;
        const battlesWon = await redis.get(battlesWonKey);
        
        players.push({
          username: playerData.username || username,
          level: playerData.stats?.level || 1,
          experience: playerData.stats?.experience || 0,
          battlesWon: battlesWon ? parseInt(battlesWon) : 0,
          gold: playerData.stats?.gold || 0,
          score: parseInt(scoreStr) || 0,
          lastPlayed: playerData.lastPlayed
        });
      }
    }
    
    // Sort by level descending
    players.sort((a, b) => b.level - a.level);
    
    res.json({
      status: 'success',
      totalPlayers: players.length,
      players: players
    });
    
  } catch (error) {
    console.error('[Admin] Error listing players:', error);
    res.status(500).json({ status: 'error', message: 'Failed to list players' });
  }
});

// Admin endpoint to rebuild leaderboard from current player data
router.post('/api/admin/rebuild-leaderboard', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors']; // Must match client-side check
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] REBUILD LEADERBOARD DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied. Admin privileges required.' 
      });
      return;
    }
    
    console.log(`[Admin] ${currentUsername} rebuilding leaderboard from player data`);
    
    // Get all player keys (this is a simplified approach)
    const leaderboardHash = await redis.hGetAll('global_leaderboard');
    const rebuiltEntries = [];
    
    for (const username of Object.keys(leaderboardHash)) {
      try {
        const playerKey = `player:${username}`;
        const playerDataStr = await redis.get(playerKey);
        
        if (playerDataStr) {
          const playerData = JSON.parse(playerDataStr);
          const newScore = (playerData.stats?.level || 1) * 100;
          
          // Update the leaderboard hash with recalculated score
          await redis.hSet('global_leaderboard', { [username]: newScore.toString() });
          
          rebuiltEntries.push({
            username,
            level: playerData.stats?.level || 1,
            newScore
          });
          
          console.log(`[Admin] Rebuilt ${username}: Level ${playerData.stats?.level || 1} = Score ${newScore}`);
        }
      } catch (error) {
        console.error(`[Admin] Error rebuilding entry for ${username}:`, error);
      }
    }
    
    console.log(`[Admin] Rebuilt ${rebuiltEntries.length} leaderboard entries`);
    
    res.json({
      status: 'success',
      message: `Successfully rebuilt leaderboard with ${rebuiltEntries.length} entries`,
      rebuiltEntries
    });
    
  } catch (error) {
    console.error('[Admin] Error rebuilding leaderboard:', error);
    res.status(500).json({ status: 'error', message: 'Failed to rebuild leaderboard' });
  }
});

// Admin endpoint to delete specific user (like LIFT_TICKET_BOT duplicate)
router.delete('/api/admin/delete-specific-user', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors']; // Add more admin usernames here if needed
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] DELETE SPECIFIC USER DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin privileges required' 
      });
      return;
    }
    
    console.log(`[Admin] Deleting specific user for authorized user ${currentUsername}...`);
    
    const targetUsername = 'LIFT_TICKET_BOT'; // The uppercase duplicate to remove
    
    try {
      // Remove player data
      console.log(`[Admin] Deleting player data: player:${targetUsername}`);
      await redis.del(`player:${targetUsername}`);
      
      // Remove from leaderboard
      console.log(`[Admin] Removing from leaderboard: ${targetUsername}`);
      await redis.hDel('global_leaderboard', [targetUsername]);
      
      // Remove battles won
      console.log(`[Admin] Deleting battles won: battles_won:${targetUsername}`);
      await redis.del(`battles_won:${targetUsername}`);
      
      // Remove score
      console.log(`[Admin] Deleting score: score:${targetUsername}`);
      await redis.del(`score:${targetUsername}`);
      
      console.log(`[Admin] Successfully deleted: ${targetUsername}`);
    } catch (redisError) {
      console.error(`[Admin] Redis error during deletion:`, redisError);
      throw redisError;
    }
    
    res.json({
      status: 'success',
      message: `Successfully deleted ${targetUsername}`,
      deletedUser: targetUsername,
      remainingUser: 'lift_ticket_bot (lowercase version preserved)'
    });
    
  } catch (error) {
    console.error('[Admin] Error deleting specific user:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to delete specific user' 
    });
  }
});

// Admin endpoint to cleanup exploiters (reset high-level players)
router.post('/api/admin/cleanup-exploiters', async (_req, res): Promise<void> => {
  try {
    // SAFETY CHECK: Only allow specific admin users
    const currentUsername = await reddit.getCurrentUsername();
    const allowedAdmins = ['dreamingcolors'];
    
    if (!currentUsername || !allowedAdmins.includes(currentUsername)) {
      console.log(`[Admin] CLEANUP EXPLOITERS DENIED: User ${currentUsername} is not authorized`);
      res.status(403).json({ 
        status: 'error', 
        message: 'Access denied - admin only' 
      });
      return;
    }
    
    console.log(`[Admin] ${currentUsername} cleaning up exploiters (level > 50)`);
    
    // Get all players from leaderboard
    const leaderboardHash = await redis.hGetAll('global_leaderboard');
    const resetPlayers = [];
    
    for (const [username, scoreStr] of Object.entries(leaderboardHash)) {
      const playerKey = `player:${username}`;
      const playerDataStr = await redis.get(playerKey);
      
      if (playerDataStr) {
        const playerData = JSON.parse(playerDataStr);
        const level = playerData.stats?.level || 1;
        
        // Reset players with suspiciously high levels
        if (level > 50) {
          console.log(`[Admin] Resetting exploiter: ${username} (Level ${level})`);
          
          // Create fresh player with default stats
          const avatarUrl = playerData.avatarUrl || DEFAULT_AVATAR_URL;
          const resetPlayer = createNewPlayer(username, avatarUrl);
          
          // Save reset player
          await redis.set(playerKey, JSON.stringify(resetPlayer));
          
          // Keep battles won counter (don't reset it)
          // const battlesWonKey = `battles_won:${username}`;
          // await redis.set(battlesWonKey, '0'); // Commented out to preserve battle history
          
          // Reset high score
          const scoreKey = `score:${username}`;
          await redis.set(scoreKey, '0');
          
          // Update leaderboard with reset stats
          await redis.hSet('global_leaderboard', { [username]: '0' });
          
          resetPlayers.push({
            username,
            oldLevel: level,
            newLevel: 1
          });
        }
      }
    }
    
    console.log(`[Admin] Reset ${resetPlayers.length} exploiters`);
    
    res.json({
      status: 'success',
      message: `Reset ${resetPlayers.length} players with level > 50`,
      resetPlayers: resetPlayers
    });
    
  } catch (error) {
    console.error('[Admin] Error cleaning up exploiters:', error);
    res.status(500).json({ status: 'error', message: 'Failed to cleanup exploiters' });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
