// TypeScript declarations for Unity API functions on window object
declare global {
  interface Window {
    // Unity Devvit API functions
    getUserData: () => Promise<string>;
    saveScore: (score: number) => Promise<string>;
    getLeaderboard: () => Promise<string>;
    getUserAvatar: () => Promise<string>;
    getUsername: () => string;
    unityLog: (message: string) => void;
    unityAlert: (message: string) => void;
    
    // Player Character System
    getPlayer: () => Promise<string>;
    updatePlayer: (statsJson: string) => Promise<string>;
    getEnemy: () => Promise<string>;
    resetPlayer: () => Promise<string>;
    getEnemyPreview: (difficulty?: string, reroll?: boolean) => Promise<string>;
    
    // Battle System
    startBattle: () => Promise<string>;
    StartBattle: () => Promise<string>;
    battleAction: (battleId: string, action: string) => Promise<string>;
    BattleAction: (battleId: string, action: string) => Promise<string>;
    getBattle: (battleId: string) => Promise<string>;
    processEnemyTurn: (battleId: string) => Promise<string>;
    
    // User context data
    userAvatar?: string;
    username?: string;
    
    // Unity instance
    unityInstance?: any;
    
    // Unity API object
    UnityDevvitAPI: {
      getUserData: () => Promise<string>;
      saveScore: (score: number) => Promise<string>;
      getLeaderboard: () => Promise<string>;
      getUserAvatar: () => Promise<string>;
      getUsername: () => string;
      getPlayer: () => Promise<string>;
      updatePlayer: (statsJson: string) => Promise<string>;
      resetPlayer: () => Promise<string>;
      getEnemy: () => Promise<string>;
      getEnemyPreview: (difficulty?: string, reroll?: boolean) => Promise<string>;
      startBattle: () => Promise<string>;
      battleAction: (battleId: string, action: string) => Promise<string>;
      getBattle: (battleId: string) => Promise<string>;
      processEnemyTurn: (battleId: string) => Promise<string>;
      log: (message: string) => void;
      alert: (message: string) => void;
    };
    
    // Devvit context
    __DEVVIT_CONTEXT__?: any;
    DEVVIT_CONTEXT?: any;
    devvitContext?: any;
    
    // Test panel functions
    testGetLeaderboard?: () => Promise<void>;
    testEnemyPreview?: (difficulty: string) => Promise<void>;
    testGetPlayer?: () => Promise<void>;
    testUpdatePlayer?: () => Promise<void>;
    testBattleAction?: (action: string) => Promise<void>;
  }
}

export {};