'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface WagerInputProps {
  minWager: number;
  maxWager: number;
  currentScore: number;
  onSubmit: (wager: number) => Promise<void>;
  type: 'daily-double' | 'final-jeopardy';
  loading?: boolean;
}

export function WagerInput({
  minWager,
  maxWager,
  currentScore,
  onSubmit,
  type,
  loading = false,
}: WagerInputProps) {
  const [wager, setWager] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const wagerAmount = parseInt(wager, 10);

    if (isNaN(wagerAmount)) {
      setError('Please enter a valid number');
      return;
    }

    if (wagerAmount < minWager) {
      setError(`Minimum wager is $${minWager}`);
      return;
    }

    if (wagerAmount > maxWager) {
      setError(`Maximum wager is $${maxWager}`);
      return;
    }

    try {
      await onSubmit(wagerAmount);
      setWager('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit wager',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="wager"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Enter your wager
        </label>
        <input
          id="wager"
          type="number"
          min={minWager}
          max={maxWager}
          value={wager}
          onChange={(e) => {
            setWager(e.target.value);
            setError('');
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={`$${minWager} - $${maxWager}`}
          disabled={loading}
        />
        <p className="text-sm text-gray-500 mt-1">
          Minimum: ${minWager} | Maximum: ${maxWager} | Current Score: $
          {currentScore}
        </p>
      </div>
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      <Button type="submit" disabled={loading || !wager}>
        {loading ? 'Submitting...' : 'Submit Wager'}
      </Button>
    </form>
  );
}
