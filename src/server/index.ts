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
async function fetchUserAvatar(username: string): Promise<string | null> {
  console.log(`[Server] Reddit APIs don't expose custom Snoo avatars for: ${username}`);
  
  // Unfortunately, Reddit's developer APIs (both public and Devvit) don't expose 
  // custom Snoo avatar URLs. This is a known limitation.
  // 
  // Options for getting custom avatars:
  // 1. User manually provides their avatar URL
  // 2. Use a default/placeholder system
  // 3. Generate avatars based on username
  
  // For now, return null to use the default avatar system
  return null;
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
    let publicProfileAvatar = null;
    
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
    
    res.json({
      status: 'success',
      username: username ?? 'anonymous',
      currentScore: currentScore ? parseInt(currentScore) : 0,
      highScore: highScore ? parseInt(highScore) : 0,
      avatarUrl: avatarUrl,
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
