'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/hooks';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchGameData,
  startGame,
  selectClue,
  answerClue,
  submitClueWager,
  submitFinalJeopardyWager,
  answerFinalJeopardy,
  startPolling,
  stopPolling,
  clearError,
  setSelectedClue,
} from '@/store/gameSlice';
import { GameBoard } from '@/components/game/GameBoard';
import { FinalJeopardyView } from '@/components/game/FinalJeopardyView';
import { ScoreDisplay } from '@/components/game/ScoreDisplay';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { AnswerAdjudication } from '@/components/game/AnswerAdjudication';
import { WagerInput } from '@/components/game/WagerInput';
import type { JeopardyBoard } from '@/lib/api/types';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const gameId = params.id as string;
  const dispatch = useAppDispatch();

  // Get all state from Redux
  const game = useAppSelector((state) => state.game.game);
  const board = useAppSelector((state) => state.game.board);
  const selectedClue = useAppSelector((state) => state.game.selectedClue);
  const actionLoading = useAppSelector((state) => state.game.actionLoading);
  const error = useAppSelector((state) => state.game.error);
  const isPolling = useAppSelector((state) => state.game.isPolling);
  const loading = useAppSelector((state) => !state.game.game && !state.game.error);
  const reduxGameId = useAppSelector((state) => state.game.gameId);
  
  // Ensure we always have a gameId - use params first, then Redux, then game.id
  const effectiveGameId = gameId || reduxGameId || game?.id;
  
  // Debug: Log gameId sources
  useEffect(() => {
    if (selectedClue && selectedClue.state === 'ANSWERED') {
      console.log('[GamePage] gameId sources:', {
        paramsId: gameId,
        reduxGameId,
        gameId: game?.id,
        effectiveGameId,
        hasEffectiveGameId: !!effectiveGameId,
      });
    }
  }, [selectedClue?.state, gameId, reduxGameId, game?.id, effectiveGameId]);

  // Initialize game data on mount
  useEffect(() => {
    if (!authLoading && user && gameId) {
      dispatch(fetchGameData(gameId));
    }
  }, [authLoading, user, gameId, dispatch]);

  // Start/stop polling based on game state
  useEffect(() => {
    if (!game || authLoading) return;

    const shouldPoll =
      game.state === 'ACTIVE' ||
      game.state === 'FINAL_PENDING' ||
      game.state === 'FINAL_ACTIVE';

    if (shouldPoll && !isPolling && !actionLoading) {
      dispatch(startPolling(gameId));
    } else if (!shouldPoll && isPolling) {
      dispatch(stopPolling());
    }

    return () => {
      if (isPolling) {
        dispatch(stopPolling());
      }
    };
  }, [game?.state, isPolling, actionLoading, gameId, dispatch, authLoading]);

  // Handle 401/403 errors - redirect to login
  useEffect(() => {
    if (error && typeof error === 'string' && error.includes('access denied')) {
      router.push('/auth/login');
    }
  }, [error, router]);

  // Debug: Log when rendering ANSWERED clue
  useEffect(() => {
    if (selectedClue && selectedClue.state === 'ANSWERED') {
      console.log('[GamePage] ANSWERED clue rendered:', {
        hasGame: !!game,
        gameId: game?.id,
        hasGameClues: !!game?.gameClues,
        gameCluesLength: game?.gameClues?.length || 0,
        selectedClueGameClueId: selectedClue.gameClueId,
        selectedClueClueId: selectedClue.clueId,
        hasAnswer: !!selectedClue.answer,
        selectedClueKeys: Object.keys(selectedClue),
        gameClueIds: game?.gameClues?.map(gc => gc.id).slice(0, 5), // First 5 for brevity
        clueIds: game?.gameClues?.map(gc => gc.clueId).slice(0, 5),
      });
      
      // If gameClues is missing, fetch it
      if (game && (!game.gameClues || game.gameClues.length === 0)) {
        console.log('[GamePage] gameClues missing, fetching game data');
        dispatch(fetchGameData(game.id));
      }
    }
  }, [selectedClue?.state, selectedClue?.gameClueId, selectedClue?.clueId, game?.gameClues, game, dispatch]);

  // Fetch answer for ANSWERED clues that don't have it
  useEffect(() => {
    if (
      selectedClue &&
      selectedClue.state === 'ANSWERED' &&
      !selectedClue.answer &&
      game
    ) {
      // If gameClues is missing or empty, fetch game data
      if (!game.gameClues || game.gameClues.length === 0) {
        console.log('[GamePage] gameClues missing, fetching game data');
        dispatch(fetchGameData(game.id));
        return;
      }
      
      // Try to find the answer in existing game state
      const gameClue = game.gameClues.find(
        (gc) => (selectedClue.gameClueId && gc.id === selectedClue.gameClueId) || 
                (selectedClue.clueId && gc.clueId === selectedClue.clueId),
      );
      
      if (gameClue && gameClue.clue.answer) {
        // Update selectedClue with answer
        dispatch(setSelectedClue({
          ...selectedClue,
          answer: gameClue.clue.answer,
        }));
      } else {
        console.warn('[GamePage] Answer not found in gameClues', {
          gameClueFound: !!gameClue,
          gameClueId: selectedClue.gameClueId,
          clueId: selectedClue.clueId,
          availableIds: game.gameClues.map(gc => ({ id: gc.id, clueId: gc.clueId })),
        });
      }
    }
  }, [selectedClue?.state, selectedClue?.answer, selectedClue?.gameClueId, selectedClue?.clueId, game?.gameClues, game, gameId, dispatch]);

  const handleStartGame = async () => {
    if (!game) return;
    await dispatch(startGame(gameId));
  };

  const handleClueClick = (clueId: string, gameClueId: string) => {
    dispatch(selectClue({ clueId, gameClueId }));
  };

  const handleSubmitWager = async (wager: number) => {
    if (!selectedClue || !game) return;
    await dispatch(submitClueWager({ gameId, clueId: selectedClue.clueId, wager }));
  };

  const handleAnswerClue = async (correct: boolean) => {
    if (!selectedClue) return;
    await dispatch(answerClue({ gameId, clueId: selectedClue.clueId, correct }));
  };

  const handleFinalJeopardyWager = async (wager: number) => {
    await dispatch(submitFinalJeopardyWager({ gameId, wager }));
  };

  const handleFinalJeopardyAnswer = async (correct: boolean) => {
    await dispatch(answerFinalJeopardy({ gameId, correct }));
  };

  const handleCloseClue = () => {
    dispatch(setSelectedClue(null));
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !game) {
    return (
      <div>
        <ErrorDisplay error={error} />
        <Button
          onClick={() => router.push('/games')}
          className="mt-4"
          variant="secondary"
        >
          Back to Games
        </Button>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  // Render based on game state
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Game</h1>
        <div className="flex items-center gap-4">
          {isPolling && (
            <span className="text-sm text-gray-500">Syncing...</span>
          )}
          <ScoreDisplay score={game.score} />
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between">
          <ErrorDisplay error={error} />
          <Button onClick={() => dispatch(clearError())} variant="secondary" className="ml-4">
            Dismiss
          </Button>
        </div>
      )}

      {/* PENDING State */}
      {game.state === 'PENDING' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">Ready to Start</h2>
          {game.finalJeopardy && (
            <p className="text-gray-600 mb-4">
              Final Jeopardy Category: {game.finalJeopardy.clue.category}
            </p>
          )}
          <Button
            onClick={handleStartGame}
            disabled={actionLoading}
            className="w-full"
          >
            {actionLoading ? 'Starting...' : 'Start Game'}
          </Button>
        </div>
      )}

      {/* ACTIVE State - Show Game Board */}
      {game.state === 'ACTIVE' && (
        <div>
          {board?.board && 'categories' in board.board ? (
            <GameBoard
              board={board.board as JeopardyBoard}
              gameId={gameId}
              onClueClick={handleClueClick}
            />
          ) : (
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <LoadingSpinner size="lg" />
                  <p className="mt-4 text-gray-600">Loading game board...</p>
                  {error && (
                    <div className="mt-4">
                      <p className="text-sm text-red-600 mb-4">
                        Failed to load board. The game may not have been started properly.
                      </p>
                      <Button
                        onClick={() => dispatch(fetchGameData(gameId))}
                        disabled={actionLoading}
                        variant="secondary"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {!error && !actionLoading && (
                    <p className="mt-2 text-sm text-gray-500">
                      If the board doesn't load, try refreshing the page.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FINAL_PENDING State */}
      {game.state === 'FINAL_PENDING' && game.finalJeopardy && (
        <FinalJeopardyView
          finalJeopardy={{
            round: 'FINAL',
            clue: {
              clueId: game.finalJeopardy.clueId,
              category: game.finalJeopardy.clue.category,
              value: game.finalJeopardy.clue.value,
              question: game.finalJeopardy.clue.question,
              wager: game.finalJeopardy.wager,
              correct: game.finalJeopardy.correct,
              scoreDelta: game.finalJeopardy.scoreDelta,
              answeredAt: game.finalJeopardy.answeredAt,
            },
          }}
          gameId={gameId}
          currentScore={game.score}
          onWagerSubmit={handleFinalJeopardyWager}
          onAnswerSubmit={handleFinalJeopardyAnswer}
          loading={actionLoading}
        />
      )}

      {/* FINAL_ACTIVE State */}
      {game.state === 'FINAL_ACTIVE' && game.finalJeopardy && (
        <FinalJeopardyView
          finalJeopardy={{
            round: 'FINAL',
            clue: {
              clueId: game.finalJeopardy.clueId,
              category: game.finalJeopardy.clue.category,
              value: game.finalJeopardy.clue.value,
              question: game.finalJeopardy.clue.question,
              answer: game.finalJeopardy.answeredAt
                ? game.finalJeopardy.clue.answer
                : undefined,
              wager: game.finalJeopardy.wager,
              correct: game.finalJeopardy.correct,
              scoreDelta: game.finalJeopardy.scoreDelta,
              answeredAt: game.finalJeopardy.answeredAt,
            },
          }}
          gameId={gameId}
          currentScore={game.score}
          onWagerSubmit={handleFinalJeopardyWager}
          onAnswerSubmit={handleFinalJeopardyAnswer}
          loading={actionLoading}
        />
      )}

      {/* COMPLETED/ELIMINATED States */}
      {(game.state === 'COMPLETED' || game.state === 'ELIMINATED') && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">
            {game.state === 'COMPLETED' ? 'Game Completed!' : 'Game Over'}
          </h2>
          <p className="text-lg mb-4">
            Final Score: <ScoreDisplay score={game.score} className="inline" />
          </p>
          {game.finalJeopardy && game.finalJeopardy.answeredAt && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="font-semibold">Final Jeopardy:</p>
              <p className="text-gray-700">{game.finalJeopardy.clue.question}</p>
              <p className="text-gray-700 mt-2">
                Answer: {game.finalJeopardy.clue.answer}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Wager: ${game.finalJeopardy.wager} |{' '}
                {game.finalJeopardy.correct ? 'Correct' : 'Incorrect'}
              </p>
            </div>
          )}
          <Button
            onClick={() => router.push('/games')}
            className="mt-4"
            variant="secondary"
          >
            Back to Games
          </Button>
        </div>
      )}

      {/* Selected Clue Modal/View */}
      {selectedClue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold">
                {selectedClue.isDailyDouble ? 'Daily Double' : 'Clue'}
              </h3>
              <button
                onClick={handleCloseClue}
                className="text-gray-500 hover:text-gray-700 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {selectedClue.state === 'UNANSWERED' && selectedClue.isDailyDouble && (
              <div>
                {selectedClue.question ? (
                  <p className="text-gray-700 mb-4">{selectedClue.question}</p>
                ) : (
                  <p className="text-gray-700 mb-4">Loading question...</p>
                )}
                <WagerInput
                  minWager={5}
                  maxWager={
                    selectedClue.maxWager ||
                    (() => {
                      // Calculate maxWager based on round (same logic as selectClue thunk)
                      const roundHighestValue =
                        board?.currentRound === 'DOUBLE_JEOPARDY' ? 2000 : 1000;
                      return Math.max(game.score, roundHighestValue);
                    })()
                  }
                  currentScore={game.score}
                  onSubmit={handleSubmitWager}
                  type="daily-double"
                  loading={actionLoading}
                />
              </div>
            )}

            {selectedClue.state === 'ANSWERED' && (
              <>
                {console.log('[GamePage] Rendering AnswerAdjudication', {
                  selectedClueState: selectedClue.state,
                  hasQuestion: !!selectedClue.question,
                  hasAnswer: !!selectedClue.answer,
                  hasGame: !!game,
                  hasGameClues: !!game?.gameClues,
                  gameCluesLength: game?.gameClues?.length || 0,
                  gameClueId: selectedClue?.gameClueId,
                  clueId: selectedClue?.clueId,
                  paramsId: gameId,
                  reduxGameId,
                  gameIdFromGame: game?.id,
                  effectiveGameId,
                  hasEffectiveGameId: !!effectiveGameId,
                })}
                <AnswerAdjudication
                  question={selectedClue.question}
                  answer={selectedClue.answer}
                  gameClues={game?.gameClues}
                  gameClueId={selectedClue?.gameClueId}
                  clueId={selectedClue?.clueId}
                  gameId={effectiveGameId}
                  onAnswer={handleAnswerClue}
                  loading={actionLoading}
                />
              </>
            )}

            {selectedClue.state === 'RESOLVED' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Question:</h4>
                  <p className="text-gray-700">{selectedClue.question}</p>
                </div>
                {selectedClue.answer && (
                  <div>
                    <h4 className="font-semibold mb-2">Answer:</h4>
                    <p className="text-gray-700">{selectedClue.answer}</p>
                  </div>
                )}
                <Button onClick={handleCloseClue} variant="secondary">
                  Close
                </Button>
              </div>
            )}

            {selectedClue.state === 'UNANSWERED' && !selectedClue.isDailyDouble && (
              selectedClue.question && selectedClue.question.trim() ? (
                <AnswerAdjudication
                  question={selectedClue.question}
                  onAnswer={handleAnswerClue}
                  loading={actionLoading}
                />
              ) : (
                <div className="text-gray-600">Loading question...</div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
