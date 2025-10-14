import { useEffect, useRef } from 'react';

export const App = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    //script.src = '/unity/Build/game.loader.js'; // Adjust to match your Unity build
    script.src = '/public/Build/RedditTest1_WebGLBuild2.loader.js'; // Adjust to match your Unity build
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

    return () => {
      script.remove();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div className="w-full h-[80vh] flex justify-center items-center bg-black">
      <div ref={containerRef} id="unity-container" className="w-full h-full" 
      style={{ width: '100vw', height: '100vh', background: 'black' }}
      />
    </div>
  );
};
