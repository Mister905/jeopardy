import type { ClueBoardItem, ClueState } from '@/lib/api/types';

export function createMockClue(
  state: ClueState = 'UNANSWERED',
  isDailyDouble: boolean = false,
  overrides?: Partial<ClueBoardItem>,
): ClueBoardItem {
  return {
    gameClueId: 'game-clue-1',
    clueId: 'clue-1',
    value: 200,
    state,
    dailyDouble: isDailyDouble,
    ...overrides,
  };
}

export const mockUnansweredClue = createMockClue('UNANSWERED');
export const mockAnsweredClue = createMockClue('ANSWERED', false, {
  question: 'Test question?',
  answer: 'Test answer',
});
export const mockResolvedClue = createMockClue('RESOLVED', false, {
  question: 'Test question?',
  answer: 'Test answer',
  wager: 0,
  scoreDelta: 200,
});
export const mockDailyDoubleClue = createMockClue('UNANSWERED', true, {
  value: 400,
});
