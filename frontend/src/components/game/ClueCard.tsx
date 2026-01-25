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
      className="w-full h-20 flex items-center justify-center border-2 font-bold text-lg transition-all text-white cursor-pointer"
      style={{
        backgroundColor: '#001AA5',
        borderColor: '#3F3A3E',
        borderRadius: '2px',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isAnswered) {
          e.currentTarget.style.backgroundColor = '#00188C';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isAnswered) {
          e.currentTarget.style.backgroundColor = '#001AA5';
        }
      }}
    >
      {isUnanswered ? (
        <span style={{ color: '#EAAB66' }}>{formatValue(clue.value)}</span>
      ) : (
        // When answered, show nothing - just the background color
        // Same as a regular active clue button, only without any text
        null
      )}
    </button>
  );
}
