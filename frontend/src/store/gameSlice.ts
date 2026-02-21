import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  getGame,
  getBoard,
  startGame as apiStartGame,
  answerClue as apiAnswerClue,
  passClue as apiPassClue,
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
  category?: string;
}

interface GameState {
  gameId: string | null;
  game: GameResponse | null;
  board: BoardResponse | null;
  selectedClue: SelectedClue | null;
  actionLoading: boolean;
  error: string | null;
  previousGameState: string | null;
}

const initialState: GameState = {
  gameId: null,
  game: null,
  board: null,
  selectedClue: null,
  actionLoading: false,
  error: null,
  previousGameState: null,
};

/** Extract error payload from ApiClientError or plain error-like object (avoids Jest worker issues with Error instances). */
function getErrorPayload(
  err: unknown,
  fallback: string,
): { error: string; statusCode?: number } {
  if (err instanceof ApiClientError) {
    return { error: err.message, statusCode: err.statusCode };
  }
  // Plain objects with statusCode (e.g. from API) - use their message
  if (
    err &&
    typeof err === 'object' &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return {
      error: (err as { message: string }).message,
      statusCode: (err as { statusCode: number }).statusCode,
    };
  }
  return { error: fallback, statusCode: 500 };
}

// Thunk to fetch game and board data
export const fetchGameData = createAsyncThunk(
  'game/fetchGameData',
  async (gameId: string, { rejectWithValue }) => {
    try {
      const [gameData, boardData] = await Promise.all([
        getGame(gameId),
        getBoard(gameId).catch(() => null), // Board may not exist for PENDING games
      ]);
      return { game: gameData, board: boardData };
    } catch (err) {
      const payload = getErrorPayload(err, 'Failed to load game. Please try again.');
      return rejectWithValue(payload);
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
      const payload = getErrorPayload(err, 'Failed to start game. Please try again.');
      return rejectWithValue(payload);
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
            category: category.name,
          };
          break;
        }
      }

      if (!clueData) {
        return rejectWithValue({ error: 'Clue not found' });
      }

      // If clue is UNANSWERED and we don't have question, fetch full game data
      if (clueData.state === 'UNANSWERED' && !clueData.question) {
        await dispatch(fetchGameData(game.id));
        const updatedState = getState() as { game: GameState };
        const updatedGame = updatedState.game.game;
        if (updatedGame) {
          const gameClue = updatedGame.gameClues?.find(
            (gc) => gc.id === gameClueId,
          );
          if (gameClue) {
            clueData.question = gameClue.clue.question;
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
      const response = await apiAnswerClue(gameId, clueId, correct);
      await dispatch(fetchGameData(gameId));
      return response;
    } catch (err) {
      const payload = getErrorPayload(err, 'Failed to submit answer. Please try again.');
      return rejectWithValue(payload);
    }
  },
);

// Thunk to pass on a clue (regular clues only; not allowed for Daily Doubles)
export const passClue = createAsyncThunk(
  'game/passClue',
  async (
    { gameId, clueId }: { gameId: string; clueId: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const response = await apiPassClue(gameId, clueId);
      await dispatch(fetchGameData(gameId));
      return response;
    } catch (err) {
      const payload = getErrorPayload(err, 'Failed to pass clue. Please try again.');
      return rejectWithValue(payload);
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
      const state = getState() as { game: GameState };
      const { board, selectedClue } = state.game;
      
      if (selectedClue && board?.board && 'categories' in board.board) {
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
                state: clue.state,
                maxWager: response.maxWager, // Extract from backend response
              },
            };
          }
        }
      }
      
      // If selectedClue exists, update maxWager even if clue not found in board
      if (selectedClue) {
        return {
          updatedClue: {
            ...selectedClue,
            maxWager: response.maxWager, // Extract from backend response
          },
        };
      }
      
      return;
    } catch (err) {
      const payload = getErrorPayload(err, 'Failed to submit wager. Please try again.');
      return rejectWithValue(payload);
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
      const payload = getErrorPayload(err, 'Failed to submit wager. Please try again.');
      return rejectWithValue(payload);
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
      const payload = getErrorPayload(err, 'Failed to submit answer. Please try again.');
      return rejectWithValue(payload);
    }
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
    resetGameState: () => initialState,
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

        // Do not clear selectedClue here when clue becomes RESOLVED: after Pass we keep
        // the dialog open so the user can review the answer and click Continue; clearing
        // is done in answerClue.fulfilled (after answer) or by the user clicking Continue.
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
        state.selectedClue = action.payload;
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
      .addCase(answerClue.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.selectedClue = null; // Close clue modal
        // When backend transitioned to FINAL_PENDING/ELIMINATED, it returns the updated game
        if (action.payload?.game) {
          state.game = action.payload.game;
          state.gameId = action.payload.game.id;
          state.previousGameState = action.payload.game.state;
        }
      })
      .addCase(answerClue.rejected, (state, action) => {
        state.actionLoading = false;
        const payload = action.payload as { error?: string; statusCode?: number };
        if (payload?.error) {
          state.error = payload.error;
        }
      });

    // passClue
    builder
      .addCase(passClue.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(passClue.fulfilled, (state, action) => {
        state.actionLoading = false;
        // Keep selectedClue so UI can show answer + Continue; parent clears on Continue
        if (action.payload?.game) {
          state.game = action.payload.game;
          state.gameId = action.payload.game.id;
          state.previousGameState = action.payload.game.state;
        }
      })
      .addCase(passClue.rejected, (state, action) => {
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
