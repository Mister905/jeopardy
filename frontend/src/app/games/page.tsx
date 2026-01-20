'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/hooks';
import { GameList } from '@/components/game/GameList';
import { createGame, listGames } from '@/lib/api/games';
import { ApiClientError } from '@/lib/api/client';
import type { ListGamesResponse } from '@/lib/api/types';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export default function GamesPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [gamesData, setGamesData] = useState<ListGamesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingGame, setCreatingGame] = useState(false);

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
          // Only redirect if not already on login page to prevent loops
          // useRequireAuth will handle the redirect, so we don't need to do it here
          // Just clear the user state and let the hook handle it
          return;
        }
        // Show the specific error message from the API client
        setError(err.message);
      } else {
        // Handle unexpected errors
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to load games. Please try again.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async () => {
    setCreatingGame(true);
    setError(null);
    try {
      const newGame = await createGame();
      router.push(`/games/${newGame.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          // useRequireAuth will handle the redirect
          return;
        }
        setError(err.message);
      } else {
        setError('Failed to create game. Please try again.');
      }
    } finally {
      setCreatingGame(false);
    }
  };

  if (authLoading) {
    return null; // useRequireAuth handles redirect
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Games</h1>
      <GameList
        data={gamesData}
        loading={loading}
        error={error}
        onCreateGame={handleCreateGame}
        creatingGame={creatingGame}
      />
    </div>
  );
}
