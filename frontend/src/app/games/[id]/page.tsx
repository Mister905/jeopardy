'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  clearError,
  setSelectedClue,
  resetGameState,
} from '@/store/gameSlice';
import { GameBoard } from '@/components/game/GameBoard';
import { FinalJeopardyView } from '@/components/game/FinalJeopardyView';
import { ScoreDisplay } from '@/components/game/ScoreDisplay';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { AnswerAdjudication } from '@/components/game/AnswerAdjudication';
import { WagerInput } from '@/components/game/WagerInput';
import { createGame } from '@/lib/api/games';
import { getUserDashboard } from '@/lib/api/user';
import type { JeopardyBoard } from '@/lib/api/types';

// Mark as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useRequireAuth();
  const gameId = params.id as string;
  const dispatch = useAppDispatch();
  const autoStartAttempted = useRef(false);
  
  // Track Daily Double flow step: 'intro' | 'wager' | 'question'
  const [dailyDoubleStep, setDailyDoubleStep] = useState<'intro' | 'wager' | 'question'>('intro');
  const [username, setUsername] = useState<string | null>(null);

  // Get all state from Redux
  const game = useAppSelector((state) => state.game.game);
  const board = useAppSelector((state) => state.game.board);
  const selectedClue = useAppSelector((state) => state.game.selectedClue);
  const actionLoading = useAppSelector((state) => state.game.actionLoading);
  const error = useAppSelector((state) => state.game.error);
  const currentGameId = useAppSelector((state) => state.game.gameId);
  const loading = useAppSelector((state) => !state.game.game && !state.game.error);

  // Clear game state when gameId changes to prevent showing previous game
  // This ensures we don't briefly show the previous game's board when navigating
  useEffect(() => {
    if (gameId) {
      // If we have a different game loaded, or if we have game data but it's for a different game, clear it
      if (
        (currentGameId && currentGameId !== gameId) ||
        (game && game.id !== gameId)
      ) {
        // Game ID changed, clear the old game state immediately
        dispatch(resetGameState());
      }
    }
  }, [gameId, currentGameId, game?.id, dispatch]);

  // Initialize game data on mount
  useEffect(() => {
    if (!authLoading && user && gameId) {
      // Only fetch if we don't have game data or if gameId changed
      if (!game || game.id !== gameId) {
        dispatch(fetchGameData(gameId));
      }
    }
  }, [authLoading, user, gameId, dispatch, game?.id]);

  // Fetch username for display
  useEffect(() => {
    if (!authLoading && user && !username) {
      getUserDashboard()
        .then((data) => setUsername(data.username))
        .catch((err) => {
          console.error('Failed to fetch username:', err);
          // Don't set username on error, will fallback to round name
        });
    }
  }, [authLoading, user, username]);

  const handleStartGame = async () => {
    if (!game) return;
    await dispatch(startGame(gameId));
  };

  // Auto-start game if requested via query parameter
  useEffect(() => {
    const autoStart = searchParams?.get('autoStart') === 'true';
    if (
      autoStart &&
      !autoStartAttempted.current &&
      game &&
      game.state === 'PENDING' &&
      !actionLoading
    ) {
      autoStartAttempted.current = true;
      // Start the game automatically
      dispatch(startGame(gameId));
      // Remove query parameter from URL
      router.replace(`/games/${gameId}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, actionLoading, searchParams, gameId, router]);

  // Polling removed - not needed for single-player game
  // All state changes are triggered by user actions which already fetch game data

  // Handle 401/403 errors - redirect to login
  useEffect(() => {
    if (error && typeof error === 'string' && error.includes('access denied')) {
      router.push('/auth/login');
    }
  }, [error, router]);

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

  // Don't show old game data if gameId doesn't match
  const isGameIdMismatch = game && game.id !== gameId;
  const shouldShowLoading = authLoading || loading || isGameIdMismatch;

  if (shouldShowLoading) {
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
          onClick={() => router.push('/')}
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
              borderColor: '#3F3A3E',
              width: '159px', // Match the width of a clue card
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
          {actionLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-white text-lg">Preparing your game board...</p>
            </div>
          ) : (
            <>
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
                Start Game
              </Button>
            </>
          )}
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
              username={username || undefined}
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
                      If the board doesn&apos;t load, try refreshing the page.
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
        <div 
          className="p-6 rounded-lg border-2"
          style={{
            backgroundColor: 'rgba(0, 26, 165, 0.3)',
            borderColor: '#00188C',
            color: 'white',
          }}
        >
          <h2 className="text-2xl font-bold mb-4 text-center">
            {game.state === 'COMPLETED' ? 'Game Completed!' : 'Game Over'}
          </h2>
          <p className="text-lg mb-4 text-center">
            Final Score: <ScoreDisplay score={game.score} className="inline" />
          </p>
          <p className="text-lg mb-4 text-center">Thanks for playing.</p>
          <div className="flex gap-4 mt-4 justify-center">
            <Button
              onClick={() => router.push('/')}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
              Home
            </Button>
            <Button
              onClick={async () => {
                try {
                  // Retrieve username from localStorage if available
                  const username = localStorage.getItem('pendingUsername') || undefined;
                  const newGame = await createGame(username);
                  // Clear pending username after successful game creation
                  if (username) {
                    localStorage.removeItem('pendingUsername');
                  }
                  router.push(`/games/${newGame.id}`);
                } catch (err) {
                  console.error('Failed to create new game:', err);
                }
              }}
              variant="secondary"
            >
              New Game
            </Button>
          </div>
        </div>
      )}

      {/* Selected Clue Modal/View */}
      {selectedClue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-10 border-2" style={{ backgroundColor: 'rgba(0, 26, 165, 0.95)', borderColor: '#00188C', color: 'white' }}>
            {!selectedClue.isDailyDouble && (
              <h3 className="text-2xl font-bold text-center text-white mb-4">
                {selectedClue.category || 'Clue'}
              </h3>
            )}

            {selectedClue.isDailyDouble && selectedClue.state === 'UNANSWERED' && dailyDoubleStep === 'intro' && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <img 
                    src="/daily_double.png" 
                    alt="Daily Double" 
                    className="max-w-md w-full h-auto"
                    onError={(e) => {
                      // Fallback if image doesn't exist - hide the image element
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <Button
                  onClick={() => setDailyDoubleStep('wager')}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}
            
            {selectedClue.isDailyDouble && selectedClue.state === 'UNANSWERED' && dailyDoubleStep === 'wager' && (
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-center text-white">Enter your wager:</h3>
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
                <p className="text-sm text-white opacity-80 text-center mt-8 font-bold">
                  You can wager up to ${board?.currentRound === 'DOUBLE_JEOPARDY' ? '2,000' : '1,000'} or your current score, whichever is greater.
                </p>
              </div>
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
                <AnswerAdjudication
                  question={selectedClue.question}
                  answer={selectedClue.answer}
                  gameClues={game?.gameClues}
                  gameClueId={selectedClue.gameClueId}
                  clueId={selectedClue.clueId}
                  gameId={gameId}
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
