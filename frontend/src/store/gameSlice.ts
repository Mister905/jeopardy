import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  getGame,
  getBoard,
  startGame as apiStartGame,
  answerClue as apiAnswerClue,
  submitClueWager as apiSubmitClueWager,
  submitFinalJeopardyWager as apiSubmitFinalJeopardyWager,
  answerFinalJeopardy as apiAnswerFinalJeopardy,
} from '@/lib/api/games';
import { ApiClientError } from '@/lib/api/client';
import type {
  GameResponse,
  BoardResponse,
  JeopardyBoard,
} from '@/lib/api/types';

export interface SelectedClue {
  clueId: string;
  gameClueId: string;
  question: string;
  answer?: string;
  isDailyDouble: boolean;
  state: string;
  maxWager?: number;
}

interface GameState {
  gameId: string | null;
  game: GameResponse | null;
  board: BoardResponse | null;
  selectedClue: SelectedClue | null;
  actionLoading: boolean;
  error: string | null;
  isPolling: boolean;
  pollingIntervalId: NodeJS.Timeout | null;
  previousGameState: string | null;
}

const initialState: GameState = {
  gameId: null,
  game: null,
  board: null,
  selectedClue: null,
  actionLoading: false,
  error: null,
  isPolling: false,
  pollingIntervalId: null,
  previousGameState: null,
};

// Thunk to fetch game and board data
export const fetchGameData = createAsyncThunk(
  'game/fetchGameData',
  async (gameId: string, { rejectWithValue }) => {
    try {
      const [gameData, boardData] = await Promise.all([
        getGame(gameId),
        getBoard(gameId).catch((boardErr) => {
          // If game is ACTIVE, board should exist - log the error
          // We'll check the game state after fetching to determine if this is a problem
          console.warn('Board fetch failed:', boardErr);
          return null;
        }),
      ]);
      
      // Verify gameClues are included (they should always be for ACTIVE games)
      if (gameData.state === 'ACTIVE' && (!gameData.gameClues || gameData.gameClues.length === 0)) {
        console.warn('Game is ACTIVE but gameClues are missing or empty');
      }
      
      // If game is ACTIVE but board is missing, this is an error condition
      if (gameData.state === 'ACTIVE' && !boardData) {
        console.error('Game is ACTIVE but board is missing');
        // Don't reject - allow the game to render with a loading state
        // The UI will show a loading message for the board
      }
      
      return { game: gameData, board: boardData };
    } catch (err) {
      if (err instanceof ApiClientError) {
        return rejectWithValue({
          error: err.message,
          statusCode: err.statusCode,
        });
      }
      return rejectWithValue({
        error: 'Failed to load game. Please try again.',
        statusCode: 500,
      });
    }
  },
);

// Thunk to start game
export const startGame = createAsyncThunk(
  'game/startGame',
  async (gameId: string, { dispatch, rejectWithValue }) => {
    try {
      await apiStartGame(gameId);
      await dispatch(fetchGameData(gameId));
      return;
    } catch (err) {
      if (err instanceof ApiClientError) {
        return rejectWithValue({
          error: err.message,
          statusCode: err.statusCode,
        });
      }
      return rejectWithValue({
        error: 'Failed to start game. Please try again.',
        statusCode: 500,
      });
    }
  },
);

// Thunk to select a clue
export const selectClue = createAsyncThunk(
  'game/selectClue',
  async (
    { clueId, gameClueId }: { clueId: string; gameClueId: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    // If empty strings, clear selection
    if (!clueId || !gameClueId) {
      return null;
    }
    try {
      const state = getState() as { game: GameState };
      const { game, board } = state.game;

      if (!board || !board.board || !game) {
        return rejectWithValue({
          error: 'Game or board data not available',
        });
      }

      const jeopardyBoard = board.board as JeopardyBoard;
      let clueData: SelectedClue | null = null;

      // Find the clue in the board
      for (const category of jeopardyBoard.categories) {
        const clue = category.clues.find((c) => c.gameClueId === gameClueId);
        if (clue) {
          clueData = {
            clueId: clue.clueId,
            gameClueId: clue.gameClueId,
            question: clue.question || '',
            answer: clue.answer,
            isDailyDouble: clue.dailyDouble,
            state: clue.state,
          };
          break;
        }
      }

      if (!clueData) {
        return rejectWithValue({ error: 'Clue not found' });
      }

      // For UNANSWERED clues, fetch full game data to get the question
      // (board data doesn't include question for UNANSWERED clues)
      if (clueData.state === 'UNANSWERED' && (!clueData.question || clueData.question.trim() === '')) {
        await dispatch(fetchGameData(game.id));
        const updatedState = getState() as { game: GameState };
        const updatedGame = updatedState.game.game;
        if (updatedGame) {
          const gameClue = updatedGame.gameClues?.find(
            (gc) => gc.id === gameClueId,
          );
          if (gameClue && gameClue.clue.question) {
            clueData.question = gameClue.clue.question;
          }
        }
      }

      // For ANSWERED clues, fetch full game data to get the answer
      // (board data doesn't include answer for ANSWERED clues, only for RESOLVED)
      // This works exactly like UNANSWERED clues fetching the question
      if (clueData.state === 'ANSWERED' && !clueData.answer) {
        await dispatch(fetchGameData(game.id));
        const updatedState = getState() as { game: GameState };
        const updatedGame = updatedState.game.game;
        if (updatedGame) {
          const gameClue = updatedGame.gameClues?.find(
            (gc) => gc.id === gameClueId,
          );
          if (gameClue && gameClue.clue.answer) {
            clueData.answer = gameClue.clue.answer;
          }
        }
      }

      // Calculate maxWager for Daily Double
      if (clueData.isDailyDouble && clueData.state === 'UNANSWERED') {
        const roundHighestValue =
          board.currentRound === 'JEOPARDY' ? 1000 : 2000;
        clueData.maxWager = Math.max(game.score, roundHighestValue);
      }

      return clueData;
    } catch (err) {
      return rejectWithValue({
        error: 'Failed to select clue. Please try again.',
      });
    }
  },
);

// Thunk to answer a clue
export const answerClue = createAsyncThunk(
  'game/answerClue',
  async (
    { gameId, clueId, correct }: { gameId: string; clueId: string; correct: boolean },
    { dispatch, rejectWithValue },
  ) => {
    try {
      await apiAnswerClue(gameId, clueId, correct);
      await dispatch(fetchGameData(gameId));
      return;
    } catch (err) {
      if (err instanceof ApiClientError) {
        return rejectWithValue({
          error: err.message,
          statusCode: err.statusCode,
        });
      }
      return rejectWithValue({
        error: 'Failed to submit answer. Please try again.',
        statusCode: 500,
      });
    }
  },
);

// Thunk to submit clue wager
export const submitClueWager = createAsyncThunk(
  'game/submitClueWager',
  async (
    { gameId, clueId, wager }: { gameId: string; clueId: string; wager: number },
    { dispatch, getState, rejectWithValue },
  ) => {
    try {
      // Extract maxWager from backend response
      const response = await apiSubmitClueWager(gameId, clueId, wager);
      await dispatch(fetchGameData(gameId));
      
      // Update selected clue with maxWager from backend and ANSWERED state
      // Extract answer from gameClues exactly like we extract question for UNANSWERED clues
      const state = getState() as { game: GameState };
      const { board, selectedClue, game } = state.game;
      
      if (selectedClue) {
        // Get answer from game data - fetchGameData just completed, so game.gameClues should be available
        let answer: string | undefined = undefined;
        if (game?.gameClues) {
          const gameClue = game.gameClues.find(
            (gc) => gc.id === selectedClue.gameClueId,
          );
          if (gameClue && gameClue.clue.answer) {
            answer = gameClue.clue.answer;
          }
        }
        
        if (board?.board && 'categories' in board.board) {
          const jeopardyBoard = board.board as JeopardyBoard;
          for (const category of jeopardyBoard.categories) {
            const clue = category.clues.find(
              (c) => c.gameClueId === selectedClue.gameClueId,
            );
            if (clue && clue.state === 'ANSWERED') {
              return {
                updatedClue: {
                  ...selectedClue,
                  question: clue.question || selectedClue.question,
                  answer: answer, // Use answer from gameClues
                  state: clue.state,
                  maxWager: response.maxWager,
                },
              };
            }
          }
        }
        
        // Update selectedClue with answer and maxWager
        // Preserve all existing fields including gameClueId and clueId
        return {
          updatedClue: {
            ...selectedClue,
            answer: answer, // Use answer from gameClues
            maxWager: response.maxWager,
            // Ensure gameClueId and clueId are preserved
            gameClueId: selectedClue.gameClueId,
            clueId: selectedClue.clueId,
          },
        };
      }
      
      return;
    } catch (err) {
      if (err instanceof ApiClientError) {
        return rejectWithValue({
          error: err.message,
          statusCode: err.statusCode,
        });
      }
      return rejectWithValue({
        error: 'Failed to submit wager. Please try again.',
        statusCode: 500,
      });
    }
  },
);

// Thunk to submit Final Jeopardy wager
export const submitFinalJeopardyWager = createAsyncThunk(
  'game/submitFinalJeopardyWager',
  async (
    { gameId, wager }: { gameId: string; wager: number },
    { dispatch, rejectWithValue },
  ) => {
    try {
      await apiSubmitFinalJeopardyWager(gameId, wager);
      await dispatch(fetchGameData(gameId));
      return;
    } catch (err) {
      if (err instanceof ApiClientError) {
        return rejectWithValue({
          error: err.message,
          statusCode: err.statusCode,
        });
      }
      return rejectWithValue({
        error: 'Failed to submit wager. Please try again.',
        statusCode: 500,
      });
    }
  },
);

// Thunk to answer Final Jeopardy
export const answerFinalJeopardy = createAsyncThunk(
  'game/answerFinalJeopardy',
  async (
    { gameId, correct }: { gameId: string; correct: boolean },
    { dispatch, rejectWithValue },
  ) => {
    try {
      await apiAnswerFinalJeopardy(gameId, correct);
      await dispatch(fetchGameData(gameId));
      return;
    } catch (err) {
      if (err instanceof ApiClientError) {
        return rejectWithValue({
          error: err.message,
          statusCode: err.statusCode,
        });
      }
      return rejectWithValue({
        error: 'Failed to submit answer. Please try again.',
        statusCode: 500,
      });
    }
  },
);

// Helper function to check if polling should be active
const shouldPoll = (gameState: string | null): boolean => {
  if (!gameState) return false;
  return (
    gameState === 'ACTIVE' ||
    gameState === 'FINAL_PENDING' ||
    gameState === 'FINAL_ACTIVE'
  );
};

// Thunk to start polling
export const startPolling = createAsyncThunk(
  'game/startPolling',
  async (gameId: string, { dispatch, getState }) => {
    const state = getState() as { game: GameState };
    const { game, isPolling, pollingIntervalId } = state.game;

    // Don't start if already polling
    if (isPolling && pollingIntervalId) {
      return;
    }

    // Don't start if game state doesn't require polling
    if (!shouldPoll(game?.state || null)) {
      return;
    }

    // Clear any existing interval
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }

    // Set up polling interval
    const intervalId = setInterval(() => {
      const currentState = getState() as { game: GameState };
      const { game: currentGame, actionLoading, pollingIntervalId: currentIntervalId } = currentState.game;

      // Check if polling was stopped (interval ID cleared) - prevents race condition
      if (!currentIntervalId || currentIntervalId !== intervalId) {
        return;
      }

      // Don't poll if action is in progress
      if (actionLoading) {
        return;
      }

      // Don't poll if game state no longer requires it
      if (!shouldPoll(currentGame?.state || null)) {
        dispatch(stopPolling());
        return;
      }

      dispatch(fetchGameData(gameId));
    }, 3000); // Poll every 3 seconds

    return intervalId;
  },
);

// Action to stop polling
export const stopPolling = createAsyncThunk(
  'game/stopPolling',
  async (_, { getState }) => {
    const state = getState() as { game: GameState };
    const { pollingIntervalId } = state.game;

    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }

    return null;
  },
);

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGame: (state, action: PayloadAction<GameResponse | null>) => {
      // State transition detection is handled in fetchGameData.fulfilled
      // This reducer is rarely called directly, so we don't duplicate the logic
      state.game = action.payload;
      state.previousGameState = action.payload?.state || null;
      state.gameId = action.payload?.id || null;
    },
    setBoard: (state, action: PayloadAction<BoardResponse | null>) => {
      state.board = action.payload;
    },
    setSelectedClue: (state, action: PayloadAction<SelectedClue | null>) => {
      state.selectedClue = action.payload;
    },
    setActionLoading: (state, action: PayloadAction<boolean>) => {
      state.actionLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetGameState: (state) => {
      // Clear polling if active
      if (state.pollingIntervalId) {
        clearInterval(state.pollingIntervalId);
      }
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // fetchGameData
    builder
      .addCase(fetchGameData.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchGameData.fulfilled, (state, action) => {
        const { game, board } = action.payload;
        
        // Update game state (this will trigger state transition detection)
        const previousState = state.previousGameState;
        const currentState = game.state;

        if (previousState && previousState !== currentState) {
          // Clear selected clue on major state changes
          if (
            currentState === 'FINAL_PENDING' ||
            currentState === 'FINAL_ACTIVE' ||
            currentState === 'COMPLETED' ||
            currentState === 'ELIMINATED'
          ) {
            state.selectedClue = null;
          }
        }

        state.game = game;
        state.board = board;
        state.previousGameState = currentState;
        state.gameId = game.id;
        state.error = null;

        // Log if gameClues are missing (they should always be included for ACTIVE games)
        if (game.state === 'ACTIVE' && (!game.gameClues || game.gameClues.length === 0)) {
          console.warn('[fetchGameData.fulfilled] Game is ACTIVE but gameClues are missing or empty', {
            gameId: game.id,
            gameClues: game.gameClues,
          });
        }

        // Restore missing IDs in selectedClue from board data if needed
        // This ensures gameClueId and clueId are always available for answer extraction
        if (state.selectedClue && board?.board && 'categories' in board.board) {
          const jeopardyBoard = board.board as JeopardyBoard;
          for (const category of jeopardyBoard.categories) {
            const clue = category.clues.find(
              (c) => 
                (state.selectedClue?.gameClueId && c.gameClueId === state.selectedClue.gameClueId) ||
                (state.selectedClue?.clueId && c.clueId === state.selectedClue.clueId) ||
                (state.selectedClue?.question && c.question === state.selectedClue.question)
            );
            if (clue) {
              // Restore missing IDs
              if (!state.selectedClue.gameClueId && clue.gameClueId) {
                state.selectedClue.gameClueId = clue.gameClueId;
              }
              if (!state.selectedClue.clueId && clue.clueId) {
                state.selectedClue.clueId = clue.clueId;
              }
              break;
            }
          }
        }

        // Update selected clue with answer if it's in ANSWERED state
        // The answer is always in gameClues, just like the question
        // This ensures the answer is available immediately when game data is fetched
        if (state.selectedClue && state.selectedClue.state === 'ANSWERED' && !state.selectedClue.answer) {
          if (game.gameClues && game.gameClues.length > 0) {
            // Try gameClueId first
            let gameClue = state.selectedClue.gameClueId
              ? game.gameClues.find((gc) => gc.id === state.selectedClue.gameClueId)
              : null;
            
            // Fallback to clueId
            if (!gameClue && state.selectedClue.clueId) {
              gameClue = game.gameClues.find((gc) => gc.clueId === state.selectedClue.clueId);
            }
            
            if (gameClue && gameClue.clue.answer) {
              state.selectedClue.answer = gameClue.clue.answer;
            }
          }
        }

        // Check if selected clue is now resolved
        if (state.selectedClue && board?.board && 'categories' in board.board) {
          const jeopardyBoard = board.board as JeopardyBoard;
          for (const category of jeopardyBoard.categories) {
            const clue = category.clues.find(
              (c) => c.gameClueId === state.selectedClue?.gameClueId,
            );
            if (clue && clue.state === 'RESOLVED' && state.selectedClue.state !== 'RESOLVED') {
              // Clue was resolved, clear selection
              state.selectedClue = null;
              break;
            }
          }
        }

        // Update polling based on new state
        const shouldStartPolling = shouldPoll(currentState);
        if (shouldStartPolling && !state.isPolling) {
          // Polling will be started by component
        } else if (!shouldStartPolling && state.isPolling) {
          // Stop polling if game reached terminal state
          if (state.pollingIntervalId) {
            clearInterval(state.pollingIntervalId);
            state.pollingIntervalId = null;
          }
          state.isPolling = false;
        }
      })
      .addCase(fetchGameData.rejected, (state, action) => {
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
        if (payload?.statusCode === 401 || payload?.statusCode === 403) {
          // Will be handled by component to redirect
        }
      });

    // startGame
    builder
      .addCase(startGame.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(startGame.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(startGame.rejected, (state, action) => {
        state.actionLoading = false;
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // selectClue
    builder
      .addCase(selectClue.pending, (state) => {
        state.error = null; // Clear error on new selection attempt
      })
      .addCase(selectClue.fulfilled, (state, action) => {
        if (!action.payload) {
          state.selectedClue = null;
          return;
        }
        
        state.selectedClue = action.payload;
        
        // If clue is ANSWERED and answer is missing, try to get it from current game state
        // This is a fallback in case the thunk didn't populate it
        if (action.payload.state === 'ANSWERED' && !action.payload.answer) {
          if (state.game?.gameClues && state.game.gameClues.length > 0) {
            // Try to find by gameClueId first
            let gameClue = state.game.gameClues.find(
              (gc) => gc.id === action.payload.gameClueId,
            );
            
            // Fallback: try to find by clueId
            if (!gameClue) {
              gameClue = state.game.gameClues.find(
                (gc) => gc.clueId === action.payload.clueId,
              );
            }
            
            if (gameClue && gameClue.clue.answer) {
              state.selectedClue.answer = gameClue.clue.answer;
            } else {
              console.warn(`[selectClue.fulfilled] Answer still missing after reducer fallback. gameClueId: ${action.payload.gameClueId}, clueId: ${action.payload.clueId}`);
            }
          }
        }
      })
      .addCase(selectClue.rejected, (state, action) => {
        const payload = action.payload as { error?: string };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // answerClue
    builder
      .addCase(answerClue.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(answerClue.fulfilled, (state) => {
        state.actionLoading = false;
        state.selectedClue = null; // Close clue modal
      })
      .addCase(answerClue.rejected, (state, action) => {
        state.actionLoading = false;
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // submitClueWager
    builder
      .addCase(submitClueWager.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(submitClueWager.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.error = null; // Clear error on success
        // Update selectedClue with maxWager from backend and ANSWERED state
        // The fetchGameData will have already updated the board, so we just need to update selectedClue
        if (action.payload?.updatedClue) {
          state.selectedClue = action.payload.updatedClue;
        } else if (state.selectedClue) {
          // If no updated clue returned, just update maxWager if we have it
          // The state will be updated by fetchGameData.fulfilled checking the board
        }
      })
      .addCase(submitClueWager.rejected, (state, action) => {
        state.actionLoading = false;
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // submitFinalJeopardyWager
    builder
      .addCase(submitFinalJeopardyWager.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(submitFinalJeopardyWager.fulfilled, (state) => {
        state.actionLoading = false;
        state.error = null; // Clear error on success
      })
      .addCase(submitFinalJeopardyWager.rejected, (state, action) => {
        state.actionLoading = false;
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // answerFinalJeopardy
    builder
      .addCase(answerFinalJeopardy.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(answerFinalJeopardy.fulfilled, (state) => {
        state.actionLoading = false;
        state.error = null; // Clear error on success
      })
      .addCase(answerFinalJeopardy.rejected, (state, action) => {
        state.actionLoading = false;
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // startPolling
    builder
      .addCase(startPolling.fulfilled, (state, action) => {
        if (action.payload) {
          state.pollingIntervalId = action.payload;
          state.isPolling = true;
        }
      });

    // stopPolling
    builder
      .addCase(stopPolling.fulfilled, (state) => {
        state.pollingIntervalId = null;
        state.isPolling = false;
      });
  },
});

export const {
  setGame,
  setBoard,
  setSelectedClue,
  setActionLoading,
  setError,
  clearError,
  resetGameState,
} = gameSlice.actions;

export default gameSlice.reducer;
