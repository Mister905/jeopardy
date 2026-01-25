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
  
  // Use red for negative scores, even if text-white is in className
  // Otherwise use white if explicitly requested, or conditional colors
  const colorClass = isNegative
    ? '' // Will use inline style for red
    : forceWhite 
      ? 'text-white' 
      : isZero ? 'text-gray-600' : 'text-green-600';
  
  // Inline style for negative scores (red)
  const inlineStyle = isNegative ? { color: '#D20422' } : {};
  
  // Use span for inline usage (e.g., inside <p> tags), div for block usage
  const Component = isInline ? 'span' : 'div';
  const baseClasses = isInline ? 'font-bold' : 'text-2xl font-bold';

  return (
    <Component
      className={`${baseClasses} ${colorClass} ${className}`}
      style={inlineStyle}
    >
      {formattedScore}
    </Component>
  );
}
