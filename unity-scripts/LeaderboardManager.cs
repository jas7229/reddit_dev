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
    public ScrollRect leaderboardScrollRect; // Scroll rect for the leaderboard (optional)
    
    [Header("Leaderboard Header")]
    public TextMeshProUGUI titleText; // "LEADERBOARD" title
    public TextMeshProUGUI playerRankText; // "Your Rank: #5 of 23 players"
    public TextMeshProUGUI loadingText; // "Loading..." text
    
    [Header("Empty State")]
    public GameObject emptyStatePanel; // Panel to show when no data
    public TextMeshProUGUI emptyStateText; // "No players found" message
    
    [Header("Layout Settings")]
    [SerializeField] private int maxDisplayEntries = 15; // Maximum entries to show
    [SerializeField] private bool alwaysShowCurrentPlayer = true; // Always include current player
    [SerializeField] private bool enableScrolling = true; // Enable scrolling for long lists
    
    [Header("UI Layout Settings")]
    [Tooltip("Height of each leaderboard entry (should match your prefab height)")]
    [SerializeField] private float entryHeight = 80f; // Height of each entry
    [Tooltip("Maximum entries to show before scrolling kicks in")]
    [SerializeField] private int maxEntriesBeforeScroll = 10; // Adjust based on your panel size
    [Tooltip("Always enable scrolling (useful if you want consistent behavior)")]
    [SerializeField] private bool alwaysEnableScrolling = false;
    
    // Current leaderboard data
    private List<LeaderboardEntryData> currentLeaderboard = new List<LeaderboardEntryData>();
    private bool isLoadingLeaderboard = false;
    private bool isUpdatingUI = false; // Prevent concurrent UI updates
    private int currentPlayerRank = -1;
    private int totalPlayers = 0;
    
    void Start()
    {
        Debug.Log($"LeaderboardManager started on GameObject: {gameObject.name}");
        
        // Set up button listeners
        if (leaderboardButton != null) leaderboardButton.onClick.AddListener(OpenLeaderboard);
        if (closeButton != null) closeButton.onClick.AddListener(CloseLeaderboard);
        
        // Hide leaderboard panel initially
        if (leaderboardPanel != null) leaderboardPanel.SetActive(false);
        if (emptyStatePanel != null) emptyStatePanel.SetActive(false);
        
        // Register this GameObject for JavaScript callbacks
        Debug.Log($"LeaderboardManager ready to receive callbacks on: {gameObject.name}");
    }
    
    // Public method to open leaderboard (call from main UI button)
    public void OpenLeaderboard()
    {
        Debug.Log("Opening leaderboard");
        
        if (leaderboardPanel != null)
        {
            leaderboardPanel.SetActive(true);
            
            // Initialize layout (simple setup)
            InitializeLayout();
            
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
            
            // Timeout protection - if no response in 15 seconds, show mock data
            StartCoroutine(LeaderboardTimeoutCoroutine());
        #else
            Debug.Log("Leaderboard only works in WebGL builds - showing mock data");
            // Show mock data for editor testing
            ShowMockLeaderboard();
            isLoadingLeaderboard = false;
        #endif
    }
    
    // Timeout protection for leaderboard loading
    private IEnumerator LeaderboardTimeoutCoroutine()
    {
        float timeout = 15f; // Increased timeout
        float elapsed = 0f;
        
        while (isLoadingLeaderboard && elapsed < timeout)
        {
            elapsed += Time.deltaTime;
            yield return null;
        }
        
        // If still loading after timeout, show mock data as fallback
        if (isLoadingLeaderboard)
        {
            Debug.LogWarning("Leaderboard request timed out - showing mock data as fallback");
            isLoadingLeaderboard = false;
            
            #if UNITY_WEBGL && !UNITY_EDITOR
                // In WebGL, show mock data if server fails
                ShowMockLeaderboard();
            #else
                ShowErrorState();
            #endif
        }
    }
    
    // Called from JavaScript when leaderboard data is received
    public void OnLeaderboardReceived(string jsonData)
    {
        Debug.Log($"[{gameObject.name}] Leaderboard data received: {jsonData}");
        isLoadingLeaderboard = false;
        
        // Validate input
        if (string.IsNullOrEmpty(jsonData))
        {
            Debug.LogError("Received empty leaderboard data");
            StartCoroutine(ShowErrorStateCoroutine());
            return;
        }
        
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
                
                // Fallback: if totalPlayers is 0 but we have entries, use entry count
                if (totalPlayers == 0 && currentLeaderboard.Count > 0)
                {
                    totalPlayers = currentLeaderboard.Count;
                    Debug.Log($"[FALLBACK] Server returned totalPlayers=0, using entry count: {totalPlayers}");
                }
                
                Debug.Log($"[REAL DATA] Leaderboard response: {currentLeaderboard.Count} entries, playerRank: {currentPlayerRank}, totalPlayers: {totalPlayers}");
                
                // Use coroutine to avoid UI rebuild conflicts
                StartCoroutine(ShowLeaderboardCoroutine());
            }
            else
            {
                Debug.LogError("Failed to get leaderboard: " + response.message);
                StartCoroutine(ShowErrorStateCoroutine());
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing leaderboard data: " + e.Message);
            StartCoroutine(ShowErrorStateCoroutine());
        }
    }
    
    // Display leaderboard in UI with smart entry limiting
    private void ShowLeaderboard()
    {
        StartCoroutine(ShowLeaderboardCoroutine());
    }
    
    // Coroutine version to avoid UI rebuild conflicts
    private IEnumerator ShowLeaderboardCoroutine()
    {
        // Prevent concurrent UI updates
        if (isUpdatingUI)
        {
            Debug.LogWarning("UI update already in progress, skipping");
            yield break;
        }
        
        isUpdatingUI = true;
        
        Debug.Log($"Displaying leaderboard with {currentLeaderboard.Count} entries (max display: {maxDisplayEntries})");
        
        // Wait for end of frame to avoid layout conflicts
        yield return new WaitForEndOfFrame();
        
        // Hide loading/empty states
        if (loadingText != null) loadingText.gameObject.SetActive(false);
        if (emptyStatePanel != null) emptyStatePanel.SetActive(false);
        
        // Wait a frame between UI changes
        yield return null;
        
        // Update header info
        if (titleText != null) titleText.text = "LEADERBOARD";
        
        if (playerRankText != null)
        {
            if (currentPlayerRank > 0 && totalPlayers > 0)
            {
                playerRankText.text = $"Your Rank: #{currentPlayerRank} of {totalPlayers} players";
            }
            else if (totalPlayers > 0)
            {
                playerRankText.text = $"Total Players: {totalPlayers}";
            }
            else if (currentLeaderboard.Count > 0)
            {
                // Fallback: use the count of entries we actually have
                playerRankText.text = $"Showing {currentLeaderboard.Count} players";
            }
            else
            {
                playerRankText.text = "Loading player data...";
            }
        }
        
        // Wait another frame
        yield return null;
        
        // Clear existing entries
        ClearLeaderboardEntries();
        
        // Check if we have data to show
        if (currentLeaderboard.Count == 0)
        {
            StartCoroutine(ShowEmptyStateCoroutine());
            yield break;
        }
        
        // Wait for layout to settle
        yield return new WaitForEndOfFrame();
        
        // Setup layout based on your panel design
        SetupLayout();
        
        // Create smart entry list with current player inclusion
        List<LeaderboardEntryData> displayEntries = CreateSmartDisplayList();
        
        // Create leaderboard entries with delays to avoid overwhelming the layout system
        for (int i = 0; i < displayEntries.Count; i++)
        {
            LeaderboardEntryData entry = displayEntries[i];
            int actualRank = GetActualRank(entry);
            CreateLeaderboardEntry(entry, actualRank);
            
            // Small delay every few entries to let layout system catch up
            if (i % 3 == 2) // Every 3rd entry
            {
                yield return null;
            }
        }
        
        // Wait for all entries to be created
        yield return new WaitForEndOfFrame();
        
        // Setup scrolling if enabled and needed
        SetupScrolling(displayEntries.Count);
        
        Debug.Log($"Displayed {displayEntries.Count} leaderboard entries");
        
        // Mark UI update as complete
        isUpdatingUI = false;
    }
    
    // Create a smart list of entries to display with current player inclusion
    private List<LeaderboardEntryData> CreateSmartDisplayList()
    {
        List<LeaderboardEntryData> displayList = new List<LeaderboardEntryData>();
        
        // If we have fewer entries than max, show all
        if (currentLeaderboard.Count <= maxDisplayEntries)
        {
            displayList.AddRange(currentLeaderboard);
            return displayList;
        }
        
        // Find current player in the full list
        LeaderboardEntryData currentPlayerEntry = null;
        int currentPlayerIndex = -1;
        
        if (alwaysShowCurrentPlayer && currentPlayerRank > 0)
        {
            for (int i = 0; i < currentLeaderboard.Count; i++)
            {
                if (i + 1 == currentPlayerRank) // Rank is 1-based, index is 0-based
                {
                    currentPlayerEntry = currentLeaderboard[i];
                    currentPlayerIndex = i;
                    break;
                }
            }
        }
        
        // Strategy: Show top entries + current player if not in top
        int topEntriesToShow = maxDisplayEntries;
        
        // If current player is not in top entries, reserve one slot for them
        if (currentPlayerEntry != null && currentPlayerIndex >= maxDisplayEntries)
        {
            topEntriesToShow = maxDisplayEntries - 1;
        }
        
        // Add top entries
        for (int i = 0; i < Mathf.Min(topEntriesToShow, currentLeaderboard.Count); i++)
        {
            displayList.Add(currentLeaderboard[i]);
        }
        
        // Add current player if they're not already included
        if (currentPlayerEntry != null && currentPlayerIndex >= maxDisplayEntries)
        {
            // Add separator entry if there's a gap
            if (currentPlayerIndex > topEntriesToShow)
            {
                displayList.Add(CreateSeparatorEntry());
            }
            
            displayList.Add(currentPlayerEntry);
            Debug.Log($"Added current player at rank {currentPlayerRank} to display list");
        }
        
        return displayList;
    }
    
    // Create a separator entry to show there are hidden entries
    private LeaderboardEntryData CreateSeparatorEntry()
    {
        return new LeaderboardEntryData
        {
            username = "...",
            level = 0,
            battlesWon = 0,
            score = 0,
            avatarUrl = ""
        };
    }
    
    // Get the actual rank of an entry in the full leaderboard
    private int GetActualRank(LeaderboardEntryData entry)
    {
        // Handle separator entry
        if (entry.username == "...")
        {
            return -1; // Special value for separator
        }
        
        // Find the entry in the original list
        for (int i = 0; i < currentLeaderboard.Count; i++)
        {
            if (currentLeaderboard[i].username == entry.username && 
                currentLeaderboard[i].score == entry.score)
            {
                return i + 1; // Convert to 1-based rank
            }
        }
        
        return -1; // Not found
    }
    
    // Setup scrolling behavior (simple version that works with your panel)
    private void SetupScrolling(int entryCount)
    {
        Debug.Log($"SetupScrolling called: enableScrolling={enableScrolling}, scrollRect={leaderboardScrollRect != null}, entryCount={entryCount}, maxEntriesBeforeScroll={maxEntriesBeforeScroll}");
        
        if (leaderboardScrollRect == null) 
        {
            Debug.LogWarning("ScrollRect is null - scrolling disabled");
            return;
        }
        
        if (!enableScrolling)
        {
            Debug.LogWarning("Scrolling is disabled in settings");
            return;
        }
        
        // More aggressive scrolling logic - enable scrolling with fewer entries
        bool needsScrolling = alwaysEnableScrolling || (entryCount > 5); // Lower threshold for testing
        
        leaderboardScrollRect.vertical = needsScrolling;
        leaderboardScrollRect.horizontal = false;
        
        // Ensure scroll rect is properly configured
        if (needsScrolling)
        {
            leaderboardScrollRect.movementType = ScrollRect.MovementType.Elastic;
            leaderboardScrollRect.scrollSensitivity = 30f;
            leaderboardScrollRect.inertia = true;
            leaderboardScrollRect.decelerationRate = 0.135f;
            
            // Force scroll to top and fix positioning
            StartCoroutine(FixScrollPositionCoroutine());
            
            Debug.Log("Scrolling enabled with enhanced settings");
        }
        else
        {
            // Even without scrolling, ensure content is positioned correctly
            StartCoroutine(FixContentPositionCoroutine());
            Debug.Log("Scrolling disabled - not enough entries");
        }
        
        Debug.Log($"Final scrolling state: vertical={leaderboardScrollRect.vertical}, content={leaderboardScrollRect.content?.name}");
    }
    
    // Create individual leaderboard entry
    private void CreateLeaderboardEntry(LeaderboardEntryData entryData, int rank)
    {
        if (leaderboardEntryPrefab == null || leaderboardContent == null) return;
        
        GameObject entryObj = Instantiate(leaderboardEntryPrefab, leaderboardContent);
        LeaderboardEntryUI entryUI = entryObj.GetComponent<LeaderboardEntryUI>();
        
        if (entryUI != null)
        {
            // Handle separator entry
            if (rank == -1 && entryData.username == "...")
            {
                entryUI.SetupSeparatorEntry();
            }
            else
            {
                bool isCurrentPlayer = (rank == currentPlayerRank);
                entryUI.SetupEntry(entryData, rank, isCurrentPlayer);
            }
        }
        else
        {
            Debug.LogWarning("LeaderboardEntryUI component not found on prefab!");
        }
    }
    
    // Clear all leaderboard entries safely
    private void ClearLeaderboardEntries()
    {
        if (leaderboardContent == null) return;
        
        // Use DestroyImmediate in editor, Destroy in build to avoid layout conflicts
        var children = new List<Transform>();
        foreach (Transform child in leaderboardContent)
        {
            children.Add(child);
        }
        
        foreach (Transform child in children)
        {
            if (child != null)
            {
                #if UNITY_EDITOR
                    DestroyImmediate(child.gameObject);
                #else
                    Destroy(child.gameObject);
                #endif
            }
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
        StartCoroutine(ShowErrorStateCoroutine());
    }
    
    // Coroutine version to avoid UI rebuild conflicts
    private IEnumerator ShowErrorStateCoroutine()
    {
        yield return new WaitForEndOfFrame();
        
        if (loadingText != null)
        {
            loadingText.gameObject.SetActive(true);
            loadingText.text = "Failed to load leaderboard";
        }
        
        yield return null;
        
        if (playerRankText != null) playerRankText.text = "Please try again later";
        
        ClearLeaderboardEntries();
    }
    
    // Show empty state when no players found
    private void ShowEmptyState()
    {
        StartCoroutine(ShowEmptyStateCoroutine());
    }
    
    // Coroutine version to avoid UI rebuild conflicts
    private IEnumerator ShowEmptyStateCoroutine()
    {
        yield return new WaitForEndOfFrame();
        
        if (emptyStatePanel != null)
        {
            emptyStatePanel.SetActive(true);
        }
        
        yield return null;
        
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
        
        // Create mock data including problematic users for testing
        currentLeaderboard.Add(new LeaderboardEntryData
        {
            username = "PRguitarman",
            level = 8,
            battlesWon = 25,
            score = 2500,
            avatarUrl = "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfNDhhM2EwNDI0Nzg0N2VkMzUwOGI4YjRjZjdlNzIwMjViNDY5NTcwMl8z_rare_2ac1bb56-63fc-4837-8cde-c443fb602a3b-headshot.png"
        });
        
        currentLeaderboard.Add(new LeaderboardEntryData
        {
            username = "TestPlayer1",
            level = 5,
            battlesWon = 12,
            score = 1500,
            avatarUrl = "https://www.reddit.com/user/TestPlayer1/avatar"
        });
        
        currentLeaderboard.Add(new LeaderboardEntryData
        {
            username = "penguitt", 
            level = 6,
            battlesWon = 18,
            score = 1800,
            avatarUrl = "https://www.reddit.com/user/penguitt/avatar"
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
        totalPlayers = 4;
        
        Debug.Log($"[MOCK DATA] Using mock leaderboard: {currentLeaderboard.Count} entries, playerRank: {currentPlayerRank}, totalPlayers: {totalPlayers}");
        
        ShowLeaderboard();
    }
    
    // Public method to test avatar loading for specific users (for debugging)
    public void TestAvatarLoading(string username, string avatarUrl)
    {
        Debug.Log($"[LEADERBOARD DEBUG] Testing avatar loading for {username} with URL: {avatarUrl}");
        
        // Create a test entry
        var testEntry = new LeaderboardEntryData
        {
            username = username,
            level = 1,
            battlesWon = 0,
            score = 0,
            avatarUrl = avatarUrl
        };
        
        // Clear existing entries and show just this test entry
        ClearLeaderboardEntries();
        CreateLeaderboardEntry(testEntry, 1);
    }
    
    // Public methods for runtime configuration
    public void SetMaxDisplayEntries(int maxEntries)
    {
        maxDisplayEntries = Mathf.Clamp(maxEntries, 5, 50);
        Debug.Log($"Max display entries set to: {maxDisplayEntries}");
    }
    
    public void SetAlwaysShowCurrentPlayer(bool showPlayer)
    {
        alwaysShowCurrentPlayer = showPlayer;
        Debug.Log($"Always show current player: {alwaysShowCurrentPlayer}");
    }
    
    public void SetScrollingEnabled(bool enabled)
    {
        enableScrolling = enabled;
        Debug.Log($"Scrolling enabled: {enableScrolling}");
    }
    
    // Force refresh the leaderboard display with current settings
    public void RefreshDisplay()
    {
        if (currentLeaderboard.Count > 0)
        {
            StartCoroutine(RefreshDisplayCoroutine());
        }
    }
    
    // Coroutine version to avoid UI conflicts
    private IEnumerator RefreshDisplayCoroutine()
    {
        yield return new WaitForEndOfFrame();
        ShowLeaderboard();
    }
    
    // Set the entry height (should match your prefab height)
    public void SetEntryHeight(float height)
    {
        entryHeight = height;
        Debug.Log($"Entry height set to: {entryHeight}px");
    }
    
    // Set max entries before scrolling kicks in
    public void SetMaxEntriesBeforeScroll(int maxEntries)
    {
        maxEntriesBeforeScroll = maxEntries;
        Debug.Log($"Max entries before scroll set to: {maxEntriesBeforeScroll}");
    }
    
    // Force scrolling always on/off (useful for testing)
    public void SetAlwaysEnableScrolling(bool enable)
    {
        alwaysEnableScrolling = enable;
        Debug.Log($"Always enable scrolling: {alwaysEnableScrolling}");
        RefreshDisplay(); // Apply immediately
    }
    
    // Force enable scrolling for debugging
    [ContextMenu("Force Enable Scrolling")]
    public void ForceEnableScrolling()
    {
        if (leaderboardScrollRect != null)
        {
            leaderboardScrollRect.vertical = true;
            leaderboardScrollRect.horizontal = false;
            Debug.Log("Scrolling force enabled!");
        }
        else
        {
            Debug.LogError("ScrollRect is null - cannot enable scrolling");
        }
    }
    
    // Fix scroll position to ensure entries start at top
    private IEnumerator FixScrollPositionCoroutine()
    {
        // Wait for layout to complete
        yield return new WaitForEndOfFrame();
        yield return new WaitForEndOfFrame(); // Extra frame for safety
        
        if (leaderboardScrollRect != null)
        {
            // Force scroll to top
            leaderboardScrollRect.verticalNormalizedPosition = 1f;
            
            // Also manually set content position
            if (leaderboardScrollRect.content != null)
            {
                leaderboardScrollRect.content.anchoredPosition = new Vector2(
                    leaderboardScrollRect.content.anchoredPosition.x, 
                    0f
                );
            }
            
            Debug.Log("Scroll position fixed - content should start at top");
        }
    }
    
    // Fix content position for non-scrolling content
    private IEnumerator FixContentPositionCoroutine()
    {
        // Wait for layout to complete
        yield return new WaitForEndOfFrame();
        yield return new WaitForEndOfFrame();
        
        if (leaderboardContent != null)
        {
            RectTransform contentRect = leaderboardContent.GetComponent<RectTransform>();
            if (contentRect != null)
            {
                // Ensure content starts at the very top
                contentRect.anchoredPosition = new Vector2(0, 0);
                Debug.Log("Content position fixed for non-scrolling layout");
            }
        }
    }
    
    // Get current layout info (for debugging)
    public string GetLayoutInfo()
    {
        bool scrollingActive = leaderboardScrollRect?.vertical ?? false;
        string contentPosition = "N/A";
        string layoutGroupInfo = "N/A";
        
        if (leaderboardContent != null)
        {
            RectTransform contentRect = leaderboardContent.GetComponent<RectTransform>();
            if (contentRect != null)
            {
                contentPosition = $"Pos: {contentRect.anchoredPosition}, Anchor: {contentRect.anchorMin}-{contentRect.anchorMax}";
            }
            
            VerticalLayoutGroup layoutGroup = leaderboardContent.GetComponent<VerticalLayoutGroup>();
            if (layoutGroup != null)
            {
                layoutGroupInfo = $"Padding: T{layoutGroup.padding.top} B{layoutGroup.padding.bottom}, Spacing: {layoutGroup.spacing}";
            }
        }
        
        return $"Max Display Entries: {maxDisplayEntries}\n" +
               $"Current Entries: {currentLeaderboard.Count}\n" +
               $"Max Before Scroll: {maxEntriesBeforeScroll}\n" +
               $"Scrolling Active: {scrollingActive}\n" +
               $"Entry Height: {entryHeight}px\n" +
               $"Always Enable Scrolling: {alwaysEnableScrolling}\n" +
               $"Content: {contentPosition}\n" +
               $"Layout Group: {layoutGroupInfo}";
    }
    
    // Fix cut-off entries manually (for debugging)
    [ContextMenu("Fix Cut-off Entries")]
    public void FixCutoffEntries()
    {
        FixLayoutGroupSettings();
        StartCoroutine(FixScrollPositionCoroutine());
        Debug.Log("Manually fixed cut-off entries");
    }
    
    // Simple layout setup that works with your existing panel design
    private void SetupLayout()
    {
        // Fix layout group settings first
        FixLayoutGroupSettings();
        
        // Determine if we need scrolling based on entry count
        bool needsScrolling = alwaysEnableScrolling || (currentLeaderboard.Count > maxEntriesBeforeScroll);
        
        if (needsScrolling)
        {
            // Enable scrolling for longer lists
            SetupScrollableContent();
            Debug.Log($"Scrolling enabled for {currentLeaderboard.Count} entries");
        }
        else
        {
            // Use fixed layout for shorter lists
            SetupFixedContent();
            Debug.Log($"Fixed layout for {currentLeaderboard.Count} entries");
        }
    }
    
    // Fix Vertical Layout Group settings to prevent cut-off entries
    private void FixLayoutGroupSettings()
    {
        if (leaderboardContent == null) return;
        
        VerticalLayoutGroup layoutGroup = leaderboardContent.GetComponent<VerticalLayoutGroup>();
        if (layoutGroup != null)
        {
            // Ensure proper alignment and padding
            layoutGroup.childAlignment = TextAnchor.UpperCenter;
            layoutGroup.padding.top = 0; // No top padding
            layoutGroup.padding.bottom = 5; // Small bottom padding
            layoutGroup.padding.left = 5;
            layoutGroup.padding.right = 5;
            layoutGroup.spacing = 5f; // Reasonable spacing between entries
            
            // Child control settings
            layoutGroup.childControlWidth = true;
            layoutGroup.childControlHeight = false;
            layoutGroup.childForceExpandWidth = true;
            layoutGroup.childForceExpandHeight = false;
            
            Debug.Log("Layout group settings fixed - no top padding, proper alignment");
        }
        else
        {
            Debug.LogWarning("No VerticalLayoutGroup found on content - entries might not align properly");
        }
    }
    
    // Setup scrollable content (works with your existing panel size)
    private void SetupScrollableContent()
    {
        if (leaderboardScrollRect != null)
        {
            // Enable smooth scrolling
            leaderboardScrollRect.vertical = true;
            leaderboardScrollRect.horizontal = false;
            leaderboardScrollRect.scrollSensitivity = entryHeight; // Scroll one entry at a time
            leaderboardScrollRect.inertia = true;
            leaderboardScrollRect.decelerationRate = 0.135f;
        }
        
        // Ensure content can expand beyond the viewport and starts at the top
        if (leaderboardContent != null)
        {
            ContentSizeFitter sizeFitter = leaderboardContent.GetComponent<ContentSizeFitter>();
            if (sizeFitter == null)
            {
                sizeFitter = leaderboardContent.gameObject.AddComponent<ContentSizeFitter>();
            }
            sizeFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            
            // Ensure content starts at the top
            RectTransform contentRect = leaderboardContent.GetComponent<RectTransform>();
            if (contentRect != null)
            {
                // Set anchors to top-stretch
                contentRect.anchorMin = new Vector2(0, 1);
                contentRect.anchorMax = new Vector2(1, 1);
                contentRect.pivot = new Vector2(0.5f, 1); // Pivot at top
                contentRect.anchoredPosition = new Vector2(0, 0); // Start at top
            }
        }
    }
    
    // Setup fixed content (no scrolling, fits within your panel)
    private void SetupFixedContent()
    {
        if (leaderboardScrollRect != null)
        {
            // Disable scrolling
            leaderboardScrollRect.vertical = false;
        }
        
        // Content fits within the panel bounds and starts at top
        if (leaderboardContent != null)
        {
            ContentSizeFitter sizeFitter = leaderboardContent.GetComponent<ContentSizeFitter>();
            if (sizeFitter == null)
            {
                sizeFitter = leaderboardContent.gameObject.AddComponent<ContentSizeFitter>();
            }
            sizeFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            
            // Ensure content starts at the top
            RectTransform contentRect = leaderboardContent.GetComponent<RectTransform>();
            if (contentRect != null)
            {
                // Set anchors to top-stretch
                contentRect.anchorMin = new Vector2(0, 1);
                contentRect.anchorMax = new Vector2(1, 1);
                contentRect.pivot = new Vector2(0.5f, 1); // Pivot at top
                contentRect.anchoredPosition = new Vector2(0, 0); // Start at top
            }
        }
    }
    
    // Simple initialization - your panel handles the sizing
    private void InitializeLayout()
    {
        // Just ensure the scroll rect is properly configured if it exists
        if (leaderboardScrollRect != null)
        {
            leaderboardScrollRect.horizontal = false; // Never scroll horizontally
            leaderboardScrollRect.scrollSensitivity = entryHeight; // Smooth scrolling
        }
        
        Debug.Log("Leaderboard layout initialized - using your panel design");
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