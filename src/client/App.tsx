import { useEffect, useRef } from 'react';
//import { Devvit } from '@devvit/api'; 

declare const Devvit: any;

export const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      // 1️⃣ Get avatar from Devvit
      let avatarUrl = "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfNDhhM2EwNDI0Nzg0N2VkMzUwOGI4YjRjZjdlNzIwMjViNDY5NTcwMl8z_rare_e85ca617-5a92-4b1f-a9a3-0e8631571a20.png"; // fallback
      try {
        const user = await Devvit.currentUser();
        if (user?.avatarUrl) {
          avatarUrl = user.avatarUrl;
        }
      } catch (err) {
        console.warn("Devvit currentUser not available, using placeholder", err);
      }

      // 2️⃣ Expose globally for Unity
      (window as any).userAvatar = avatarUrl;
      console.log("User avatar URL set for Unity:", avatarUrl);

      // 3️⃣ Load Unity
      const script = document.createElement('script');
      script.src = '/public/Build/RedditTest1_WebGLBuild2.loader.js'; // adjust if needed
      script.async = true;

      script.onload = () => {
        if (typeof (window as any).createUnityInstance !== 'function') {
          console.error('Unity loader not found');
          return;
        }

        (window as any).createUnityInstance(containerRef.current, {
          dataUrl: '/public/Build/RedditTest1_WebGLBuild2.data',
          frameworkUrl: '/public/Build/RedditTest1_WebGLBuild2.framework.js',
          codeUrl: '/public/Build/RedditTest1_WebGLBuild2.wasm',
          streamingAssetsUrl: '/public/StreamingAssets',
          companyName: 'MyCompany',
          productName: 'MyUnityGame',
          productVersion: '1.0',
        })
          .then(() => console.log('✅ Unity instance created'))
          .catch((err: any) => console.error('❌ Failed to load Unity:', err));
      };

      document.body.appendChild(script);
    }

    init();

    return () => {
      // Cleanup
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div className="w-full h-[80vh] flex justify-center items-center bg-black">
      <div
        ref={containerRef}
        id="unity-container"
        className="w-full h-full"
        style={{ width: '100vw', height: '100vh', background: 'black' }}
      />
    </div>
  );
};
