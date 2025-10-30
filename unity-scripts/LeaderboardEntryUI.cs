using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;
using System.Collections.Generic;

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
    
    // Set up as a separator entry (shows "..." to indicate hidden entries)
    public void SetupSeparatorEntry()
    {
        // Create dummy data for separator
        entryData = new LeaderboardEntryData
        {
            username = "...",
            level = 0,
            battlesWon = 0,
            score = 0,
            avatarUrl = ""
        };
        
        rank = -1;
        isCurrentPlayer = false;
        
        UpdateSeparatorUI();
        UpdateSeparatorStyling();
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
    
    // Load and display player avatar with fallback system
    private void LoadAvatar()
    {
        if (avatarImage == null || string.IsNullOrEmpty(entryData.avatarUrl)) 
        {
            SetDefaultAvatar();
            return;
        }
        
        // Skip loading for mock avatars in editor
        if (entryData.avatarUrl.StartsWith("mock_avatar"))
        {
            Debug.Log($"Skipping mock avatar load for {entryData.username}");
            SetDefaultAvatar();
            return;
        }
        
        StartCoroutine(LoadAvatarWithFallbacks(entryData.avatarUrl));
    }
    
    // Coroutine to load avatar with multiple fallback options
    private IEnumerator LoadAvatarWithFallbacks(string primaryUrl)
    {
        // Special debugging for known problematic users
        bool isProblematicUser = entryData.username.ToLower().Contains("prguitarman") || 
                                entryData.username.ToLower().Contains("penguitt");
        
        if (isProblematicUser)
        {
            Debug.Log($"[AVATAR DEBUG] Loading avatar for known user: {entryData.username}");
            Debug.Log($"[AVATAR DEBUG] Primary URL: {primaryUrl}");
        }
        
        // Generate fallback URLs for this user
        List<string> fallbackUrls = GenerateFallbackUrls(entryData.username, primaryUrl);
        
        if (isProblematicUser)
        {
            Debug.Log($"[AVATAR DEBUG] Generated {fallbackUrls.Count} fallback URLs for {entryData.username}");
            for (int i = 0; i < fallbackUrls.Count; i++)
            {
                Debug.Log($"[AVATAR DEBUG] Fallback {i + 1}: {fallbackUrls[i]}");
            }
        }
        
        // Try each URL in sequence
        for (int urlIndex = 0; urlIndex < fallbackUrls.Count; urlIndex++)
        {
            string avatarUrl = fallbackUrls[urlIndex];
            
            if (isProblematicUser)
            {
                Debug.Log($"[AVATAR DEBUG] Attempt {urlIndex + 1}/{fallbackUrls.Count} for {entryData.username}: {avatarUrl}");
            }
            else
            {
                Debug.Log($"Trying to load avatar for {entryData.username}: {avatarUrl}");
            }
            
            using (UnityEngine.Networking.UnityWebRequest uwr = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(avatarUrl))
            {
                // Set timeout to avoid hanging
                uwr.timeout = 15; // Increased timeout for problematic users
                
                yield return uwr.SendWebRequest();

                if (uwr.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    try
                    {
                        Texture2D tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(uwr);
                        
                        // Validate the texture
                        if (tex != null && tex.width > 0 && tex.height > 0)
                        {
                            Sprite sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
                            
                            if (avatarImage != null)
                            {
                                avatarImage.sprite = sprite;
                                avatarImage.preserveAspect = true;
                            }
                            
                            if (isProblematicUser)
                            {
                                Debug.Log($"[AVATAR DEBUG] SUCCESS! Avatar loaded for {entryData.username} from: {avatarUrl}");
                                Debug.Log($"[AVATAR DEBUG] Texture size: {tex.width}x{tex.height}");
                            }
                            else
                            {
                                Debug.Log($"Avatar loaded successfully for {entryData.username} from: {avatarUrl}");
                            }
                            
                            yield break; // Success! Exit the loop
                        }
                        else
                        {
                            if (isProblematicUser)
                            {
                                Debug.LogWarning($"[AVATAR DEBUG] Invalid texture for {entryData.username} from: {avatarUrl} (tex: {tex}, size: {tex?.width}x{tex?.height})");
                            }
                            else
                            {
                                Debug.LogWarning($"Invalid texture received for {entryData.username} from: {avatarUrl}");
                            }
                        }
                    }
                    catch (System.Exception e)
                    {
                        if (isProblematicUser)
                        {
                            Debug.LogError($"[AVATAR DEBUG] Error processing texture for {entryData.username}: {e.Message}");
                            Debug.LogError($"[AVATAR DEBUG] Stack trace: {e.StackTrace}");
                        }
                        else
                        {
                            Debug.LogError($"Error processing avatar texture for {entryData.username}: {e.Message}");
                        }
                    }
                }
                else
                {
                    if (isProblematicUser)
                    {
                        Debug.LogWarning($"[AVATAR DEBUG] Failed to load for {entryData.username} from {avatarUrl}");
                        Debug.LogWarning($"[AVATAR DEBUG] Error: {uwr.error}");
                        Debug.LogWarning($"[AVATAR DEBUG] Response code: {uwr.responseCode}");
                    }
                    else
                    {
                        Debug.LogWarning($"Failed to load avatar for {entryData.username} from {avatarUrl}: {uwr.error}");
                    }
                }
            }
            
            // Small delay between attempts to avoid hammering servers
            yield return new WaitForSeconds(0.3f);
        }
        
        // If all fallbacks failed, use default avatar
        if (isProblematicUser)
        {
            Debug.LogError($"[AVATAR DEBUG] ALL FALLBACKS FAILED for {entryData.username}, using default");
        }
        else
        {
            Debug.LogWarning($"All avatar URLs failed for {entryData.username}, using default");
        }
        
        SetDefaultAvatar();
    }
    
    // Generate list of fallback URLs to try
    private List<string> GenerateFallbackUrls(string username, string primaryUrl)
    {
        List<string> urls = new List<string>();
        
        // 1. Primary URL (from server)
        if (!string.IsNullOrEmpty(primaryUrl))
        {
            urls.Add(primaryUrl);
        }
        
        // 2. Use server-provided fallback URLs if available
        // Note: This would require updating the data structure to include fallbackAvatarUrls
        // For now, we'll generate our own fallbacks
        
        // 3. Reddit user avatar endpoint (works for many users)
        urls.Add($"https://www.reddit.com/user/{username}/avatar");
        
        // 4. Alternative Reddit avatar format
        urls.Add($"https://styles.redditmedia.com/t5_2qh1i/styles/profileIcon_{username}.png");
        
        // 5. Gravatar-style fallback (generates consistent avatar based on username)
        string hash = GetSimpleHash(username);
        urls.Add($"https://www.gravatar.com/avatar/{hash}?d=identicon&s=128");
        
        // 6. Default Reddit Snoo avatar (always works)
        urls.Add("https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfNDhhM2EwNDI0Nzg0N2VkMzUwOGI4YjRjZjdlNzIwMjViNDY5NTcwMl8z_rare_2ac1bb56-63fc-4837-8cde-c443fb602a3b.png");
        
        return urls;
    }
    
    // Simple hash function for generating consistent fallback avatars
    private string GetSimpleHash(string input)
    {
        if (string.IsNullOrEmpty(input)) return "default";
        
        int hash = 0;
        foreach (char c in input)
        {
            hash = ((hash << 5) - hash) + c;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return System.Math.Abs(hash).ToString("x8");
    }
    
    // Set a default avatar when all else fails
    private void SetDefaultAvatar()
    {
        if (avatarImage == null) return;
        
        // You could load a default sprite from Resources here
        // For now, we'll just leave it empty but could add a default Snoo sprite
        Debug.Log($"Using default avatar for {entryData.username}");
        
        // Optional: Set a solid color background as fallback
        // avatarImage.color = GetUserColor(entryData.username);
    }
    
    // Generate a consistent color for users without avatars (optional)
    private Color GetUserColor(string username)
    {
        if (string.IsNullOrEmpty(username)) return Color.gray;
        
        int hash = username.GetHashCode();
        Random.InitState(hash);
        
        return new Color(
            Random.Range(0.3f, 0.8f),
            Random.Range(0.3f, 0.8f), 
            Random.Range(0.3f, 0.8f),
            1f
        );
    }
    
    // Update UI for separator entry
    private void UpdateSeparatorUI()
    {
        // Hide rank
        if (rankText != null)
        {
            rankText.text = "";
        }
        
        // Show dots for username
        if (usernameText != null)
        {
            usernameText.text = "• • •";
            usernameText.fontStyle = FontStyles.Bold;
        }
        
        // Hide other fields
        if (levelText != null) levelText.text = "";
        if (battlesWonText != null) battlesWonText.text = "";
        if (scoreText != null) scoreText.text = ""; // Score is hidden anyway
        
        // Hide avatar
        if (avatarImage != null) avatarImage.gameObject.SetActive(false);
    }
    
    // Update styling for separator entry
    private void UpdateSeparatorStyling()
    {
        if (backgroundImage == null) return;
        
        // Use a subtle separator color
        Color separatorColor = new Color(0.15f, 0.15f, 0.15f, 0.5f);
        backgroundImage.color = separatorColor;
        
        // Slightly smaller scale
        transform.localScale = Vector3.one * 0.9f;
    }
    
    // Format score with commas for readability (currently hidden)
    private string FormatScore(int score)
    {
        // Hide score for now since it's not being used in battle system
        return ""; // Return empty string to hide
        
        // Original formatting (commented out):
        /*
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
        */
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