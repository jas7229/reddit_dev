using UnityEngine;
using UnityEngine.UI;
using System.Runtime.InteropServices;



// Define all the data classes first
[System.Serializable]
public class PlayerStats
{
    public int level;
    public int experience;
    public int experienceToNext;
    public int hitPoints;
    public int maxHitPoints;
    public int specialPoints;
    public int maxSpecialPoints;
    public int attack;
    public int defense;
    public int skillPoints;
    public int gold;
}

[System.Serializable]
public class PlayerCharacter
{
    public string username;
    public string avatarUrl;
    public PlayerStats stats;
    public string createdAt;
    public string lastPlayed;
    public bool isNPC; // For enemies
}

[System.Serializable]
public class PlayerResponse
{
    public string status;
    public PlayerCharacter playerCharacter;
    public string message;
}

[System.Serializable]
public class EnemyResponse
{
    public string status;
    public PlayerCharacter enemy; // Reusing PlayerCharacter for enemies
    public string message;
}


public class PlayerManager : MonoBehaviour
{

    [Header("Auto-Refresh Settings")]
public bool autoRefreshFromServer = true;
public float serverRefreshInterval = 5f; // Refresh from server every 5 seconds

private float lastServerRefresh;


    [Header("Player Data")]
    public PlayerCharacter currentPlayer;
    public PlayerCharacter currentEnemy;

    [Header("UI References")]
    public Image playerAvatarImage;
    public Image enemyAvatarImage;
    public Text playerStatsText;
    public Text enemyStatsText;

    [Header("Loading States")]
    public bool playerDataLoaded = false;
    public bool playerAvatarLoaded = false;
    public bool enemyDataLoaded = false;
    public bool enemyAvatarLoaded = false;

    // Import the JavaScript functions
    [DllImport("__Internal")]
    private static extern void GetPlayerData();

    [DllImport("__Internal")]
    private static extern void UpdatePlayerData(string statsJson);

    [DllImport("__Internal")]
    private static extern void InitializeAdmin();

    [DllImport("__Internal")]
    private static extern void GetEnemyData();

    [DllImport("__Internal")]
    private static extern void RefreshPlayerData(); // Add this line


void Start() 
{
    #if UNITY_WEBGL && !UNITY_EDITOR
        Debug.Log("Loading player data from Devvit...");
        GetPlayerData();
        lastServerRefresh = Time.time; // Add this line
        
        // Initialize admin system
        InitializeAdmin();
    #else
        Debug.Log("WebGL functions only work in builds, not editor");
        CreateMockPlayerData();
    #endif
}
void Update() 
{
    // Auto-refresh from server periodically (but not during battles)
    if (autoRefreshFromServer && Time.time - lastServerRefresh > serverRefreshInterval) 
    {
        // Check if there's an active battle - don't override battle HP
        BattleUIManager battleManager = FindFirstObjectByType<BattleUIManager>();
        bool inActiveBattle = battleManager != null && battleManager.IsInActiveBattle();
        
        if (!inActiveBattle)
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
            Debug.Log("Auto-refreshing player data from server...");
            RefreshPlayerData();
            lastServerRefresh = Time.time;
        #endif
        }
        else
        {
            Debug.Log("Skipping auto-refresh - battle in progress");
        }
    }
}

    // Called from JavaScript when player data is received (fast)
    public void OnPlayerDataReceived(string jsonData)
    {
        Debug.Log("Received player data: " + jsonData);

        try
        {
            PlayerResponse response = JsonUtility.FromJson<PlayerResponse>(jsonData);

            if (response.status == "success" && response.playerCharacter != null)
            {
                currentPlayer = response.playerCharacter;
                playerDataLoaded = true;

                Debug.Log($"Player loaded: {currentPlayer.username}, Level {currentPlayer.stats.level}, Gold {currentPlayer.stats.gold}");

                // Update UI immediately with stats
                UpdatePlayerUI();

                // Avatar will load separately via OnPlayerAvatarLoaded

                   NotifyDisplayUpdate();
            }
            else
            {
                Debug.LogError("Failed to load player: " + response.message);
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing player data: " + e.Message);
        }
    }

    // Called from JavaScript when player avatar is loaded (slower)
    // public void OnPlayerAvatarLoaded(string base64ImageData) 
    // {
    //     Debug.Log("Player avatar loaded");

    //     if (!string.IsNullOrEmpty(base64ImageData) && playerAvatarImage != null) 
    //     {
    //         StartCoroutine(LoadImageFromBase64(base64ImageData, playerAvatarImage));
    //         playerAvatarLoaded = true;
    //     }
    //     else 
    //     {
    //         Debug.LogWarning("Failed to load player avatar or no UI image assigned");
    //     }
    // }

    // Called from JavaScript when enemy data is received
    public void OnEnemyDataReceived(string jsonData)
    {
        Debug.Log("Enemy data received: " + jsonData);

        try
        {
            EnemyResponse response = JsonUtility.FromJson<EnemyResponse>(jsonData);

            if (response.status == "success" && response.enemy != null)
            {
                currentEnemy = response.enemy;
                enemyDataLoaded = true;

                Debug.Log($"Enemy loaded: {currentEnemy.username}, Level {currentEnemy.stats.level}");

                // Update enemy UI
                UpdateEnemyUI();
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing enemy data: " + e.Message);
        }
    }

    // Called from JavaScript when enemy avatar is loaded
    public void OnEnemyAvatarLoaded(string base64ImageData)
    {
        Debug.Log("Enemy avatar loaded");

        if (!string.IsNullOrEmpty(base64ImageData) && enemyAvatarImage != null)
        {
            StartCoroutine(LoadImageFromBase64(base64ImageData, enemyAvatarImage));
            enemyAvatarLoaded = true;
        }
    }

    // Called from JavaScript when player is updated
    public void OnPlayerUpdated(string jsonData)
    {
        Debug.Log("Player updated: " + jsonData);
        // Reuse the same parsing logic
        OnPlayerDataReceived(jsonData);

        // Notify display scripts to update
        PlayerStatsDisplay display = FindObjectOfType<PlayerStatsDisplay>();
        if (display != null)
        {
            display.ForceUpdate();
        }

    }

    // Update player UI with stats (called immediately when data loads)
    private void UpdatePlayerUI()
    {
        if (currentPlayer != null && playerStatsText != null)
        {
            playerStatsText.text = $"{currentPlayer.username}\n" +
                                  $"Level: {currentPlayer.stats.level}\n" +
                                  $"HP: {currentPlayer.stats.hitPoints}/{currentPlayer.stats.maxHitPoints}\n" +
                                  $"Gold: {currentPlayer.stats.gold}";
        }
    }

    // Update enemy UI with stats
    private void UpdateEnemyUI()
    {
        if (currentEnemy != null && enemyStatsText != null)
        {
            enemyStatsText.text = $"{currentEnemy.username}\n" +
                                 $"Level: {currentEnemy.stats.level}\n" +
                                 $"HP: {currentEnemy.stats.hitPoints}/{currentEnemy.stats.maxHitPoints}";
        }
    }

    // Coroutine to load base64 image data into UI Image
    private System.Collections.IEnumerator LoadImageFromBase64(string base64Data, Image targetImage)
    {
        try
        {
            // Remove data URL prefix if present
            string base64 = base64Data;
            if (base64.StartsWith("data:image"))
            {
                base64 = base64.Substring(base64.IndexOf(",") + 1);
            }

            // Convert base64 to bytes
            byte[] imageBytes = System.Convert.FromBase64String(base64);

            // Create texture
            Texture2D texture = new Texture2D(2, 2);
            texture.LoadImage(imageBytes);

            // Create sprite and assign to UI
            Sprite sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f));
            targetImage.sprite = sprite;

            Debug.Log("Avatar image loaded successfully");
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error loading image from base64: " + e.Message);
        }

        yield return null;
    }

    // Public methods for game logic
    public void LoadNewEnemy()
    {
        enemyDataLoaded = false;
        enemyAvatarLoaded = false;

#if UNITY_WEBGL && !UNITY_EDITOR
            GetEnemyData();
#endif
    }

    public void AddGold(int amount)
    {
        if (currentPlayer != null)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
                int newGold = currentPlayer.stats.gold + amount;
                string updateJson = $"{{\"gold\": {newGold}}}";
                UpdatePlayerData(updateJson);
#endif
        }
    }

    public bool IsPlayerFullyLoaded()
    {
        return playerDataLoaded && playerAvatarLoaded;
    }

    public bool IsEnemyFullyLoaded()
    {
        return enemyDataLoaded && enemyAvatarLoaded;
    }

    // Mock data for editor testing
    private void CreateMockPlayerData()
    {
        currentPlayer = new PlayerCharacter
        {
            username = "TestPlayer",
            avatarUrl = "",
            stats = new PlayerStats
            {
                level = 5,
                hitPoints = 100,
                maxHitPoints = 100,
                gold = 250,
                attack = 15,
                defense = 8
            }
        };
        playerDataLoaded = true;
        UpdatePlayerUI();
    }

    // Manual refresh button (call this from UI button)
public void ManualRefreshFromServer() 
{
    #if UNITY_WEBGL && !UNITY_EDITOR
        Debug.Log("Manual refresh requested...");
        RefreshPlayerData();
        lastServerRefresh = Time.time;
    #endif
}

// Notify all display scripts to update
private void NotifyDisplayUpdate() 
{
    // Find and update all display scripts
    PlayerStatsDisplay[] displays = FindObjectsByType<PlayerStatsDisplay>(FindObjectsSortMode.None);
    foreach (var display in displays) 
    {
        display.ForceUpdate();
    }
}


}
