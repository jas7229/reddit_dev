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
  level: number;
  avatarUrl: string;
  fallbackAvatarUrls?: string[]; // Additional avatar URLs to try if primary fails
  battlesWon?: number;
  lastPlayed?: string;
};

export type LeaderboardResponse = {
  status: 'success' | 'error';
  leaderboard?: LeaderboardEntry[];
  playerRank?: number;
  totalPlayers?: number;
  isCurrentPlayerIncluded?: boolean;
  message?: string;
};

// Player Character System Types
export type PlayerStats = {
  level: number;
  experience: number;
  experienceToNext: number;
  hitPoints: number;
  maxHitPoints: number;
  specialPoints: number;
  maxSpecialPoints: number;
  attack: number;
  defense: number;
  skillPoints: number;
  gold: number;
};

export type PlayerCharacter = {
  username: string;
  avatarUrl: string;
  stats: PlayerStats;
  createdAt: string;
  lastPlayed: string;
};

export type EnemyCharacter = {
  username: string;
  avatarUrl: string;
  stats: PlayerStats;
  isNPC?: boolean;
};

export type UserDataResponse = {
  status: 'success' | 'error';
  username?: string;
  currentScore?: number;
  highScore?: number;
  avatarUrl?: string;
  playerCharacter?: PlayerCharacter;
  message?: string;
};

export type PlayerUpdateResponse = {
  status: 'success' | 'error';
  playerCharacter?: PlayerCharacter;
  message?: string;
};

export type EnemyResponse = {
  status: 'success' | 'error';
  enemy?: EnemyCharacter;
  message?: string;
};

export type BattleDifficulty = 'easy' | 'medium' | 'hard';

export type EnemyPreviewRequest = {
  difficulty?: BattleDifficulty;
  reroll?: boolean;
};

export type EnemyPreviewResponse = {
  status: 'success' | 'error';
  enemy?: EnemyCharacter;
  difficulty?: BattleDifficulty;
  levelDifference?: number;
  expectedRewards?: {
    baseExperience: number;
    baseGold: number;
    riskLevel: string;
  };
  message?: string;
};

// Battle System Types
export type BattleAction = 'attack' | 'defend' | 'special' | 'heal';

export type BattleTurn = {
  attacker: string;
  defender: string;
  action: BattleAction;
  damage: number;
  healing: number;
  message: string;
  attackerHpAfter: number;
  defenderHpAfter: number;
};

export type BattleState = {
  battleId: string;
  player: PlayerCharacter;
  enemy: EnemyCharacter;
  currentTurn: 'player' | 'enemy';
  turnNumber: number;
  isActive: boolean;
  winner?: 'player' | 'enemy';
  battleLog: BattleTurn[];
  createdAt: string;
};

export type BattleActionRequest = {
  battleId: string;
  action: BattleAction;
};

export type BattleActionResponse = {
  status: 'success' | 'error';
  battleState?: BattleState;
  playerTurn?: BattleTurn;
  enemyTurn?: BattleTurn;
  battleEnded?: boolean;
  winner?: 'player' | 'enemy';
  rewards?: {
    experience: number;
    gold: number;
    levelUp?: boolean;
  };
  message?: string;
};
