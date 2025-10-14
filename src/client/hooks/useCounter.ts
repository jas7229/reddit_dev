import { useCallback, useEffect, useState } from 'react';
import type { InitResponse, IncrementResponse, DecrementResponse } from '../../shared/types/api';

interface CounterState {
  count: number;
  username: string | null;
  loading: boolean;
}

export const useCounter = () => {
  const [state, setState] = useState<CounterState>({
    count: 0,
    username: null,
    loading: true,
  });

  const [avatar, setAvatar] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  // --- Fetch initial counter data from backend ---
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: InitResponse = await res.json();
        if (data.type !== 'init') throw new Error('Unexpected response');

        // Ensure we have a valid username (for testing, fallback to a real account)
        const username = data.username || 'spez';

        setState({ count: data.count, username, loading: false });
        setPostId(data.postId);
      } catch (err) {
        console.error('Failed to init counter', err);
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    void init();
  }, []);

  // --- Counter update functions ---
  const update = useCallback(
    async (action: 'increment' | 'decrement') => {
      if (!postId) {
        console.error('No postId – cannot update counter');
        return;
      }

      try {
        const res = await fetch(`/api/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: IncrementResponse | DecrementResponse = await res.json();
        setState((prev) => ({ ...prev, count: data.count }));
      } catch (err) {
        console.error(`Failed to ${action}`, err);
      }
    },
    [postId]
  );

  const increment = useCallback(() => update('increment'), [update]);
  const decrement = useCallback(() => update('decrement'), [update]);

  // --- Fetch Reddit avatar (web-safe) ---
  useEffect(() => {
    const username = state.username;
    if (!username) return;

    const fetchAvatar = async () => {
      try {
        const response = await fetch(`https://www.reddit.com/user/${username}/about.json`);
        if (!response.ok) throw new Error('Failed to fetch user info');
        const data = await response.json();
        const img = data?.data?.snoovatar_img || data?.data?.icon_img || null;
        setAvatar(img);
      } catch (err) {
        console.error('Error fetching Reddit avatar:', err);
        setAvatar(null); // fallback if fetch fails
      }
    };

    void fetchAvatar();
  }, [state.username]);

  // --- Return state + functions ---
  return {
    ...state,
    increment,
    decrement,
    avatar,
  };
};
