// TypeScript types matching backend DTOs exactly

export type GameState =
  | 'PENDING'
  | 'ACTIVE'
  | 'FINAL_PENDING'
  | 'FINAL_ACTIVE'
  | 'ELIMINATED'
  | 'COMPLETED';

export type Round = 'JEOPARDY' | 'DOUBLE_JEOPARDY' | 'FINAL';

export type ClueState = 'UNANSWERED' | 'ANSWERED' | 'RESOLVED';

// Clue Response DTO
export interface ClueResponse {
  id: string;
  category: string;
  round: Round;
  value: number;
  question: string;
  answer: string;
  dailyDouble: boolean;
  createdAt: string;
}

// Game Clue Response DTO
export interface GameClueResponse {
  id: string;
  gameId: string;
  clueId: string;
  state: ClueState;
  wager: number | null;
  scoreDelta: number | null;
  answeredAt: string | null;
  clue: ClueResponse;
}

// Final Jeopardy Response DTO
export interface FinalJeopardyResponse {
  id: string;
  gameId: string;
  clueId: string;
  wager: number;
  correct: boolean | null;
  scoreDelta: number | null;
  answeredAt: string | null;
  clue: ClueResponse;
}

// Game Response DTO
export interface GameResponse {
  id: string;
  userId: string;
  state: GameState;
  score: number;
  createdAt: string;
  updatedAt: string;
  gameClues?: GameClueResponse[];
  finalJeopardy?: FinalJeopardyResponse;
}

// List Games Response DTO
export interface ListGamesResponse {
  games: Array<{
    id: string;
    userId: string;
    state: GameState;
    score: number;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

// Start Game Response DTO
export interface StartGameResponse {
  message: string;
  game: GameResponse;
}

// Answer Clue Response DTO
export interface AnswerClueResponse {
  gameClueId: string;
  clueId: string;
  state: ClueState;
  correct: boolean;
  scoreDelta: number;
  newScore: number;
  answeredAt: string;
  message: string;
}

// Submit Wager Response DTO
export interface SubmitWagerResponse {
  gameClueId: string;
  clueId: string;
  wager: number;
  currentScore: number;
  maxWager: number;
  message: string;
}

// Final Jeopardy Wager Response DTO
export interface FinalJeopardyWagerResponse {
  gameId: string;
  finalJeopardyId: string;
  wager: number;
  currentScore: number;
  message: string;
}

// Final Jeopardy Answer Response DTO
export interface FinalJeopardyAnswerResponse {
  gameId: string;
  finalJeopardyId: string;
  correct: boolean;
  wager: number;
  scoreDelta: number;
  finalScore: number;
  gameState: GameState;
  answeredAt: string;
  message: string;
}

// Board Response DTOs
export interface ClueBoardItem {
  gameClueId: string;
  clueId: string;
  value: number;
  state: ClueState;
  dailyDouble: boolean;
  question?: string;
  answer?: string;
  wager?: number;
  scoreDelta?: number;
}

export interface CategoryBoard {
  name: string;
  clues: ClueBoardItem[];
}

export interface JeopardyBoard {
  round: 'JEOPARDY' | 'DOUBLE_JEOPARDY';
  categories: CategoryBoard[];
}

export interface FinalJeopardyBoard {
  round: 'FINAL';
  clue: {
    clueId: string;
    category: string;
    value: number;
    question: string;
    answer?: string;
    wager: number;
    correct: boolean | null;
    scoreDelta: number | null;
    answeredAt: string | null;
  };
}

export interface BoardResponse {
  gameId: string;
  currentRound: Round | null;
  gameState: GameState;
  score: number;
  board: JeopardyBoard | FinalJeopardyBoard | null;
}

// Request DTOs
export interface AnswerClueRequest {
  correct: boolean;
}

export interface SubmitWagerRequest {
  wager: number;
}

export interface ListGamesQuery {
  status?: GameState;
  limit?: number;
  offset?: number;
}

// User Dashboard Response DTO
export interface UserStats {
  totalGamesPlayed: number;
  averageScore: number;
  bestScore: number | null;
  worstScore: number | null;
  totalWinnings: number;
  overallAccuracy: number | null;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  jeopardyAccuracy: number | null;
  doubleJeopardyAccuracy: number | null;
  finalJeopardyAccuracy: number | null;
  dailyDoubleAccuracy: number | null;
  currentCorrectStreak: number;
  longestCorrectStreak: number;
  currentIncorrectStreak: number;
  longestIncorrectStreak: number;
  largestSuccessfulDailyDoubleWager: number | null;
  largestSuccessfulFinalJeopardyWager: number | null;
  largestUnsuccessfulDailyDoubleWager: number | null;
  largestUnsuccessfulFinalJeopardyWager: number | null;
}

export interface UserDashboardResponse {
  username: string;
  stats: UserStats;
}
