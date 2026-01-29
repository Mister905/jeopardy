'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { GameState } from '@/lib/api/types';
import '@/styles/components/GameCard.scss';

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
      PENDING: { text: 'Not Started', color: 'bg-gray-500', customClass: '' },
      ACTIVE: { text: 'In Progress', color: '', customClass: 'game-card__badge--active' },
      FINAL_PENDING: { text: 'Final Jeopardy', color: 'bg-purple-500', customClass: '' },
      FINAL_ACTIVE: { text: 'Final Jeopardy', color: 'bg-purple-500', customClass: '' },
      COMPLETED: { text: 'Completed', color: 'bg-green-500', customClass: '' },
      ELIMINATED: { text: 'Eliminated', color: 'bg-red-500', customClass: '' },
    };

    const badge = badges[state];
    return (
      <span
        className={`px-2 py-1 rounded text-white text-xs font-semibold border-2 ${badge.color} ${badge.customClass}`}
      >
        {badge.text}
      </span>
    );
  };

  return (
    <div className="game-card rounded-lg p-6 border-2 transition-all relative hover:opacity-90 min-h-[220px]">
      <Link href={`/games/${id}`} className="block">
        <div className="flex items-center justify-between mb-2">
          {getStateBadge(state)}
          <span className="text-sm text-white opacity-80">
            {formatDate(updatedAt)}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-lg font-semibold text-white">
            Score: {formatScore(score)}
          </p>
          <p className="text-sm text-white opacity-80 mt-1">
            Created: {formatDate(createdAt)}
          </p>
        </div>
      </Link>
      {canEndGame && onEndGame && (
        <div className="game-card__divider mt-3 pt-3 border-t">
          {showConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-white">End this game?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleEndGame}
                  disabled={ending}
                  className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {ending ? 'Ending...' : 'Confirm'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirm(false);
                  }}
                  disabled={ending}
                  className="game-card__cancel-btn flex-1 px-3 py-1.5 text-sm rounded border-2 transition-colors disabled:opacity-50 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href={`/games/${id}`}
                className="game-card__resume-link flex-1 px-3 py-1.5 text-sm text-white rounded border-2 text-center transition-colors hover:opacity-80"
              >
                Resume
              </Link>
              <button
                onClick={handleEndGame}
                disabled={ending}
                className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                End Game
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
