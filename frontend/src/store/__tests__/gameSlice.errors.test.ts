import { configureStore } from '@reduxjs/toolkit';
import gameReducer, {
  fetchGameData,
  startGame,
  answerClue,
  submitClueWager,
  submitFinalJeopardyWager,
  answerFinalJeopardy,
  type GameState,
} from '../gameSlice';
import * as gamesApi from '@/lib/api/games';
import { ApiClientError } from '@/lib/api/client';
import { createMockGame } from '@/test-utils/mocks/gameMocks';
import { createMockBoardResponse } from '@/test-utils/mocks/boardMocks';

jest.mock('@/lib/api/games');

describe('gameSlice error handling', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { game: gameReducer },
    });
    jest.clearAllMocks();
  });

  describe('ApiClientError handling', () => {
    it('should handle 400 validation errors', async () => {
      const error = new ApiClientError(400, 'Invalid wager amount', 'Bad Request');
      (gamesApi.submitClueWager as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(
        submitClueWager({ gameId: 'game-1', clueId: 'clue-1', wager: -100 }),
      );

      expect(result.type).toBe('game/submitClueWager/rejected');
      expect(store.getState().game.error).toBe('Invalid wager amount');
      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should handle 401 unauthorized errors', async () => {
      const error = new ApiClientError(401, 'Unauthorized access', 'Unauthorized');
      (gamesApi.getGame as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Unauthorized access');
      // Component should handle redirect
    });

    it('should handle 403 forbidden errors', async () => {
      const error = new ApiClientError(403, 'Access denied', 'Forbidden');
      (gamesApi.getGame as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Access denied');
      // Component should handle redirect
    });

    it('should handle 404 not found errors', async () => {
      const error = new ApiClientError(404, 'Game not found', 'Not Found');
      (gamesApi.getGame as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Game not found');
    });

    it('should handle 500 server errors', async () => {
      const error = new ApiClientError(500, 'Internal server error', 'Internal Server Error');
      (gamesApi.getGame as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Internal server error');
    });
  });

  describe('network error handling', () => {
    it('should handle network failures during fetchGameData', async () => {
      (gamesApi.getGame as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Failed to load game. Please try again.');
    });

    it('should handle network failures during action thunks', async () => {
      (gamesApi.answerClue as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await store.dispatch(
        answerClue({ gameId: 'game-1', clueId: 'clue-1', correct: true }),
      );

      expect(result.type).toBe('game/answerClue/rejected');
      expect(store.getState().game.error).toBe('Failed to submit answer. Please try again.');
      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should handle timeout scenarios', async () => {
      (gamesApi.getGame as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      );

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBeTruthy();
    });
  });

  describe('error state clearing', () => {
    it('should clear error on successful retry (fetchGameData.fulfilled)', async () => {
      const stateWithError: GameState = {
        gameId: 'game-1',
        game: null,
        board: null,
        selectedClue: null,
        actionLoading: false,
        error: 'Previous error',
        isPolling: false,
        pollingIntervalId: null,
        previousGameState: null,
      };

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: { game: stateWithError },
      });

      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.error).toBeNull();
    });

    it('should clear error on successful action (answerClue.fulfilled)', async () => {
      const stateWithError: GameState = {
        gameId: 'game-1',
        game: createMockGame('ACTIVE'),
        board: createMockBoardResponse(),
        selectedClue: null,
        actionLoading: false,
        error: 'Previous error',
        isPolling: false,
        pollingIntervalId: null,
        previousGameState: 'ACTIVE',
      };

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: { game: stateWithError },
      });

      (gamesApi.answerClue as jest.Mock).mockResolvedValue({
        gameClueId: 'gc-1',
        clueId: 'clue-1',
        state: 'ANSWERED' as const,
        correct: true,
        scoreDelta: 200,
        newScore: 200,
        answeredAt: '2024-01-01T00:00:00Z',
        message: 'Correct!',
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(createMockGame('ACTIVE'));
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(createMockBoardResponse());

      await store.dispatch(answerClue({ gameId: 'game-1', clueId: 'clue-1', correct: true }));

      expect(store.getState().game.error).toBeNull();
    });

    it('should clear error on successful action (submitClueWager.fulfilled)', async () => {
      const stateWithError: GameState = {
        gameId: 'game-1',
        game: createMockGame('ACTIVE'),
        board: createMockBoardResponse(),
        selectedClue: {
          clueId: 'clue-1',
          gameClueId: 'gc-1',
          question: 'Test?',
          isDailyDouble: true,
          state: 'UNANSWERED',
        },
        actionLoading: false,
        error: 'Previous error',
        isPolling: false,
        pollingIntervalId: null,
        previousGameState: 'ACTIVE',
      };

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: { game: stateWithError },
      });

      (gamesApi.submitClueWager as jest.Mock).mockResolvedValue({
        gameClueId: 'gc-1',
        clueId: 'clue-1',
        wager: 500,
        currentScore: 1000,
        maxWager: 2000,
        message: 'Wager submitted',
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(createMockGame('ACTIVE'));
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(createMockBoardResponse());

      await store.dispatch(submitClueWager({ gameId: 'game-1', clueId: 'clue-1', wager: 500 }));

      expect(store.getState().game.error).toBeNull();
    });

    it('should clear error on new action attempt (pending cases)', async () => {
      const stateWithError: GameState = {
        gameId: 'game-1',
        game: createMockGame('ACTIVE'),
        board: createMockBoardResponse(),
        selectedClue: null,
        actionLoading: false,
        error: 'Previous error',
        isPolling: false,
        pollingIntervalId: null,
        previousGameState: 'ACTIVE',
      };

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: { game: stateWithError },
      });

      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      // Dispatch pending action
      store.dispatch(fetchGameData('game-1'));

      // Error should be cleared immediately on pending
      expect(store.getState().game.error).toBeNull();
    });
  });

  describe('UI state recovery', () => {
    it('should clear actionLoading on error', async () => {
      const error = new ApiClientError(400, 'Invalid request', 'Bad Request');
      (gamesApi.startGame as jest.Mock).mockRejectedValue(error);

      store.dispatch(startGame('game-1'));
      expect(store.getState().game.actionLoading).toBe(true);

      await Promise.resolve(); // Wait for rejection

      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should not get stuck in loading state', async () => {
      const error = new ApiClientError(500, 'Server error', 'Internal Server Error');
      (gamesApi.answerClue as jest.Mock).mockRejectedValue(error);

      await store.dispatch(answerClue({ gameId: 'game-1', clueId: 'clue-1', correct: true }));

      expect(store.getState().game.actionLoading).toBe(false);
      expect(store.getState().game.error).toBeTruthy();
    });

    it('should provide user-friendly error messages', async () => {
      const error = new ApiClientError(400, 'Validation failed', 'Bad Request');
      (gamesApi.submitClueWager as jest.Mock).mockRejectedValue(error);

      await store.dispatch(submitClueWager({ gameId: 'game-1', clueId: 'clue-1', wager: 500 }));

      const errorMessage = store.getState().game.error;
      expect(errorMessage).toBe('Validation failed');
      expect(errorMessage).not.toContain('ApiClientError');
      expect(errorMessage).not.toContain('[object Object]');
    });
  });
});
