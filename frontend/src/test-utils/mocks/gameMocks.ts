import type { GameResponse, GameState } from '@/lib/api/types';

export function createMockGame(
  state: GameState = 'PENDING',
  overrides?: Partial<GameResponse>,
): GameResponse {
  const baseGame: GameResponse = {
    id: 'game-1',
    userId: 'user-1',
    state,
    score: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  return { ...baseGame, ...overrides };
}

export const mockPendingGame = createMockGame('PENDING');
export const mockActiveGame = createMockGame('ACTIVE', { score: 1000 });
export const mockFinalPendingGame = createMockGame('FINAL_PENDING', {
  score: 5000,
});
export const mockFinalActiveGame = createMockGame('FINAL_ACTIVE', {
  score: 5000,
});
export const mockCompletedGame = createMockGame('COMPLETED', {
  score: 10000,
});
export const mockEliminatedGame = createMockGame('ELIMINATED', { score: 0 });
