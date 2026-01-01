import { GameState, Round } from '@prisma/client';

export interface ClueMetadataDto {
  id: string;
  category: string;
  value: number;
  dailyDouble: boolean;
  state: string;
}

export interface CategoryDto {
  name: string;
  clues: ClueMetadataDto[];
}

export interface BoardDto {
  round: Round;
  categories: CategoryDto[];
}

export class GameResponseDto {
  id: string;
  state: GameState;
  score: number;
  boards: BoardDto[];
  createdAt: Date;
  updatedAt: Date;
}

