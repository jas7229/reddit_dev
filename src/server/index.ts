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
      // Try to get all player keys
      console.log('[Leaderboard] Attempting to get all player keys...');
      const playerKeys = await redis.keys('player:*');
      console.log(`[Leaderboard] Found ${playerKeys.length} player keys:`, playerKeys);
      
      // Process each player
      for (const playerKey of playerKeys) {
        try {
          const playerDataStr = await redis.get(playerKey);
          if (playerDataStr) {
            const playerData = JSON.parse(playerDataStr);
            const username = playerKey.replace('player:', '');
            
            // Get additional data
            const scoreKey = `score:${username}`;
            const battlesWonKey = `battles_won:${username}`;
            
            const [highScore, battlesWon] = await Promise.all([
              redis.get(scoreKey),
              redis.get(battlesWonKey)
            ]);
            
            leaderboardEntries.push({
              username: playerData.username || username,
              score: highScore ? parseInt(highScore) : 0,
              level: playerData.stats?.level || 1,
              avatarUrl: playerData.avatarUrl || DEFAULT_AVATAR_URL,
              battlesWon: battlesWon ? parseInt(battlesWon) : 0,
              lastPlayed: playerData.lastPlayed || playerData.createdAt
            });
          }
        } catch (playerError) {
          console.error(`[Leaderboard] Error processing player ${playerKey}:`, playerError);
        }
      }
    } catch (keysError) {
      console.error('[Leaderboard] Error getting player keys, falling back to current player only:', keysError);
      
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
            battlesWon: battlesWon ? parseInt(battlesWon) : 0,
            lastPlayed: playerData.lastPlayed || playerData.createdAt
          });
        }
      }
    }
    
    // Sort by level first, then by battles won, then by score
    leaderboardEntries.sort((a, b) => {
      if (a.level !== b.level) return b.level - a.level;
      if (a.battlesWon !== b.battlesWon) return b.battlesWon - a.battlesWon;
      return b.score - a.score;
    });
    
    // Find current player's rank
    let playerRank = -1;
    if (currentUsername) {
      const playerIndex = leaderboardEntries.findIndex(entry => entry.username === currentUsername);
      playerRank = playerIndex >= 0 ? playerIndex + 1 : -1;
    }
    
    // Return top 20 players
    const topPlayers = leaderboardEntries.slice(0, 20);
    
    console.log(`[Leaderboard] Returning ${topPlayers.length} players, current player rank: ${playerRank}`);
    
    res.json({
      status: 'success',
      leaderboard: topPlayers,
      playerRank: playerRank,
      totalPlayers: leaderboardEntries.length
    });
    
  } catch (error) {
    console.error('[Leaderboard] Error getting leaderboard:', error);
    console.error('[Leaderboard] Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: `Failed to get leaderboard: ${error.message}`
    });
  }
});

// Helper function to update leaderboard when player stats change
async function updatePlayerLeaderboard(username: string, battlesWon?: number): Promise<void> {
  try {
    // Update battles won counter if provided
    if (battlesWon !== undefined) {
      const battlesWonKey = `battles_won:${username}`;
      await redis.set(battlesWonKey, battlesWon.toString());
      console.log(`[Leaderboard] Updated battles won for ${username}: ${battlesWon}`);
    }
    
    // The leaderboard endpoint will automatically pull fresh data from player records
    // so we don't need to maintain a separate leaderboard cache
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

// Helper function to get user's Snoovatar
async function getUserSnoovatar(username?: string): Promise<string> {
  try {
    const user = username ? await reddit.getUserByUsername(username) : await reddit.getCurrentUser();
    if (user) {
      const userAny = user as any;
      if (typeof userAny.getSnoovatarUrl === 'function') {
        const snoovatarUrl = await userAny.getSnoovatarUrl();
        if (snoovatarUrl) return snoovatarUrl;
      }
    }
  } catch (error) {
    console.error(`[Server] Error getting Snoovatar for ${username}:`, error);
  }
  return DEFAULT_AVATAR_URL;
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
      gold: 0
    },
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
      baseDamage = attacker.stats.attack;
      break;
    case 'special':
      baseDamage = Math.floor(attacker.stats.attack * 1.5); // 50% more damage
      break;
    case 'defend':
      return 0; // Defending does no damage
    default:
      baseDamage = attacker.stats.attack;
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
  
  const battleState = {
    battleId,
    player: { ...player },
    enemy: { ...enemy },
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
  let playerMessage = '';
  
  console.log(`[Battle] === PLAYER TURN START ===`);
  console.log(`[Battle] Player turn: ${playerAction}`);
  console.log(`[Battle] Player HP before: ${battle.player.stats.hitPoints}/${battle.player.stats.maxHitPoints}`);
  console.log(`[Battle] Enemy HP before: ${battle.enemy.stats.hitPoints}/${battle.enemy.stats.maxHitPoints}`);
  
  if (playerAction === 'heal') {
    playerHealing = Math.floor(battle.player.stats.maxHitPoints * 0.3); // Heal 30%
    battle.player.stats.hitPoints = Math.min(
      battle.player.stats.maxHitPoints, 
      battle.player.stats.hitPoints + playerHealing
    );
    playerMessage = `${battle.player.username} healed for ${playerHealing} HP!`;
  } else if (playerAction === 'defend') {
    playerMessage = `${battle.player.username} is defending!`;
  } else {
    playerDamage = calculateDamage(battle.player, battle.enemy, playerAction);
    console.log(`[Battle] Player damage calculated: ${playerDamage}`);
    
    const enemyHpBefore = battle.enemy.stats.hitPoints;
    battle.enemy.stats.hitPoints = Math.max(0, battle.enemy.stats.hitPoints - playerDamage);
    console.log(`[Battle] Enemy HP: ${enemyHpBefore} -> ${battle.enemy.stats.hitPoints} (damage: ${playerDamage})`);
    
    if (playerAction === 'special') {
      battle.player.stats.specialPoints = Math.max(0, battle.player.stats.specialPoints - 10);
      playerMessage = `${battle.player.username} used special attack for ${playerDamage} damage!`;
    } else {
      playerMessage = `${battle.player.username} attacked for ${playerDamage} damage!`;
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
    const playerUsername = battle.player.username;
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
    const playerUsername = battle.player.username;
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

    console.log(`[Server] Resetting player stats for: ${username}`);
    
    // Get current player to preserve username and avatar
    const playerKey = `player:${username}`;
    const existingPlayerStr = await redis.get(playerKey);
    let avatarUrl = DEFAULT_AVATAR_URL;
    
    if (existingPlayerStr) {
      const existingPlayer = JSON.parse(existingPlayerStr);
      console.log(`[Server] Current player before reset:`, existingPlayer.stats);
      avatarUrl = existingPlayer.avatarUrl || DEFAULT_AVATAR_URL;
    }
    
    // Create fresh player with default stats
    const resetPlayer = createNewPlayer(username, avatarUrl);
    console.log(`[Server] New reset player stats:`, resetPlayer.stats);
    
    // Save reset player
    await redis.set(playerKey, JSON.stringify(resetPlayer));
    
    // Reset battles won counter
    const battlesWonKey = `battles_won:${username}`;
    await redis.set(battlesWonKey, '0');
    
    // Reset high score
    const scoreKey = `score:${username}`;
    await redis.set(scoreKey, '0');
    
    // Verify the reset worked
    const verifyPlayerStr = await redis.get(playerKey);
    if (verifyPlayerStr) {
      const verifyPlayer = JSON.parse(verifyPlayerStr);
      console.log(`[Server] Verified reset player stats:`, verifyPlayer.stats);
    }
    
    console.log(`[Server] Player ${username} stats reset to defaults`);
    
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
    let isRealPlayer = false;
    
    // 60% chance to fight a real player from leaderboard, 40% chance for famous accounts
    if (Math.random() < 0.6) {
      try {
        // Get real players from the database
        const playerKeys = await redis.keys('player:*');
        const realPlayers = [];
        
        for (const playerKey of playerKeys) {
          const playerDataStr = await redis.get(playerKey);
          if (playerDataStr) {
            const playerData = JSON.parse(playerDataStr);
            const username = playerKey.replace('player:', '');
            
            // Don't fight yourself
            if (username !== currentUsername) {
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
          
          randomEnemy = selectedPlayer.username;
          isRealPlayer = true;
          console.log(`[Enemy] Selected real player: ${randomEnemy} (Level ${selectedPlayer.level})`);
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
        hitPoints: 40 + (enemyLevel * 8), // Much weaker: 40 + 8*level
        maxHitPoints: 40 + (enemyLevel * 8),
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
    let isRealPlayer = false;
    
    // 60% chance for real player, 40% for famous accounts
    if (Math.random() < 0.6) {
      try {
        const playerKeys = await redis.keys('player:*');
        const realPlayers = [];
        
        for (const playerKey of playerKeys) {
          const playerDataStr = await redis.get(playerKey);
          if (playerDataStr) {
            const playerData = JSON.parse(playerDataStr);
            const username = playerKey.replace('player:', '');
            
            if (username !== currentUsername) {
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
            randomEnemy = selectedPlayer.username;
            isRealPlayer = true;
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
        enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 2 + 1)); // 1-2 levels below
        break;
      case 'medium':
        enemyLevel = playerLevel + Math.floor(Math.random() * 3 - 1); // -1 to +1 levels
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
        hitPoints: 80 + (enemyLevel * 10), // Slightly weaker than player
        maxHitPoints: 80 + (enemyLevel * 10),
        specialPoints: 15 + Math.floor(enemyLevel * 1.5),
        maxSpecialPoints: 15 + Math.floor(enemyLevel * 1.5),
        attack: 8 + Math.floor(enemyLevel * 1.2),
        defense: 3 + Math.floor(enemyLevel * 0.8),
        skillPoints: 0,
        gold: 0
      },
      isNPC: !isRealPlayer
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

// Battle System API Endpoints
router.post('/api/battle/start', async (_req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }
    
    const player = await getOrCreatePlayer(username);
    
    // Generate enemy using same logic as /api/enemy endpoint
    let randomEnemy;
    
    // 60% chance to fight a real player, 40% chance for famous accounts
    if (Math.random() < 0.6) {
      try {
        const playerKeys = await redis.keys('player:*');
        const realPlayers = [];
        
        for (const playerKey of playerKeys) {
          const playerDataStr = await redis.get(playerKey);
          if (playerDataStr) {
            const playerData = JSON.parse(playerDataStr);
            const enemyUsername = playerKey.replace('player:', '');
            
            if (enemyUsername !== username) {
              realPlayers.push({
                username: playerData.username || enemyUsername,
                level: playerData.stats?.level || 1
              });
            }
          }
        }
        
        if (realPlayers.length > 0) {
          realPlayers.sort((a, b) => Math.abs(a.level - player.stats.level) - Math.abs(b.level - player.stats.level));
          const candidatePlayers = realPlayers.slice(0, Math.min(5, realPlayers.length));
          const selectedPlayer = candidatePlayers[Math.floor(Math.random() * candidatePlayers.length)];
          randomEnemy = selectedPlayer.username;
        }
      } catch (error) {
        console.error('[Battle] Error getting real players for battle:', error);
      }
    }
    
    // Fallback to famous accounts (only those with custom avatars)
    if (!randomEnemy) {
      const famousEnemies = [
        'spez', 'kn0thing', 'pl00h', 'lift_ticket', 'penguitt', 'PRguitarman',
        'artofbrentos', 'salt_the_wizard', 'StutterVoid', 'iamdeirdre', 'Hoppy_Doodle',
        'Tandizojere', 'kinnester', 'artofmajon', 'tinymischiefs', 'kristyglas',
        'WorstTwitchEver', 'Qugmo', 'sabet76', 'Conall-in-Space', 'TheFattyBagz',
        'giftedocean', 'NatAltDesign', '_ships', 'OniCowboy', 'tfoust10',
        'mantrakid', 'sixthrodeo', 'PotatoNahh', 'aerynlynne', 'AkuDreams', 'ImAlekBan',
        'AliciaFreemanDesigns', 'OhBenny', 'anaeho', 'ChristineMendoza', 'Substantial-Law-910',
        'AVIRENFT', 'NateBearArt', 'bodegacatceo', 'Bumblebon', 'BunnyPrecious',
        'Canetoonist', 'ChipperdoodlesComic', 'Civort', 'Cool_Cats_NFT',
        'entropyre', 'Potstar1', 'Frayz', 'The_GeoffreyK', 'GlowyMushroom', 'GwynnArts',
        'slugfive', 'Jenniichii', 'hessicajansen', 'Josh_Brandon', 'karonuke', 'killjoyink',
        'Koyangi2018', 'anondoodles', 'NaoTajigen', 'Pollila1', 'OpenFren', 'Oue',
        'phobox91', 'razbonix', 'rocketMoonApe', 'RyeHardyDesigns', 'rylar', 'Saiyre-Art_Official',
        'Shadowjom', 'darth-weedy', 'Wurlawyrm',
        'shittymorph', 'KeyserSosa', 'powerlanguage', 'bsimpson'
      ];
      randomEnemy = famousEnemies[Math.floor(Math.random() * famousEnemies.length)];
    }
    const enemyAvatarUrl = await getUserSnoovatar(randomEnemy);
    
    const playerLevel = player.stats.level;
    const enemyLevel = Math.max(1, playerLevel - Math.floor(Math.random() * 3) - 1); // Enemy is 1-3 levels lower
    
    const enemy = {
      username: randomEnemy,
      avatarUrl: enemyAvatarUrl,
      stats: {
        level: enemyLevel,
        experience: 0,
        experienceToNext: 0,
        hitPoints: 40 + (enemyLevel * 8), // Much weaker: 40 + 8*level
        maxHitPoints: 40 + (enemyLevel * 8),
        specialPoints: 5 + enemyLevel, // Much less SP: 5 + level
        maxSpecialPoints: 5 + enemyLevel,
        attack: 4 + Math.floor(enemyLevel / 2), // Much weaker attack: 4 + level/2
        defense: 1 + Math.floor(enemyLevel / 3), // Very low defense: 1 + level/3
        skillPoints: 0,
        gold: 0
      },
      isNPC: true
    };
    
    const battleState = await createBattle(player, enemy);
    
    res.json({
      status: 'success',
      battleState: battleState
    });
  } catch (error) {
    console.error('[Server] Error starting battle:', error);
    res.status(500).json({ status: 'error', message: 'Failed to start battle' });
  }
});

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
    
    // Process enemy turn
    const enemyAction = getEnemyAction();
    let enemyDamage = 0;
    let enemyHealing = 0;
    let enemyMessage = '';
    
    console.log(`[Battle] === ENEMY TURN START ===`);
    console.log(`[Battle] Enemy action: ${enemyAction}`);
    
    if (enemyAction === 'heal') {
      enemyHealing = Math.floor(battle.enemy.stats.maxHitPoints * 0.2);
      battle.enemy.stats.hitPoints = Math.min(
        battle.enemy.stats.maxHitPoints,
        battle.enemy.stats.hitPoints + enemyHealing
      );
      enemyMessage = `${battle.enemy.username} healed for ${enemyHealing} HP!`;
    } else if (enemyAction === 'defend') {
      enemyMessage = `${battle.enemy.username} is defending!`;
    } else {
      enemyDamage = calculateDamage(battle.enemy, battle.player, enemyAction);
      console.log(`[Battle] Enemy damage: ${enemyDamage}`);
      
      const playerHpBefore = battle.player.stats.hitPoints;
      battle.player.stats.hitPoints = Math.max(0, battle.player.stats.hitPoints - enemyDamage);
      console.log(`[Battle] Player HP: ${playerHpBefore} -> ${battle.player.stats.hitPoints}`);
      
      enemyMessage = `${battle.enemy.username} attacked for ${enemyDamage} damage!`;
    }
    
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

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
