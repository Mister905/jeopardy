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
      PENDING: { text: 'Not Started', color: 'bg-gray-500', customColor: null },
      ACTIVE: { text: 'In Progress', color: '', customColor: '#001AA5' },
      FINAL_PENDING: { text: 'Final Jeopardy', color: 'bg-purple-500', customColor: null },
      FINAL_ACTIVE: { text: 'Final Jeopardy', color: 'bg-purple-500', customColor: null },
      COMPLETED: { text: 'Completed', color: 'bg-green-500', customColor: null },
      ELIMINATED: { text: 'Eliminated', color: 'bg-red-500', customColor: null },
    };

    const badge = badges[state];
    return (
      <span
        className={`px-2 py-1 rounded text-white text-xs font-semibold ${badge.color}`}
        style={
          badge.customColor
            ? { backgroundColor: badge.customColor, border: '2px solid #3F3A3E' }
            : undefined
        }
      >
        {badge.text}
      </span>
    );
  };

  return (
    <div 
      className="rounded-lg p-4 border-2 transition-all relative hover:opacity-90"
      style={{
        backgroundColor: 'rgba(0, 26, 165, 0.3)',
        borderColor: '#3F3A3E',
        color: 'white',
      }}
    >
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
        <div className="mt-3 pt-3 border-t" style={{ borderColor: '#00188C' }}>
          {showConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-white">End this game?</p>
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
                  className="flex-1 px-3 py-1.5 text-sm rounded border-2 transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'rgba(0, 24, 140, 0.4)',
                    borderColor: '#00188C',
                    color: 'white',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 24, 140, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 24, 140, 0.4)';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href={`/games/${id}`}
                className="flex-1 px-3 py-1.5 text-sm text-white rounded border-2 text-center transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'rgba(0, 24, 140, 0.4)',
                  borderColor: '#3F3A3E',
                }}
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
