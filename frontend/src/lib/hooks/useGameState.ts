'use client';

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchGameData, startPolling, stopPolling } from '@/store/gameSlice';

/**
 * Optional convenience hook that wraps Redux selectors and dispatch.
 * All actual state management happens in Redux - this is just a thin wrapper.
 * Can be removed if not needed - components can use Redux hooks directly.
 */
export function useGameState(options?: {
  gameId?: string;
  enabled?: boolean;
  pollInterval?: number;
  pausePolling?: boolean;
  onStateChange?: (game: any) => void;
}) {
  const dispatch = useAppDispatch();

  // Get all state from Redux
  const game = useAppSelector((state) => state.game.game);
  const board = useAppSelector((state) => state.game.board);
  const loading = useAppSelector((state) => !state.game.game && !state.game.error);
  const error = useAppSelector((state) => state.game.error);
  const isPolling = useAppSelector((state) => state.game.isPolling);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (options?.gameId) {
      return dispatch(fetchGameData(options.gameId));
    }
  }, [dispatch, options?.gameId]);

  return {
    game,
    board,
    loading,
    error,
    refresh,
    isPolling,
  };
}
