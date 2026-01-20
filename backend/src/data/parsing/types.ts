export interface RawClueRow {
  round: string;
  clueValue: string;
  dailyDoubleValue: string;
  category: string;
  comments: string;
  answer: string;
  question: string;
  airDate: string;
  notes: string;
}

export interface ParsedFinalJeopardyClue {
  seasonNumber: number;
  category: string;
  answer: string;
  question: string;
  airDate?: string;
  sourceFile: string;
}

export interface ParsingError {
  file: string;
  line?: number;
  message: string;
}

export interface SeasonFileParseResult {
  totalRowsRead: number;
  finalJeopardyRowsFound: number;
  parsedClues: ParsedFinalJeopardyClue[];
  invalidRows: number;
  errors: ParsingError[];
}

export interface ParsingResult {
  totalFilesProcessed: number;
  totalRowsRead: number;
  finalJeopardyRowsFound: number;
  validRows: number;
  invalidRows: number;
  duplicatesSkipped?: number;
  outputFile: string;
  errors: ParsingError[];
}

export interface ParsedJeopardyClue {
  seasonNumber: number;
  round: '1' | '2'; // '1' for Jeopardy, '2' for Double Jeopardy
  category: string;
  answer: string;
  question: string;
  value: number; // Dollar value from clue_value column
  dailyDouble: boolean; // true if daily_double_value > 0
  airDate?: string;
  sourceFile: string;
}

export interface JeopardySeasonFileParseResult {
  totalRowsRead: number;
  jeopardyRowsFound: number; // Rounds 1 and 2 combined
  parsedClues: ParsedJeopardyClue[];
  invalidRows: number;
  errors: ParsingError[];
}

export interface JeopardyParsingResult {
  totalFilesProcessed: number;
  totalRowsRead: number;
  jeopardyRowsFound: number; // Rounds 1 and 2 combined
  validRows: number;
  invalidRows: number;
  duplicatesSkipped?: number;
  outputFile: string;
  errors: ParsingError[];
}
