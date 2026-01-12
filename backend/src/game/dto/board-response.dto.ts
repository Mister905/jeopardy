import { GameState, Round } from '@prisma/client';

export class ClueBoardItemDto {
  gameClueId: string;
  clueId: string;
  value: number;
  state: 'UNANSWERED' | 'ANSWERED' | 'RESOLVED';
  dailyDouble: boolean;
  question?: string;
  answer?: string;
  wager?: number;
  scoreDelta?: number;
}

export class CategoryBoardDto {
  name: string;
  clues: ClueBoardItemDto[];
}

export class JeopardyBoardDto {
  round: 'JEOPARDY' | 'DOUBLE_JEOPARDY';
  categories: CategoryBoardDto[];
}

export class FinalJeopardyBoardDto {
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

export class BoardResponseDto {
  gameId: string;
  currentRound: Round | null;
  gameState: GameState;
  score: number;
  board: JeopardyBoardDto | FinalJeopardyBoardDto | null;
}
