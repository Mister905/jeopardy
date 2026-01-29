import { GameState, Round } from '@prisma/client';

export class ClueResponseDto {
  id: string;
  category: string;
  round: Round;
  value: number;
  question: string;
  answer: string;
  dailyDouble: boolean;
  createdAt: string;
}

export class GameClueResponseDto {
  id: string;
  gameId: string;
  clueId: string;
  state: 'UNANSWERED' | 'ANSWERED' | 'RESOLVED';
  wager: number | null;
  scoreDelta: number | null;
  answeredAt: string | null;
  clue: ClueResponseDto;
}

export class FinalJeopardyResponseDto {
  id: string;
  gameId: string;
  clueId: string;
  wager: number;
  correct: boolean | null;
  scoreDelta: number | null;
  answeredAt: string | null;
  clue: ClueResponseDto;
}

export class GameResponseDto {
  id: string;
  userId: string;
  state: GameState;
  score: number;
  createdAt: string;
  updatedAt: string;
  gameClues?: GameClueResponseDto[];
  finalJeopardy?: FinalJeopardyResponseDto;
}

export class ListGamesResponseDto {
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

export class StartGameResponseDto {
  message: string;
  game: GameResponseDto;
}

export class AnswerClueResponseDto {
  gameClueId: string;
  clueId: string;
  state: 'UNANSWERED' | 'ANSWERED' | 'RESOLVED';
  correct: boolean;
  scoreDelta: number;
  newScore: number;
  answeredAt: string;
  message: string;
  /** Present when game transitioned to FINAL_PENDING or ELIMINATED so client can update UI immediately */
  game?: GameResponseDto;
}

export class SubmitWagerResponseDto {
  gameClueId: string;
  clueId: string;
  wager: number;
  currentScore: number;
  maxWager: number;
  message: string;
}

export class FinalJeopardyWagerResponseDto {
  gameId: string;
  finalJeopardyId: string;
  wager: number;
  currentScore: number;
  message: string;
}

export class FinalJeopardyAnswerResponseDto {
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
