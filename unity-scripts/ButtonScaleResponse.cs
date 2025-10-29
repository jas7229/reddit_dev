using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using System.Collections;

public class ButtonScaleResponse : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
{
    [Header("Scale Settings")]
    public float pressedScale = 0.95f;
    public float animationDuration = 0.1f;
    
    private Vector3 originalScale;
    private bool isPressed = false;
    private Coroutine scaleCoroutine;
    private Button button;
    
    void Start()
    {
        originalScale = transform.localScale;
        button = GetComponent<Button>();
        
        // Disable Unity's built-in color transitions to prevent conflicts
        if (button != null)
        {
            ColorBlock colors = button.colors;
            colors.colorMultiplier = 1f;
            colors.fadeDuration = 0f; // Disable color fade
            button.colors = colors;
        }
    }
    
    void Update()
    {
        // Safety check: if button becomes non-interactable while pressed, reset
        if (isPressed && button != null && !button.interactable)
        {
            ForceReset();
        }
    }
    
    public void OnPointerDown(PointerEventData eventData)
    {
        if (button != null && !button.interactable) return;
        
        if (!isPressed)
        {
            isPressed = true;
            AnimateScale(originalScale * pressedScale);
            
            // Start auto-reset timer as safety measure
            StartCoroutine(AutoResetCoroutine());
        }
    }
    
    public void OnPointerUp(PointerEventData eventData)
    {
        if (isPressed)
        {
            isPressed = false;
            AnimateScale(originalScale);
        }
    }
    
    public void OnPointerExit(PointerEventData eventData)
    {
        if (isPressed)
        {
            isPressed = false;
            AnimateScale(originalScale);
        }
    }
    
    // Force reset the button state (useful for debugging)
    public void ForceReset()
    {
        isPressed = false;
        if (scaleCoroutine != null)
        {
            StopCoroutine(scaleCoroutine);
            scaleCoroutine = null;
        }
        transform.localScale = originalScale;
    }
    
    private void AnimateScale(Vector3 targetScale)
    {
        if (scaleCoroutine != null)
        {
            StopCoroutine(scaleCoroutine);
        }
        scaleCoroutine = StartCoroutine(ScaleAnimation(targetScale));
    }
    
    private IEnumerator ScaleAnimation(Vector3 targetScale)
    {
        Vector3 startScale = transform.localScale;
        float elapsedTime = 0f;
        
        while (elapsedTime < animationDuration)
        {
            elapsedTime += Time.deltaTime;
            float progress = elapsedTime / animationDuration;
            
            // Smooth easing
            progress = Mathf.SmoothStep(0f, 1f, progress);
            
            transform.localScale = Vector3.Lerp(startScale, targetScale, progress);
            yield return null;
        }
        
        transform.localScale = targetScale;
        scaleCoroutine = null;
    }
    
    void OnDisable()
    {
        // Reset scale when disabled
        ForceReset();
    }
    
    void OnEnable()
    {
        // Ensure we start in the correct state
        if (originalScale == Vector3.zero)
        {
            originalScale = transform.localScale;
        }
        ForceReset();
    }
    
    // Coroutine to automatically reset if stuck pressed for too long
    private IEnumerator AutoResetCoroutine()
    {
        yield return new WaitForSeconds(2f); // Reset after 2 seconds if still pressed
        if (isPressed)
        {
            Debug.LogWarning($"Button {gameObject.name} was stuck pressed - auto-resetting");
            ForceReset();
        }
    }
}