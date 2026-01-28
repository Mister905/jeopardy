import React from 'react';
import '@/styles/components/ScoreDisplay.scss';

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

  const isInline = className.includes('inline');
  const forceWhite = className.includes('text-white');

  const colorClass = isNegative
    ? 'score-display--negative'
    : forceWhite
      ? 'score-display--white'
      : isZero
        ? 'score-display--white'
        : 'score-display--positive';

  const Component = isInline ? 'span' : 'div';
  const baseClasses = isInline ? 'score-display score-display--inline' : 'score-display';

  return (
    <Component className={`${baseClasses} ${colorClass} ${className}`.trim()}>
      {formattedScore}
    </Component>
  );
}
