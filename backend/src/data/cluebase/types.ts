import { Round } from '@prisma/client';

/**
 * Cluebase API response structure for a single clue
 * Note: Actual field names may vary based on Cluebase API documentation
 */
export interface CluebaseClueResponse {
  id?: string;
  clue?: string; // The question/clue text
  question?: string; // Alternative field name for question
  answer?: string; // The correct response
  response?: string; // Alternative field name for answer
  category?: string; // Category name
  value?: number; // Dollar value
  round?: string | Round; // Round identifier
  daily_double?: boolean; // Daily Double flag
  [key: string]: unknown; // Allow for additional fields
}

/**
 * Cluebase API response wrapper
 */
export interface CluebaseApiResponse {
  clues?: CluebaseClueResponse[];
  data?: CluebaseClueResponse[];
  results?: CluebaseClueResponse[];
  count?: number;
  total?: number;
  [key: string]: unknown; // Allow for different response structures
}

/**
 * Cluebase API error response
 */
export interface CluebaseApiError {
  error?: string;
  message?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Custom error class for Cluebase API errors
 */
export class CluebaseApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'CluebaseApiException';
  }
}
