using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Runtime.InteropServices;
using System.Collections;
using System.Collections.Generic;

public class ShopManager : MonoBehaviour 
{
    // External JavaScript function declarations
    [DllImport("__Internal")]
    private static extern void GetShopData();
    
    [DllImport("__Internal")]
    private static extern void PurchaseItem(string itemId);
    
    [Header("Shop UI")]
    public GameObject shopPanel; // Main shop popup
    public Button closeButton; // Close shop button
    
    [Header("Player Info Display")]
    public Image playerAvatarImage; // Player's avatar
    public TextMeshProUGUI playerNameText; // Player name
    public TextMeshProUGUI playerLevelText; // Player level
    public TextMeshProUGUI playerGoldText; // Current gold amount
    
    [Header("Player Stats Display")]
    public TextMeshProUGUI playerAttackText; // "ATK: 15"
    public TextMeshProUGUI playerDefenseText; // "DEF: 8"
    public TextMeshProUGUI playerHealthText; // "HP: 120"
    
    [Header("Shop Items")]
    public GameObject shopItemPrefab; // Prefab for individual shop items
    public Transform shopItemsContainer; // Parent for shop item instances
    public TextMeshProUGUI loadingText; // "Loading shop..." text
    public TextMeshProUGUI errorText; // Error message display
    
    [Header("Manager References")]
    public PlayerManager playerManager; // Reference to get player data
    
    // Current shop state
    private ShopData currentShopData;
    private bool isLoadingShop = false;
    private List<GameObject> spawnedShopItems = new List<GameObject>();
    
    void Start()
    {
        Debug.Log("ShopManager started");
        
        // Find PlayerManager if not assigned
        if (playerManager == null)
        {
            playerManager = FindFirstObjectByType<PlayerManager>();
        }
        
        // Set up button listeners
        if (closeButton != null) closeButton.onClick.AddListener(CloseShop);
        
        // Hide shop panel initially
        if (shopPanel != null) shopPanel.SetActive(false);
        
        // Hide error text initially
        if (errorText != null) errorText.gameObject.SetActive(false);
    }
    
    // Public method to open shop (call from UI button)
    public void ShowShop()
    {
        Debug.Log("Opening shop");
        
        if (shopPanel != null)
        {
            shopPanel.SetActive(true);
            
            // Animate panel in with LeanTween
            shopPanel.transform.localScale = Vector3.zero;
            LeanTween.scale(shopPanel, Vector3.one, 0.4f)
                .setEase(LeanTweenType.easeOutBack)
                .setOvershoot(1.1f);
        }
        
        // Load shop data
        LoadShopData();
    }
    
    // Close shop panel
    public void CloseShop()
    {
        Debug.Log("Closing shop");
        
        if (shopPanel != null)
        {
            // Animate panel out with LeanTween
            LeanTween.scale(shopPanel, Vector3.zero, 0.3f)
                .setEase(LeanTweenType.easeInBack)
                .setOnComplete(() => {
                    shopPanel.SetActive(false);
                });
        }
    }
    
    // Load shop data from server
    private void LoadShopData()
    {
        if (isLoadingShop) return;
        
        isLoadingShop = true;
        Debug.Log("Loading shop data");
        
        // Show loading state
        ShowLoadingState();
        
        #if UNITY_WEBGL && !UNITY_EDITOR
            GetShopData();
        #else
            Debug.Log("Shop data loading only works in WebGL builds");
            ShowMockShopData();
            isLoadingShop = false;
        #endif
    }
    
    // Called from JavaScript when shop data is received
    public void OnShopDataReceived(string jsonData)
    {
        Debug.Log("Shop data received: " + jsonData);
        isLoadingShop = false;
        
        try
        {
            var response = JsonUtility.FromJson<ShopResponse>(jsonData);
            
            if (response.status == "success")
            {
                currentShopData = new ShopData
                {
                    shopItems = response.shopItems,
                    playerGold = response.playerGold,
                    playerStats = response.playerStats
                };
                
                ShowShopData(currentShopData);
            }
            else
            {
                Debug.LogError("Failed to get shop data: " + response.message);
                ShowErrorState("Failed to load shop data");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing shop data: " + e.Message);
            ShowErrorState("Error loading shop data");
        }
    }
    
    // Called from JavaScript when item purchase is completed
    public void OnItemPurchased(string jsonData)
    {
        Debug.Log("Item purchase result: " + jsonData);
        
        try
        {
            var response = JsonUtility.FromJson<PurchaseResponse>(jsonData);
            
            if (response.status == "success")
            {
                Debug.Log($"Successfully purchased {response.item.name}!");
                
                // Refresh shop data to show updated state
                LoadShopData();
                
                // Update player manager if available
                if (playerManager != null)
                {
                    playerManager.RefreshPlayerData();
                }
            }
            else
            {
                Debug.LogError("Purchase failed: " + response.message);
                ShowErrorState($"Purchase failed: {response.message}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError("Error parsing purchase response: " + e.Message);
            ShowErrorState("Purchase error");
        }
    }
    
    // Display shop data in UI
    private void ShowShopData(ShopData shopData)
    {
        Debug.Log("Displaying shop data");
        
        // Hide loading/error states
        if (loadingText != null) loadingText.gameObject.SetActive(false);
        if (errorText != null) errorText.gameObject.SetActive(false);
        
        // Update player info
        UpdatePlayerInfo(shopData);
        
        // Create shop item UI elements
        CreateShopItems(shopData.shopItems);
    }
    
    // Update player information display
    private void UpdatePlayerInfo(ShopData shopData)
    {
        // Update gold display
        if (playerGoldText != null)
        {
            playerGoldText.text = $"{shopData.playerGold}";
        }
        
        // Update stats display
        if (playerAttackText != null)
        {
            playerAttackText.text = $"ATK: {shopData.playerStats.attack}";
        }
        
        if (playerDefenseText != null)
        {
            playerDefenseText.text = $"DEF: {shopData.playerStats.defense}";
        }
        
        if (playerHealthText != null)
        {
            playerHealthText.text = $"HP: {shopData.playerStats.maxHitPoints}";
        }
        
        if (playerLevelText != null)
        {
            playerLevelText.text = $"Level {shopData.playerStats.level}";
        }
        
        // Update player name and avatar from PlayerManager
        if (playerManager != null && playerManager.currentPlayer != null)
        {
            if (playerNameText != null)
            {
                playerNameText.text = playerManager.currentPlayer.username;
            }
            
            // Load player avatar (reuse PlayerManager's avatar loading)
            if (playerAvatarImage != null && playerManager.playerAvatarImage != null)
            {
                playerAvatarImage.sprite = playerManager.playerAvatarImage.sprite;
            }
        }
    }
    
    // Create shop item UI elements
    private void CreateShopItems(ShopItem[] shopItems)
    {
        // Clear existing items
        ClearShopItems();
        
        if (shopItemPrefab == null || shopItemsContainer == null)
        {
            Debug.LogWarning("Shop item prefab or container not assigned!");
            return;
        }
        
        // Create UI for each shop item
        foreach (var item in shopItems)
        {
            GameObject itemObj = Instantiate(shopItemPrefab, shopItemsContainer);
            ShopItemUI itemUI = itemObj.GetComponent<ShopItemUI>();
            
            if (itemUI != null)
            {
                itemUI.SetupItem(item, this);
                spawnedShopItems.Add(itemObj);
            }
            else
            {
                Debug.LogWarning("ShopItemUI component not found on shop item prefab!");
                Destroy(itemObj);
            }
        }
        
        Debug.Log($"Created {spawnedShopItems.Count} shop item UI elements");
    }
    
    // Clear all spawned shop items
    private void ClearShopItems()
    {
        foreach (GameObject item in spawnedShopItems)
        {
            if (item != null) Destroy(item);
        }
        spawnedShopItems.Clear();
    }
    
    // Purchase an item (called by ShopItemUI)
    public void PurchaseShopItem(string itemId)
    {
        Debug.Log($"Attempting to purchase item: {itemId}");
        
        #if UNITY_WEBGL && !UNITY_EDITOR
            PurchaseItem(itemId);
        #else
            Debug.Log($"Would purchase {itemId} in WebGL build");
        #endif
    }
    
    // Show loading state
    private void ShowLoadingState()
    {
        if (loadingText != null)
        {
            loadingText.gameObject.SetActive(true);
            loadingText.text = "Loading shop...";
        }
        
        if (errorText != null) errorText.gameObject.SetActive(false);
        
        // Clear existing items
        ClearShopItems();
    }
    
    // Show error state
    private void ShowErrorState(string message)
    {
        if (errorText != null)
        {
            errorText.gameObject.SetActive(true);
            errorText.text = message;
        }
        
        if (loadingText != null) loadingText.gameObject.SetActive(false);
    }
    
    // Show mock data for editor testing
    private void ShowMockShopData()
    {
        var mockData = new ShopData
        {
            playerGold = 500,
            playerStats = new PlayerStatsData
            {
                attack = 12,
                defense = 8,
                maxHitPoints = 120,
                level = 5
            },
            shopItems = new ShopItem[]
            {
                new ShopItem
                {
                    id = "iron_sword",
                    name = "Iron Sword",
                    description = "A sturdy blade that increases attack power",
                    cost = 100,
                    icon = "⚔️",
                    purchased = false,
                    canAfford = true
                },
                new ShopItem
                {
                    id = "steel_shield",
                    name = "Steel Shield", 
                    description = "Protective gear that boosts defense",
                    cost = 150,
                    icon = "🛡️",
                    purchased = false,
                    canAfford = true
                }
            }
        };
        
        ShowShopData(mockData);
    }
}

// Data classes for shop system
[System.Serializable]
public class ShopResponse
{
    public string status;
    public ShopItem[] shopItems;
    public int playerGold;
    public PlayerStatsData playerStats;
    public string message;
}

[System.Serializable]
public class PurchaseResponse
{
    public string status;
    public string message;
    public ShopItem item;
    public int newGold;
    public PlayerStatsData newStats;
}

[System.Serializable]
public class ShopData
{
    public ShopItem[] shopItems;
    public int playerGold;
    public PlayerStatsData playerStats;
}

[System.Serializable]
public class ShopItem
{
    public string id;
    public string name;
    public string description;
    public int cost;
    public string icon;
    public bool purchased;
    public bool canAfford;
}

[System.Serializable]
public class PlayerStatsData
{
    public int attack;
    public int defense;
    public int maxHitPoints;
    public int level;
}