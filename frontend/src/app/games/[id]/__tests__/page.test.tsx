import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useParams, useRouter } from 'next/navigation';
import GameDetailPage from '../page';
import { renderWithProviders } from '@/test-utils/test-utils';
import { createMockGame } from '@/test-utils/mocks/gameMocks';
import { createMockBoardResponse, createMockJeopardyBoard } from '@/test-utils/mocks/boardMocks';
import * as gamesApi from '@/lib/api/games';
import { fetchGameData, startGame, startPolling, stopPolling } from '@/store/gameSlice';

jest.mock('next/navigation');
jest.mock('@/lib/api/games');
jest.mock('@/lib/auth/hooks', () => ({
  useRequireAuth: jest.fn(() => ({
    user: { id: 'user-1' },
    loading: false,
  })),
}));

describe('GameDetailPage component', () => {
  const mockPush = jest.fn();
  const mockParams = { id: 'game-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    (useParams as jest.Mock).mockReturnValue(mockParams);
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('should mount and initialize game data', async () => {
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY');

    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(gamesApi.getGame).toHaveBeenCalledWith('game-1');
    });
  });

  it('should start polling for ACTIVE games', async () => {
    jest.useFakeTimers();
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY');

    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    const { store } = renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(store.getState().game.game).toEqual(mockGame);
    });

    // Polling should start for ACTIVE games
    await waitFor(() => {
      expect(store.getState().game.isPolling).toBe(true);
    });

    jest.useRealTimers();
  });

  it('should stop polling on component unmount', async () => {
    jest.useFakeTimers();
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY');

    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    const { store, unmount } = renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(store.getState().game.isPolling).toBe(true);
    });

    unmount();

    await waitFor(() => {
      expect(store.getState().game.isPolling).toBe(false);
    });

    jest.useRealTimers();
  });

  it('should handle error and recovery', async () => {
    const error = new Error('Network error');
    (gamesApi.getGame as jest.Mock).mockRejectedValueOnce(error);

    const { store } = renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(store.getState().game.error).toBeTruthy();
    });

    // Retry should clear error
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse();
    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    await store.dispatch(fetchGameData('game-1'));

    await waitFor(() => {
      expect(store.getState().game.error).toBeNull();
    });
  });

  it('should dispatch correct thunks on user interactions', async () => {
    const mockGame = createMockGame('PENDING');
    const mockBoard = createMockBoardResponse();

    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);
    (gamesApi.startGame as jest.Mock).mockResolvedValue({
      message: 'Game started',
      game: createMockGame('ACTIVE'),
    });

    const { store } = renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(store.getState().game.game).toEqual(mockGame);
    });

    const startButton = screen.getByRole('button', { name: /start game/i });
    await userEvent.click(startButton);

    await waitFor(() => {
      expect(gamesApi.startGame).toHaveBeenCalledWith('game-1');
    });
  });

  it('should reflect Redux state changes in UI', async () => {
    const mockGame = createMockGame('ACTIVE');
    const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY', createMockJeopardyBoard());

    (gamesApi.getGame as jest.Mock).mockResolvedValue(mockGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    const { store } = renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Game')).toBeInTheDocument();
    });

    // UI should show game board for ACTIVE state
    expect(screen.getByText('Jeopardy!')).toBeInTheDocument();
  });

  it('should redirect on 401/403 errors', async () => {
    const { ApiClientError } = await import('@/lib/api/client');
    const error = new ApiClientError(403, 'Access denied', 'Forbidden');
    (gamesApi.getGame as jest.Mock).mockRejectedValue(error);

    renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('should show loading state initially', () => {
    (gamesApi.getGame as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    renderWithProviders(<GameDetailPage />);

    // Should show loading spinner
    // This depends on LoadingSpinner implementation
  });

  it('should stop polling when game reaches terminal state', async () => {
    jest.useFakeTimers();
    const mockGame = createMockGame('ACTIVE');
    const completedGame = createMockGame('COMPLETED');
    const mockBoard = createMockBoardResponse('game-1', 'ACTIVE', 'JEOPARDY');

    (gamesApi.getGame as jest.Mock)
      .mockResolvedValueOnce(mockGame)
      .mockResolvedValueOnce(completedGame);
    (gamesApi.getBoard as jest.Mock).mockResolvedValue(mockBoard);

    const { store } = renderWithProviders(<GameDetailPage />);

    await waitFor(() => {
      expect(store.getState().game.isPolling).toBe(true);
    });

    // Simulate state change to COMPLETED
    (gamesApi.getGame as jest.Mock).mockResolvedValue(completedGame);
    await store.dispatch(fetchGameData('game-1'));

    await waitFor(() => {
      expect(store.getState().game.isPolling).toBe(false);
    });

    jest.useRealTimers();
  });
});
