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
}

export function GameList({
  data,
  loading,
  error,
  onCreateGame,
  creatingGame,
}: GameListProps) {
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

  if (!data || data.games.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No games yet.</p>
        <button
          onClick={onCreateGame}
          disabled={creatingGame}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {creatingGame ? 'Creating...' : 'Create New Game'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Games</h2>
        <button
          onClick={onCreateGame}
          disabled={creatingGame}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {creatingGame ? 'Creating...' : 'New Game'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.games.map((game) => (
          <GameCard
            key={game.id}
            id={game.id}
            state={game.state}
            score={game.score}
            createdAt={game.createdAt}
            updatedAt={game.updatedAt}
          />
        ))}
      </div>
      {data.total > data.games.length && (
        <p className="text-sm text-gray-500 text-center mt-4">
          Showing {data.games.length} of {data.total} games
        </p>
      )}
    </div>
  );
}
