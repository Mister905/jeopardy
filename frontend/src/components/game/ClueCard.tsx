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

  const getButtonStyle = () => {
    if (isUnanswered) {
      return {
        backgroundColor: '#001AA5',
        borderColor: '#00188C',
      };
    }
    return {};
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
            ? 'text-white cursor-pointer'
            : isAnswered
              ? 'bg-yellow-500 text-black border-yellow-600 cursor-pointer'
              : 'bg-gray-300 text-gray-600 border-gray-400 cursor-not-allowed'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={getButtonStyle()}
      onMouseEnter={(e) => {
        if (isUnanswered && !disabled && !isResolved) {
          e.currentTarget.style.backgroundColor = '#00188C';
        }
      }}
      onMouseLeave={(e) => {
        if (isUnanswered && !disabled && !isResolved) {
          e.currentTarget.style.backgroundColor = '#001AA5';
        }
      }}
    >
      {isUnanswered ? (
        <span style={{ color: '#EAAB66' }}>{formatValue(clue.value)}</span>
      ) : isAnswered ? (
        // Show nothing - just the background color
        null
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
