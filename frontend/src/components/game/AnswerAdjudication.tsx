'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { getGame } from '@/lib/api/games';

interface AnswerAdjudicationProps {
  question: string;
  answer?: string;
  onAnswer: (correct: boolean) => Promise<void>;
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
  
  console.log('[AnswerAdjudication] Component rendered', {
    hasQuestion: !!question,
    questionPreview: question?.substring(0, 50),
    hasAnswerProp: !!answerProp,
    hasGameClues: !!gameClues,
    gameCluesLength: gameClues?.length || 0,
    gameClueId,
    clueId,
    gameIdProp,
    gameIdFromParams,
    gameId,
    hasGameId: !!gameId,
  });
  
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState(answerProp);
  const [fetchingAnswer, setFetchingAnswer] = useState(false);

  // Extract answer from gameClues - this should work immediately, just like the question
  useEffect(() => {
    console.log('[AnswerAdjudication] useEffect running', {
      hasAnswerProp: !!answerProp,
      hasAnswer: !!answer,
      hasGameClues: !!gameClues,
      gameCluesLength: gameClues?.length || 0,
      gameClueId,
      clueId,
      gameId,
      hasGameId: !!gameId,
      hasQuestion: !!question,
      fetchingAnswer,
    });
    
    // Always sync with answerProp if it changes
    if (answerProp) {
      console.log('[AnswerAdjudication] Using answerProp', { answer: answerProp.substring(0, 50) });
      setAnswer(answerProp);
      return;
    }
    
    // If we already have an answer, don't fetch
    if (answer) {
      console.log('[AnswerAdjudication] Already have answer, skipping fetch', { answer: answer.substring(0, 50) });
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
        console.log('[AnswerAdjudication] Found answer in gameClues prop');
        setAnswer(gameClue.clue.answer);
        return;
      }
    }
    
    // If we don't have gameClues or IDs, fetch from API immediately
    // This ensures we always have the answer available, even if props are missing
    if (!answer && !fetchingAnswer && gameId) {
      console.log('[AnswerAdjudication] Fetching answer from API', { gameId, gameClueId, clueId, hasQuestion: !!question });
      setFetchingAnswer(true);
      getGame(gameId)
        .then((gameData) => {
          console.log('[AnswerAdjudication] Fetched game data', {
            hasGameClues: !!gameData.gameClues,
            gameCluesLength: gameData.gameClues?.length || 0,
          });
          
          if (gameData.gameClues && gameData.gameClues.length > 0) {
            let gameClue: typeof gameData.gameClues[0] | undefined = undefined;
            
            // Try to find by gameClueId first
            if (gameClueId) {
              gameClue = gameData.gameClues.find((gc) => gc.id === gameClueId);
              console.log('[AnswerAdjudication] Looked up by gameClueId', { found: !!gameClue });
            }
            
            // Fallback to clueId
            if (!gameClue && clueId) {
              gameClue = gameData.gameClues.find((gc) => gc.clueId === clueId);
              console.log('[AnswerAdjudication] Looked up by clueId', { found: !!gameClue });
            }
            
            // Last resort: match by question text
            if (!gameClue && question) {
              const normalizedQuestion = question.trim().toLowerCase();
              gameClue = gameData.gameClues.find(
                (gc) => gc.clue.question?.trim().toLowerCase() === normalizedQuestion,
              );
              console.log('[AnswerAdjudication] Looked up by question', { found: !!gameClue, questionLength: question.length });
            }
            
            if (gameClue?.clue?.answer) {
              console.log('[AnswerAdjudication] Found answer!', { answer: gameClue.clue.answer.substring(0, 50) });
              setAnswer(gameClue.clue.answer);
            } else {
              console.warn('[AnswerAdjudication] Could not find answer in fetched game data', {
                hasGameClues: !!gameData.gameClues,
                gameCluesLength: gameData.gameClues.length,
                gameClueId,
                clueId,
                hasQuestion: !!question,
                questionPreview: question?.substring(0, 50),
                allGameClueIds: gameData.gameClues.map(gc => gc.id).slice(0, 5),
                allClueIds: gameData.gameClues.map(gc => gc.clueId).slice(0, 5),
              });
            }
          } else {
            console.warn('[AnswerAdjudication] No gameClues in fetched game data');
          }
        })
        .catch((err) => {
          console.error('[AnswerAdjudication] Failed to fetch answer:', err);
        })
        .finally(() => {
          setFetchingAnswer(false);
        });
    } else if (!gameId) {
      console.warn('[AnswerAdjudication] Cannot fetch answer - gameId is missing');
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

  return (
    <div className="space-y-4 p-6 rounded-lg" style={{ backgroundColor: 'rgba(0, 24, 140, 0.3)', border: '2px solid #00188C' }}>
      <div>
        <h3 className="text-lg font-semibold mb-2 text-white">Question:</h3>
        <p style={{ color: '#EAAB66' }}>{question}</p>
      </div>

      {showAnswer && (
        <div>
          <h3 className="text-lg font-semibold mb-2 text-white">Answer:</h3>
          {answer ? (
            <p className="text-white">
              {answer.charAt(0) === answer.charAt(0).toUpperCase()
                ? answer
                : answer.charAt(0).toUpperCase() + answer.slice(1)}
            </p>
          ) : (
            <p className="text-gray-500 italic">Loading answer...</p>
          )}
        </div>
      )}

      {!showAnswer && (
        <Button
          onClick={() => {
            console.log('[AnswerAdjudication] Show Answer clicked', {
              hasAnswer: !!answer,
              hasGameClues: !!gameClues,
              gameClueId,
              clueId,
              gameId,
            });
            
            // When "Show Answer" is clicked, try to extract answer immediately if not already set
            if (!answer && gameClues && gameClues.length > 0 && (gameClueId || clueId)) {
              let gameClue = gameClueId
                ? gameClues.find((gc) => gc.id === gameClueId)
                : null;
              
              if (!gameClue && clueId) {
                gameClue = gameClues.find((gc) => gc.clueId === clueId);
              }
              
              if (gameClue?.clue?.answer) {
                console.log('[AnswerAdjudication] Found answer in gameClues on click');
                setAnswer(gameClue.clue.answer);
              }
            }
            
            // If still no answer and we have gameId, fetch it now
            if (!answer && gameId && !fetchingAnswer) {
              console.log('[AnswerAdjudication] Fetching answer on Show Answer click');
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
                      console.log('[AnswerAdjudication] Found answer on click fetch!');
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
