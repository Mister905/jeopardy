'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth, signOutAndRedirectToLogin } from '@/lib/auth/hooks';
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
  const [creatingGame, setCreatingGame] = useState(false);
  const [authError, setAuthError] = useState(false);

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
          await signOutAndRedirectToLogin(router);
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
    setAuthError(false);
    setCreatingGame(true);
    try {
      const username = localStorage.getItem('pendingUsername') || undefined;
      const newGame = await createGame(username);
      if (username) {
        localStorage.removeItem('pendingUsername');
      }
      window.location.href = `/games/${newGame.id}?autoStart=true`;
    } catch (err) {
      if (err instanceof ApiClientError) {
        console.warn('[Trivia] Create game failed:', err.statusCode, err.message);
        if (err.statusCode === 401) {
          setAuthError(true);
          setError(
            'Authorization failed. The app may not be sending your sign-in token to the server. Try signing in again, or check that the deployment forwards the Authorization header for /api requests.'
          );
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

  // Don't render game list when no user (e.g. after logout); useRequireAuth will redirect to login
  if (!user) {
    return null;
  }

  return (
    <div>
      <GameList
        data={gamesData}
        loading={loading}
        error={error}
        onCreateGame={handleCreateGame}
        creatingGame={creatingGame}
        onEndGame={handleEndGame}
        errorActionLabel={authError ? 'Sign in again' : undefined}
        onErrorAction={
          authError ? () => signOutAndRedirectToLogin(router) : undefined
        }
      />
    </div>
  );
}
