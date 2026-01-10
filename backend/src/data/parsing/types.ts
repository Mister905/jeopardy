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
