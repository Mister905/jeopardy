import type {
  GameResponse,
  BoardResponse,
  AnswerClueResponse,
  SubmitWagerResponse,
  FinalJeopardyWagerResponse,
  FinalJeopardyAnswerResponse,
  StartGameResponse,
} from '@/lib/api/types';
import { createMockGame } from './gameMocks';
import { createMockBoardResponse } from './boardMocks';

// Mock implementations for API functions
// These can be used with jest.mock to replace the actual API calls

export const mockApiResponses = {
  getGame: jest.fn<Promise<GameResponse>, [string]>(),
  getBoard: jest.fn<Promise<BoardResponse>, [string]>(),
  startGame: jest.fn<Promise<StartGameResponse>, [string]>(),
  answerClue: jest.fn<Promise<AnswerClueResponse>, [string, string, boolean]>(),
  submitClueWager: jest.fn<Promise<SubmitWagerResponse>, [string, string, number]>(),
  submitFinalJeopardyWager: jest.fn<Promise<FinalJeopardyWagerResponse>, [string, number]>(),
  answerFinalJeopardy: jest.fn<Promise<FinalJeopardyAnswerResponse>, [string, boolean]>(),
};

// Helper to reset all mocks
export function resetApiMocks() {
  Object.values(mockApiResponses).forEach((mock) => mock.mockReset());
}

// Helper to set up default successful responses
export function setupDefaultApiMocks(gameId: string = 'game-1') {
  mockApiResponses.getGame.mockResolvedValue(createMockGame('ACTIVE'));
  mockApiResponses.getBoard.mockResolvedValue(
    createMockBoardResponse(gameId, 'ACTIVE', 'JEOPARDY'),
  );
  mockApiResponses.startGame.mockResolvedValue({
    message: 'Game started',
    game: createMockGame('ACTIVE'),
  });
  mockApiResponses.answerClue.mockResolvedValue({
    gameClueId: 'game-clue-1',
    clueId: 'clue-1',
    state: 'ANSWERED',
    correct: true,
    scoreDelta: 200,
    newScore: 200,
    answeredAt: '2024-01-01T00:00:00Z',
    message: 'Correct!',
  });
  mockApiResponses.submitClueWager.mockResolvedValue({
    gameClueId: 'game-clue-1',
    clueId: 'clue-1',
    wager: 500,
    currentScore: 1000,
    maxWager: 2000,
    message: 'Wager submitted',
  });
  mockApiResponses.submitFinalJeopardyWager.mockResolvedValue({
    gameId: 'game-1',
    finalJeopardyId: 'final-1',
    wager: 1000,
    currentScore: 5000,
    message: 'Wager submitted',
  });
  mockApiResponses.answerFinalJeopardy.mockResolvedValue({
    gameId: 'game-1',
    finalJeopardyId: 'final-1',
    correct: true,
    wager: 1000,
    scoreDelta: 1000,
    finalScore: 6000,
    gameState: 'COMPLETED',
    answeredAt: '2024-01-01T00:00:00Z',
    message: 'Correct!',
  });
}

// Helper to create error responses
export function createApiError(
  statusCode: number,
  message: string = 'Error message',
) {
  const error = new Error(message) as any;
  error.statusCode = statusCode;
  error.message = message;
  error.error = 'Error';
  return error;
}
