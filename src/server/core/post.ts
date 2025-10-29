import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Minimal required fields only
      backgroundUri: 'ArenaSplash.png',
      buttonLabel: 'Start Battle',
      appIconUri: 'ArenaIcon.png',
    },
    postData: {
      gameState: 'initial',
      playerLevel: 1,
      battles: 0,
    },
    subredditName: subredditName,
    title: 'Avatar Arena',
  });
};
