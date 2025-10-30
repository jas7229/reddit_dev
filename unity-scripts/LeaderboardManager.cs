using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Runtime.InteropServices;
using System.Collections;
using System.Collections.Generic;

public class LeaderboardManager : MonoBehaviour 
{
    // External JavaScript function declarations
    [DllImport("__Internal")]
    private static extern void GetLeaderboard();
    
    [Header("Leaderboard UI")]
    public GameObject leaderboardPanel; // Main leaderboard panel
    public Button leaderboardButton; // Button to open leaderboard
    public Button closeButton; // Button to close leaderboard
    public Transform leaderboardContent; // Content area for leaderboard entries
    public GameObject leaderboardEntryPrefab; // Prefab for individual leaderboard entries
    
    [Header("Leaderboard Header")]
    public TextMeshProUGUI titleText; // "LEADERBOARD" title
    public TextMeshProUGUI playerRankText; // "Your Rank: #5 of 23 players"
    public TextMeshProUGUI loadingText; // "Loading..." text
    
    [Header("Empty State")]
    public GameObject emptyStatePanel; // Panel to show when no data
    public TextMeshProUGUI emptyStateText; // "No players found" message
    
    // Current leaderboard data
    private List<LeaderboardEntryData> currentLeaderboard = new List<LeaderboardEntryData>();
    private bool isLoadingLeaderboard = false;
    private int currentPlayerRank = -1;
    private int totalPlayers = 0;
    
    void Start()
    {
        Debug.Log("LeaderboardManager started");
        
        // Set up button listeners
        if (leaderboardButton != null) leaderboardButton.onClick.AddListener(OpenLeaderboard);
        if (closeButton != null) closeButton.onClick.AddListener(CloseLeaderboard);
        
        // Hide leaderboard panel initially
        if (leaderboardPanel != null) leaderboardPanel.SetActive(false);
        if (emptyStatePanel != null) emptyStatePanel.SetActive(false);
    }
    
    // Public method to open leaderboard (call from main UI button)
    public void OpenLeaderboard()
    {
        Debug.Log("Opening leaderboard");
        
        if (leaderboardPanel != null)
        {
            leaderboardPanel.SetActive(true);
            
            // Animate panel in with LeanTween
            leaderboardPanel.transform.localScale = Vector3.zero;
            LeanTween.scale(leaderboardPanel, Vector3.one, 0.4f)
                .setEase(LeanTweenType.easeOutBack)
                .setOvershoot(1.1f);
        }
        
        // Load leaderboard data
        LoadLeaderboardData();
    }
    
    // Close leaderboard panel
    public void CloseLeaderboard()
    {
        Debug.Log("Closing leaderboard");
        
        if (leaderboardPanel != null)
        {
            // Animate panel out with LeanTween
            LeanTween.scale(leaderboardPanel, Vector3.zero, 0.3f)
                .setEase(LeanTweenType.easeInBack)
                .setOnComplete(() => {
                    leaderboardPanel.SetActive(false);
                });
        }
    }
    
    // Load leaderboard data from server
    private void LoadLeaderboardData()
    {
        if (isLoadingLeaderboard) return;
        
        isLoadingLeaderboard = true;
        Debug.Log("Loading leaderboard data from server");
        
        // Show loading state
        ShowLoadingState();
        
        #if UNITY_WEBGL && !UNITY_EDITOR
            // Call JavaScript function to get leaderboard
            GetLeaderboard();
            
            // Timeout protection - if no response in 10 seconds, show error
            StartCoroutine(LeaderboardTimeoutCoroutine());
        #else
            Debug.Log("Leaderboard only works in WebGL builds");
            // Show mock data for editor testing
            ShowMockLeaderboard();
            isLoadingLeaderboard = false;
        #endif
    }
    
    // Timeout protection for leaderboard loading
    private IEnumerator LeaderboardTimeoutCoroutine()
    {
        float timeout = 10f;
        float elapsed = 0f;
        
        while (isLoadingLeaderboard && elapsed < timeout)
        {
            elapsed += Time.deltaTime;
            yield return null;
        }
        
        // If still loading after timeout, show error
        if (isLoadingLeaderboard)
        {
            Debug.LogWarning("Leaderboard request timed out");
            isLoadingLeaderboard = false;
            ShowErrorState();
        }
    }
    
    // Called from JavaScript when leaderboard data is received
    public void OnLeaderboardReceived(string jsonData)
    {
        Debug.Log("Leaderboard data received: " + jsonData);
        isLoadingLeaderboard = false;
        
        try
        {
            var response = JsonUtility.FromJson<LeaderboardResponse>(jsonData);
            
            if (response.status == "success" && response.leaderboard != null)
            {
                currentLeaderboard.Clear();
                foreach (var entry in response.leaderboard)
                {
                    currentLeaderboard.Add(entry);
                }
                
                currentPlayerRank = response.playerRank ?? -1;
                totalPlayers = response.totalPlayers ?? 0;
                
                ShowLeaderboard();
            }
            else
            {
                Debug.LogError("Failed to get leaderboard: " + response.message);
                ShowErrorState();
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing leaderboard data: " + e.Message);
            ShowErrorState();
        }
    }
    
    // Display leaderboard in UI
    private void ShowLeaderboard()
    {
        Debug.Log($"Displaying leaderboard with {currentLeaderboard.Count} entries");
        
        // Hide loading/empty states
        if (loadingText != null) loadingText.gameObject.SetActive(false);
        if (emptyStatePanel != null) emptyStatePanel.SetActive(false);
        
        // Update header info
        if (titleText != null) titleText.text = "LEADERBOARD";
        
        if (playerRankText != null)
        {
            if (currentPlayerRank > 0)
            {
                playerRankText.text = $"Your Rank: #{currentPlayerRank} of {totalPlayers} players";
            }
            else
            {
                playerRankText.text = $"Total Players: {totalPlayers}";
            }
        }
        
        // Clear existing entries
        ClearLeaderboardEntries();
        
        // Check if we have data to show
        if (currentLeaderboard.Count == 0)
        {
            ShowEmptyState();
            return;
        }
        
        // Create leaderboard entries
        for (int i = 0; i < currentLeaderboard.Count; i++)
        {
            CreateLeaderboardEntry(currentLeaderboard[i], i + 1);
        }
    }
    
    // Create individual leaderboard entry
    private void CreateLeaderboardEntry(LeaderboardEntryData entryData, int rank)
    {
        if (leaderboardEntryPrefab == null || leaderboardContent == null) return;
        
        GameObject entryObj = Instantiate(leaderboardEntryPrefab, leaderboardContent);
        LeaderboardEntryUI entryUI = entryObj.GetComponent<LeaderboardEntryUI>();
        
        if (entryUI != null)
        {
            entryUI.SetupEntry(entryData, rank, currentPlayerRank == rank);
        }
        else
        {
            Debug.LogWarning("LeaderboardEntryUI component not found on prefab!");
        }
    }
    
    // Clear all leaderboard entries
    private void ClearLeaderboardEntries()
    {
        if (leaderboardContent == null) return;
        
        foreach (Transform child in leaderboardContent)
        {
            Destroy(child.gameObject);
        }
    }
    
    // Show loading state
    private void ShowLoadingState()
    {
        if (loadingText != null)
        {
            loadingText.gameObject.SetActive(true);
            loadingText.text = "Loading leaderboard...";
        }
        
        if (emptyStatePanel != null) emptyStatePanel.SetActive(false);
        if (playerRankText != null) playerRankText.text = "";
        
        ClearLeaderboardEntries();
    }
    
    // Show error state
    private void ShowErrorState()
    {
        if (loadingText != null)
        {
            loadingText.gameObject.SetActive(true);
            loadingText.text = "Failed to load leaderboard";
        }
        
        if (playerRankText != null) playerRankText.text = "Please try again later";
        
        ClearLeaderboardEntries();
    }
    
    // Show empty state when no players found
    private void ShowEmptyState()
    {
        if (emptyStatePanel != null)
        {
            emptyStatePanel.SetActive(true);
        }
        
        if (emptyStateText != null)
        {
            emptyStateText.text = "No players found.\nBe the first to play!";
        }
        
        if (loadingText != null) loadingText.gameObject.SetActive(false);
    }
    
    // Show mock leaderboard for editor testing
    private void ShowMockLeaderboard()
    {
        currentLeaderboard.Clear();
        
        // Create mock data
        currentLeaderboard.Add(new LeaderboardEntryData
        {
            username = "TestPlayer1",
            level = 5,
            battlesWon = 12,
            score = 1500,
            avatarUrl = "mock_avatar_1"
        });
        
        currentLeaderboard.Add(new LeaderboardEntryData
        {
            username = "TestPlayer2", 
            level = 3,
            battlesWon = 8,
            score = 900,
            avatarUrl = "mock_avatar_2"
        });
        
        currentLeaderboard.Add(new LeaderboardEntryData
        {
            username = "TestPlayer3",
            level = 4,
            battlesWon = 6,
            score = 750,
            avatarUrl = "mock_avatar_3"
        });
        
        currentPlayerRank = 2;
        totalPlayers = 3;
        
        ShowLeaderboard();
    }
}

// Data classes for leaderboard
[System.Serializable]
public class LeaderboardResponse
{
    public string status;
    public LeaderboardEntryData[] leaderboard;
    public int? playerRank;
    public int? totalPlayers;
    public string message;
}

[System.Serializable]
public class LeaderboardEntryData
{
    public string username;
    public int score;
    public int level;
    public string avatarUrl;
    public int battlesWon;
    public string lastPlayed;
}