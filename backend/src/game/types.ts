import { GameState, Round } from '@prisma/client';

export interface CreateGameResult {
  game: {
    id: string;
    userId: string;
    state: GameState;
    score: number;
    createdAt: Date;
    updatedAt: Date;
    finalJeopardy: {
      id: string;
      gameId: string;
      clueId: string;
      wager: number;
      correct: boolean | null;
      scoreDelta: number | null;
      answeredAt: Date | null;
      clue: {
        id: string;
        category: string;
        round: Round;
        value: number;
        question: string;
        answer: string;
        dailyDouble: boolean;
        createdAt: Date;
      };
    };
  };
}

export interface CreateGameError {
  message: string;
  code: 'VALIDATION_ERROR' | 'NO_CLUES_AVAILABLE' | 'DATABASE_ERROR' | 'USER_NOT_FOUND';
}
