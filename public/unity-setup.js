const canvas = document.getElementById("unity-canvas");

// Unity build original resolution
const GAME_WIDTH = 1080;
const GAME_HEIGHT = 1920;
const GAME_ASPECT = GAME_WIDTH / GAME_HEIGHT;

// Function to resize canvas for Devvit environment
function resizeUnityCanvas() {
    if (!canvas || !canvas.parentElement) return;

    const parent = canvas.parentElement;
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    const parentAspect = parentWidth / parentHeight;
    const dpr = window.devicePixelRatio || 1;

    let width, height;

    // Letterbox to preserve aspect ratio
    if (parentAspect > GAME_ASPECT) {
        height = parentHeight;
        width = height * GAME_ASPECT;
    } else {
        width = parentWidth;
        height = width / GAME_ASPECT;
    }

    // Ensure canvas fits within parent
    width = Math.min(width, parentWidth);
    height = Math.min(height, parentHeight);

    // Apply CSS sizes (what user sees)
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    
    // Set actual canvas resolution for crisp rendering
    // This is key for preventing blurriness on high-DPI displays
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Center the canvas
    canvas.style.margin = "0 auto";
    canvas.style.display = "block";
    
    console.log(`[Canvas] Resized to ${width}x${height} CSS, ${canvas.width}x${canvas.height} actual (DPR: ${dpr})`);
}

// Initialize Devvit context and user data
function initializeDevvitContext() {
    // Try different possible context names
    const ctx = window.__DEVVIT_CONTEXT__ || window.DEVVIT_CONTEXT || window.devvitContext;
    
    console.log("[Devvit] Full context object:", ctx);
    console.log("[Devvit] Available window properties:", Object.keys(window).filter(key => key.toLowerCase().includes('devvit')));
    
    if (ctx && ctx.user) {
        console.log("[Devvit] User object:", ctx.user);
        console.log("[Devvit] Available user properties:", Object.keys(ctx.user));
        
        // Try multiple possible avatar fields
        const possibleAvatars = [
            ctx.user.snoovatar_full_body,
            ctx.user.snoovatar_outfit_img,
            ctx.user.snoovatar_img,
            ctx.user.snoo_img, 
            ctx.user.profile_img,
            ctx.user.avatar_img,
            ctx.user.avatarUrl,
            ctx.user.icon_img,
            ctx.user.icon
        ];
        
        console.log("[Devvit] Possible avatar URLs:", possibleAvatars);
        
        // Find the first non-null avatar
        window.userAvatar = possibleAvatars.find(url => url && url.trim() !== '') || 
                           "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
        
        // Set username for Unity to access
        window.username = ctx.user.username || ctx.user.name || "RedditUser";
        
        console.log("[Devvit] Final avatar URL:", window.userAvatar);
        console.log("[Devvit] Final username:", window.username);
    } else {
        console.log("[Devvit] No user context available, trying server fallback");
        initializeFromServer();
    }
}

// Function to wait for Devvit context with timeout
function waitForDevvitContext(maxAttempts = 50) {
    let attempts = 0;
    
    const checkContext = () => {
        attempts++;
        console.log(`[Devvit] Attempt ${attempts}: Checking for context...`);
        
        // Try different possible context names
        const ctx = window.__DEVVIT_CONTEXT__ || window.DEVVIT_CONTEXT || window.devvitContext;
        
        if (ctx) {
            console.log("[Devvit] Context found!", ctx);
            initializeDevvitContext();
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(checkContext, 100); // Check every 100ms
        } else {
            console.log("[Devvit] Context not found after timeout, using server fallback");
            initializeFromServer();
        }
    };
    
    checkContext();
}

// Fallback: get user data from server
async function initializeFromServer() {
    try {
        console.log("[Devvit] Fetching user data from server...");
        const response = await fetch('/api/user-data');
        const data = await response.json();
        
        if (data.status === 'success') {
            window.userAvatar = data.avatarUrl || "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
            window.username = data.username || "RedditUser";
            
            console.log("[Devvit] Server data loaded:", {
                username: window.username,
                avatar: window.userAvatar,
                debug: data.debug
            });
        }
    } catch (error) {
        console.error("[Devvit] Failed to get server data:", error);
        // Use fallbacks
        window.userAvatar = "https://www.redditstatic.com/avatars/avatar_default_01_0DD3BB.png";
        window.username = "TestUser";
    }
}

// Wait for DOM and Devvit context
window.addEventListener("DOMContentLoaded", () => {
    resizeUnityCanvas();
    waitForDevvitContext();
});

// Update on window or orientation change
window.addEventListener("resize", resizeUnityCanvas);
window.addEventListener("orientationchange", resizeUnityCanvas);
