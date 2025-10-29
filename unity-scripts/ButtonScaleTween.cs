using UnityEngine;
using UnityEngine.EventSystems; // Required for IPointerDownHandler and IPointerUpHandler


public class ButtonScaleTween : MonoBehaviour
{
    // Assign the UI Element you want to animate in the Inspector
    public RectTransform objectToAnimate; 

    // The scale to which the object will grow
    public Vector3 targetScale = new Vector3(1.2f, 1.2f, 1.2f);
    // The duration of the tween
    public float duration = 0.5f;

    private bool isScaledUp = false;

    public void OnButtonPress()
    {
        if (objectToAnimate == null) 
        {
            Debug.LogError("Object to animate is not assigned!");
            return;
        }

        // Check the current state of the scale
        if (!isScaledUp)
        {
            // Scale up the UI element
            LeanTween.scale(objectToAnimate, targetScale, duration)
                .setEase(LeanTweenType.easeOutBack); // Use a pleasing ease type
            isScaledUp = true;
        }
        else
        {
            // Scale the UI element back to its original size (1,1,1)
            LeanTween.scale(objectToAnimate, Vector3.one, duration)
                .setEase(LeanTweenType.easeOutQuad);
            isScaledUp = false;
        }
    }
}