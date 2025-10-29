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
    
    // Duplicate extern declarations removed - using the ones at the top of the class
    
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
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "attack");
            #endif
        }
    }
    
    public void PerformDefend() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "defend");
            #endif
        }
    }
    
    public void PerformSpecial() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
                BattleAction(currentBattle.battleId, "special");
            #endif
        }
    }
    
    public void PerformHeal() 
    {
        if (currentBattle != null && currentBattle.isActive) 
        {
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
                }
                
                // Show player turn immediately and trigger attack animation
                AnimateBattleText("Player Turn Complete");
                
                UpdateUI();
                
                // Only start animation sequence if not already playing
                if (!isPlayingBattleAnimation)
                {
                    StartCoroutine(HandlePlayerAttackSequence(response.battleEnded));
                }
                else
                {
                    Debug.LogWarning("Animation already playing - skipping new animation sequence");
                }
                
                // Don't start enemy turn delay here - it's handled in the sequence
                
                if (response.battleEnded) 
                {
                    Debug.Log($"Battle ended! Winner: {response.winner}");
                    
                    if (response.rewards != null) 
                    {
                        Debug.Log($"Rewards: {response.rewards.experience} XP, {response.rewards.gold} Gold");
                        
                        if (response.rewards.levelUp) 
                        {
                            Debug.Log("LEVEL UP!");
                        }
                    }
                    
                    string winner = response.winner == "player" ? "Victory!" : "Defeat!";
                    AnimateBattleText($"Battle Ended - {winner}");
                    
                    // Hide battle panel after a delay
                    Invoke("HideBattlePanel", 3f);
                }
            }
        }
        catch (System.Exception e) 
        {
            Debug.LogError("Error parsing battle action data: " + e.Message);
        }
    }
    
    // Handle the complete player attack sequence
    private System.Collections.IEnumerator HandlePlayerAttackSequence(bool battleEnded)
    {
        Debug.Log("*** PLAYER ATTACK SEQUENCE STARTED ***");
        isPlayingBattleAnimation = true; // Disable auto-updates during animation
        
        // Disable action buttons during animations
        SetActionButtonsEnabled(false);
        
        // 1. Player attacks (grow/pulse)
        if (playerAvatarImage != null)
        {
            Debug.Log("Starting PLAYER attack animation");
            yield return StartCoroutine(AttackAnimation(playerAvatarImage));
        }
        
        // 2. Enemy gets hurt (red flash/shake)  
        if (enemyAvatarImage != null)
        {
            Debug.Log("Starting ENEMY hurt animation");
            yield return StartCoroutine(HurtAnimation(enemyAvatarImage));
        }
        
        Debug.Log($"Player attack sequence complete. Battle ended: {battleEnded}");
        
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
        
        // Hurt animation: blink and shake (no red)
        float animationTime = 0.8f; // Slightly shorter
        float elapsed = 0f;
        
        while (elapsed < animationTime)
        {
            elapsed += Time.deltaTime;
            float progress = elapsed / animationTime;
            
            // Blink effect (fade in/out) - slower blinks
            float blinkIntensity = Mathf.Sin(progress * Mathf.PI * 4); // 2 blinks, slower
            float alpha = 0.3f + (Mathf.Abs(blinkIntensity) * 0.7f); // Fade between 30% and 100%
            Color blinkColor = originalColor;
            blinkColor.a = alpha;
            hurtImage.color = blinkColor;
            
            // Shake effect (slightly reduced intensity)
            float shakeIntensity = (1f - progress) * 3f; // Reduced from 5f to 3f
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
        StartCoroutine(HandlePlayerAttackSequence(false));
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
        SetButtonState(specialButton, enabled, "Special");
        SetButtonState(healButton, enabled, "Heal");
        
        // If disabling, also reset any stuck visual effects immediately
        if (!enabled)
        {
            ResetAvatarVisuals();
        }
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
