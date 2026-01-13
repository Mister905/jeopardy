import React from 'react';

interface ErrorDisplayProps {
  error: string | Error;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded relative">
      <div className="flex items-center justify-between">
        <span>{errorMessage}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-800 hover:text-red-900 ml-4"
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
