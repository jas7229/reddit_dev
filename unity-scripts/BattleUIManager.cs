using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Runtime.InteropServices;
using System.Collections;
using UnityEngine.Networking;

public class BattleUIManager : MonoBehaviour 
{
    // External JavaScript function declarations for DevvitAPI.jslib
    [DllImport("__Internal")]
    private static extern void StartBattle();
    
    [DllImport("__Internal")]
    private static extern void BattleAction(string battleId, string action);
    
    [Header("Player UI References")]
    public TextMeshProUGUI playerNameText;
    public TextMeshProUGUI playerLevelText;
    public TextMeshProUGUI playerGoldText;
    public Slider playerHealthSlider;
    public Slider playerSpecialSlider;
    public Slider playerExperienceSlider;
    public TextMeshProUGUI playerHealthText; // "85/100"
    public TextMeshProUGUI playerSpecialText; // "15/20"
    public TextMeshProUGUI playerExperienceText; // "45/100"
    public TextMeshProUGUI playerAttackDefenseText; // "ATK: 12 DEF: 8"
    public Image playerAvatarImage; // Player avatar display
    
    [Header("Enemy UI References")]
    public TextMeshProUGUI enemyNameText;
    public TextMeshProUGUI enemyLevelText;
    public Slider enemyHealthSlider;
    public Slider enemySpecialSlider;
    public TextMeshProUGUI enemyHealthText;
    public TextMeshProUGUI enemySpecialText;
    public TextMeshProUGUI enemyAttackDefenseText;
    public Image enemyAvatarImage; // Enemy avatar display
    
    [Header("Battle Status")]
    public TextMeshProUGUI battleStatusText;
    public TextMeshProUGUI turnNumberText;
    public GameObject battlePanel; // Show/hide during battles
    
    [Header("Turn Indicators")]
    public Image playerTurnIndicator; // Circle/panel behind player level
    public Image enemyTurnIndicator; // Circle/panel behind enemy level
    
    [Header("Battle Results Screen")]
    public GameObject battleResultsPanel; // Main results panel
    public TextMeshProUGUI resultsTitle; // "VICTORY!" or "DEFEAT!"
    public TextMeshProUGUI resultsSubtitle; // Enemy name defeated
    public Image resultsEnemyAvatar; // Enemy avatar image
    public TextMeshProUGUI expGainedText; // "+50 EXP"
    public TextMeshProUGUI goldGainedText; // "+30 Gold"
    public TextMeshProUGUI levelUpText; // "LEVEL UP!" (optional)
    public Button continueButton; // "Continue" button
    public Image resultsBackground; // Background panel for scaling animation
    
    [Header("Battle Action Buttons")]
    public Button attackButton;
    public Button defendButton;
    public Button specialButton;
    public Button healButton;
    
    [Header("Manager References")]
    public PlayerManager playerManager;
    
    [Header("Update Settings")]
    public bool autoUpdate = true;
    public float updateInterval = 0.5f;
    
    private float lastUpdateTime;
    private BattleState currentBattle;
    private bool inActiveBattle = false; // Flag to prevent auto-updates during battle
    private string lastPlayerAction = "attack"; // Track the last action for animations
    
    // Track loaded avatars to prevent unnecessary reloading
    private string loadedPlayerUsername = "";
    private string loadedEnemyUsername = "";
    
    // Track animation state to prevent conflicts
    private bool isPlayingBattleAnimation = false;
    
    // Track flip state to prevent re-flipping
    private bool enemyAvatarFlipped = false;
    
    // Track progress bar flash states to prevent overlapping flashes
    private bool playerHealthFlashing = false;
    private bool playerSpecialFlashing = false;
    private bool playerExperienceFlashing = false;
    private bool enemyHealthFlashing = false;
    
    // Turn indicator colors
    private Color inactiveTurnColor = new Color(0.5f, 0.5f, 0.5f, 0.3f); // Grey, semi-transparent
    private Color activeTurnColor = new Color(1f, 0.2f, 0.2f, 0.8f); // Red, more opaque
    private Color enemyTurnColor = new Color(1f, 0.6f, 0f, 0.8f); // Orange for enemy turn
    
    // Battle results colors
    private Color victoryColor = new Color(0f, 1f, 0.2f, 1f); // Bright green
    private Color defeatColor = new Color(1f, 0.2f, 0.2f, 1f); // Red
    private Color levelUpColor = new Color(1f, 0.8f, 0f, 1f); // Gold
    
    // External function for processing enemy turns
    [DllImport("__Internal")]
    private static extern void ProcessEnemyTurn(string battleId);
    
    // Import avatar function (same as LoadAvatar.cs uses)
    [DllImport("__Internal")]
    private static extern System.IntPtr GetUserAvatar();
    
    
    
    void Start()
    {
         Debug.Log("BattleUIManager started - GameObject name: " + gameObject.name);
    
        // Find PlayerManager if not assigned
        if (playerManager == null) 
        {
            playerManager = FindFirstObjectByType<PlayerManager>();
        }
        
        // Hide battle panel initially
        if (battlePanel != null) 
        {
            battlePanel.SetActive(false);
        }
        
        // Disable battle buttons initially (no battle active)
        SetActionButtonsEnabled(false);
        
        // Initialize turn indicators (both inactive)
        UpdateTurnIndicators(null);
        
        // Initial update
        UpdateUI();
    }
    
    void Update() 
    {
        // Auto-update if enabled and not playing battle animations
        if (autoUpdate && !isPlayingBattleAnimation && Time.time - lastUpdateTime > updateInterval) 
        {
            UpdateUI();
            lastUpdateTime = Time.time;
        }
        
        // Safety mechanism: Reset animation flag if it's been stuck for too long
        if (isPlayingBattleAnimation && Time.time - lastUpdateTime > 10f)
        {
            Debug.LogWarning("Animation flag stuck - resetting to allow UI updates");
            isPlayingBattleAnimation = false;
        }
    }

    
    public void DebugBattleState1()
    {
        if (currentBattle == null)
        {
            Debug.Log("No current battle");
            return;
        }

        Debug.Log($"Battle ID: {currentBattle.battleId}");
        Debug.Log($"Is Active: {currentBattle.isActive}");
        Debug.Log($"Current Turn: {currentBattle.currentTurn}");
        Debug.Log($"Turn Number: {currentBattle.turnNumber}");
        Debug.Log($"Player HP: {currentBattle.player.stats.hitPoints}/{currentBattle.player.stats.maxHitPoints}");
        Debug.Log($"Enemy HP: {currentBattle.enemy.stats.hitPoints}/{currentBattle.enemy.stats.maxHitPoints}");
    }

    
    public void UpdateUI() 
    {
        UpdatePlayerUI();
        UpdateEnemyUI();
        UpdateBattleStatus();
        
        // Update special button state based on current SP
        if (currentBattle != null && currentBattle.isActive && currentBattle.currentTurn == "player")
        {
            UpdateSpecialButtonState(true);
        }
    }
    
    private void UpdatePlayerUI() 
    {
        if (playerManager == null || playerManager.currentPlayer == null) 
        {
            ShowPlayerLoadingUI();
            return;
        }
        
        PlayerCharacter player = playerManager.currentPlayer;
        PlayerStats stats = player.stats;
        
        // Update text fields
        if (playerNameText != null) 
        {
            playerNameText.text = player.username;
        }
        
        if (playerLevelText != null) 
        {
            playerLevelText.text = $"{stats.level}";
        }
        
        if (playerGoldText != null) 
        {
            playerGoldText.text = $"{stats.gold}";
        }
        
        if (playerAttackDefenseText != null) 
        {
            playerAttackDefenseText.text = $"ATK: {stats.attack} DEF: {stats.defense}";
        }
        
        // Update health slider and text
        if (playerHealthSlider != null) 
        {
            float oldValue = playerHealthSlider.value;
            playerHealthSlider.maxValue = stats.maxHitPoints;
            playerHealthSlider.value = stats.hitPoints;
            
            // Flash if value changed
            if (oldValue != stats.hitPoints)
            {
                FlashProgressBar(playerHealthSlider, ref playerHealthFlashing);
            }
        }
        
        if (playerHealthText != null) 
        {
            playerHealthText.text = $"{stats.hitPoints}/{stats.maxHitPoints}";
        }
        
        // Update special points slider and text
        if (playerSpecialSlider != null) 
        {
            float oldValue = playerSpecialSlider.value;
            playerSpecialSlider.maxValue = stats.maxSpecialPoints;
            playerSpecialSlider.value = stats.specialPoints;
            
            // Flash if value changed
            if (oldValue != stats.specialPoints)
            {
                FlashProgressBar(playerSpecialSlider, ref playerSpecialFlashing);
            }
        }
        
        if (playerSpecialText != null) 
        {
            playerSpecialText.text = $"{stats.specialPoints}/{stats.maxSpecialPoints}";
        }
        
        // Update experience slider and text
        if (playerExperienceSlider != null) 
        {
            float oldValue = playerExperienceSlider.value;
            playerExperienceSlider.maxValue = stats.experienceToNext;
            playerExperienceSlider.value = stats.experience;
            
            // Flash if value changed
            if (oldValue != stats.experience)
            {
                FlashProgressBar(playerExperienceSlider, ref playerExperienceFlashing);
            }
        }
        
        if (playerExperienceText != null) 
        {
            playerExperienceText.text = $"{stats.experience}/{stats.experienceToNext}";
        }
        
        // Load player avatar if we haven't loaded it for this player yet
        if (playerAvatarImage != null)
        {
            if (loadedPlayerUsername != player.username || playerAvatarImage.sprite == null)
            {
                Debug.Log($"Loading player avatar for {player.username} (was: {loadedPlayerUsername}, sprite null: {playerAvatarImage.sprite == null})");
                LoadPlayerAvatar();
                loadedPlayerUsername = player.username;
            }
            else
            {
                Debug.Log($"Player avatar already loaded for {player.username}, skipping");
            }
        }
        else
        {
            Debug.LogWarning("playerAvatarImage is null - drag an Image component to this field!");
        }
    }
    
    private void UpdateEnemyUI() 
    {
        if (currentBattle == null || currentBattle.enemy == null) 
        {
            ShowEnemyLoadingUI();
            return;
        }
        
        PlayerCharacter enemy = currentBattle.enemy;
        PlayerStats stats = enemy.stats;
        
        // Update enemy text fields
        if (enemyNameText != null) 
        {
            enemyNameText.text = enemy.username;
        }
        
        if (enemyLevelText != null) 
        {
            enemyLevelText.text = $"{stats.level}";
        }
        
        if (enemyAttackDefenseText != null) 
        {
            enemyAttackDefenseText.text = $"ATK: {stats.attack} DEF: {stats.defense}";
        }
        
        // Update enemy health slider and text
        if (enemyHealthSlider != null) 
        {
            float oldValue = enemyHealthSlider.value;
            enemyHealthSlider.maxValue = stats.maxHitPoints;
            enemyHealthSlider.value = stats.hitPoints;
            
            // Flash if value changed
            if (oldValue != stats.hitPoints)
            {
                FlashProgressBar(enemyHealthSlider, ref enemyHealthFlashing);
            }
        }
        
        if (enemyHealthText != null) 
        {
            enemyHealthText.text = $"{stats.hitPoints}/{stats.maxHitPoints}";
        }
        
        // Update enemy special points slider and text
        if (enemySpecialSlider != null) 
        {
            enemySpecialSlider.maxValue = stats.maxSpecialPoints;
            enemySpecialSlider.value = stats.specialPoints;
        }
        
        if (enemySpecialText != null) 
        {
            enemySpecialText.text = $"{stats.specialPoints}/{stats.maxSpecialPoints}";
        }
        
        // Load enemy avatar if we haven't loaded it for this enemy yet
        if (enemyAvatarImage != null)
        {
            if (loadedEnemyUsername != enemy.username)
            {
                Debug.Log($"Loading enemy avatar for {enemy.username} (was: {loadedEnemyUsername})");
                enemyAvatarFlipped = false; // Reset flip state for new enemy
                LoadEnemyAvatar();
                loadedEnemyUsername = enemy.username;
            }
        }
        else
        {
            Debug.LogWarning("enemyAvatarImage is null - drag an Image component to this field!");
        }
    }
    
    private void UpdateBattleStatus() 
    {
        if (currentBattle == null) 
        {
            if (battleStatusText != null) 
            {
                battleStatusText.text = "No active battle";
            }
            
            if (turnNumberText != null) 
            {
                turnNumberText.text = "";
            }
            
            // No battle - both indicators inactive
            UpdateTurnIndicators(null);
            return;
        }
        
        if (battleStatusText != null) 
        {
            if (currentBattle.isActive) 
            {
                string currentTurn = currentBattle.currentTurn == "player" ? "Your Turn" : "Enemy Turn";
                battleStatusText.text = $"Battle Active - {currentTurn}";
            }
            else 
            {
                string winner = currentBattle.winner == "player" ? "Victory!" : "Defeat!";
                battleStatusText.text = $"Battle Ended - {winner}";
            }
        }
        
        if (turnNumberText != null) 
        {
            turnNumberText.text = $"Turn {currentBattle.turnNumber}";
        }
        
        // Update turn indicators
        UpdateTurnIndicators(currentBattle.isActive ? currentBattle.currentTurn : null);
    }
    
    private void UpdateTurnIndicators(string currentTurn)
    {
        // Update player turn indicator
        if (playerTurnIndicator != null)
        {
            if (currentTurn == "player")
            {
                playerTurnIndicator.color = activeTurnColor;
                // Optional: Add a subtle pulse animation
                StartCoroutine(PulseTurnIndicator(playerTurnIndicator));
            }
            else
            {
                playerTurnIndicator.color = inactiveTurnColor;
            }
        }
        
        // Update enemy turn indicator  
        if (enemyTurnIndicator != null)
        {
            if (currentTurn == "enemy")
            {
                enemyTurnIndicator.color = enemyTurnColor;
                // Optional: Add a subtle pulse animation
                StartCoroutine(PulseTurnIndicator(enemyTurnIndicator));
            }
            else
            {
                enemyTurnIndicator.color = inactiveTurnColor;
            }
        }
    }
    
    private System.Collections.IEnumerator PulseTurnIndicator(Image indicator)
    {
        Color baseColor = indicator.color;
        float pulseSpeed = 2f; // Slower pulse
        
        // Pulse continuously while this color is active
        while (indicator != null && Mathf.Approximately(indicator.color.r, baseColor.r))
        {
            float pulse = (Mathf.Sin(Time.time * pulseSpeed) + 1f) / 2f; // 0 to 1
            float alpha = Mathf.Lerp(baseColor.a * 0.6f, baseColor.a, pulse);
            
            Color pulseColor = baseColor;
            pulseColor.a = alpha;
            indicator.color = pulseColor;
            
            yield return null;
        }
    }
    
    private void ShowPlayerLoadingUI() 
    {
        if (playerNameText != null) playerNameText.text = "Loading...";
        if (playerLevelText != null) playerLevelText.text = "Level ?";
        if (playerGoldText != null) playerGoldText.text = "Gold: ?";
        if (playerHealthText != null) playerHealthText.text = "?/?";
        if (playerSpecialText != null) playerSpecialText.text = "?/?";
        if (playerExperienceText != null) playerExperienceText.text = "?/?";
        if (playerAttackDefenseText != null) playerAttackDefenseText.text = "ATK: ? DEF: ?";
    }
    
    private void ShowEnemyLoadingUI() 
    {
        if (enemyNameText != null) enemyNameText.text = "No Enemy";
        if (enemyLevelText != null) enemyLevelText.text = "";
        if (enemyHealthText != null) enemyHealthText.text = "";
        if (enemySpecialText != null) enemySpecialText.text = "";
        if (enemyAttackDefenseText != null) enemyAttackDefenseText.text = "";
        
        // Reset sliders
        if (enemyHealthSlider != null) 
        {
            enemyHealthSlider.value = 0;
            enemyHealthSlider.maxValue = 1;
        }
        if (enemySpecialSlider != null) 
        {
            enemySpecialSlider.value = 0;
            enemySpecialSlider.maxValue = 1;
        }
    }
    
    // Public methods for battle control
    public void StartNewBattle() 
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
            StartBattle();
        #else
            Debug.Log("Battle functions only work in WebGL builds");
        #endif
    }
    
    public void PerformAttack() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
            lastPlayerAction = "attack"; // Store action for animation
            
            // Immediately disable all buttons to prevent button mashing
            SetActionButtonsEnabled(false);
            Debug.Log("Attack pressed - all buttons disabled immediately");
            
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "attack");
            #endif
        }
    }
    
    public void PerformDefend() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
            lastPlayerAction = "defend"; // Store action for animation
            
            // Immediately disable all buttons to prevent button mashing
            SetActionButtonsEnabled(false);
            Debug.Log("Defend pressed - all buttons disabled immediately");
            
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "defend");
            #endif
        }
    }
    
    public void PerformSpecial() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
            lastPlayerAction = "special"; // Store action for animation
            
            // Immediately disable all buttons to prevent button mashing
            SetActionButtonsEnabled(false);
            Debug.Log("Special pressed - all buttons disabled immediately");
            
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "special");
            #endif
        }
    }
    
    public void PerformHeal() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
            lastPlayerAction = "heal"; // Store action for animation
            
            // Immediately disable all buttons to prevent button mashing
            SetActionButtonsEnabled(false);
            Debug.Log("Heal pressed - all buttons disabled immediately");
            
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "heal");
            #endif
        }
    }
    
    // Called from JavaScript when battle starts
    public void OnBattleStarted(string jsonData) 
    {
        Debug.Log("Battle started: " + jsonData);
           Debug.Log("*** BattleUIManager.OnBattleStarted called! ***");
    Debug.Log("Battle data: " + jsonData);
    
        
        try 
        {
            var response = JsonUtility.FromJson<BattleStartResponse>(jsonData);
            
            if (response.status == "success" && response.battleState != null) 
            {
                currentBattle = response.battleState;
                inActiveBattle = true; // Disable auto-updates during battle
                
                if (battlePanel != null) 
                {
                    battlePanel.SetActive(true);
                }
                
                // Enable buttons if it's player's turn
                SetActionButtonsEnabled(currentBattle.currentTurn == "player");
                
                UpdateUI();
                Debug.Log($"Battle started: {currentBattle.player.username} vs {currentBattle.enemy.username}");
            }
        }
        catch (System.Exception e) 
        {
            Debug.LogError("Error parsing battle start data: " + e.Message);
        }
    }
    
    // Called from JavaScript when battle action is performed
    public void OnBattleAction(string jsonData) 
    {
        Debug.Log("*** BATTLE ACTION MESSAGE RECEIVED IN UNITY! ***");
        
        try 
        {
            var response = JsonUtility.FromJson<BattleActionResponse>(jsonData);
            
            if (response.status == "success" && response.battleState != null) 
            {
                currentBattle = response.battleState;
                
                // IMPORTANT: Update PlayerManager with new player data from battle
                if (playerManager != null && currentBattle.player != null) 
                {
                    playerManager.currentPlayer = currentBattle.player;
                    Debug.Log($"Updated PlayerManager: HP {currentBattle.player.stats.hitPoints}/{currentBattle.player.stats.maxHitPoints}");
                    Debug.Log($"Battle flag set - preventing external HP updates");
                }
                
                // Show player turn immediately and trigger attack animation
                AnimateBattleText("Player Turn Complete");
                
                UpdateUI();
                
                // Only start animation sequence if not already playing
                if (!isPlayingBattleAnimation)
                {
                    // Use the last player action for animations
                    StartCoroutine(HandlePlayerActionSequence(lastPlayerAction, response.battleEnded));
                }
                else
                {
                    Debug.LogWarning("Animation already playing - skipping new animation sequence");
                }
                
                // Check if it's now enemy turn and process it automatically
                if (!response.battleEnded && currentBattle.isActive && currentBattle.currentTurn == "enemy")
                {
                    Debug.Log("It's enemy turn - processing enemy turn after delay");
                    Invoke("ProcessEnemyTurnDelayed", 2f); // 2 second delay for animations
                }
                
                // Don't start enemy turn delay here - it's handled in the sequence
                
                if (response.battleEnded) 
                {
                    Debug.Log($"Battle ended! Winner: {response.winner}");
                    
                    // Show battle results screen
                    ShowBattleResults(response.winner, response.rewards);
                    
                    inActiveBattle = false; // Re-enable auto-updates after battle
                }
            }
        }
        catch (System.Exception e) 
        {
            Debug.LogError("Error parsing battle action data: " + e.Message);
        }
    }
    
    // Handle the complete player action sequence with action-specific animations
    private System.Collections.IEnumerator HandlePlayerActionSequence(string playerAction, bool battleEnded)
    {
        Debug.Log($"*** PLAYER {playerAction.ToUpper()} SEQUENCE STARTED ***");
        isPlayingBattleAnimation = true; // Disable auto-updates during animation
        
        // Disable action buttons during animations
        SetActionButtonsEnabled(false);
        
        // 1. Player action animation (action-specific)
        if (playerAvatarImage != null)
        {
            Debug.Log($"Starting PLAYER {playerAction} animation");
            yield return StartCoroutine(GetPlayerActionAnimation(playerAction, playerAvatarImage));
        }
        
        // 2. Enemy reaction (only for attacks)
        if (enemyAvatarImage != null && (playerAction == "attack" || playerAction == "special"))
        {
            Debug.Log($"Starting ENEMY reaction to {playerAction}");
            yield return StartCoroutine(GetEnemyReactionAnimation(playerAction, enemyAvatarImage));
        }
        
        Debug.Log($"Player {playerAction} sequence complete. Battle ended: {battleEnded}");
        
        // 3. If battle isn't over, start enemy turn
        if (!battleEnded && currentBattle != null && currentBattle.isActive)
        {
            Debug.Log("Starting enemy turn sequence");
            yield return StartCoroutine(ShowEnemyTurnDelay());
        }
        
        isPlayingBattleAnimation = false; // Re-enable auto-updates
        Debug.Log("*** ALL BATTLE ANIMATIONS COMPLETE ***");
        
        // Reset any stuck visual effects
        ResetAvatarVisuals();
        
        // Re-enable action buttons if it's player's turn
        if (!battleEnded && currentBattle != null && currentBattle.isActive && currentBattle.currentTurn == "player")
        {
            SetActionButtonsEnabled(true);
        }
        
        // Force a UI update after animations to refresh everything
        UpdateUI();
    }
    
    private System.Collections.IEnumerator ShowEnemyTurnDelay() 
    {
        Debug.Log("*** ENEMY TURN SEQUENCE STARTED ***");
        
        // Show "Enemy Turn" status with animation
        AnimateBattleText("Battle Active - Enemy Turn");
        
        // Shorter wait before enemy attacks
        Debug.Log("Enemy turn: Waiting 0.6 seconds before attack");
        yield return new WaitForSeconds(0.6f);
        
        // 1. Enemy attacks (grow/pulse)
        if (enemyAvatarImage != null)
        {
            Debug.Log("Starting ENEMY attack animation");
            yield return StartCoroutine(AttackAnimation(enemyAvatarImage));
        }
        
        // 2. Player gets hurt (red flash/shake)
        if (playerAvatarImage != null)
        {
            Debug.Log("Starting PLAYER hurt animation");
            yield return StartCoroutine(HurtAnimation(playerAvatarImage));
        }
        
        // Very brief pause before returning to player turn
        Debug.Log("Enemy turn: Brief 0.3 second pause");
        yield return new WaitForSeconds(0.3f);
        
        Debug.Log("*** ENEMY TURN SEQUENCE COMPLETE ***");
        
        // 3. Back to player turn with animation
        if (currentBattle != null && currentBattle.isActive) 
        {
            AnimateBattleText("Battle Active - Your Turn");
        }
    }

    private void HideBattlePanel()
    {
        if (battlePanel != null)
        {
            battlePanel.SetActive(false);
        }
        currentBattle = null;
    }

    // Button methods
    // public void StartNewBattle() 
    // {
    //     #if UNITY_WEBGL && !UNITY_EDITOR
    //         StartBattle();
    //     #endif
    // }

    // public void PerformAttack() 
    // {
    //     if (currentBattle != null && currentBattle.isActive) 
    //     {
    //         #if UNITY_WEBGL && !UNITY_EDITOR
    //             BattleAction(currentBattle.battleId, "attack");
    //         #endif
    //     }
    // }


    // Force update method
    public void ForceUpdate()
    {
        UpdateUI();
    }

    public void TestMessage(string testData)
    {
        Debug.Log("*** TEST MESSAGE RECEIVED IN UNITY! ***");
        Debug.Log("Test data: " + testData);
    }
    
    // Manual test method to check avatar loading
    public void TestAvatarLoading()
    {
        Debug.Log("Testing avatar loading...");
        
        // Debug what avatar URLs we actually have
        if (playerManager != null && playerManager.currentPlayer != null)
        {
            Debug.Log($"Real player avatar URL: '{playerManager.currentPlayer.avatarUrl}'");
        }
        else
        {
            Debug.LogWarning("PlayerManager or currentPlayer is null!");
        }
        
        if (currentBattle != null && currentBattle.enemy != null)
        {
            Debug.Log($"Real enemy avatar URL: '{currentBattle.enemy.avatarUrl}'");
        }
        else
        {
            Debug.LogWarning("currentBattle or enemy is null!");
        }
        
        LoadPlayerAvatar(); // Try the normal method
        LoadEnemyAvatar();  // And enemy method
    }
    
    // Force reload avatars (clears existing sprites first)
    public void ForceReloadAvatars()
    {
        Debug.Log("Force reloading avatars...");
        
        // Clear existing sprites
        if (playerAvatarImage != null) playerAvatarImage.sprite = null;
        if (enemyAvatarImage != null) enemyAvatarImage.sprite = null;
        
        // Force reload
        LoadPlayerAvatar();
        LoadEnemyAvatar();
    }
    
    // Avatar Loading Methods (using fresh avatar URLs like LoadAvatar.cs)
    private void LoadPlayerAvatar()
    {
        if (playerAvatarImage != null)
        {
            string avatarUrl = "";
            
            // Try multiple methods to get the avatar URL
            #if UNITY_WEBGL && !UNITY_EDITOR
                try 
                {
                    System.IntPtr ptr = GetUserAvatar();
                    avatarUrl = System.Runtime.InteropServices.Marshal.PtrToStringUTF8(ptr);
                    Debug.Log($"GetUserAvatar() returned: '{avatarUrl}'");
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"Error calling GetUserAvatar(): {e.Message}");
                }
            #else
                Debug.Log("Editor mode - using fallback avatar");
                avatarUrl = "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfNDhhM2EwNDI0Nzg0N2VkMzUwOGI4YjRjZjdlNzIwMjViNDY5NTcwMl8z_rare_2ac1bb56-63fc-4837-8cde-c443fb602a3b.png";
            #endif
            
            // Fallback to player data avatar URL if GetUserAvatar fails
            if (string.IsNullOrEmpty(avatarUrl) && playerManager != null && playerManager.currentPlayer != null)
            {
                avatarUrl = playerManager.currentPlayer.avatarUrl;
                Debug.Log($"Fallback to player data avatar URL: '{avatarUrl}'");
            }
            
            Debug.Log($"Final player avatar URL: '{avatarUrl}'");
            
            if (!string.IsNullOrEmpty(avatarUrl))
            {
                StartCoroutine(LoadAvatarCoroutine(avatarUrl, playerAvatarImage, "Player"));
            }
            else
            {
                Debug.LogWarning("All avatar URL methods failed - no avatar to load!");
            }
        }
        else
        {
            Debug.LogWarning("playerAvatarImage is null!");
        }
    }
    
    private void LoadEnemyAvatar()
    {
        if (currentBattle != null && currentBattle.enemy != null && enemyAvatarImage != null)
        {
            string avatarUrl = currentBattle.enemy.avatarUrl;
            Debug.Log($"Enemy avatar URL: '{avatarUrl}'");
            
            if (!string.IsNullOrEmpty(avatarUrl))
            {
                StartCoroutine(LoadAvatarCoroutine(avatarUrl, enemyAvatarImage, "Enemy"));
            }
            else
            {
                Debug.LogWarning("Enemy avatar URL is null or empty!");
            }
        }
        else
        {
            Debug.LogWarning("currentBattle, enemy, or enemyAvatarImage is null!");
        }
    }
    
    private IEnumerator LoadAvatarCoroutine(string url, Image targetImage, string avatarType)
    {
        Debug.Log($"Loading {avatarType} avatar from: {url}");
        
        if (string.IsNullOrEmpty(url))
        {
            Debug.LogWarning($"{avatarType} avatar URL is empty!");
            yield break;
        }

        using (UnityWebRequest uwr = UnityWebRequestTexture.GetTexture(url))
        {
            yield return uwr.SendWebRequest();

            if (uwr.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"{avatarType} avatar load failed: " + uwr.error);
                yield break;
            }

            Texture2D tex = DownloadHandlerTexture.GetContent(uwr);

            // Convert to Sprite for Image
            Sprite sprite = Sprite.Create(tex,
                new Rect(0, 0, tex.width, tex.height),
                new Vector2(0.5f, 0.5f));

            targetImage.sprite = sprite;
            
            // Normalize avatar size while preserving aspect ratio
            targetImage.preserveAspect = true;
            
            // Scale avatar to fit the Unity object size while preserving aspect ratio
            RectTransform rectTransform = targetImage.GetComponent<RectTransform>();
            if (rectTransform != null)
            {
                // Get the container size (your 250x420 Unity object)
                Vector2 containerSize = rectTransform.sizeDelta;
                
                // If container size is zero, use the parent size
                if (containerSize.x == 0 || containerSize.y == 0)
                {
                    RectTransform parentRect = rectTransform.parent as RectTransform;
                    if (parentRect != null)
                    {
                        containerSize = parentRect.rect.size;
                    }
                }
                
                Debug.Log($"{avatarType} avatar will fit container size: {containerSize.x}x{containerSize.y}");
                
                // Let preserveAspect handle the scaling within your container
                // No need to override sizeDelta - Unity will handle it
            }
            
            // Flip enemy avatar to face left (towards player) - only once
            if (avatarType == "Enemy" && !enemyAvatarFlipped)
            {
                Vector3 scale = targetImage.transform.localScale;
                scale.x = -Mathf.Abs(scale.x); // Make X scale negative to flip horizontally
                targetImage.transform.localScale = scale;
                enemyAvatarFlipped = true;
                Debug.Log($"Enemy avatar flipped to face left");
            }
            
            Debug.Log($"{avatarType} avatar loaded successfully with preserved aspect ratio!");
        }
    }
    
    // Battle Animation Methods
    private System.Collections.IEnumerator AttackAnimation(Image attackerImage)
    {
        if (attackerImage == null) 
        {
            Debug.LogWarning("AttackAnimation: attackerImage is null!");
            yield break;
        }
        
        string imageName = attackerImage.name;
        Debug.Log($"*** ATTACK ANIMATION STARTED for {imageName} ***");
        
        Vector3 originalScale = attackerImage.transform.localScale;
        Color originalColor = attackerImage.color;
        
        // Attack animation: fast pulse, no brightness flash
        float animationTime = 0.5f; // Faster animation
        float elapsed = 0f;
        
        while (elapsed < animationTime)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / animationTime;
            
            // Fast pulse scale (grow then shrink) - reduced scale
            float scaleMultiplier = 1f + (Mathf.Sin(progress * Mathf.PI * 3) * 0.12f); // Faster pulse, subtle scale
            attackerImage.transform.localScale = originalScale * scaleMultiplier;
            
            // Keep original color (no brightness flash)
            attackerImage.color = originalColor;
            
            yield return null;
        }
        
        // Reset to original
        attackerImage.transform.localScale = originalScale;
        attackerImage.color = originalColor;
        
        Debug.Log($"*** ATTACK ANIMATION COMPLETED for {imageName} ***");
    }
    
    private System.Collections.IEnumerator HurtAnimation(Image hurtImage)
    {
        if (hurtImage == null) 
        {
            Debug.LogWarning("HurtAnimation: hurtImage is null!");
            yield break;
        }
        
        string imageName = hurtImage.name;
        Debug.Log($"*** HURT ANIMATION STARTED for {imageName} ***");
        
        Color originalColor = hurtImage.color;
        Vector3 originalPosition = hurtImage.transform.localPosition;
        
        // Hurt animation: slower, more deliberate blink and shake (similar to heal speed)
        float animationTime = 1.2f; // Longer duration, closer to heal
        float elapsed = 0f;
        
        while (elapsed < animationTime)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / animationTime;
            
            // Slower, more deliberate blink effect (similar to heal rhythm)
            float blinkIntensity = Mathf.Sin(progress * Mathf.PI * 2.5f); // Slower blinks
            float alpha = 0.4f + (Mathf.Abs(blinkIntensity) * 0.6f); // Fade between 40% and 100%
            Color blinkColor = originalColor;
            blinkColor.a = alpha;
            hurtImage.color = blinkColor;
            
            // Gentler shake effect
            float shakeIntensity = (1f - progress) * 2f; // Even gentler shake
            Vector3 shake = new Vector3(
                UnityEngine.Random.Range(-shakeIntensity, shakeIntensity),
                UnityEngine.Random.Range(-shakeIntensity, shakeIntensity),
                0
            );
            hurtImage.transform.localPosition = originalPosition + shake;
            
            yield return null;
        }
        
        // Reset to original
        hurtImage.color = originalColor;
        hurtImage.transform.localPosition = originalPosition;
        
        Debug.Log($"*** HURT ANIMATION COMPLETED for {imageName} ***");
    }
    
    // Debug method to manually trigger animations (for testing)
    public void TestPlayerAttack()
    {
        StartCoroutine(HandlePlayerActionSequence("attack", false));
    }
    
    // Force reload avatars (useful for debugging)
    public void ForceReloadPlayerAvatar()
    {
        Debug.Log("Force reloading player avatar...");
        loadedPlayerUsername = ""; // Reset tracking
        if (playerAvatarImage != null) playerAvatarImage.sprite = null;
        LoadPlayerAvatar();
    }
    
    // Reset any stuck visual effects on avatars
    private void ResetAvatarVisuals()
    {
        if (playerAvatarImage != null)
        {
            playerAvatarImage.color = Color.white;
            playerAvatarImage.transform.localPosition = Vector3.zero;
            playerAvatarImage.transform.localScale = Vector3.one;
        }
        
        if (enemyAvatarImage != null)
        {
            enemyAvatarImage.color = Color.white;
            enemyAvatarImage.transform.localPosition = Vector3.zero;
            
            // Preserve the flip state when resetting scale
            Vector3 resetScale = Vector3.one;
            if (enemyAvatarFlipped)
            {
                resetScale.x = -1f; // Keep it flipped
            }
            enemyAvatarImage.transform.localScale = resetScale;
        }
        
        Debug.Log("Avatar visuals reset to default state");
    }
    
    // Enable/disable action buttons
    private void SetActionButtonsEnabled(bool enabled)
    {
        SetButtonState(attackButton, enabled, "Attack");
        SetButtonState(defendButton, enabled, "Defend");
        SetButtonState(healButton, enabled, "Heal");
        
        // Special button has additional SP requirement check
        UpdateSpecialButtonState(enabled);
        
        // If disabling, also reset any stuck visual effects immediately
        if (!enabled)
        {
            ResetAvatarVisuals();
        }
    }
    
    // Update special button based on SP availability
    private void UpdateSpecialButtonState(bool battleActive)
    {
        if (specialButton == null) return;
        
        bool hasEnoughSP = false;
        
        if (currentBattle != null && currentBattle.player != null)
        {
            // Calculate SP cost (80% of max SP)
            int spCost = Mathf.FloorToInt(currentBattle.player.stats.maxSpecialPoints * 0.8f);
            hasEnoughSP = currentBattle.player.stats.specialPoints >= spCost;
            
            Debug.Log($"Special button check: SP {currentBattle.player.stats.specialPoints}/{currentBattle.player.stats.maxSpecialPoints}, Cost: {spCost}, Enabled: {battleActive && hasEnoughSP}");
        }
        
        SetButtonState(specialButton, battleActive && hasEnoughSP, "Special");
    }
    
    // Helper method to set individual button state with text color
    private void SetButtonState(Button button, bool enabled, string buttonName)
    {
        if (button != null)
        {
            button.interactable = enabled;
            
            // Update text color based on state
            TextMeshProUGUI buttonText = button.GetComponentInChildren<TextMeshProUGUI>();
            if (buttonText != null)
            {
                buttonText.color = enabled ? Color.white : new Color(0.5f, 0.5f, 0.5f, 1f); // Grey when disabled
            }
            
            Debug.Log($"{buttonName} button {(enabled ? "enabled" : "disabled")}");
        }
    }
    
    // Flash progress bars when they update (with overlap protection)
    private void FlashProgressBar(Slider slider, ref bool flashingFlag)
    {
        if (slider != null && !flashingFlag)
        {
            StartCoroutine(FlashProgressBarCoroutine(slider, flashingFlag));
        }
    }
    
    private System.Collections.IEnumerator FlashProgressBarCoroutine(Slider slider, bool flashingFlag)
    {
        Image fillImage = slider.fillRect?.GetComponent<Image>();
        if (fillImage == null) yield break;
        
        // Set flag to prevent overlapping flashes
        if (slider == playerHealthSlider) playerHealthFlashing = true;
        else if (slider == playerSpecialSlider) playerSpecialFlashing = true;
        else if (slider == playerExperienceSlider) playerExperienceFlashing = true;
        else if (slider == enemyHealthSlider) enemyHealthFlashing = true;
        
        Color originalColor = fillImage.color;
        Color flashColor = Color.white;
        
        // Longer flash to white and back
        float flashTime = 0.35f;
        float elapsed = 0f;
        
        while (elapsed < flashTime)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / flashTime;
            
            // Flash to white then back to original
            fillImage.color = Color.Lerp(flashColor, originalColor, progress);
            yield return null;
        }
        
        // Ensure it's back to original color
        fillImage.color = originalColor;
        
        // Clear flag
        if (slider == playerHealthSlider) playerHealthFlashing = false;
        else if (slider == playerSpecialSlider) playerSpecialFlashing = false;
        else if (slider == playerExperienceSlider) playerExperienceFlashing = false;
        else if (slider == enemyHealthSlider) enemyHealthFlashing = false;
    }
    
    // Animate battle text changes with fade effect
    private void AnimateBattleText(string newText)
    {
        if (battleStatusText != null)
        {
            StartCoroutine(AnimateBattleTextCoroutine(newText));
        }
    }
    
    private System.Collections.IEnumerator AnimateBattleTextCoroutine(string newText)
    {
        if (battleStatusText == null) yield break;
        
        Color originalColor = battleStatusText.color;
        
        // Fade out
        float fadeTime = 0.2f;
        float elapsed = 0f;
        
        while (elapsed < fadeTime)
        {
            elapsed += Time.deltaTime;
            float alpha = 1f - (elapsed / fadeTime);
            battleStatusText.color = new Color(originalColor.r, originalColor.g, originalColor.b, alpha);
            yield return null;
        }
        
        // Change text
        battleStatusText.text = newText;
        
        // Fade in
        elapsed = 0f;
        while (elapsed < fadeTime)
        {
            elapsed += Time.deltaTime;
            float alpha = elapsed / fadeTime;
            battleStatusText.color = new Color(originalColor.r, originalColor.g, originalColor.b, alpha);
            yield return null;
        }
        
        // Ensure full opacity
        battleStatusText.color = originalColor;
    }
    
    // Process enemy turn with delay
    private void ProcessEnemyTurnDelayed()
    {
        if (currentBattle != null && currentBattle.isActive && currentBattle.currentTurn == "enemy")
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
                Debug.Log("Processing enemy turn for battle: " + currentBattle.battleId);
                ProcessEnemyTurn(currentBattle.battleId);
            #else
                Debug.Log("Enemy turn processing only works in WebGL builds");
            #endif
        }
    }
    
    // Called from JavaScript when enemy turn completes
    public void OnEnemyTurn(string jsonData) 
    {
        Debug.Log("*** ENEMY TURN COMPLETED ***");
        Debug.Log("Enemy turn data: " + jsonData);
        
        try 
        {
            var response = JsonUtility.FromJson<BattleActionResponse>(jsonData);
            
            if (response.status == "success" && response.battleState != null) 
            {
                currentBattle = response.battleState;
                
                // Update PlayerManager with new player data after enemy turn
                if (playerManager != null && currentBattle.player != null) 
                {
                    playerManager.currentPlayer = currentBattle.player;
                    Debug.Log($"After enemy turn - Player HP: {currentBattle.player.stats.hitPoints}/{currentBattle.player.stats.maxHitPoints}");
                }
                
                UpdateUI();
                
                // Show enemy turn animation
                AnimateBattleText("Enemy Turn Complete");
                
                // Re-enable action buttons if it's player's turn again
                if (!response.battleEnded && currentBattle.isActive && currentBattle.currentTurn == "player")
                {
                    SetActionButtonsEnabled(true);
                    Debug.Log("Back to player turn - buttons enabled");
                }
                
                if (response.battleEnded) 
                {
                    Debug.Log($"Battle ended after enemy turn! Winner: {response.winner}");
                    
                    // Show battle results screen
                    ShowBattleResults(response.winner, response.rewards);
                    
                    inActiveBattle = false; // Re-enable auto-updates after battle
                }
            }
        }
        catch (System.Exception e) 
        {
            Debug.LogError("Error parsing enemy turn data: " + e.Message);
        }
    }
    
    // Public method for other scripts to check if battle is active
    public bool IsInActiveBattle()
    {
        return inActiveBattle && currentBattle != null && currentBattle.isActive;
    }
    
    // Show battle results screen with rewards
    private void ShowBattleResults(string winner, BattleRewards rewards)
    {
        if (battleResultsPanel == null) 
        {
            Debug.LogWarning("Battle results panel not assigned!");
            // Fallback to old behavior
            string winnerText = winner == "player" ? "Victory!" : "Defeat!";
            AnimateBattleText($"Battle Ended - {winnerText}");
            Invoke("HideBattlePanel", 3f);
            return;
        }
        
        // Set up results content
        bool isVictory = winner == "player";
        
        // Title and colors
        if (resultsTitle != null)
        {
            resultsTitle.text = isVictory ? "VICTORY!" : "DEFEAT!";
            resultsTitle.color = isVictory ? victoryColor : defeatColor;
        }
        
        // Subtitle (enemy name)
        if (resultsSubtitle != null && currentBattle != null)
        {
            if (isVictory)
            {
                resultsSubtitle.text = $"Defeated {currentBattle.enemy.username}!";
            }
            else
            {
                resultsSubtitle.text = $"Defeated by {currentBattle.enemy.username}";
            }
        }
        
        // Copy enemy avatar to results screen
        if (resultsEnemyAvatar != null && enemyAvatarImage != null && currentBattle != null)
        {
            // Copy the sprite and preserve aspect ratio
            resultsEnemyAvatar.sprite = enemyAvatarImage.sprite;
            resultsEnemyAvatar.color = Color.white; // Reset any battle effects
            resultsEnemyAvatar.transform.localScale = Vector3.one; // Reset scale
            
            // For defeat, maybe make the enemy avatar slightly larger/more prominent
            if (!isVictory)
            {
                resultsEnemyAvatar.transform.localScale = Vector3.one * 1.1f;
            }
            
            Debug.Log($"Copied enemy avatar for {currentBattle.enemy.username} to results screen");
        }
        
        // Rewards (only show for victory)
        if (isVictory && rewards != null)
        {
            if (expGainedText != null)
            {
                expGainedText.text = $"+{rewards.experience} EXP";
                expGainedText.gameObject.SetActive(true);
            }
            
            if (goldGainedText != null)
            {
                goldGainedText.text = $"+{rewards.gold} Gold";
                goldGainedText.gameObject.SetActive(true);
            }
            
            if (levelUpText != null)
            {
                if (rewards.levelUp)
                {
                    levelUpText.text = "LEVEL UP!";
                    levelUpText.color = levelUpColor;
                    levelUpText.gameObject.SetActive(true);
                }
                else
                {
                    levelUpText.gameObject.SetActive(false);
                }
            }
        }
        else
        {
            // Hide reward texts for defeat
            if (expGainedText != null) expGainedText.gameObject.SetActive(false);
            if (goldGainedText != null) goldGainedText.gameObject.SetActive(false);
            if (levelUpText != null) levelUpText.gameObject.SetActive(false);
        }
        
        // Disable battle buttons since battle is over
        SetActionButtonsEnabled(false);
        Debug.Log("Battle ended - all action buttons disabled");
        
        // Show results with scale-in animation
        Debug.Log($"Showing battle results panel for {(isVictory ? "VICTORY" : "DEFEAT")}");
        StartCoroutine(ShowResultsAnimation(isVictory));
    }
    
    // Animate the results screen appearing
    private System.Collections.IEnumerator ShowResultsAnimation(bool isVictory)
    {
        if (battleResultsPanel == null) yield break;
        
        // Start hidden and scaled down
        Debug.Log("Activating battle results panel");
        battleResultsPanel.SetActive(true);
        
        if (resultsBackground != null)
        {
            resultsBackground.transform.localScale = Vector3.zero;
        }
        
        // Hide enemy avatar initially for dramatic reveal
        if (resultsEnemyAvatar != null)
        {
            resultsEnemyAvatar.color = new Color(1f, 1f, 1f, 0f); // Transparent
        }
        
        // Scale in animation
        float duration = 0.5f;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            
            // Smooth scale-in with slight overshoot
            float scale = Mathf.LerpUnclamped(0f, 1f, 
                Mathf.SmoothStep(0f, 1.1f, progress));
            
            if (progress > 0.8f)
            {
                // Settle back to 1.0 in the last 20%
                scale = Mathf.Lerp(1.1f, 1f, (progress - 0.8f) / 0.2f);
            }
            
            if (resultsBackground != null)
            {
                resultsBackground.transform.localScale = Vector3.one * scale;
            }
            
            yield return null;
        }
        
        // Ensure final scale is exactly 1
        if (resultsBackground != null)
        {
            resultsBackground.transform.localScale = Vector3.one;
        }
        
        // Animate enemy avatar appearing
        if (resultsEnemyAvatar != null)
        {
            yield return StartCoroutine(AnimateEnemyAvatarReveal(isVictory));
        }
        
        // Enable continue button
        if (continueButton != null)
        {
            continueButton.interactable = true;
        }
    }
    
    // Animate the enemy avatar appearing in results
    private System.Collections.IEnumerator AnimateEnemyAvatarReveal(bool isVictory)
    {
        if (resultsEnemyAvatar == null) yield break;
        
        float duration = 0.4f;
        float elapsed = 0f;
        
        // Start transparent
        Color targetColor = Color.white;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            
            // Fade in
            float alpha = Mathf.Lerp(0f, 1f, progress);
            resultsEnemyAvatar.color = new Color(targetColor.r, targetColor.g, targetColor.b, alpha);
            
            // For victory, add a subtle pulse effect
            if (isVictory)
            {
                float pulse = 1f + (Mathf.Sin(progress * Mathf.PI * 3) * 0.1f);
                resultsEnemyAvatar.transform.localScale = Vector3.one * pulse;
            }
            
            yield return null;
        }
        
        // Final state
        resultsEnemyAvatar.color = targetColor;
        
        if (isVictory)
        {
            resultsEnemyAvatar.transform.localScale = Vector3.one;
        }
        else
        {
            // For defeat, keep the enemy slightly larger
            resultsEnemyAvatar.transform.localScale = Vector3.one * 1.1f;
        }
    }
    
    // Called by continue button
    public void OnContinueButtonPressed()
    {
        StartCoroutine(HideResultsAnimation());
    }
    
    // Animate the results screen disappearing
    private System.Collections.IEnumerator HideResultsAnimation()
    {
        if (battleResultsPanel == null) yield break;
        
        // Disable continue button
        if (continueButton != null)
        {
            continueButton.interactable = false;
        }
        
        // Scale out animation
        float duration = 0.3f;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            
            float scale = Mathf.Lerp(1f, 0f, progress);
            
            if (resultsBackground != null)
            {
                resultsBackground.transform.localScale = Vector3.one * scale;
            }
            
            yield return null;
        }
        
        // Hide the panel
        Debug.Log("Deactivating battle results panel");
        battleResultsPanel.SetActive(false);
        
        // Hide battle panel
        if (battlePanel != null)
        {
            battlePanel.SetActive(false);
        }
        
        // Reset scale for next time
        if (resultsBackground != null)
        {
            resultsBackground.transform.localScale = Vector3.one;
        }
    }

    
    // Get player action-specific animation
    private System.Collections.IEnumerator GetPlayerActionAnimation(string action, Image avatarImage)
    {
        switch (action.ToLower())
        {
            case "attack":
                yield return StartCoroutine(AttackAnimation(avatarImage));
                break;
            case "defend":
                yield return StartCoroutine(DefendAnimation(avatarImage));
                break;
            case "heal":
                yield return StartCoroutine(HealAnimation(avatarImage));
                break;
            case "special":
                yield return StartCoroutine(SpecialAttackAnimation(avatarImage));
                break;
            default:
                yield return StartCoroutine(AttackAnimation(avatarImage)); // Fallback
                break;
        }
    }
    
    // Get enemy reaction animation
    private System.Collections.IEnumerator GetEnemyReactionAnimation(string playerAction, Image enemyImage)
    {
        switch (playerAction.ToLower())
        {
            case "attack":
                yield return StartCoroutine(HurtAnimation(enemyImage));
                break;
            case "special":
                yield return StartCoroutine(SpecialHurtAnimation(enemyImage));
                break;
            default:
                // No reaction for defend/heal
                yield return null;
                break;
        }
    }
    
    // Action-specific animations (AttackAnimation already exists above, using that one)
    
    private System.Collections.IEnumerator DefendAnimation(Image image)
    {
        // Grow slightly and turn white/shine
        Vector3 originalScale = image.transform.localScale;
        Color originalColor = image.color;
        Color defendColor = Color.white;
        
        float duration = 0.5f;
        float elapsed = 0f;
        
        // Grow and turn white
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            float scale = Mathf.Lerp(1f, 1.1f, progress);
            Color currentColor = Color.Lerp(originalColor, defendColor, progress * 0.7f);
            
            image.transform.localScale = originalScale * scale;
            image.color = currentColor;
            yield return null;
        }
        
        // Hold for a moment
        yield return new WaitForSeconds(0.3f);
        
        // Return to normal
        elapsed = 0f;
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            float scale = Mathf.Lerp(1.1f, 1f, progress);
            Color currentColor = Color.Lerp(defendColor, originalColor, progress);
            
            image.transform.localScale = originalScale * scale;
            image.color = currentColor;
            yield return null;
        }
        
        image.transform.localScale = originalScale;
        image.color = originalColor;
    }
    
    private System.Collections.IEnumerator HealAnimation(Image image)
    {
        // Turn green and pulse gently
        Vector3 originalScale = image.transform.localScale;
        Color originalColor = image.color;
        Color healColor = Color.green;
        
        float duration = 0.4f;
        
        // Pulse green 3 times
        for (int i = 0; i < 3; i++)
        {
            float elapsed = 0f;
            
            // Fade to green
            while (elapsed < duration / 2)
            {
                elapsed += Time.deltaTime;
                float progress = elapsed / (duration / 2);
                Color currentColor = Color.Lerp(originalColor, healColor, progress * 0.8f);
                image.color = currentColor;
                yield return null;
            }
            
            // Fade back
            elapsed = 0f;
            while (elapsed < duration / 2)
            {
                elapsed += Time.deltaTime;
                float progress = elapsed / (duration / 2);
                Color currentColor = Color.Lerp(healColor, originalColor, progress);
                image.color = currentColor;
                yield return null;
            }
        }
        
        image.color = originalColor;
    }
    
    private System.Collections.IEnumerator SpecialAttackAnimation(Image image)
    {
        // Dramatic scale and color change
        Vector3 originalScale = image.transform.localScale;
        Color originalColor = image.color;
        Color specialColor = Color.yellow;
        
        float duration = 0.3f;
        float elapsed = 0f;
        
        // Dramatic scale up with yellow glow
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            float scale = Mathf.Lerp(1f, 1.3f, progress);
            Color currentColor = Color.Lerp(originalColor, specialColor, progress);
            
            image.transform.localScale = originalScale * scale;
            image.color = currentColor;
            yield return null;
        }
        
        // Hold briefly
        yield return new WaitForSeconds(0.1f);
        
        // Quick return
        elapsed = 0f;
        duration = 0.2f;
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            float scale = Mathf.Lerp(1.3f, 1f, progress);
            Color currentColor = Color.Lerp(specialColor, originalColor, progress);
            
            image.transform.localScale = originalScale * scale;
            image.color = currentColor;
            yield return null;
        }
        
        image.transform.localScale = originalScale;
        image.color = originalColor;
    }
    
    // HurtAnimation already exists above - using that one (but need to modify it for no color)
    
    private System.Collections.IEnumerator SpecialHurtAnimation(Image image)
    {
        // Intense red flash for special attacks
        Vector3 originalPosition = image.transform.localPosition;
        Color originalColor = image.color;
        Color hurtColor = new Color(1f, 0f, 0f, 1f); // Bright red
        
        float duration = 0.4f;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / duration;
            
            // Intense red flash
            Color currentColor = Color.Lerp(hurtColor, originalColor, progress);
            image.color = currentColor;
            
            // More intense shake
            float shakeAmount = (1f - progress) * 8f;
            Vector3 shakeOffset = new Vector3(
                Random.Range(-shakeAmount, shakeAmount),
                Random.Range(-shakeAmount, shakeAmount),
                0f
            );
            image.transform.localPosition = originalPosition + shakeOffset;
            
            yield return null;
        }
        
        image.transform.localPosition = originalPosition;
        image.color = originalColor;
    }


}

// Additional response classes for battle data
[System.Serializable]
public class BattleStartResponse
{
    public string status;
    public BattleState battleState;
    public string message;
}

[System.Serializable]
public class BattleState
{
    public string battleId;
    public PlayerCharacter player;
    public PlayerCharacter enemy;
    public string currentTurn;
    public int turnNumber;
    public bool isActive;
    public string winner;
    public string createdAt;
}

[System.Serializable]
public class BattleRewards
{
    public int experience;
    public int gold;
    public bool levelUp;
}

[System.Serializable]
public class BattleActionResponse
{
    public string status;
    public BattleState battleState;
    public bool battleEnded;
    public string winner;
    public BattleRewards rewards;
    public string message;
}
