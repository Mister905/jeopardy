'use client';

import React from 'react';
import { WagerInput } from './WagerInput';
import { AnswerAdjudication } from './AnswerAdjudication';
import type { FinalJeopardyBoard } from '@/lib/api/types';
import '@/styles/components/FinalJeopardyView.scss';

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
    <div className="final-jeopardy-view">
      <div className="final-jeopardy-view__category">
        <h3 className="final-jeopardy-view__category-title">Category:</h3>
        <p className="final-jeopardy-view__category-name">{clue.category}</p>
      </div>

      {!hasWager ? (
        <div className="final-jeopardy-card final-jeopardy-view__card">
          <h3 className="final-jeopardy-view__card-title">Enter your wager:</h3>
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
        <div className="final-jeopardy-card final-jeopardy-view__card">
          <div className="final-jeopardy-view__summary">
            <div>
              <h3 className="final-jeopardy-view__card-title">Question:</h3>
              <p className="final-jeopardy__question">{clue.question}</p>
            </div>
            <div>
              <h3 className="final-jeopardy-view__card-title">Answer:</h3>
              <p className="final-jeopardy-view__answer">{clue.answer}</p>
            </div>
            <div className="final-jeopardy__divider final-jeopardy-view__meta">
              <p className="final-jeopardy-view__meta-text">
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
