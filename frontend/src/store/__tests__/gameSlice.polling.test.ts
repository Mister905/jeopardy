import { configureStore } from '@reduxjs/toolkit';
import gameReducer, { startPolling, stopPolling, resetGameState, type GameState } from '../gameSlice';
import { fetchGameData } from '../gameSlice';
import * as gamesApi from '@/lib/api/games';
import { createMockGame } from '@/test-utils/mocks/gameMocks';
import { createMockBoardResponse } from '@/test-utils/mocks/boardMocks';

jest.mock('@/lib/api/games');

describe('gameSlice polling behavior', () => {
  let store: ReturnType<typeof configureStore>;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;
  let intervalIds: NodeJS.Timeout[];

  beforeEach(() => {
    jest.useFakeTimers();
    intervalIds = [];
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Track interval IDs
    global.setInterval = jest.fn((fn, delay) => {
      const id = originalSetInterval(fn, delay);
      intervalIds.push(id);
      return id;
    }) as any;

    global.clearInterval = jest.fn((id) => {
      originalClearInterval(id);
    }) as any;

    store = configureStore({
      reducer: { game: gameReducer },
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    intervalIds.forEach((id) => originalClearInterval(id));
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  describe('startPolling', () => {
    it('should start polling for ACTIVE game', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(startPolling('game-1'));

      expect(store.getState().game.isPolling).toBe(true);
      expect(store.getState().game.pollingIntervalId).toBeTruthy();
    });

    it('should start polling for FINAL_PENDING game', async () => {
      const mockGame = createMockGame('FINAL_PENDING');
      const mockBoard = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'FINAL_PENDING',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(startPolling('game-1'));

      expect(store.getState().game.isPolling).toBe(true);
    });

    it('should not start polling if already polling', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      const existingIntervalId = setInterval(() => {}, 1000) as any;

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: true,
            pollingIntervalId: existingIntervalId,
            previousGameState: 'ACTIVE',
          },
        },
      });

      await store.dispatch(startPolling('game-1'));

      // Should not create a new interval
      expect(store.getState().game.pollingIntervalId).toBe(existingIntervalId);
    });

    it('should not start polling if game state does not require it', async () => {
      const mockGame = createMockGame('PENDING');
      const mockBoard = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'PENDING',
          },
        },
      });

      await store.dispatch(startPolling('game-1'));

      expect(store.getState().game.isPolling).toBe(false);
    });

    it('should clear existing interval before starting new one', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      const existingIntervalId = setInterval(() => {}, 1000) as any;

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: existingIntervalId,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(startPolling('game-1'));

      expect(global.clearInterval).toHaveBeenCalledWith(existingIntervalId);
    });

    it('should dispatch fetchGameData on interval', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(startPolling('game-1'));

      const initialCallCount = (gamesApi.getGame as jest.Mock).mock.calls.length;

      // Fast-forward timer to trigger interval
      jest.advanceTimersByTime(3000);

      // Wait for async operations
      await Promise.resolve();

      expect(gamesApi.getGame).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('should skip polling when actionLoading is true', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: true,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(startPolling('game-1'));

      const initialCallCount = (gamesApi.getGame as jest.Mock).mock.calls.length;

      // Fast-forward timer
      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      // Should not have called fetchGameData because actionLoading is true
      expect(gamesApi.getGame).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should stop polling when game state changes to terminal state', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      const completedGame = createMockGame('COMPLETED');
      const completedBoard = createMockBoardResponse('game-1', 'COMPLETED', null);

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      // startPolling doesn't call the API, so first mock is for fetchGameData
      (gamesApi.getGame as jest.Mock).mockResolvedValueOnce(completedGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValueOnce(completedBoard);

      await store.dispatch(startPolling('game-1'));

      // Verify polling started
      expect(store.getState().game.isPolling).toBe(true);
      expect(store.getState().game.pollingIntervalId).toBeTruthy();

      // Simulate state change to COMPLETED via fetchGameData
      await store.dispatch(fetchGameData('game-1'));

      // Verify game state changed
      expect(store.getState().game.game?.state).toBe('COMPLETED');

      // Polling should have stopped after state change
      expect(store.getState().game.isPolling).toBe(false);
      expect(store.getState().game.pollingIntervalId).toBeNull();
    });

    it('should handle race condition with interval ID mismatch', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      await store.dispatch(startPolling('game-1'));
      const intervalId = store.getState().game.pollingIntervalId;

      // Stop polling (clears interval)
      await store.dispatch(stopPolling());

      // Fast-forward timer - should not dispatch because interval was cleared
      const initialCallCount = (gamesApi.getGame as jest.Mock).mock.calls.length;
      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      // Should not have called fetchGameData because interval ID was cleared
      expect(gamesApi.getGame).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('stopPolling', () => {
    it('should stop polling and clear interval', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      const intervalId = setInterval(() => {}, 1000) as any;

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board: mockBoard,
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: true,
            pollingIntervalId: intervalId,
            previousGameState: 'ACTIVE',
          },
        },
      });

      await store.dispatch(stopPolling());

      expect(global.clearInterval).toHaveBeenCalledWith(intervalId);
      expect(store.getState().game.isPolling).toBe(false);
      expect(store.getState().game.pollingIntervalId).toBeNull();
    });

    it('should handle stopping when no interval exists', async () => {
      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: createMockGame('ACTIVE'),
            board: createMockBoardResponse(),
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: false,
            pollingIntervalId: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      await store.dispatch(stopPolling());

      expect(store.getState().game.isPolling).toBe(false);
    });
  });

  describe('resetGameState', () => {
    it('should clear polling interval on reset', () => {
      const intervalId = setInterval(() => {}, 1000) as any;

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: createMockGame('ACTIVE'),
            board: createMockBoardResponse(),
            selectedClue: null,
            actionLoading: false,
            error: null,
            isPolling: true,
            pollingIntervalId: intervalId,
            previousGameState: 'ACTIVE',
          },
        },
      });

      store.dispatch(resetGameState());

      expect(global.clearInterval).toHaveBeenCalledWith(intervalId);
      expect(store.getState().game.isPolling).toBe(false);
      expect(store.getState().game.pollingIntervalId).toBeNull();
    });
  });
});
