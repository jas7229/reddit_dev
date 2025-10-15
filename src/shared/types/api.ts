export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

// Unity-specific API types
export type SaveScoreResponse = {
  status: 'success' | 'error';
  score?: number;
  highScore?: number;
  username?: string;
  message?: string;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
};

export type LeaderboardResponse = {
  status: 'success' | 'error';
  leaderboard?: LeaderboardEntry[];
  message?: string;
};

export type UserDataResponse = {
  status: 'success' | 'error';
  username?: string;
  currentScore?: number;
  highScore?: number;
  avatarUrl?: string;
  message?: string;
};
