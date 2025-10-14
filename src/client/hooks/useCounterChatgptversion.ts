import { useEffect, useState } from 'react';

export const useCounter = () => {
  // --- State variables ---
  const [count, setCount] = useState(0);
  const [username, setUsername] = useState<string | null>('reddituser'); // Replace with actual user if needed
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  // --- Counter logic ---
  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);

  // --- Fetch Reddit user avatar ---
  useEffect(() => {
    if (!username) return;

    const fetchAvatar = async () => {
      setLoading(true);
      try {
        const response = await fetch(`https://www.reddit.com/user/${username}/about.json`);
        if (!response.ok) throw new Error('Failed to fetch user info');
        const data = await response.json();

        const img = data?.data?.snoovatar_img || data?.data?.icon_img;
        setAvatar(img || null);
      } catch (err) {
        console.error('Error fetching Reddit avatar:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [username]);

  // --- Return data & functions ---
  return {
    count,
    username,
    loading,
    increment,
    decrement,
    avatar,
  };
};
