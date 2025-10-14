 canvas = document.getElementById("unity-canvas");

// Unity build original resolution
const GAME_WIDTH = 1080;
const GAME_HEIGHT = 1920;
const GAME_ASPECT = GAME_WIDTH / GAME_HEIGHT;

// Optional: threshold to switch to full scaling
const ASPECT_THRESHOLD = 0.05; // 5% difference

// Unity Module
var Module = {
    canvas: canvas,
    scalingMode: "auto",
};

// Function to resize canvas with letterboxing and mobile support   
function resizeUnityCanvas() {
    if (!canvas || !canvas.parentElement) return;

    const parent = canvas.parentElement;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    const parentAspect = parentWidth / parentHeight;

    let width, height;

    if (Math.abs(parentAspect - GAME_ASPECT) < ASPECT_THRESHOLD) {
        // Full scaling if aspect close enough
        width = parentWidth;
        height = parentHeight;
    } else {
        // Letterbox to preserve aspect ratio
        if (parentAspect > GAME_ASPECT) {
            height = parentHeight;
            width = height * GAME_ASPECT;
        } else {
            width = parentWidth;
            height = width / GAME_ASPECT;
        }
    }

    // Prevent overflow on mobile screens
    width = Math.min(width, parentWidth);
    height = Math.min(height, parentHeight);

    // Apply sizes
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
}

// Run before Unity loader initializes
resizeUnityCanvas();

// Update on window or orientation change
window.addEventListener("resize", resizeUnityCanvas);
window.addEventListener("orientationchange", resizeUnityCanvas);
