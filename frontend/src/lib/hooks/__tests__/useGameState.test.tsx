import { renderHook, act } from '@testing-library/react';
import { useGameState } from '../useGameState';
import { renderWithProviders, createMockStore } from '@/test-utils/test-utils';
import { createMockGame } from '@/test-utils/mocks/gameMocks';
import { createMockBoardResponse } from '@/test-utils/mocks/boardMocks';
import { Provider } from 'react-redux';
import * as gamesApi from '@/lib/api/games';

jest.mock('@/lib/api/games');

describe('useGameState hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct state from Redux', () => {
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse();

    const store = createMockStore({
      game: {
        gameId: 'game-1',
        game: mockGame,
        board: mockBoard,
        selectedClue: null,
        actionLoading: false,
        error: null,
        previousGameState: 'ACTIVE',
      },
    });

    const { result } = renderHook(() => useGameState(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current.game).toEqual(mockGame);
    expect(result.current.board).toEqual(mockBoard);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return loading state when game is null and no error', () => {
    const store = createMockStore({
      game: {
        gameId: null,
        game: null,
        board: null,
        selectedClue: null,
        actionLoading: false,
        error: null,
        previousGameState: null,
      },
    });

    const { result } = renderHook(() => useGameState(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current.loading).toBe(true);
  });

  it('should return error state', () => {
    const store = createMockStore({
      game: {
        gameId: 'game-1',
        game: null,
        board: null,
        selectedClue: null,
        actionLoading: false,
        error: 'Test error',
        previousGameState: null,
      },
    });

    const { result } = renderHook(() => useGameState(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current.error).toBe('Test error');
    expect(result.current.loading).toBe(false);
  });

  it('should dispatch fetchGameData when refresh is called with gameId', async () => {
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse();

    const store = createMockStore({
      game: {
        gameId: 'game-1',
        game: mockGame,
        board: mockBoard,
        selectedClue: null,
        actionLoading: false,
        error: null,
        previousGameState: 'ACTIVE',
      },
    });

    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    const { result } = renderHook(() => useGameState({ gameId: 'game-1' }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(gamesApi.getGame).toHaveBeenCalledWith('game-1');
  });

  it('should not dispatch fetchGameData when refresh is called without gameId', async () => {
    const store = createMockStore({
      game: {
        gameId: null,
        game: null,
        board: null,
        selectedClue: null,
        actionLoading: false,
        error: null,
        previousGameState: null,
      },
    });

    const { result } = renderHook(() => useGameState(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await result.current.refresh();

    expect(gamesApi.getGame).not.toHaveBeenCalled();
  });
});
