import { useEffect, useRef, useState } from 'react';

interface FullscreenUnityGameProps {
  buildPath: string; // path to Unity WebGL build in public/
  loaderFile?: string; // defaults to UnityLoader.js
  jsonFile?: string;   // defaults to Build/YourGame.json
  maxWidth?: string | number; // optional max width
  maxHeight?: string | number; // optional max height
}

export const ResponsiveUnityGameFullscreen = ({
  buildPath,
  loaderFile = 'UnityLoader.js',
  jsonFile = 'Build/YourGame.json',
  maxWidth = '100%',
  maxHeight = '100%',
}: FullscreenUnityGameProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [aspectRatio] = useState(16 / 9); // default Unity aspect ratio
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load Unity WebGL build
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `${buildPath}/${loaderFile}`;
    script.async = true;

    script.onload = () => {
      const UnityLoader = (window as any).UnityLoader;
      if (!UnityLoader) {
        console.error('UnityLoader not found.');
        return;
      }

      UnityLoader.instantiate(containerRef.current, `${buildPath}/${jsonFile}`, {
        onProgress: (_gameInstance: any, progress: number) => setLoadingProgress(progress * 100),
      });
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [buildPath, loaderFile, jsonFile]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Container style for responsive scaling
  const containerStyle = {
    width: '100%',
    maxWidth,
    maxHeight,
    position: 'relative' as const,
    paddingTop: `${100 / aspectRatio}%`,
  };

  const canvasStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  };

  return (
    <div style={{ marginBottom: '1em' }}>
      <button
        onClick={toggleFullscreen}
        style={{
          marginBottom: '0.5em',
          padding: '0.5em 1em',
          cursor: 'pointer',
          borderRadius: '4px',
          background: '#d93900',
          color: '#fff',
          fontWeight: 'bold',
        }}
      >
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>

      <div style={containerStyle} ref={containerRef}>
        {loadingProgress < 100 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#00000080',
              color: '#fff',
              fontSize: '1.5em',
              zIndex: 10,
            }}
          >
            Loading... {Math.round(loadingProgress)}%
          </div>
        )}
        <div style={canvasStyle} />
      </div>
    </div>
  );
};
