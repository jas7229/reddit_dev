import { ResponsiveUnityGameFullscreen } from './ResponsiveUnityGame';

export const App = () => {
  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>My Fullscreen Devvit Unity Game</h1>
      <ResponsiveUnityGameFullscreen buildPath="/UnityBuild" />
    </div>
  );
};
