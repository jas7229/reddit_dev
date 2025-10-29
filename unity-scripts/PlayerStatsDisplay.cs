using UnityEngine;
using TMPro; // Import TextMeshPro namespace

public class PlayerStatsDisplay : MonoBehaviour 
{
    [Header("UI TextMeshPro References")]
    public TextMeshProUGUI playerNameText;
    public TextMeshProUGUI playerLevelText;
    public TextMeshProUGUI playerGoldText;
    public TextMeshProUGUI playerHealthText;
    
    [Header("Manager Reference")]
    public PlayerManager playerManager;
    
    [Header("Update Settings")]
    public bool autoUpdate = true;
    public float updateInterval = 0.5f; // Update every 0.5 seconds
    
    private float lastUpdateTime;
    
    void Start() 
    {
        // Find PlayerManager if not assigned
        if (playerManager == null) 
        {
            playerManager = FindFirstObjectByType<PlayerManager>();
        }
        
        // Initial update
        UpdateDisplay();
    }
    
    void Update() 
    {
        // Auto-update if enabled
        if (autoUpdate && Time.time - lastUpdateTime > updateInterval) 
        {
            UpdateDisplay();
            lastUpdateTime = Time.time;
        }
    }
    
    public void UpdateDisplay() 
    {
        // Check if we have a player manager and player data
        if (playerManager == null || playerManager.currentPlayer == null) 
        {
            ShowLoadingText();
            return;
        }
        
        PlayerCharacter player = playerManager.currentPlayer;
        
        // Update each TextMeshPro field
        if (playerNameText != null) 
        {
            playerNameText.text = player.username;
        }
        
        if (playerLevelText != null) 
        {
            playerLevelText.text = $"Level {player.stats.level}";
        }
        
        if (playerGoldText != null) 
        {
            playerGoldText.text = $"Gold: {player.stats.gold}";
        }
        
        if (playerHealthText != null) 
        {
            playerHealthText.text = $"HP: {player.stats.hitPoints}/{player.stats.maxHitPoints}";
        }
    }
    
    private void ShowLoadingText() 
    {
        // Show loading text while data is being fetched
        if (playerNameText != null) playerNameText.text = "Loading...";
        if (playerLevelText != null) playerLevelText.text = "Level ?";
        if (playerGoldText != null) playerGoldText.text = "Gold: ?";
        if (playerHealthText != null) playerHealthText.text = "HP: ?/?";
    }
    
    // Public method to force an update
    public void ForceUpdate() 
    {
        UpdateDisplay();
    }
}
