'use client';

import React from 'react';
import type { ClueBoardItem } from '@/lib/api/types';
import '@/styles/components/ClueCard.scss';

interface ClueCardProps {
  clue: ClueBoardItem;
  onClick: () => void;
  disabled?: boolean;
}

export function ClueCard({ clue, onClick, disabled }: ClueCardProps) {
  const isUnanswered = clue.state === 'UNANSWERED';
  const isAnswered = clue.state === 'ANSWERED' || clue.state === 'RESOLVED';

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
      disabled={disabled || isAnswered}
      className={`clue-card w-full h-20 flex items-center justify-center border-2 font-bold text-lg transition-all text-white cursor-pointer ${isAnswered ? 'clue-card--answered' : ''}`}
    >
      {isUnanswered ? (
        <span className="clue-card__value">{formatValue(clue.value)}</span>
      ) : (
        // When answered, show nothing - just the background color
        // Same as a regular active clue button, only without any text
        null
      )}
    </button>
  );
}
