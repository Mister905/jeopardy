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
  round?: 'JEOPARDY' | 'DOUBLE_JEOPARDY'; // Round for Daily Doubles to determine button text
}

export function WagerInput({
  minWager,
  maxWager,
  currentScore,
  onSubmit,
  type,
  loading = false,
  round,
}: WagerInputProps) {
  const [wager, setWager] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleWagerChange = (value: string) => {
    setWager(value);
    setError('');
    
    // Only show minimum error if user enters a value less than $5
    if (value && !isNaN(parseInt(value, 10))) {
      const wagerAmount = parseInt(value, 10);
      if (wagerAmount < minWager) {
        setError(`Minimum wager is $${minWager}`);
      }
    }
  };

  // Determine button text and value for Daily Double
  // If player has less than round maximum, show round maximum button ($1,000 or $2,000)
  // Otherwise, show "True Daily Double" button
  const getDailyDoubleButtonInfo = () => {
    if (type !== 'daily-double' || !round) {
      return null;
    }

    const roundMaximum = round === 'JEOPARDY' ? 1000 : 2000;
    
    // If current score is less than round maximum, maxWager will be the round maximum
    // Show the round maximum button in this case
    if (currentScore < roundMaximum && maxWager === roundMaximum) {
      return {
        text: `$${roundMaximum.toLocaleString()}`,
        value: roundMaximum,
      };
    }
    
    // Otherwise, show "True Daily Double" which sets to maxWager (player's score)
    return {
      text: 'True Daily Double',
      value: maxWager,
    };
  };

  // Determine button info for Final Jeopardy "All In" button
  const getFinalJeopardyButtonInfo = () => {
    if (type !== 'final-jeopardy') {
      return null;
    }

    // For Final Jeopardy, "All In" means wagering the entire current score
    return {
      text: 'All In',
      value: maxWager, // maxWager is the current score for Final Jeopardy
    };
  };

  const dailyDoubleButtonInfo = getDailyDoubleButtonInfo();
  const finalJeopardyButtonInfo = getFinalJeopardyButtonInfo();

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
          onChange={(e) => handleWagerChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loading}
        />
      </div>
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      <div className="flex gap-2">
        {dailyDoubleButtonInfo && (
          <Button
            type="button"
            onClick={() => {
              setWager(dailyDoubleButtonInfo.value.toString());
              setError('');
            }}
            disabled={loading}
            variant="secondary"
          >
            {dailyDoubleButtonInfo.text}
          </Button>
        )}
        {finalJeopardyButtonInfo && (
          <Button
            type="button"
            onClick={() => {
              setWager(finalJeopardyButtonInfo.value.toString());
              setError('');
            }}
            disabled={loading}
            variant="secondary"
          >
            {finalJeopardyButtonInfo.text}
          </Button>
        )}
        <Button type="submit" disabled={loading || !wager} className="flex-1">
          {loading ? 'Submitting...' : 'Submit Wager'}
        </Button>
      </div>
    </form>
  );
}
