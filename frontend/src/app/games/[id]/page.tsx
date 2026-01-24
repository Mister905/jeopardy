'use client';

import { useEffect, useState } from 'react';
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
  endGame,
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
  
  // Track Daily Double flow step: 'intro' | 'wager' | 'question'
  const [dailyDoubleStep, setDailyDoubleStep] = useState<'intro' | 'wager' | 'question'>('intro');

  // Get all state from Redux
  const game = useAppSelector((state) => state.game.game);
  const board = useAppSelector((state) => state.game.board);
  const selectedClue = useAppSelector((state) => state.game.selectedClue);
  const actionLoading = useAppSelector((state) => state.game.actionLoading);
  const error = useAppSelector((state) => state.game.error);
  const loading = useAppSelector((state) => !state.game.game && !state.game.error);
  const reduxGameId = useAppSelector((state) => state.game.gameId);

  // Debug helper: Log Daily Doubles in gameClues (for testing only)
  useEffect(() => {
    if (game?.gameClues) {
      // Use clue.dailyDouble from the API response (which uses isDailyDouble from GameClue)
      const dailyDoubles = game.gameClues
        .filter((gc) => gc.clue.dailyDouble && gc.state === 'UNANSWERED')
        .map((gc) => ({
          category: gc.clue.category,
          value: gc.clue.value,
          gameClueId: gc.id,
          round: gc.clue.round,
        }));
      if (dailyDoubles.length > 0) {
        const jeopardyCount = dailyDoubles.filter(dd => dd.round === 'JEOPARDY').length;
        const doubleJeopardyCount = dailyDoubles.filter(dd => dd.round === 'DOUBLE_JEOPARDY').length;
        console.log(`Daily Doubles available: ${dailyDoubles.length} total (Jeopardy: ${jeopardyCount}, Double Jeopardy: ${doubleJeopardyCount})`, dailyDoubles);
      }
    }
  }, [game?.gameClues]);
  
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

  // Auto-start game if it's in PENDING state (only once per game)
  const [hasAutoStarted, setHasAutoStarted] = useState<string | null>(null);
  useEffect(() => {
    // Only auto-start if:
    // 1. Game exists and is PENDING
    // 2. Not currently loading
    // 3. Haven't already auto-started this specific game
    if (game && game.state === 'PENDING' && !actionLoading && !loading && hasAutoStarted !== gameId) {
      // Small delay to ensure UI is ready, then auto-start
      const timer = setTimeout(() => {
        setHasAutoStarted(gameId);
        dispatch(startGame(gameId));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [game?.state, game?.id, gameId, actionLoading, loading, hasAutoStarted, dispatch]);


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
    try {
      await dispatch(startGame(gameId));
    } catch (err) {
      console.error('Failed to start game:', err);
      // Error will be set in Redux state and displayed
    }
  };

  const handleClueClick = (clueId: string, gameClueId: string) => {
    dispatch(selectClue({ clueId, gameClueId }));
  };

  const handleSubmitWager = async (wager: number) => {
    if (!selectedClue || !game) return;
    await dispatch(submitClueWager({ gameId, clueId: selectedClue.gameClueId, wager }));
    // After wager is submitted, move to question step
    setDailyDoubleStep('question');
  };

  const handleAnswerClue = async (correct: boolean) => {
    if (!selectedClue) return;
    // Use gameClueId (GameClue ID) not clueId (Clue ID) - backend expects GameClue ID
    await dispatch(answerClue({ gameId, clueId: selectedClue.gameClueId, correct }));
  };

  const handleFinalJeopardyWager = async (wager: number) => {
    await dispatch(submitFinalJeopardyWager({ gameId, wager }));
  };

  const handleFinalJeopardyAnswer = async (correct: boolean) => {
    await dispatch(answerFinalJeopardy({ gameId, correct }));
  };

  const handleCloseClue = () => {
    dispatch(setSelectedClue(null));
    setDailyDoubleStep('intro'); // Reset Daily Double flow when closing
  };
  
  // Reset Daily Double step when a new Daily Double is selected
  useEffect(() => {
    if (selectedClue?.isDailyDouble) {
      if (selectedClue.state === 'UNANSWERED') {
        setDailyDoubleStep('intro');
      } else if (selectedClue.state === 'ANSWERED') {
        // If wager was already submitted, go directly to question step
        setDailyDoubleStep('question');
      }
    }
  }, [selectedClue?.gameClueId, selectedClue?.isDailyDouble, selectedClue?.state]);

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
      {/* Score Display - centered with same dimensions as a clue card */}
      {(game.state === 'ACTIVE' ||
        game.state === 'FINAL_PENDING' ||
        game.state === 'FINAL_ACTIVE') && (
        <div className="w-full flex justify-center">
          <div 
            className="h-20 flex items-center justify-center rounded-lg border-2 text-white font-bold text-lg"
            style={{
              backgroundColor: '#001AA5',
              borderColor: '#00188C',
              width: '159px', // Match the width of a clue card (from user's DOM inspection)
            }}
          >
            <ScoreDisplay score={game.score} className="text-white" />
          </div>
        </div>
      )}

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
        <div className="p-6 rounded-lg border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.3)', borderColor: '#00188C', color: 'white' }}>
          <h2 className="text-2xl font-bold mb-4 text-white">Ready to Start</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
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
              userEmail={user?.email}
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
                    <p className="mt-2 text-sm text-white opacity-80">
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
              answer: game.finalJeopardy.clue.answer,
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
              answer: game.finalJeopardy.clue.answer,
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
              <p style={{ color: '#EAAB66' }}>{game.finalJeopardy.clue.question}</p>
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
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.95)', borderColor: '#00188C', color: 'white' }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-center text-white">
                  {selectedClue.isDailyDouble ? 'Daily Double' : 'Clue'}
                </h3>
                {selectedClue.category && (
                  <p className="text-lg text-white mt-1 text-center opacity-90">{selectedClue.category}</p>
                )}
              </div>
              <button
                onClick={handleCloseClue}
                className="text-white hover:opacity-70 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {selectedClue.isDailyDouble && selectedClue.state === 'UNANSWERED' && dailyDoubleStep === 'intro' && (
              <div className="space-y-6 text-center">
                <h2 className="text-4xl font-bold text-blue-600">Daily Double</h2>
                <Button
                  onClick={() => setDailyDoubleStep('wager')}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}
            
            {selectedClue.isDailyDouble && selectedClue.state === 'UNANSWERED' && dailyDoubleStep === 'wager' && (
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
                round={board?.currentRound === 'DOUBLE_JEOPARDY' ? 'DOUBLE_JEOPARDY' : 'JEOPARDY'}
              />
            )}
            
            {selectedClue.isDailyDouble && (selectedClue.state === 'ANSWERED' || dailyDoubleStep === 'question') && (
              <div>
                {selectedClue.question ? (
                  <AnswerAdjudication
                    question={selectedClue.question}
                    answer={selectedClue.answer}
                    onAnswer={handleAnswerClue}
                    loading={actionLoading}
                    gameClues={game?.gameClues}
                    gameClueId={selectedClue.gameClueId}
                    clueId={selectedClue.clueId}
                    gameId={gameId}
                  />
                ) : (
                  <p className="text-gray-700 mb-4">Loading question...</p>
                )}
              </div>
            )}

            {selectedClue.state === 'ANSWERED' && !selectedClue.isDailyDouble && (
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
                  <p style={{ color: '#EAAB66' }}>{selectedClue.question}</p>
                </div>
                {selectedClue.answer && (
                  <div>
                    <h4 className="font-semibold mb-2 text-white">Answer:</h4>
                    <p className="text-white">{selectedClue.answer}</p>
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
                <div className="text-white">Loading question...</div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
