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
        <div className="p-6 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.3)', borderColor: '#00188C', color: 'white' }}>
          <h3 className="text-lg font-semibold mb-4 text-white">Enter your wager:</h3>
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
          clueId={clue.clueId}
          gameId={gameId}
        />
      ) : (
        <div className="p-6 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.3)', borderColor: '#00188C', color: 'white' }}>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">Question:</h3>
              <p style={{ color: '#EAAB66' }}>{clue.question}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-white">Answer:</h3>
              <p className="text-white">{clue.answer}</p>
            </div>
            <div className="pt-4 border-t" style={{ borderColor: '#00188C' }}>
              <p className="text-sm text-white opacity-80">
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
