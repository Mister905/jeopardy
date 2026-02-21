import { configureStore } from '@reduxjs/toolkit';
import gameReducer, { fetchGameData, startGame, type GameState } from '../gameSlice';
import * as gamesApi from '@/lib/api/games';
import {
  createMockGame,
  mockPendingGame,
  mockActiveGame,
  mockFinalPendingGame,
  mockFinalActiveGame,
  mockCompletedGame,
} from '@/test-utils/mocks/gameMocks';
import { createMockBoardResponse, createMockJeopardyBoard } from '@/test-utils/mocks/boardMocks';
import { createMockSelectedClue } from '@/test-utils/test-utils';

jest.mock('@/lib/api/games');

describe('gameSlice state transitions', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { game: gameReducer },
    });
    jest.clearAllMocks();
  });

  describe('round transitions', () => {
    it('should transition PENDING → ACTIVE via startGame', async () => {
      const pendingGame = createMockGame('PENDING');
      const activeGame = createMockGame('ACTIVE');
      const board = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY');

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: pendingGame,
            board: null,
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'PENDING',
          },
        },
      });

      (gamesApi.startGame as jest.Mock).mockResolvedValue({
        message: 'Game started',
        game: activeGame,
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(activeGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(startGame('game-1'));

      expect(store.getState().game.game?.state).toBe('ACTIVE');
      expect(store.getState().game.previousGameState).toBe('ACTIVE');
    });

    it('should transition ACTIVE → FINAL_PENDING via fetchGameData', async () => {
      const activeGame = createMockGame('ACTIVE');
      const finalPendingGame = createMockGame('FINAL_PENDING');
      const board = createMockBoardResponse('game-1', 'FINAL_PENDING', 'DOUBLE_JEOPARDY');

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: activeGame,
            board: createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY'),
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(finalPendingGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.game?.state).toBe('FINAL_PENDING');
      expect(store.getState().game.previousGameState).toBe('FINAL_PENDING');
    });

    it('should transition FINAL_PENDING → FINAL_ACTIVE via fetchGameData', async () => {
      const finalPendingGame = createMockGame('FINAL_PENDING');
      const finalActiveGame = createMockGame('FINAL_ACTIVE');
      const board = createMockBoardResponse('game-1', 'FINAL_ACTIVE', 'FINAL');

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: finalPendingGame,
            board: createMockBoardResponse('game-1', 'FINAL_PENDING', 'DOUBLE_JEOPARDY'),
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'FINAL_PENDING',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(finalActiveGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.game?.state).toBe('FINAL_ACTIVE');
      expect(store.getState().game.previousGameState).toBe('FINAL_ACTIVE');
    });

    it('should transition to COMPLETED terminal state', async () => {
      const activeGame = createMockGame('ACTIVE');
      const completedGame = createMockGame('COMPLETED');
      const board = createMockBoardResponse('game-1', 'COMPLETED', null);

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: activeGame,
            board: createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY'),
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(completedGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.game?.state).toBe('COMPLETED');
    });

    it('should transition to ELIMINATED terminal state', async () => {
      const activeGame = createMockGame('ACTIVE');
      const eliminatedGame = createMockGame('ELIMINATED');
      const board = createMockBoardResponse('game-1', 'ELIMINATED', null);

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: activeGame,
            board: createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY'),
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(eliminatedGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.game?.state).toBe('ELIMINATED');
    });
  });

  describe('selectedClue lifecycle', () => {
    it('should set selectedClue via selectClue thunk', async () => {
      const mockGame = createMockGame('ACTIVE');
      const board = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY', createMockJeopardyBoard());

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board,
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      const { selectClue } = await import('../gameSlice');
      await store.dispatch(selectClue({ clueId: 'clue-1', gameClueId: 'gc-1' }));

      expect(store.getState().game.selectedClue).toBeTruthy();
      expect(store.getState().game.selectedClue?.gameClueId).toBe('gc-1');
    });

    it('should clear selectedClue on transition to FINAL_PENDING', async () => {
      const activeGame = createMockGame('ACTIVE');
      const finalPendingGame = createMockGame('FINAL_PENDING');
      const board = createMockBoardResponse('game-1', 'FINAL_PENDING', 'DOUBLE_JEOPARDY');
      const selectedClue = createMockSelectedClue();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: activeGame,
            board: createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY'),
            selectedClue,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(finalPendingGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.selectedClue).toBeNull();
    });

    it('should clear selectedClue on transition to FINAL_ACTIVE', async () => {
      const finalPendingGame = createMockGame('FINAL_PENDING');
      const finalActiveGame = createMockGame('FINAL_ACTIVE');
      const board = createMockBoardResponse('game-1', 'FINAL_ACTIVE', 'FINAL');
      const selectedClue = createMockSelectedClue();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: finalPendingGame,
            board: createMockBoardResponse('game-1', 'FINAL_PENDING', 'DOUBLE_JEOPARDY'),
            selectedClue,
            actionLoading: false,
            error: null,
            previousGameState: 'FINAL_PENDING',
          },
        },
      });

      (gamesApi.getGame as jest.Mock).mockResolvedValue(finalActiveGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      await store.dispatch(fetchGameData('game-1'));

      expect(store.getState().game.selectedClue).toBeNull();
    });

    it('should clear selectedClue after answerClue succeeds', async () => {
      const mockGame = createMockGame('ACTIVE');
      const selectedClue = createMockSelectedClue();
      const board = createMockBoardResponse();

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board,
            selectedClue,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
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
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      const { answerClue } = await import('../gameSlice');
      await store.dispatch(answerClue({ gameId: 'game-1', clueId: 'clue-1', correct: true }));

      expect(store.getState().game.selectedClue).toBeNull();
    });

    it('should update selectedClue with maxWager after submitClueWager', async () => {
      const mockGame = createMockGame('ACTIVE');
      const selectedClue = createMockSelectedClue({ gameClueId: 'gc-1', isDailyDouble: true });
      const board = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY', createMockJeopardyBoard());
      
      // Make clue ANSWERED in board
      if (board.board && 'categories' in board.board) {
        board.board.categories[0].clues[0].state = 'ANSWERED';
      }

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: mockGame,
            board,
            selectedClue,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      (gamesApi.submitClueWager as jest.Mock).mockResolvedValue({
        gameClueId: 'gc-1',
        clueId: 'clue-1',
        wager: 500,
        currentScore: 1000,
        maxWager: 2000,
        message: 'Wager submitted',
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(board);

      const { submitClueWager } = await import('../gameSlice');
      await store.dispatch(submitClueWager({ gameId: 'game-1', clueId: 'clue-1', wager: 500 }));

      expect(store.getState().game.selectedClue?.maxWager).toBe(2000);
    });
  });
});
