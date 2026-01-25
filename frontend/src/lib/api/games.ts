import { apiGet, apiPost } from './client';
import type {
  GameResponse,
  ListGamesResponse,
  StartGameResponse,
  BoardResponse,
  AnswerClueResponse,
  SubmitWagerResponse,
  FinalJeopardyWagerResponse,
  FinalJeopardyAnswerResponse,
  AnswerClueRequest,
  SubmitWagerRequest,
  ListGamesQuery,
  Round,
} from './types';

/**
 * Create a new game for the authenticated user
 */
export async function createGame(username?: string): Promise<GameResponse> {
  return apiPost<GameResponse>('/games', username ? { username } : {});
}

/**
 * List all games for the authenticated user
 */
export async function listGames(
  params?: ListGamesQuery,
): Promise<ListGamesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.offset) {
    queryParams.append('offset', params.offset.toString());
  }

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/games?${queryString}` : '/games';

  return apiGet<ListGamesResponse>(endpoint);
}

/**
 * Get detailed information about a specific game
 */
export async function getGame(gameId: string): Promise<GameResponse> {
  return apiGet<GameResponse>(`/games/${gameId}`);
}

/**
 * Start a game by creating Jeopardy and Double Jeopardy boards
 */
export async function startGame(gameId: string): Promise<StartGameResponse> {
  return apiPost<StartGameResponse>(`/games/${gameId}/start`, {});
}

/**
 * Get the current round's board state
 */
export async function getBoard(
  gameId: string,
  round?: Round,
): Promise<BoardResponse> {
  const queryParams = new URLSearchParams();
  if (round) {
    queryParams.append('round', round);
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/games/${gameId}/board?${queryString}`
    : `/games/${gameId}/board`;

  return apiGet<BoardResponse>(endpoint);
}

/**
 * Answer a regular clue or submit Daily Double answer
 */
export async function answerClue(
  gameId: string,
  clueId: string,
  correct: boolean,
): Promise<AnswerClueResponse> {
  const body: AnswerClueRequest = { correct };
  return apiPost<AnswerClueResponse>(
    `/games/${gameId}/clues/${clueId}/answer`,
    body,
  );
}

/**
 * Submit a wager for a Daily Double clue
 */
export async function submitClueWager(
  gameId: string,
  clueId: string,
  wager: number,
): Promise<SubmitWagerResponse> {
  const body: SubmitWagerRequest = { wager };
  return apiPost<SubmitWagerResponse>(
    `/games/${gameId}/clues/${clueId}/wager`,
    body,
  );
}

/**
 * Submit a wager for Final Jeopardy
 */
export async function submitFinalJeopardyWager(
  gameId: string,
  wager: number,
): Promise<FinalJeopardyWagerResponse> {
  const body: SubmitWagerRequest = { wager };
  return apiPost<FinalJeopardyWagerResponse>(
    `/games/${gameId}/final-jeopardy/wager`,
    body,
  );
}

/**
 * Submit the answer (correct/incorrect) for Final Jeopardy
 */
export async function answerFinalJeopardy(
  gameId: string,
  correct: boolean,
): Promise<FinalJeopardyAnswerResponse> {
  const body: AnswerClueRequest = { correct };
  return apiPost<FinalJeopardyAnswerResponse>(
    `/games/${gameId}/final-jeopardy/answer`,
    body,
  );
}

/**
 * End/abandon a game that is in progress
 */
export async function endGame(gameId: string): Promise<GameResponse> {
  return apiPost<GameResponse>(`/games/${gameId}/end`);
}
