import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { RootState, store as realStore } from '@/store/store';
import gameReducer from '@/store/gameSlice';
import authReducer from '@/store/authSlice';
import type { GameResponse, BoardResponse } from '@/lib/api/types';
import type { SelectedClue } from '@/store/gameSlice';

// Define PreloadedState type ourselves since it's not exported in this version
type PreloadedState<T> = Partial<T>;

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof configureStore>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    store,
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  const testStore =
    store ||
    (configureStore({
      reducer: { game: gameReducer, auth: authReducer },
    }) as any);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={testStore}>{children}</Provider>;
  }

  return { store: testStore, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export function createMockStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: { game: gameReducer, auth: authReducer },
  }) as any;
}

export function createMockGameState(
  overrides?: Partial<GameResponse>,
): GameResponse {
  return {
    id: 'game-1',
    userId: 'user-1',
    state: 'PENDING',
    score: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockBoardState(
  overrides?: Partial<BoardResponse>,
): BoardResponse {
  return {
    gameId: 'game-1',
    currentRound: 'JEOPARDY',
    gameState: 'ACTIVE',
    score: 0,
    board: null,
    ...overrides,
  };
}

export function createMockSelectedClue(
  overrides?: Partial<SelectedClue>,
): SelectedClue {
  return {
    clueId: 'clue-1',
    gameClueId: 'game-clue-1',
    question: 'Test question?',
    isDailyDouble: false,
    state: 'UNANSWERED',
    ...overrides,
  };
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
