import gameReducer, {
  setGame,
  setBoard,
  setSelectedClue,
  setActionLoading,
  setError,
  clearError,
  resetGameState,
  type GameState,
} from '../gameSlice';
import { createMockGameState, createMockBoardState, createMockSelectedClue } from '@/test-utils/test-utils';

describe('gameSlice reducers', () => {
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

  describe('setGame', () => {
    it('should set game and update gameId', () => {
      const game = createMockGameState({ id: 'game-123' });
      const action = setGame(game);
      const state = gameReducer(initialState, action);

      expect(state.game).toEqual(game);
      expect(state.gameId).toBe('game-123');
      expect(state.previousGameState).toBe(game.state);
    });

    it('should handle null game', () => {
      const action = setGame(null);
      const state = gameReducer(initialState, action);

      expect(state.game).toBeNull();
      expect(state.gameId).toBeNull();
      expect(state.previousGameState).toBeNull();
    });
  });

  describe('setBoard', () => {
    it('should set board', () => {
      const board = createMockBoardState();
      const action = setBoard(board);
      const state = gameReducer(initialState, action);

      expect(state.board).toEqual(board);
    });

    it('should handle null board', () => {
      const action = setBoard(null);
      const state = gameReducer(initialState, action);

      expect(state.board).toBeNull();
    });
  });

  describe('setSelectedClue', () => {
    it('should set selected clue', () => {
      const clue = createMockSelectedClue();
      const action = setSelectedClue(clue);
      const state = gameReducer(initialState, action);

      expect(state.selectedClue).toEqual(clue);
    });

    it('should handle null selected clue', () => {
      const action = setSelectedClue(null);
      const state = gameReducer(initialState, action);

      expect(state.selectedClue).toBeNull();
    });
  });

  describe('setActionLoading', () => {
    it('should set actionLoading to true', () => {
      const action = setActionLoading(true);
      const state = gameReducer(initialState, action);

      expect(state.actionLoading).toBe(true);
    });

    it('should set actionLoading to false', () => {
      const stateWithLoading = { ...initialState, actionLoading: true };
      const action = setActionLoading(false);
      const state = gameReducer(stateWithLoading, action);

      expect(state.actionLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Something went wrong';
      const action = setError(errorMessage);
      const state = gameReducer(initialState, action);

      expect(state.error).toBe(errorMessage);
    });

    it('should handle null error', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const action = setError(null);
      const state = gameReducer(stateWithError, action);

      expect(state.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      const stateWithError = { ...initialState, error: 'Some error' };
      const action = clearError();
      const state = gameReducer(stateWithError, action);

      expect(state.error).toBeNull();
    });

    it('should handle clearing when no error exists', () => {
      const action = clearError();
      const state = gameReducer(initialState, action);

      expect(state.error).toBeNull();
    });
  });

  describe('resetGameState', () => {
    it('should reset to initial state', () => {
      const stateWithData: GameState = {
        gameId: 'game-1',
        game: createMockGameState(),
        board: createMockBoardState(),
        selectedClue: createMockSelectedClue(),
        actionLoading: true,
        error: 'Error',
        isPolling: true,
        pollingIntervalId: 123 as any,
        previousGameState: 'ACTIVE',
      };

      const action = resetGameState();
      const state = gameReducer(stateWithData, action);

      expect(state).toEqual(initialState);
    });

    it('should clear polling interval if exists', () => {
      const mockIntervalId = setInterval(() => {}, 1000);
      const stateWithPolling: GameState = {
        ...initialState,
        pollingIntervalId: mockIntervalId as any,
        isPolling: true,
      };

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const action = resetGameState();
      gameReducer(stateWithPolling, action);

      expect(clearIntervalSpy).toHaveBeenCalledWith(mockIntervalId);
      clearIntervalSpy.mockRestore();
    });
  });
});
