'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface AnswerAdjudicationProps {
  question: string;
  answer?: string;
  onAnswer: (correct: boolean) => Promise<void>;
  loading?: boolean;
}

export function AnswerAdjudication({
  question,
  answer,
  onAnswer,
  loading = false,
}: AnswerAdjudicationProps) {
  const [showAnswer, setShowAnswer] = useState(!!answer);
  const [submitting, setSubmitting] = useState(false);

  const handleAnswer = async (correct: boolean) => {
    setSubmitting(true);
    try {
      await onAnswer(correct);
    } catch (err) {
      // Error handling is done in parent component
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-white border border-gray-200 rounded-lg">
      <div>
        <h3 className="text-lg font-semibold mb-2">Question:</h3>
        <p className="text-gray-800">{question}</p>
      </div>

      {showAnswer && answer && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Answer:</h3>
          <p className="text-gray-800">{answer}</p>
        </div>
      )}

      {!showAnswer && (
        <Button
          onClick={() => setShowAnswer(true)}
          variant="secondary"
          disabled={loading || submitting}
        >
          Show Answer
        </Button>
      )}

      {showAnswer && (
        <div className="flex gap-4">
          <Button
            onClick={() => handleAnswer(true)}
            disabled={loading || submitting}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {submitting ? 'Submitting...' : 'I got it right'}
          </Button>
          <Button
            onClick={() => handleAnswer(false)}
            disabled={loading || submitting}
            variant="danger"
            className="flex-1"
          >
            {submitting ? 'Submitting...' : 'I got it wrong'}
          </Button>
        </div>
      )}
    </div>
  );
}
