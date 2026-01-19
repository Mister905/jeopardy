import type {
  BoardResponse,
  JeopardyBoard,
  FinalJeopardyBoard,
  ClueBoardItem,
  CategoryBoard,
} from '@/lib/api/types';

export function createMockClueBoardItem(
  overrides?: Partial<ClueBoardItem>,
): ClueBoardItem {
  return {
    gameClueId: 'game-clue-1',
    clueId: 'clue-1',
    value: 200,
    state: 'UNANSWERED',
    dailyDouble: false,
    ...overrides,
  };
}

export function createMockCategory(
  name: string,
  clues: ClueBoardItem[],
): CategoryBoard {
  return {
    name,
    clues,
  };
}

export function createMockJeopardyBoard(
  overrides?: Partial<JeopardyBoard>,
): JeopardyBoard {
  const categories: CategoryBoard[] = [
    createMockCategory('Category 1', [
      createMockClueBoardItem({ value: 200, clueId: 'clue-1', gameClueId: 'gc-1' }),
      createMockClueBoardItem({ value: 400, clueId: 'clue-2', gameClueId: 'gc-2' }),
      createMockClueBoardItem({ value: 600, clueId: 'clue-3', gameClueId: 'gc-3' }),
      createMockClueBoardItem({ value: 800, clueId: 'clue-4', gameClueId: 'gc-4' }),
      createMockClueBoardItem({ value: 1000, clueId: 'clue-5', gameClueId: 'gc-5' }),
    ]),
    createMockCategory('Category 2', [
      createMockClueBoardItem({ value: 200, clueId: 'clue-6', gameClueId: 'gc-6' }),
      createMockClueBoardItem({ value: 400, clueId: 'clue-7', gameClueId: 'gc-7' }),
      createMockClueBoardItem({ value: 600, clueId: 'clue-8', gameClueId: 'gc-8' }),
      createMockClueBoardItem({ value: 800, clueId: 'clue-9', gameClueId: 'gc-9' }),
      createMockClueBoardItem({ value: 1000, clueId: 'clue-10', gameClueId: 'gc-10' }),
    ]),
  ];

  return {
    round: 'JEOPARDY',
    categories,
    ...overrides,
  };
}

export function createMockDoubleJeopardyBoard(
  overrides?: Partial<JeopardyBoard>,
): JeopardyBoard {
  const board = createMockJeopardyBoard({ round: 'DOUBLE_JEOPARDY' });
  // Double the values for Double Jeopardy
  board.categories.forEach((category) => {
    category.clues.forEach((clue) => {
      clue.value = clue.value * 2;
    });
  });
  return { ...board, ...overrides };
}

export function createMockFinalJeopardyBoard(
  overrides?: Partial<FinalJeopardyBoard>,
): FinalJeopardyBoard {
  return {
    round: 'FINAL',
    clue: {
      clueId: 'final-clue-1',
      category: 'Final Category',
      value: 0,
      question: 'Final Jeopardy question?',
      wager: 0,
      correct: null,
      scoreDelta: null,
      answeredAt: null,
      ...overrides?.clue,
    },
    ...overrides,
  };
}

export function createMockBoardResponse(
  gameId: string = 'game-1',
  gameState: string = 'ACTIVE',
  currentRound: string = 'JEOPARDY',
  board: JeopardyBoard | FinalJeopardyBoard | null = createMockJeopardyBoard(),
  overrides?: Partial<BoardResponse>,
): BoardResponse {
  return {
    gameId,
    currentRound: currentRound as any,
    gameState: gameState as any,
    score: 0,
    board,
    ...overrides,
  };
}
