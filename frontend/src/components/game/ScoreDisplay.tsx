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

  const isInline = className.includes('inline');
  const forceWhite = className.includes('text-white');
  
  // Use white color if explicitly requested, otherwise use conditional colors
  const colorClass = forceWhite 
    ? 'text-white' 
    : isNegative ? 'text-red-600' : isZero ? 'text-gray-600' : 'text-green-600';
  
  // Use span for inline usage (e.g., inside <p> tags), div for block usage
  const Component = isInline ? 'span' : 'div';
  const baseClasses = isInline ? 'font-bold' : 'text-2xl font-bold';

  return (
    <Component
      className={`${baseClasses} ${colorClass} ${className}`}
    >
      {formattedScore}
    </Component>
  );
}
