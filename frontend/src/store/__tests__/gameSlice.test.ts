import { configureStore } from '@reduxjs/toolkit';
import gameReducer, {
  fetchGameData,
  startGame,
  selectClue,
  answerClue,
  submitClueWager,
  submitFinalJeopardyWager,
  answerFinalJeopardy,
  type GameState,
} from '../gameSlice';
import * as gamesApi from '@/lib/api/games';
import { ApiClientError } from '@/lib/api/client';
import { createMockGame, mockActiveGame } from '@/test-utils/mocks/gameMocks';
import { createMockBoardResponse, createMockJeopardyBoard } from '@/test-utils/mocks/boardMocks';
import { createMockClue } from '@/test-utils/mocks/clueMocks';

// Mock the API module
jest.mock('@/lib/api/games');

describe('gameSlice thunks and extraReducers', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { game: gameReducer },
    });
    jest.clearAllMocks();
  });

  describe('fetchGameData', () => {
    it('should fetch game and board data successfully', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY');

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/fulfilled');
      expect(store.getState().game.game).toEqual(mockGame);
      expect(store.getState().game.board).toEqual(mockBoard);
      expect(store.getState().game.error).toBeNull();
      expect(store.getState().game.previousGameState).toBe('ACTIVE');
    });

    it('should handle board not existing for PENDING games', async () => {
      const mockGame = createMockGame('PENDING');

      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/fulfilled');
      expect(store.getState().game.game).toEqual(mockGame);
      expect(store.getState().game.board).toBeNull();
    });

    it('should handle ApiClientError', async () => {
      const error = new ApiClientError(404, 'Game not found', 'Not Found');
      (gamesApi.getGame as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Game not found');
    });

    it('should handle generic errors', async () => {
      (gamesApi.getGame as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await store.dispatch(fetchGameData('game-1'));

      expect(result.type).toBe('game/fetchGameData/rejected');
      expect(store.getState().game.error).toBe('Failed to load game. Please try again.');
    });

    it('should clear error on pending', async () => {
      const stateWithError = {
        ...store.getState().game,
        error: 'Previous error',
      };
      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: { game: stateWithError },
      });

      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      store.dispatch(fetchGameData('game-1'));
      expect(store.getState().game.error).toBeNull();
    });
  });

  describe('startGame', () => {
    it('should start game and fetch updated data', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();

      (gamesApi.startGame as jest.Mock).mockResolvedValue({
        message: 'Game started',
        game: mockGame,
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const result = await store.dispatch(startGame('game-1'));

      expect(result.type).toBe('game/startGame/fulfilled');
      expect(gamesApi.startGame).toHaveBeenCalledWith('game-1');
      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should handle errors', async () => {
      const error = new ApiClientError(400, 'Invalid game state', 'Bad Request');
      (gamesApi.startGame as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(startGame('game-1'));

      expect(result.type).toBe('game/startGame/rejected');
      expect(store.getState().game.error).toBe('Invalid game state');
      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should set actionLoading during execution', async () => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      (gamesApi.startGame as jest.Mock).mockResolvedValue({
        message: 'Game started',
        game: mockGame,
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const promise = store.dispatch(startGame('game-1'));
      expect(store.getState().game.actionLoading).toBe(true);
      await promise;
      expect(store.getState().game.actionLoading).toBe(false);
    });
  });

  describe('selectClue', () => {
    beforeEach(() => {
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY', createMockJeopardyBoard());
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
            previousGameState: 'ACTIVE',
          },
        },
      });
    });

    it('should select clue from board', async () => {
      const result = await store.dispatch(
        selectClue({ clueId: 'clue-1', gameClueId: 'gc-1' }),
      );

      expect(result.type).toBe('game/selectClue/fulfilled');
      expect(store.getState().game.selectedClue).toBeTruthy();
      expect(store.getState().game.selectedClue?.gameClueId).toBe('gc-1');
    });

    it('should clear selection when clueId is empty', async () => {
      const result = await store.dispatch(selectClue({ clueId: '', gameClueId: '' }));

      expect(result.type).toBe('game/selectClue/fulfilled');
      expect(store.getState().game.selectedClue).toBeNull();
    });

    it('should fetch game data if clue is UNANSWERED without question', async () => {
      const mockGame = createMockGame('ACTIVE', {
        gameClues: [
          {
            id: 'gc-1',
            gameId: 'game-1',
            clueId: 'clue-1',
            state: 'UNANSWERED',
            wager: null,
            scoreDelta: null,
            answeredAt: null,
            clue: {
              id: 'clue-1',
              category: 'Category 1',
              round: 'JEOPARDY',
              value: 200,
              question: 'What is the question?',
              answer: 'The answer',
              dailyDouble: false,
              createdAt: '2024-01-01T00:00:00Z',
            },
          },
        ],
      });
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(
        createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY'),
      );

      const board = createMockJeopardyBoard();
      board.categories[0].clues[0].question = undefined; // No question in board
      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: createMockGame('ACTIVE'),
            board: createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY', board),
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      await store.dispatch(selectClue({ clueId: 'clue-1', gameClueId: 'gc-1' }));

      expect(gamesApi.getGame).toHaveBeenCalled();
      expect(store.getState().game.selectedClue?.question).toBe('What is the question?');
    });

    it('should calculate maxWager for Daily Double', async () => {
      const board = createMockJeopardyBoard();
      board.categories[0].clues[0].dailyDouble = true;
      board.categories[0].clues[0].state = 'UNANSWERED';

      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
            gameId: 'game-1',
            game: createMockGame('ACTIVE', { score: 1000 }),
            board: createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY', board),
            selectedClue: null,
            actionLoading: false,
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });

      await store.dispatch(selectClue({ clueId: 'clue-1', gameClueId: 'gc-1' }));

      expect(store.getState().game.selectedClue?.maxWager).toBe(1000); // Max of score and round highest
    });

    it('should handle clue not found', async () => {
      const result = await store.dispatch(
        selectClue({ clueId: 'invalid', gameClueId: 'invalid' }),
      );

      expect(result.type).toBe('game/selectClue/rejected');
      expect(store.getState().game.error).toBe('Clue not found');
    });

    it('should handle missing game or board', async () => {
      store = configureStore({
        reducer: { game: gameReducer },
      });

      const result = await store.dispatch(
        selectClue({ clueId: 'clue-1', gameClueId: 'gc-1' }),
      );

      expect(result.type).toBe('game/selectClue/rejected');
      expect(store.getState().game.error).toBe('Game or board data not available');
    });
  });

  describe('answerClue', () => {
    it('should answer clue and fetch updated data', async () => {
      const mockResponse = {
        gameClueId: 'gc-1',
        clueId: 'clue-1',
        state: 'ANSWERED' as const,
        correct: true,
        scoreDelta: 200,
        newScore: 200,
        answeredAt: '2024-01-01T00:00:00Z',
        message: 'Correct!',
      };
      const mockGame = createMockGame('ACTIVE', { score: 200 });
      const mockBoard = createMockBoardResponse();

      (gamesApi.answerClue as jest.Mock).mockResolvedValue(mockResponse);
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const result = await store.dispatch(
        answerClue({ gameId: 'game-1', clueId: 'clue-1', correct: true }),
      );

      expect(result.type).toBe('game/answerClue/fulfilled');
      expect(gamesApi.answerClue).toHaveBeenCalledWith('game-1', 'clue-1', true);
      expect(store.getState().game.selectedClue).toBeNull();
      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should handle errors', async () => {
      const error = new ApiClientError(400, 'Invalid clue state', 'Bad Request');
      (gamesApi.answerClue as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(
        answerClue({ gameId: 'game-1', clueId: 'clue-1', correct: true }),
      );

      expect(result.type).toBe('game/answerClue/rejected');
      expect(store.getState().game.error).toBe('Invalid clue state');
      expect(store.getState().game.actionLoading).toBe(false);
    });
  });

  describe('submitClueWager', () => {
    beforeEach(() => {
      store = configureStore({
        reducer: { game: gameReducer },
        preloadedState: {
          game: {
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
            error: null,
            previousGameState: 'ACTIVE',
          },
        },
      });
    });

    it('should submit wager and update selected clue', async () => {
      const mockResponse = {
        gameClueId: 'gc-1',
        clueId: 'clue-1',
        wager: 500,
        currentScore: 1000,
        maxWager: 2000,
        message: 'Wager submitted',
      };
      const mockGame = createMockGame('ACTIVE');
      const mockBoard = createMockBoardResponse();
      const board = createMockJeopardyBoard();
      board.categories[0].clues[0].state = 'ANSWERED';
      mockBoard.board = board;

      (gamesApi.submitClueWager as jest.Mock).mockResolvedValue(mockResponse);
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const result = await store.dispatch(
        submitClueWager({ gameId: 'game-1', clueId: 'clue-1', wager: 500 }),
      );

      expect(result.type).toBe('game/submitClueWager/fulfilled');
      expect(store.getState().game.selectedClue?.maxWager).toBe(2000);
      expect(store.getState().game.actionLoading).toBe(false);
    });

    it('should handle errors', async () => {
      const error = new ApiClientError(400, 'Invalid wager amount', 'Bad Request');
      (gamesApi.submitClueWager as jest.Mock).mockRejectedValue(error);

      const result = await store.dispatch(
        submitClueWager({ gameId: 'game-1', clueId: 'clue-1', wager: 500 }),
      );

      expect(result.type).toBe('game/submitClueWager/rejected');
      expect(store.getState().game.error).toBe('Invalid wager amount');
    });
  });

  describe('submitFinalJeopardyWager', () => {
    it('should submit Final Jeopardy wager', async () => {
      const mockResponse = {
        gameId: 'game-1',
        finalJeopardyId: 'final-1',
        wager: 1000,
        currentScore: 5000,
        message: 'Wager submitted',
      };
      const mockGame = createMockGame('FINAL_ACTIVE', { score: 5000 });
      const mockBoard = createMockBoardResponse();

      (gamesApi.submitFinalJeopardyWager as jest.Mock).mockResolvedValue(mockResponse);
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const result = await store.dispatch(
        submitFinalJeopardyWager({ gameId: 'game-1', wager: 1000 }),
      );

      expect(result.type).toBe('game/submitFinalJeopardyWager/fulfilled');
      expect(store.getState().game.actionLoading).toBe(false);
    });
  });

  describe('answerFinalJeopardy', () => {
    it('should answer Final Jeopardy', async () => {
      const mockResponse = {
        gameId: 'game-1',
        finalJeopardyId: 'final-1',
        correct: true,
        wager: 1000,
        scoreDelta: 1000,
        finalScore: 6000,
        gameState: 'COMPLETED' as const,
        answeredAt: '2024-01-01T00:00:00Z',
        message: 'Correct!',
      };
      const mockGame = createMockGame('COMPLETED', { score: 6000 });
      const mockBoard = createMockBoardResponse();

      (gamesApi.answerFinalJeopardy as jest.Mock).mockResolvedValue(mockResponse);
      (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
      (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

      const result = await store.dispatch(
        answerFinalJeopardy({ gameId: 'game-1', correct: true }),
      );

      expect(result.type).toBe('game/answerFinalJeopardy/fulfilled');
      expect(store.getState().game.actionLoading).toBe(false);
    });
  });
});
