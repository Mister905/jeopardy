'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { GameCard } from './GameCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import type { ListGamesResponse } from '@/lib/api/types';
import '@/styles/components/GameList.scss';

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
          className="game-list__create-btn inline-flex items-center justify-center gap-2 px-6 py-2 text-white rounded-lg disabled:opacity-50 border-2 transition-colors"
        >
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
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
            className="game-list__new-game-btn inline-flex items-center justify-center gap-2 px-6 py-2 rounded-lg disabled:opacity-50 border-2 transition-colors hover:border-blue-400"
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden />
            {creatingGame ? 'Creating...' : 'New Game'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
