// Unity WebGL Loader for Devvit
(function() {
    // Get canvas element
    const canvas = document.querySelector("#unity-canvas");
    
    // Unity Module configuration
    var Module = {
        canvas: canvas,
        scalingMode: "auto", // ensures loader and game scale with canvas
    };

    // Shows a temporary message banner/ribbon for a few seconds, or
    // a permanent error message on top of the canvas if type=='error'.
    // If type=='warning', a yellow highlight color is used.
    function unityShowBanner(msg, type) {
        var warningBanner = document.querySelector("#unity-warning");
        function updateBannerVisibility() {
            warningBanner.style.display = warningBanner.children.length ? 'block' : 'none';
        }
        var div = document.createElement('div');
        div.innerHTML = msg;
        warningBanner.appendChild(div);
        if (type == 'error') div.style = 'background: red; padding: 10px;';
        else {
            if (type == 'warning') div.style = 'background: yellow; padding: 10px;';
            setTimeout(function() {
                warningBanner.removeChild(div);
                updateBannerVisibility();
            }, 5000);
        }
        updateBannerVisibility();
    }

    // Unity build configuration
    var buildUrl = "Build";
    var loaderUrl = buildUrl + "/RedditTest1_WebGLBuild2.loader.js";
    var config = {
        arguments: [],
        dataUrl: buildUrl + "/RedditTest1_WebGLBuild2.data",
        frameworkUrl: buildUrl + "/RedditTest1_WebGLBuild2.framework.js",
        codeUrl: buildUrl + "/RedditTest1_WebGLBuild2.wasm",
        streamingAssetsUrl: "StreamingAssets",
        companyName: "Jascolors",
        productName: "RedditTest1",
        productVersion: "1.0",
        showBanner: unityShowBanner,
    };

    // Configure for mobile vs desktop
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        // Mobile device configuration
        var meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes';
        document.getElementsByTagName('head')[0].appendChild(meta);
        
        document.querySelector("#unity-container").className = "unity-mobile";
        canvas.className = "unity-mobile";
        
        // Keep native device pixel ratio for crisp rendering on mobile
        // Don't override devicePixelRatio - let Unity handle it automatically
        console.log('[Unity] Mobile detected, devicePixelRatio:', window.devicePixelRatio);
    } else {
        // Desktop configuration - let CSS handle sizing
        canvas.style.maxWidth = "100%";
        canvas.style.maxHeight = "100%";
        console.log('[Unity] Desktop detected, devicePixelRatio:', window.devicePixelRatio);
    }

    // Show loading bar
    document.querySelector("#unity-loading-bar").style.display = "block";

    // Load Unity
    var script = document.createElement("script");
    script.src = loaderUrl;
    script.onload = () => {
        createUnityInstance(canvas, config, (progress) => {
            document.querySelector("#unity-progress-bar-full").style.width = 100 * progress + "%";
        }).then((unityInstance) => {
            // Hide loading bar when ready
            document.querySelector("#unity-loading-bar").style.display = "none";
            
            // Set up fullscreen button
            document.querySelector("#unity-fullscreen-button").onclick = () => {
                unityInstance.SetFullscreen(1);
            };
            
            // Store Unity instance globally for potential communication
            window.unityInstance = unityInstance;
            
            console.log("[Unity] Game loaded successfully");
            
        }).catch((message) => {
            console.error("[Unity] Failed to load:", message);
            unityShowBanner("Failed to load Unity game: " + message, 'error');
        });
    };

    document.body.appendChild(script);
})(); // End of IIFE