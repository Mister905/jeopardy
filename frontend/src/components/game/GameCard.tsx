'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { GameState } from '@/lib/api/types';

interface GameCardProps {
  id: string;
  state: GameState;
  score: number;
  createdAt: string;
  updatedAt: string;
  onEndGame?: (gameId: string) => Promise<void>;
}

export function GameCard({
  id,
  state,
  score,
  createdAt,
  updatedAt,
  onEndGame,
}: GameCardProps) {
  const [ending, setEnding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canEndGame =
    state === 'PENDING' ||
    state === 'ACTIVE' ||
    state === 'FINAL_PENDING' ||
    state === 'FINAL_ACTIVE';

  const handleEndGame = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    if (!onEndGame) return;

    setEnding(true);
    try {
      await onEndGame(id);
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed to end game:', error);
    } finally {
      setEnding(false);
    }
  };
  const formatScore = (score: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(score);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStateBadge = (state: GameState) => {
    const badges = {
      PENDING: { text: 'Not Started', color: 'bg-gray-500' },
      ACTIVE: { text: 'In Progress', color: 'bg-blue-500' },
      FINAL_PENDING: { text: 'Final Jeopardy', color: 'bg-purple-500' },
      FINAL_ACTIVE: { text: 'Final Jeopardy', color: 'bg-purple-500' },
      COMPLETED: { text: 'Completed', color: 'bg-green-500' },
      ELIMINATED: { text: 'Eliminated', color: 'bg-red-500' },
    };

    const badge = badges[state];
    return (
      <span
        className={`px-2 py-1 rounded text-white text-xs font-semibold ${badge.color}`}
      >
        {badge.text}
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow relative">
      <Link href={`/games/${id}`} className="block">
        <div className="flex items-center justify-between mb-2">
          {getStateBadge(state)}
          <span className="text-sm text-gray-500">
            {formatDate(updatedAt)}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-lg font-semibold">
            Score: {formatScore(score)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Created: {formatDate(createdAt)}
          </p>
        </div>
      </Link>
      {canEndGame && onEndGame && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {showConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">End this game?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleEndGame}
                  disabled={ending}
                  className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {ending ? 'Ending...' : 'Yes, End Game'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirm(false);
                  }}
                  disabled={ending}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleEndGame}
              disabled={ending}
              className="w-full px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              End Game
            </button>
          )}
        </div>
      )}
    </div>
  );
}
