import {
  ParsedFinalJeopardyClue,
  ParsedJeopardyClue,
} from '../parsing/types';

// Union type for all parsed clue types
export type ParsedClue = ParsedFinalJeopardyClue | ParsedJeopardyClue;

export interface IngestionError {
  clueIndex?: number;
  clue?: ParsedClue;
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
