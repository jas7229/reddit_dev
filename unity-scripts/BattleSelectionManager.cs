using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Runtime.InteropServices;
using System.Collections;

public class BattleSelectionManager : MonoBehaviour 
{
    // External JavaScript function declarations
    [DllImport("__Internal")]
    private static extern void GetEnemyPreview(string difficulty, bool reroll);
    
    [DllImport("__Internal")]
    private static extern void StartBattleWithDifficulty(string difficulty);
    
    [Header("Battle Selection UI")]
    public GameObject battleSelectionPanel; // Main selection screen panel
    public Button easyButton;
    public Button mediumButton;
    public Button hardButton;
    
    [Header("Enemy Preview UI")]
    public GameObject enemyPreviewPanel; // Enemy preview section
    public Image enemyPreviewAvatar;
    public TextMeshProUGUI enemyNameText;
    public TextMeshProUGUI enemyLevelText;
    public TextMeshProUGUI enemyStatsText; // "ATK: 15 DEF: 8 HP: 120/120"
    public TextMeshProUGUI difficultyText; // "EASY", "MEDIUM", "HARD"
    
    [Header("Reward Preview UI")]
    public TextMeshProUGUI expectedExpText; // "+75 EXP"
    public TextMeshProUGUI expectedGoldText; // "+45 Gold"
    public TextMeshProUGUI riskLevelText; // "Low Risk", "Balanced", "High Risk"
    
    [Header("Action Buttons")]
    public Button rerollButton; // "Reroll Enemy"
    public Button confirmBattleButton; // "Start Battle!"
    public Button backButton; // "Back" to close selection
    
    [Header("Difficulty Colors")]
    public Color easyColor = new Color(0.4f, 0.8f, 0.4f, 1f); // Green
    public Color mediumColor = new Color(0.8f, 0.8f, 0.4f, 1f); // Yellow
    public Color hardColor = new Color(0.8f, 0.4f, 0.4f, 1f); // Red
    
    [Header("Manager References")]
    public BattleUIManager battleUIManager; // Reference to battle system
    
    // Current selection state
    private string selectedDifficulty = "medium";
    private EnemyPreviewData currentEnemy;
    private bool isLoadingPreview = false;
    private bool hasShownPreviewPanel = false; // Track if panel has been shown before
    
    void Start()
    {
        Debug.Log("BattleSelectionManager started");
        
        // Find BattleUIManager if not assigned
        if (battleUIManager == null)
        {
            battleUIManager = FindFirstObjectByType<BattleUIManager>();
        }
        
        // Set up button listeners
        if (easyButton != null) easyButton.onClick.AddListener(() => SelectDifficulty("easy"));
        if (mediumButton != null) mediumButton.onClick.AddListener(() => SelectDifficulty("medium"));
        if (hardButton != null) hardButton.onClick.AddListener(() => SelectDifficulty("hard"));
        
        if (rerollButton != null) rerollButton.onClick.AddListener(RerollEnemy);
        if (confirmBattleButton != null) confirmBattleButton.onClick.AddListener(StartSelectedBattle);
        if (backButton != null) backButton.onClick.AddListener(CloseBattleSelection);
        
        // Hide panels initially
        if (battleSelectionPanel != null) battleSelectionPanel.SetActive(false);
        if (enemyPreviewPanel != null) enemyPreviewPanel.SetActive(false);
        
        // Set medium as default selection
        SelectDifficulty("medium");
        
        // Auto-open battle selection after a short delay (let scene load first)
        Invoke("AutoOpenBattleSelection", 1f);
    }
    
    // Automatically open battle selection when scene loads
    private void AutoOpenBattleSelection()
    {
        Debug.Log("Auto-opening battle selection screen");
        OpenBattleSelection();
    }
    
    // Public method to open battle selection (call from main menu)
    public void OpenBattleSelection()
    {
        Debug.Log("Opening battle selection screen");
        
        if (battleSelectionPanel != null)
        {
            battleSelectionPanel.SetActive(true);
            
            // Animate panel in with LeanTween
            battleSelectionPanel.transform.localScale = Vector3.zero;
            LeanTween.scale(battleSelectionPanel, Vector3.one, 0.4f)
                .setEase(LeanTweenType.easeOutBack)
                .setOvershoot(1.1f);
        }
        
        // Load initial enemy preview
        LoadEnemyPreview(selectedDifficulty, false);
    }
    
    // Close battle selection screen
    public void CloseBattleSelection()
    {
        Debug.Log("Closing battle selection screen");
        
        if (battleSelectionPanel != null)
        {
            // Animate panel out with LeanTween
            LeanTween.scale(battleSelectionPanel, Vector3.zero, 0.3f)
                .setEase(LeanTweenType.easeInBack)
                .setOnComplete(() => {
                    battleSelectionPanel.SetActive(false);
                    // Reset preview panel state so it can bounce in again next time
                    hasShownPreviewPanel = false;
                    if (enemyPreviewPanel != null)
                    {
                        enemyPreviewPanel.SetActive(false);
                    }
                });
        }
    }
    
    // Select difficulty and update UI
    public void SelectDifficulty(string difficulty)
    {
        selectedDifficulty = difficulty;
        Debug.Log($"[BattleSelection] SelectDifficulty called: {difficulty}");
        
        // Update button visual states
        UpdateDifficultyButtons();
        
        // Load enemy preview for selected difficulty
        LoadEnemyPreview(difficulty, false);
    }
    
    // Get the currently selected difficulty (for BattleUIManager)
    public string GetSelectedDifficulty()
    {
        return selectedDifficulty;
    }
    
    // Update difficulty button visual states
    private void UpdateDifficultyButtons()
    {
        // Reset all buttons to default state
        SetButtonState(easyButton, selectedDifficulty == "easy", easyColor);
        SetButtonState(mediumButton, selectedDifficulty == "medium", mediumColor);
        SetButtonState(hardButton, selectedDifficulty == "hard", hardColor);
    }
    
    // Set button visual state (selected/unselected)
    private void SetButtonState(Button button, bool isSelected, Color selectedColor)
    {
        if (button == null) return;
        
        Image buttonImage = button.GetComponent<Image>();
        TextMeshProUGUI buttonText = button.GetComponentInChildren<TextMeshProUGUI>();
        
        if (isSelected)
        {
            // Selected state
            if (buttonImage != null) buttonImage.color = selectedColor;
            if (buttonText != null) buttonText.color = Color.white;
            
            // Subtle scale animation
            LeanTween.scale(button.gameObject, Vector3.one * 1.05f, 0.2f)
                .setEase(LeanTweenType.easeOutQuad);
        }
        else
        {
            // Unselected state
            if (buttonImage != null) buttonImage.color = new Color(0.7f, 0.7f, 0.7f, 1f);
            if (buttonText != null) buttonText.color = new Color(0.8f, 0.8f, 0.8f, 1f);
            
            // Reset scale
            LeanTween.scale(button.gameObject, Vector3.one, 0.2f)
                .setEase(LeanTweenType.easeOutQuad);
        }
    }
    
    // Load enemy preview from server
    private void LoadEnemyPreview(string difficulty, bool reroll)
    {
        if (isLoadingPreview) return;
        
        isLoadingPreview = true;
        Debug.Log($"Loading enemy preview: {difficulty}, reroll: {reroll}");
        
        // Show loading state
        ShowLoadingState();
        
        #if UNITY_WEBGL && !UNITY_EDITOR
            // Call JavaScript function to get enemy preview
            StartCoroutine(GetEnemyPreviewCoroutine(difficulty, reroll));
        #else
            Debug.Log("Enemy preview only works in WebGL builds");
            // Show mock data for editor testing
            ShowMockEnemyPreview(difficulty);
            isLoadingPreview = false;
        #endif
    }
    
    // Coroutine to handle async enemy preview loading
    private IEnumerator GetEnemyPreviewCoroutine(string difficulty, bool reroll)
    {
        // This will be called by JavaScript when preview is ready
        yield return new WaitForSeconds(0.1f); // Small delay for JavaScript call
        
        #if UNITY_WEBGL && !UNITY_EDITOR
            // The actual call to JavaScript
            GetEnemyPreview(difficulty, reroll);
            
            // Timeout protection - if no response in 5 seconds, show error
            float timeout = 5f;
            float elapsed = 0f;
            
            while (isLoadingPreview && elapsed < timeout)
            {
                elapsed += Time.deltaTime;
                yield return null;
            }
            
            // If still loading after timeout, show error
            if (isLoadingPreview)
            {
                Debug.LogWarning("Enemy preview request timed out");
                isLoadingPreview = false;
                ShowErrorState();
            }
        #endif
    }
    
    // Called from JavaScript when enemy preview is received
    public void OnEnemyPreviewReceived(string jsonData)
    {
        Debug.Log("Enemy preview received: " + jsonData);
        isLoadingPreview = false; // Always reset loading state
        
        try
        {
            var response = JsonUtility.FromJson<EnemyPreviewResponse>(jsonData);
            
            if (response.status == "success" && response.enemy != null)
            {
                currentEnemy = response.enemy;
                ShowEnemyPreview(response);
            }
            else
            {
                Debug.LogError("Failed to get enemy preview: " + response.message);
                ShowErrorState();
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing enemy preview data: " + e.Message);
            ShowErrorState();
        }
    }
    
    // Reroll enemy with same difficulty
    public void RerollEnemy()
    {
        Debug.Log("Rerolling enemy");
        LoadEnemyPreview(selectedDifficulty, true);
    }
    
    // Start battle with selected enemy
    public void StartSelectedBattle()
    {
        Debug.Log($"Starting battle with {selectedDifficulty} difficulty");
        
        // Close selection screen
        CloseBattleSelection();
        
        // Start battle through BattleUIManager (which will use the selected difficulty)
        if (battleUIManager != null)
        {
            // The battle system will automatically use the difficulty we've selected
            battleUIManager.StartNewBattle();
        }
        else
        {
            Debug.LogError("BattleUIManager not found! Please assign it in the inspector.");
        }
    }
    
    // Show loading, error, and mock states
    private void ShowLoadingState()
    {
        if (enemyNameText != null) enemyNameText.text = "Loading...";
        if (enemyLevelText != null) enemyLevelText.text = "Level ?";
        if (enemyStatsText != null) enemyStatsText.text = "Loading enemy data...";
        
        // Disable action buttons during loading
        if (rerollButton != null) rerollButton.interactable = false;
        if (confirmBattleButton != null) confirmBattleButton.interactable = false;
    }
    
    private void ShowErrorState()
    {
        if (enemyNameText != null) enemyNameText.text = "Error";
        if (enemyLevelText != null) enemyLevelText.text = "Failed to load";
        if (enemyStatsText != null) enemyStatsText.text = "Could not load enemy data";
        
        // Re-enable reroll button to try again
        if (rerollButton != null) rerollButton.interactable = true;
        if (confirmBattleButton != null) confirmBattleButton.interactable = false;
    }
    
    // Display enemy preview in UI
    private void ShowEnemyPreview(EnemyPreviewResponse response)
    {
        Debug.Log($"[BattleSelection] ShowEnemyPreview called. hasShownPreviewPanel: {hasShownPreviewPanel}");
        
        if (enemyPreviewPanel != null)
        {
            enemyPreviewPanel.SetActive(true);
            
            // Only animate in if this is the very first time showing the panel
            if (!hasShownPreviewPanel)
            {
                Debug.Log("[BattleSelection] First time showing preview panel - animating in");
                // First time ever showing - animate in with bounce
                enemyPreviewPanel.transform.localScale = Vector3.zero;
                LeanTween.scale(enemyPreviewPanel, Vector3.one, 0.3f)
                    .setEase(LeanTweenType.easeOutBack);
                hasShownPreviewPanel = true;
            }
            else
            {
                Debug.Log("[BattleSelection] Preview panel already shown before - updating content only");
            }
            // All subsequent updates just change content without animation
        }
        else
        {
            Debug.LogWarning("[BattleSelection] enemyPreviewPanel is null!");
        }
        
        // Update enemy info with subtle content refresh animation
        if (enemyNameText != null) 
        {
            enemyNameText.text = response.enemy.username;
            // Subtle pulse for content update
            LeanTween.scale(enemyNameText.gameObject, Vector3.one * 1.05f, 0.1f)
                .setEase(LeanTweenType.easeOutQuad)
                .setOnComplete(() => {
                    LeanTween.scale(enemyNameText.gameObject, Vector3.one, 0.1f)
                        .setEase(LeanTweenType.easeInQuad);
                });
        }
        
        if (enemyLevelText != null) enemyLevelText.text = $"Level {response.enemy.stats.level}";
        
        if (enemyStatsText != null)
        {
            enemyStatsText.text = $"ATK: {response.enemy.stats.attack} DEF: {response.enemy.stats.defense} HP: {response.enemy.stats.hitPoints}/{response.enemy.stats.maxHitPoints}";
        }
        
        // Update difficulty display
        if (difficultyText != null)
        {
            difficultyText.text = response.difficulty.ToUpper();
            difficultyText.color = GetDifficultyColor(response.difficulty);
        }
        
        // Update reward preview
        if (expectedExpText != null) expectedExpText.text = $"+{response.expectedRewards.baseExperience} EXP";
        if (expectedGoldText != null) expectedGoldText.text = $"+{response.expectedRewards.baseGold} Gold";
        
        if (riskLevelText != null)
        {
            string riskText = response.expectedRewards.riskLevel == "low" ? "Low Risk" :
                             response.expectedRewards.riskLevel == "high" ? "High Risk" : "Balanced";
            riskLevelText.text = riskText;
            riskLevelText.color = GetRiskColor(response.expectedRewards.riskLevel);
        }
        
        // Load enemy avatar
        if (enemyPreviewAvatar != null && !string.IsNullOrEmpty(response.enemy.avatarUrl))
        {
            StartCoroutine(LoadEnemyAvatarCoroutine(response.enemy.avatarUrl));
        }
        
        // Enable action buttons
        if (rerollButton != null) rerollButton.interactable = true;
        if (confirmBattleButton != null) confirmBattleButton.interactable = true;
    }
    
    // Load enemy avatar for preview
    private IEnumerator LoadEnemyAvatarCoroutine(string avatarUrl)
    {
        using (UnityEngine.Networking.UnityWebRequest uwr = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(avatarUrl))
        {
            yield return uwr.SendWebRequest();

            if (uwr.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                Texture2D tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(uwr);
                Sprite sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
                
                if (enemyPreviewAvatar != null)
                {
                    enemyPreviewAvatar.sprite = sprite;
                    enemyPreviewAvatar.preserveAspect = true;
                }
            }
            else
            {
                Debug.LogError("Failed to load enemy avatar: " + uwr.error);
            }
        }
    }
    
    private void ShowMockEnemyPreview(string difficulty)
    {
        // Use the same panel activation logic as ShowEnemyPreview to prevent unwanted bounces
        if (enemyPreviewPanel != null)
        {
            enemyPreviewPanel.SetActive(true);
            
            // Only animate in if this is the very first time showing the panel
            if (!hasShownPreviewPanel)
            {
                // First time ever showing - animate in with bounce
                enemyPreviewPanel.transform.localScale = Vector3.zero;
                LeanTween.scale(enemyPreviewPanel, Vector3.one, 0.3f)
                    .setEase(LeanTweenType.easeOutBack);
                hasShownPreviewPanel = true;
            }
        }
        
        // Update mock content
        if (enemyNameText != null) enemyNameText.text = "TestEnemy";
        if (enemyLevelText != null) enemyLevelText.text = "Level 5";
        if (enemyStatsText != null) enemyStatsText.text = "ATK: 15 DEF: 8 HP: 120/120";
        if (difficultyText != null)
        {
            difficultyText.text = difficulty.ToUpper();
            difficultyText.color = GetDifficultyColor(difficulty);
        }
        if (expectedExpText != null) expectedExpText.text = "+125 EXP";
        if (expectedGoldText != null) expectedGoldText.text = "+75 Gold";
        if (riskLevelText != null) riskLevelText.text = "Balanced";
        
        if (rerollButton != null) rerollButton.interactable = true;
        if (confirmBattleButton != null) confirmBattleButton.interactable = true;
    }
    
    private Color GetRiskColor(string riskLevel)
    {
        switch (riskLevel.ToLower())
        {
            case "low": return easyColor; // Reuse easy color for low risk
            case "high": return hardColor; // Reuse hard color for high risk
            default: return mediumColor; // Reuse medium color for balanced
        }
    }
    
    private Color GetDifficultyColor(string difficulty)
    {
        switch (difficulty.ToLower())
        {
            case "easy": return easyColor;
            case "hard": return hardColor;
            default: return mediumColor;
        }
    }
}

// Data classes for enemy preview
[System.Serializable]
public class EnemyPreviewResponse
{
    public string status;
    public EnemyPreviewData enemy;
    public string difficulty;
    public int levelDifference;
    public ExpectedRewards expectedRewards;
    public string message;
}

[System.Serializable]
public class EnemyPreviewData
{
    public string username;
    public string avatarUrl;
    public EnemyStats stats;
    public bool isNPC;
}

[System.Serializable]
public class EnemyStats
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
public class ExpectedRewards
{
    public int baseExperience;
    public int baseGold;
    public string riskLevel;
}