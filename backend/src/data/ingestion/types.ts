import { ParsedFinalJeopardyClue } from '../parsing/types';

export interface IngestionError {
  clueIndex?: number;
  clue?: ParsedFinalJeopardyClue;
  message: string;
  type: 'validation' | 'database' | 'file';
}

export interface IngestionResult {
  totalCluesProcessed: number;
  validClues: number;
  invalidClues: number;
  cluesInserted: number;
  duplicatesSkipped: number;
  errors: IngestionError[];
}
