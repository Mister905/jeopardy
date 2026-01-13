'use client';

import React from 'react';
import type { ClueBoardItem } from '@/lib/api/types';

interface ClueCardProps {
  clue: ClueBoardItem;
  onClick: () => void;
  disabled?: boolean;
}

export function ClueCard({ clue, onClick, disabled }: ClueCardProps) {
  const isUnanswered = clue.state === 'UNANSWERED';
  const isAnswered = clue.state === 'ANSWERED';
  const isResolved = clue.state === 'RESOLVED';

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isResolved}
      className={`
        w-full h-20 flex items-center justify-center
        border-2 rounded-lg font-bold text-lg
        transition-all
        ${
          isUnanswered
            ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700 cursor-pointer'
            : isAnswered
              ? 'bg-yellow-500 text-black border-yellow-600 cursor-pointer'
              : 'bg-gray-300 text-gray-600 border-gray-400 cursor-not-allowed'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {isUnanswered ? (
        <>
          {formatValue(clue.value)}
          {clue.dailyDouble && (
            <span className="ml-2 text-xs">DD</span>
          )}
        </>
      ) : isAnswered ? (
        <div className="text-center">
          <div className="text-sm">Wager: {formatValue(clue.wager || 0)}</div>
          {clue.question && (
            <div className="text-xs mt-1 line-clamp-2">{clue.question}</div>
          )}
        </div>
      ) : (
        <div className="text-center text-xs">
          <div className="line-through">{formatValue(clue.value)}</div>
          {clue.scoreDelta !== undefined && (
            <div
              className={`mt-1 ${clue.scoreDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {clue.scoreDelta >= 0 ? '+' : ''}
              {formatValue(clue.scoreDelta)}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
