import { navigateTo } from '@devvit/web/client';
import { useCounter } from './hooks/useCounter';

export const App = () => {
  const { count, username, loading, increment, decrement, avatar } = useCounter();

  // Placeholder avatar URL
  const placeholder =
    'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png';

  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4">
      {/* Avatar */}
      <img
        src={avatar || placeholder}
        alt={username ? `${username}'s avatar` : 'Avatar placeholder'}
        className="w-24 h-24 rounded-full border border-gray-300 shadow-sm"
      />

      {/* Greeting */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-center text-gray-900 ">
          {username ? `Hey ${username} 👋` : 'Hey there!'}
        </h1>
      </div>

      {/* Counter */}
      <div className="flex items-center justify-center mt-5">
        <button
          className="flex items-center justify-center bg-[#d93900] text-white w-14 h-14 text-[2.5em] rounded-full cursor-pointer font-mono leading-none transition-colors"
          onClick={decrement}
          disabled={loading}
        >
          -
        </button>
        <span className="text-[1.8em] font-medium mx-5 min-w-[50px] text-center leading-none text-gray-900">
          {loading ? '...' : count}
        </span>
        <button
          className="flex items-center justify-center bg-[#d93900] text-white w-14 h-14 text-[2.5em] rounded-full cursor-pointer font-mono leading-none transition-colors"
          onClick={increment}
          disabled={loading}
        >
          +
        </button>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[0.8em] text-gray-600">
        <button className="cursor-pointer" onClick={() => navigateTo('https://developers.reddit.com/docs')}>
          Docs
        </button>
        <span className="text-gray-300">|</span>
        <button className="cursor-pointer" onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}>
          r/Devvit
        </button>
        <span className="text-gray-300">|</span>
        <button className="cursor-pointer" onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}>
          Discord
        </button>
      </footer>
    </div>
  );
};
