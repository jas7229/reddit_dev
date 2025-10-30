using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class ShopItemUI : MonoBehaviour 
{
    [Header("Item Display")]
    public TextMeshProUGUI itemNameText; // Item name
    public TextMeshProUGUI itemDescriptionText; // Item description
    public TextMeshProUGUI itemCostText; // Cost in gold
    public TextMeshProUGUI itemIconText; // Emoji icon
    public TextMeshProUGUI itemStatsText; // Stat bonuses like "+2 ATK"
    
    [Header("Purchase Button")]
    public Button purchaseButton; // Buy button
    public TextMeshProUGUI purchaseButtonText; // Button text
    
    [Header("Visual States")]
    public Image backgroundImage; // Background panel
    public Color availableColor = new Color(1f, 1f, 1f, 1f); // White
    public Color unaffordableColor = new Color(0.7f, 0.7f, 0.7f, 1f); // Grey
    public Color purchasedColor = new Color(0.4f, 0.8f, 0.4f, 1f); // Green
    
    private ShopItem currentItem;
    private ShopManager shopManager;
    
    // Set up this item UI with data
    public void SetupItem(ShopItem item, ShopManager manager)
    {
        currentItem = item;
        shopManager = manager;
        
        // Update text displays
        if (itemNameText != null) itemNameText.text = item.name;
        if (itemDescriptionText != null) itemDescriptionText.text = item.description;
        if (itemCostText != null) itemCostText.text = $"{item.cost}";
        if (itemIconText != null) itemIconText.text = item.icon;
        
        // Generate stats text from item data (this is simplified - in real system would parse from server)
        if (itemStatsText != null)
        {
            itemStatsText.text = GenerateStatsText(item);
        }
        
        // Set up purchase button
        if (purchaseButton != null)
        {
            purchaseButton.onClick.RemoveAllListeners();
            purchaseButton.onClick.AddListener(OnPurchaseClicked);
        }
        
        // Update visual state
        UpdateVisualState();
        
        Debug.Log($"Set up shop item: {item.name} (Cost: {item.cost}, Purchased: {item.purchased}, Can Afford: {item.canAfford})");
    }
    
    // Generate stats text based on item (simplified version)
    private string GenerateStatsText(ShopItem item)
    {
        // This is a simplified approach - ideally the server would send stat info
        switch (item.id)
        {
            case "iron_sword": return "+2 ATK";
            case "steel_shield": return "+3 DEF";
            case "health_potion": return "+20 HP";
            case "power_ring": return "+1 ATK, +1 DEF";
            case "champion_armor": return "+5 DEF, +10 HP";
            default: return "Stat Boost";
        }
    }
    
    // Update visual appearance based on item state
    private void UpdateVisualState()
    {
        if (currentItem.purchased)
        {
            // Item already purchased
            if (backgroundImage != null) backgroundImage.color = purchasedColor;
            if (purchaseButton != null) purchaseButton.interactable = false;
            if (purchaseButtonText != null) purchaseButtonText.text = "OWNED";
        }
        else if (!currentItem.canAfford)
        {
            // Player can't afford this item
            if (backgroundImage != null) backgroundImage.color = unaffordableColor;
            if (purchaseButton != null) purchaseButton.interactable = false;
            if (purchaseButtonText != null) purchaseButtonText.text = "TOO EXPENSIVE";
        }
        else
        {
            // Item available for purchase
            if (backgroundImage != null) backgroundImage.color = availableColor;
            if (purchaseButton != null) purchaseButton.interactable = true;
            if (purchaseButtonText != null) purchaseButtonText.text = $"BUY ({currentItem.cost}g)";
        }
    }
    
    // Called when purchase button is clicked
    private void OnPurchaseClicked()
    {
        if (currentItem == null || shopManager == null) return;
        
        Debug.Log($"Purchase button clicked for {currentItem.name}");
        
        // Add purchase animation
        if (purchaseButton != null)
        {
            // Disable button to prevent double-clicks
            purchaseButton.interactable = false;
            if (purchaseButtonText != null) purchaseButtonText.text = "BUYING...";
            
            // Scale animation
            LeanTween.scale(purchaseButton.gameObject, Vector3.one * 1.1f, 0.1f)
                .setEase(LeanTweenType.easeOutQuad)
                .setOnComplete(() => {
                    LeanTween.scale(purchaseButton.gameObject, Vector3.one, 0.1f)
                        .setEase(LeanTweenType.easeInQuad);
                });
        }
        
        // Tell shop manager to purchase this item
        shopManager.PurchaseShopItem(currentItem.id);
    }
    
    // Add hover effects (optional)
    public void OnPointerEnter()
    {
        if (currentItem != null && !currentItem.purchased && currentItem.canAfford)
        {
            // Subtle scale up on hover
            LeanTween.scale(gameObject, Vector3.one * 1.02f, 0.2f)
                .setEase(LeanTweenType.easeOutQuad);
        }
    }
    
    public void OnPointerExit()
    {
        // Reset scale
        LeanTween.scale(gameObject, Vector3.one, 0.2f)
            .setEase(LeanTweenType.easeInQuad);
    }
}