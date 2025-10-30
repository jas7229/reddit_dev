using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;

public class LeaderboardEntryUI : MonoBehaviour 
{
    [Header("Entry UI Elements")]
    public TextMeshProUGUI rankText; // "#1", "#2", etc.
    public Image avatarImage; // Player avatar
    public TextMeshProUGUI usernameText; // Player username
    public TextMeshProUGUI levelText; // "Level 5"
    public TextMeshProUGUI battlesWonText; // "12 Wins"
    public TextMeshProUGUI scoreText; // "1,500 pts"
    
    [Header("Visual Styling")]
    public Image backgroundImage; // Entry background
    public Color normalColor = new Color(0.2f, 0.2f, 0.2f, 0.8f); // Normal entry color
    public Color playerColor = new Color(0.3f, 0.6f, 0.3f, 0.8f); // Current player highlight
    public Color topRankColor = new Color(0.6f, 0.5f, 0.2f, 0.8f); // Gold for #1
    
    private LeaderboardEntryData entryData;
    private int rank;
    private bool isCurrentPlayer;
    
    // Set up the leaderboard entry with data
    public void SetupEntry(LeaderboardEntryData data, int entryRank, bool isPlayer)
    {
        entryData = data;
        rank = entryRank;
        isCurrentPlayer = isPlayer;
        
        UpdateUI();
        UpdateStyling();
        LoadAvatar();
    }
    
    // Update all UI elements with entry data
    private void UpdateUI()
    {
        // Rank
        if (rankText != null)
        {
            rankText.text = $"#{rank}";
        }
        
        // Username
        if (usernameText != null)
        {
            usernameText.text = entryData.username;
        }
        
        // Level
        if (levelText != null)
        {
            levelText.text = $"Level {entryData.level}";
        }
        
        // Battles Won
        if (battlesWonText != null)
        {
            int wins = entryData.battlesWon;
            battlesWonText.text = wins == 1 ? "1 Win" : $"{wins} Wins";
        }
        
        // Score
        if (scoreText != null)
        {
            scoreText.text = FormatScore(entryData.score);
        }
    }
    
    // Update visual styling based on rank and player status
    private void UpdateStyling()
    {
        if (backgroundImage == null) return;
        
        Color targetColor;
        
        if (isCurrentPlayer)
        {
            // Highlight current player
            targetColor = playerColor;
        }
        else if (rank == 1)
        {
            // Gold for first place
            targetColor = topRankColor;
        }
        else
        {
            // Normal color for others
            targetColor = normalColor;
        }
        
        backgroundImage.color = targetColor;
        
        // Add subtle scale effect for current player
        if (isCurrentPlayer)
        {
            transform.localScale = Vector3.one * 1.02f;
        }
    }
    
    // Load and display player avatar
    private void LoadAvatar()
    {
        if (avatarImage == null || string.IsNullOrEmpty(entryData.avatarUrl)) return;
        
        // Skip loading for mock avatars in editor
        if (entryData.avatarUrl.StartsWith("mock_avatar"))
        {
            Debug.Log($"Skipping mock avatar load for {entryData.username}");
            return;
        }
        
        StartCoroutine(LoadAvatarCoroutine(entryData.avatarUrl));
    }
    
    // Coroutine to load avatar image
    private IEnumerator LoadAvatarCoroutine(string avatarUrl)
    {
        using (UnityEngine.Networking.UnityWebRequest uwr = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(avatarUrl))
        {
            yield return uwr.SendWebRequest();

            if (uwr.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                Texture2D tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(uwr);
                Sprite sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
                
                if (avatarImage != null)
                {
                    avatarImage.sprite = sprite;
                    avatarImage.preserveAspect = true;
                }
                
                Debug.Log($"Avatar loaded for {entryData.username}");
            }
            else
            {
                Debug.LogError($"Failed to load avatar for {entryData.username}: " + uwr.error);
            }
        }
    }
    
    // Format score with commas for readability
    private string FormatScore(int score)
    {
        if (score >= 1000000)
        {
            return $"{score / 1000000f:F1}M pts";
        }
        else if (score >= 1000)
        {
            return $"{score / 1000f:F1}K pts";
        }
        else
        {
            return $"{score} pts";
        }
    }
    
    // Animation when entry is created (optional)
    void Start()
    {
        // Subtle fade-in animation
        CanvasGroup canvasGroup = GetComponent<CanvasGroup>();
        if (canvasGroup == null)
        {
            canvasGroup = gameObject.AddComponent<CanvasGroup>();
        }
        
        canvasGroup.alpha = 0f;
        LeanTween.alphaCanvas(canvasGroup, 1f, 0.3f)
            .setEase(LeanTweenType.easeOutQuad)
            .setDelay(rank * 0.05f); // Stagger entries slightly
    }
}