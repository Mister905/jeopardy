'use client';

import React, { useState } from 'react';
import { WagerInput } from './WagerInput';
import { AnswerAdjudication } from './AnswerAdjudication';
import type { FinalJeopardyBoard } from '@/lib/api/types';

interface FinalJeopardyViewProps {
  finalJeopardy: FinalJeopardyBoard;
  gameId: string;
  currentScore: number;
  onWagerSubmit: (wager: number) => Promise<void>;
  onAnswerSubmit: (correct: boolean) => Promise<void>;
  loading?: boolean;
}

export function FinalJeopardyView({
  finalJeopardy,
  gameId,
  currentScore,
  onWagerSubmit,
  onAnswerSubmit,
  loading = false,
}: FinalJeopardyViewProps) {
  const { clue } = finalJeopardy;
  const hasWager = clue.wager > 0;
  const isAnswered = clue.answeredAt !== null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-center">Final Jeopardy</h2>

      <div className="bg-blue-800 text-white p-4 rounded-lg text-center">
        <h3 className="text-xl font-semibold">Category:</h3>
        <p className="text-lg">{clue.category}</p>
      </div>

      {!hasWager ? (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Enter your wager:</h3>
          <WagerInput
            minWager={0}
            maxWager={currentScore}
            currentScore={currentScore}
            onSubmit={onWagerSubmit}
            type="final-jeopardy"
            loading={loading}
          />
        </div>
      ) : !isAnswered ? (
        <AnswerAdjudication
          question={clue.question}
          answer={clue.answer}
          onAnswer={onAnswerSubmit}
          loading={loading}
        />
      ) : (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Question:</h3>
              <p className="text-gray-800">{clue.question}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Answer:</h3>
              <p className="text-gray-800">{clue.answer}</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Wager: ${clue.wager} |{' '}
                {clue.correct ? 'Correct' : 'Incorrect'} | Score Change:{' '}
                {clue.scoreDelta !== null
                  ? `${clue.scoreDelta >= 0 ? '+' : ''}$${clue.scoreDelta}`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
