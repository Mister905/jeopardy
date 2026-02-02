'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/hooks';
import { GameList } from '@/components/game/GameList';
import { createGame, listGames, endGame } from '@/lib/api/games';
import { ApiClientError } from '@/lib/api/client';
import type { ListGamesResponse } from '@/lib/api/types';

export default function HomePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [gamesData, setGamesData] = useState<ListGamesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchGames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGames();
      setGamesData(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          router.push('/auth/login');
          return;
        }
        setError(err.message);
      } else {
        setError('Failed to load games. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async () => {
    setError(null);
    // Navigate immediately - the game detail page will handle loading state
    // We'll create the game on the game detail page to avoid showing spinner here
    try {
      // Retrieve username from localStorage if available
      const username = localStorage.getItem('pendingUsername') || undefined;
      const newGame = await createGame(username);
      // Clear pending username after successful game creation
      if (username) {
        localStorage.removeItem('pendingUsername');
      }
      // Navigate immediately - the game detail page will clear old state and show loading
      // Automatically start the game after creation
      router.push(`/games/${newGame.id}?autoStart=true`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          router.push('/auth/login');
          return;
        }
        setError(err.message);
      } else {
        setError('Failed to create game. Please try again.');
      }
    }
  };

  const handleEndGame = async (gameId: string) => {
    try {
      await endGame(gameId);
      await fetchGames();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to end game. Please try again.');
      }
      throw err;
    }
  };

  if (authLoading) {
    return null; // useRequireAuth handles redirect
  }

  return (
    <div>
      <GameList
        data={gamesData}
        loading={loading}
        error={error}
        onCreateGame={handleCreateGame}
        creatingGame={false}
        onEndGame={handleEndGame}
      />
    </div>
  );
}
