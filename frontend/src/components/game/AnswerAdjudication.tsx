'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { getGame } from '@/lib/api/games';
import '@/styles/components/AnswerAdjudication.scss';

interface AnswerAdjudicationProps {
  question: string;
  answer?: string;
  onAnswer: (correct: boolean) => Promise<void>;
  /** When true, show Pass button next to Show Answer. Must be false for Daily Doubles. */
  allowPass?: boolean;
  /** Called when user clicks Pass; only used when allowPass is true. */
  onPass?: () => Promise<void>;
  /** Called when user clicks Continue after passing; closes the clue view. */
  onContinue?: () => void;
  loading?: boolean;
  gameClues?: Array<{
    id: string;
    clueId: string;
    clue: {
      answer: string;
    };
  }>;
  gameClueId?: string;
  clueId?: string;
  gameId?: string;
}

export function AnswerAdjudication({
  question,
  answer: answerProp,
  onAnswer,
  allowPass = false,
  onPass,
  onContinue,
  loading = false,
  gameClues,
  gameClueId,
  clueId,
  gameId: gameIdProp,
}: AnswerAdjudicationProps) {
  // Get gameId from props, or fallback to URL params
  const params = useParams();
  const gameIdFromParams = params?.id as string | undefined;
  const gameId = gameIdProp || gameIdFromParams;
  
  const [showAnswer, setShowAnswer] = useState(false);
  const [passed, setPassed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState(answerProp);
  const [fetchingAnswer, setFetchingAnswer] = useState(false);

  // Extract answer from gameClues - this should work immediately, just like the question
  useEffect(() => {
    // Always sync with answerProp if it changes
    if (answerProp) {
      setAnswer(answerProp);
      return;
    }
    
    // If we already have an answer, don't fetch
    if (answer) {
      return;
    }
    
    // Try to extract from gameClues - this is the primary source, just like question extraction
    if (gameClues && gameClues.length > 0 && (gameClueId || clueId)) {
      // Try gameClueId first (most reliable match)
      let gameClue = gameClueId 
        ? gameClues.find((gc) => gc.id === gameClueId)
        : null;
      
      // Fallback to clueId if gameClueId didn't match
      if (!gameClue && clueId) {
        gameClue = gameClues.find((gc) => gc.clueId === clueId);
      }
      
      if (gameClue?.clue?.answer) {
        setAnswer(gameClue.clue.answer);
        return;
      }
    }
    
    // If we don't have gameClues or IDs, fetch from API immediately
    // This ensures we always have the answer available, even if props are missing
    if (!answer && !fetchingAnswer && gameId) {
      setFetchingAnswer(true);
      getGame(gameId)
        .then((gameData) => {
          if (gameData.gameClues && gameData.gameClues.length > 0) {
            let gameClue: typeof gameData.gameClues[0] | undefined = undefined;
            
            // Try to find by gameClueId first
            if (gameClueId) {
              gameClue = gameData.gameClues.find((gc) => gc.id === gameClueId);
            }
            
            // Fallback to clueId
            if (!gameClue && clueId) {
              gameClue = gameData.gameClues.find((gc) => gc.clueId === clueId);
            }
            
            // Last resort: match by question text
            if (!gameClue && question) {
              const normalizedQuestion = question.trim().toLowerCase();
              gameClue = gameData.gameClues.find(
                (gc) => gc.clue.question?.trim().toLowerCase() === normalizedQuestion,
              );
            }
            
            if (gameClue?.clue?.answer) {
              setAnswer(gameClue.clue.answer);
            }
          }
        })
        .catch((err) => {
          console.error('[AnswerAdjudication] Failed to fetch answer:', err);
        })
        .finally(() => {
          setFetchingAnswer(false);
        });
    }
  }, [answer, answerProp, gameClues, gameClueId, clueId, gameId, question, fetchingAnswer]);

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

  const handlePass = async () => {
    if (!onPass) return;
    // Reveal answer area and trigger answer load (same as Show Answer)
    setShowAnswer(true);
    setPassed(true);
    if (!answer && gameClues && gameClues.length > 0 && (gameClueId || clueId)) {
      const gameClue = gameClueId
        ? gameClues.find((gc) => gc.id === gameClueId)
        : gameClues.find((gc) => gc.clueId === clueId);
      if (gameClue?.clue?.answer) setAnswer(gameClue.clue.answer);
    }
    if (!answer && gameId && !fetchingAnswer) {
      setFetchingAnswer(true);
      getGame(gameId)
        .then((gameData) => {
          if (gameData.gameClues?.length) {
            const gc = gameClueId
              ? gameData.gameClues.find((g) => g.id === gameClueId)
              : gameData.gameClues.find((g) => g.clueId === clueId);
            if (gc?.clue?.answer) setAnswer(gc.clue.answer);
          }
        })
        .catch((err) => console.error('[AnswerAdjudication] Failed to fetch answer:', err))
        .finally(() => setFetchingAnswer(false));
    }
    setSubmitting(true);
    try {
      await onPass();
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="answer-adjudication space-y-4 p-6 rounded-lg">
      <div>
        <p className="text-white text-center text-lg leading-relaxed">{question}</p>
      </div>

      {showAnswer && (
        <div>
          {answer ? (
            <p className="text-white text-center font-bold my-8">
              {answer.charAt(0) === answer.charAt(0).toUpperCase()
                ? answer
                : answer.charAt(0).toUpperCase() + answer.slice(1)}
            </p>
          ) : (
            <p className="text-gray-500 italic text-center">Loading answer...</p>
          )}
        </div>
      )}

      {!showAnswer && (
        <div className="answer-adjudication__show-answer-spacer answer-adjudication__button-row">
          <Button
            className="answer-adjudication__show-answer-btn"
            onClick={() => {
            // When "Show Answer" is clicked, try to extract answer immediately if not already set
            if (!answer && gameClues && gameClues.length > 0 && (gameClueId || clueId)) {
              let gameClue = gameClueId
                ? gameClues.find((gc) => gc.id === gameClueId)
                : null;
              
              if (!gameClue && clueId) {
                gameClue = gameClues.find((gc) => gc.clueId === clueId);
              }
              
              if (gameClue?.clue?.answer) {
                setAnswer(gameClue.clue.answer);
              }
            }
            
            // If still no answer and we have gameId, fetch it now
            if (!answer && gameId && !fetchingAnswer) {
              setFetchingAnswer(true);
              getGame(gameId)
                .then((gameData) => {
                  if (gameData.gameClues && gameData.gameClues.length > 0) {
                    let gameClue: typeof gameData.gameClues[0] | undefined = undefined;
                    
                    if (gameClueId) {
                      gameClue = gameData.gameClues.find((gc) => gc.id === gameClueId);
                    }
                    
                    if (!gameClue && clueId) {
                      gameClue = gameData.gameClues.find((gc) => gc.clueId === clueId);
                    }
                    
                    if (!gameClue && question) {
                      const normalizedQuestion = question.trim().toLowerCase();
                      gameClue = gameData.gameClues.find(
                        (gc) => gc.clue.question?.trim().toLowerCase() === normalizedQuestion,
                      );
                    }
                    
                    if (gameClue?.clue?.answer) {
                      setAnswer(gameClue.clue.answer);
                    }
                  }
                })
                .catch((err) => {
                  console.error('[AnswerAdjudication] Failed to fetch answer on click:', err);
                })
                .finally(() => {
                  setFetchingAnswer(false);
                });
            }
            
            setShowAnswer(true);
          }}
            variant="secondary"
            disabled={loading || submitting}
          >
            Show Answer
          </Button>
          {allowPass && onPass && (
            <Button
              type="button"
              variant="secondary"
              disabled={loading || submitting}
              onClick={handlePass}
              className="answer-adjudication__pass-btn"
            >
              Pass
            </Button>
          )}
        </div>
      )}

      {showAnswer && (
        <>
          {passed && onContinue ? (
            <div className="flex justify-center pt-4">
              <Button
                onClick={onContinue}
                disabled={submitting}
                className="answer-adjudication__continue-btn"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Submitting...</span>
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          ) : submitting ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-white text-lg font-medium">Submitting...</p>
            </div>
          ) : (
            <div className="flex gap-4">
              <Button
                onClick={() => handleAnswer(true)}
                disabled={loading || submitting}
                className="answer-adjudication__correct-btn flex-1"
              >
                I got it right
              </Button>
              <Button
                onClick={() => handleAnswer(false)}
                disabled={loading || submitting}
                variant="danger"
                className="flex-1"
              >
                I got it wrong
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
