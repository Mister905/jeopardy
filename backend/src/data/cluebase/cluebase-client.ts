import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Round } from '@prisma/client';
import { CluebaseApiResponse, CluebaseApiError, CluebaseApiException } from './types';

@Injectable()
export class CluebaseClient {
  private readonly logger = new Logger(CluebaseClient.name);
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second base delay
  private readonly requestTimeout = 30000; // 30 seconds timeout

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('CLUEBASE_API_URL') ||
      'https://cluebase.com/api';
    this.apiKey = this.configService.get<string>('CLUEBASE_API_KEY');

    if (!this.apiUrl) {
      this.logger.warn('CLUEBASE_API_URL not configured, using default');
    }
  }

  /**
   * Fetch clues from Cluebase API
   * @param round - Round to fetch clues for (JEOPARDY or DOUBLE_JEOPARDY)
   * @param limit - Maximum number of clues to fetch
   * @param offset - Pagination offset
   * @returns Array of clue responses from API
   */
  async fetchClues(
    round: Round,
    limit: number = 100,
    offset: number = 0,
  ): Promise<CluebaseApiResponse> {
    const roundParam = round.toLowerCase().replace(/_/g, '-');
    const url = `${this.apiUrl}/clues`;
    
    const params = new URLSearchParams({
      round: roundParam,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const fullUrl = `${url}?${params.toString()}`;

    return this.makeRequest(fullUrl);
  }

  /**
   * Fetch clues by category
   * @param category - Category name
   * @param round - Round identifier
   * @param limit - Maximum number of clues
   * @returns Array of clue responses
   */
  async fetchCluesByCategory(
    category: string,
    round: Round,
    limit: number = 100,
  ): Promise<CluebaseApiResponse> {
    const roundParam = round.toLowerCase().replace(/_/g, '-');
    const url = `${this.apiUrl}/clues`;
    
    const params = new URLSearchParams({
      category: category,
      round: roundParam,
      limit: limit.toString(),
    });

    const fullUrl = `${url}?${params.toString()}`;

    return this.makeRequest(fullUrl);
  }

  /**
   * Make HTTP request to Cluebase API with retry logic
   * @param url - Full API URL with query parameters
   * @returns API response
   */
  private async makeRequest(url: string): Promise<CluebaseApiResponse> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      // Or if API uses different auth format:
      // headers['X-API-Key'] = this.apiKey;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Fetching from Cluebase API (attempt ${attempt + 1}): ${url}`);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        let response: Response;
        try {
          response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          // Handle timeout/abort errors
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new CluebaseApiException(
              `Request to Cluebase API timed out after ${this.requestTimeout}ms`,
              408, // Request Timeout
              fetchError,
            );
          }
          
          // Re-throw other fetch errors
          throw fetchError;
        }

        if (!response.ok) {
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter
              ? parseInt(retryAfter) * 1000
              : this.retryDelay * Math.pow(2, attempt);
            
            this.logger.warn(`Rate limited, waiting ${delay}ms before retry`);
            await this.sleep(delay);
            continue;
          }

          // Try to parse error response
          let errorData: CluebaseApiError;
          try {
            errorData = await response.json();
          } catch {
            errorData = {
              error: response.statusText,
              statusCode: response.status,
            };
          }

          throw new CluebaseApiException(
            errorData.message || errorData.error || `API returned ${response.status}`,
            response.status,
          );
        }

        const data: CluebaseApiResponse = await response.json();
        this.logger.debug(`Successfully fetched from Cluebase API`);
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) except 429
        if (
          error instanceof CluebaseApiException &&
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 429
        ) {
          throw error;
        }

        // Retry on network errors or server errors (5xx)
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.logger.warn(
            `Request failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw new CluebaseApiException(
      `Failed to fetch from Cluebase API after ${this.maxRetries} attempts: ${lastError?.message}`,
      undefined,
      lastError,
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
