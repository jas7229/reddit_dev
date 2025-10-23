import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Custom Splash Screen for Reddit Battler
      appDisplayName: '⚔️ Avatar Arena',
      backgroundUri: 'ArenaSplash.png', // Fixed case sensitivity
      buttonLabel: '🎮 Start Battle!',
      description: 'Epic turn-based battles with Reddit users! Level up, earn gold, and become the ultimate champion!',
      heading: 'Ready for Battle?',
      appIconUri: 'ArenaIcon.png', // Fixed case sensitivity
    },
    postData: {
      gameState: 'initial',
      playerLevel: 1,
      battles: 0,
    },
    subredditName: subredditName,
    title: '⚔️ Avatar Arena - Epic Turn-Based Combat!',
  });
};
