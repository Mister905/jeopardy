import React from 'react';

interface ScoreDisplayProps {
  score: number;
  className?: string;
}

export function ScoreDisplay({ score, className = '' }: ScoreDisplayProps) {
  const formattedScore = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(score);

  const isNegative = score < 0;
  const isZero = score === 0;

  return (
    <div
      className={`text-2xl font-bold ${isNegative ? 'text-red-600' : isZero ? 'text-gray-600' : 'text-green-600'} ${className}`}
    >
      {formattedScore}
    </div>
  );
}
