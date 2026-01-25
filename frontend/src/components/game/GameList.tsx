'use client';

import React from 'react';
import { GameCard } from './GameCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import type { ListGamesResponse } from '@/lib/api/types';

interface GameListProps {
  data: ListGamesResponse | null;
  loading: boolean;
  error: string | null;
  onCreateGame: () => void;
  creatingGame: boolean;
  onEndGame?: (gameId: string) => Promise<void>;
}

export function GameList({
  data,
  loading,
  error,
  onCreateGame,
  creatingGame,
  onEndGame,
}: GameListProps) {
  // Filter out completed and eliminated games
  const activeGames = data?.games.filter(
    (game) => game.state !== 'COMPLETED' && game.state !== 'ELIMINATED'
  ) || [];

  // Check if there's a game in progress
  const hasGameInProgress = activeGames.some(
    (game) =>
      game.state === 'ACTIVE' ||
      game.state === 'FINAL_PENDING' ||
      game.state === 'FINAL_ACTIVE'
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!data || activeGames.length === 0) {
    return (
        <div className="text-center py-12">
        <button
          onClick={onCreateGame}
          disabled={creatingGame}
          className="px-6 py-2 text-white rounded-lg disabled:opacity-50 border-2 transition-colors"
          style={{
            backgroundColor: '#001AA5',
            borderColor: '#3F3A3E',
          }}
          onMouseEnter={(e) => {
            if (!creatingGame) {
              e.currentTarget.style.backgroundColor = '#00188C';
            }
          }}
          onMouseLeave={(e) => {
            if (!creatingGame) {
              e.currentTarget.style.backgroundColor = '#001AA5';
            }
          }}
        >
          {creatingGame ? 'Creating...' : 'Create New Game'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center mb-6">
        {!hasGameInProgress && (
          <button
            onClick={onCreateGame}
            disabled={creatingGame}
            className="px-6 py-2 rounded-lg disabled:opacity-50 border-2 transition-colors hover:border-blue-400"
            style={{
              backgroundColor: '#001AA5',
              borderColor: '#3F3A3E',
              color: 'white',
            }}
          >
            {creatingGame ? 'Creating...' : 'New Game'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeGames.map((game) => (
          <GameCard
            key={game.id}
            id={game.id}
            state={game.state}
            score={game.score}
            createdAt={game.createdAt}
            updatedAt={game.updatedAt}
            onEndGame={onEndGame}
          />
        ))}
      </div>
    </div>
  );
}
