import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';

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
  const { postId } = context;
  
  if (!postId) {
    res.status(400).json({
      status: 'error',
      message: 'postId is required',
    });
    return;
  }

  try {
    // Get all high scores from leaderboard hash
    const leaderboardKey = `leaderboard:${postId}`;
    const leaderboardData = await redis.hGetAll(leaderboardKey);
    const scores = [];
    
    // Convert hash data to array format
    for (const [username, score] of Object.entries(leaderboardData)) {
      scores.push({
        username,
        score: parseInt(score)
      });
    }
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    res.json({
      status: 'success',
      leaderboard: scores.slice(0, 10) // Top 10
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get leaderboard'
    });
  }
});

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
  return "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
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
  return "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
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
      gold: 50
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
    battle.enemy.stats.hitPoints = Math.max(0, battle.enemy.stats.hitPoints - playerDamage);
    
    if (playerAction === 'special') {
      battle.player.stats.specialPoints = Math.max(0, battle.player.stats.specialPoints - 10);
      playerMessage = `${battle.player.username} used special attack for ${playerDamage} damage!`;
    } else {
      playerMessage = `${battle.player.username} attacked for ${playerDamage} damage!`;
    }
  }
  
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
  } else {
    // Enemy turn
    const enemyAction = getEnemyAction();
    let enemyDamage = 0;
    let enemyHealing = 0;
    let enemyMessage = '';
    
    if (enemyAction === 'heal') {
      enemyHealing = Math.floor(battle.enemy.stats.maxHitPoints * 0.2); // Enemy heals less
      battle.enemy.stats.hitPoints = Math.min(
        battle.enemy.stats.maxHitPoints,
        battle.enemy.stats.hitPoints + enemyHealing
      );
      enemyMessage = `${battle.enemy.username} healed for ${enemyHealing} HP!`;
    } else if (enemyAction === 'defend') {
      enemyMessage = `${battle.enemy.username} is defending!`;
    } else {
      let defenseMultiplier = 1;
      if (playerAction === 'defend') {
        defenseMultiplier = 0.5; // Defending reduces incoming damage by 50%
      }
      
      enemyDamage = Math.floor(calculateDamage(battle.enemy, battle.player, enemyAction) * defenseMultiplier);
      battle.player.stats.hitPoints = Math.max(0, battle.player.stats.hitPoints - enemyDamage);
      
      if (enemyAction === 'special') {
        enemyMessage = `${battle.enemy.username} used special attack for ${enemyDamage} damage!`;
      } else {
        enemyMessage = `${battle.enemy.username} attacked for ${enemyDamage} damage!`;
      }
    }
    
    results.enemyTurn = {
      attacker: battle.enemy.username,
      defender: battle.player.username,
      action: enemyAction,
      damage: enemyDamage,
      healing: enemyHealing,
      message: enemyMessage,
      attackerHpAfter: battle.enemy.stats.hitPoints,
      defenderHpAfter: battle.player.stats.hitPoints
    };
    
    battle.battleLog.push(results.enemyTurn);
    
    // Check if player is defeated
    if (battle.player.stats.hitPoints <= 0) {
      battle.isActive = false;
      battle.winner = 'enemy';
      results.battleEnded = true;
      results.winner = 'enemy';
    }
  }
  
  battle.turnNumber += 1;
  battle.currentTurn = battle.isActive ? 'player' : null;
  
  // Save updated battle state
  await redis.set(battleKey, JSON.stringify(battle));
  
  return {
    battleState: battle,
    ...results
  };
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

router.get('/api/enemy', async (_req, res): Promise<void> => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const currentPlayer = await getOrCreatePlayer(currentUsername || 'anonymous');
    
    // Get a random Reddit user as enemy (simplified for now)
    // In a real implementation, you'd want a better system for finding users
    const enemyUsernames = ['spez', 'kn0thing', 'reddit', 'AutoModerator', 'RedditCareResources'];
    const randomEnemy = enemyUsernames[Math.floor(Math.random() * enemyUsernames.length)];
    
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

// Battle System API Endpoints
router.post('/api/battle/start', async (_req, res): Promise<void> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      res.status(400).json({ status: 'error', message: 'Username required' });
      return;
    }
    
    const player = await getOrCreatePlayer(username);
    
    // Generate enemy (reuse existing logic)
    const enemyUsernames = ['spez', 'kn0thing', 'reddit', 'AutoModerator', 'RedditCareResources'];
    const randomEnemy = enemyUsernames[Math.floor(Math.random() * enemyUsernames.length)];
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
    let avatarUrl = "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
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
