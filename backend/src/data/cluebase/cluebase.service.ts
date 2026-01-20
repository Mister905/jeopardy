import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CluebaseClient } from './cluebase-client';
import { CluebaseClueResponse, CluebaseApiException } from './types';
import { Round, Clue } from '@prisma/client';

interface NormalizedClue {
  category: string;
  round: Round;
  value: number;
  question: string;
  answer: string;
  dailyDouble: boolean;
}

@Injectable()
export class CluebaseService {
  private readonly logger = new Logger(CluebaseService.name);

  constructor(
    private readonly cluebaseClient: CluebaseClient,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Fetch clues from Cluebase API, normalize them, and persist to database
   * @param round - Round to fetch clues for
   * @param requiredCount - Minimum number of clues needed
   * @returns Array of persisted Clue records
   */
  async fetchAndPersistClues(
    round: Round,
    requiredCount: number,
  ): Promise<void> {
    this.logger.log(
      `Ensuring ${requiredCount} clues are available in database for ${round} round`,
    );

    // Check current count in database
    let currentCount = await this.countUniqueCluesInDatabase(round);
    this.logger.debug(`Current clue count in database for ${round}: ${currentCount}`);

    if (currentCount >= requiredCount) {
      this.logger.log(
        `Sufficient clues already in database for ${round} round: ${currentCount} >= ${requiredCount}`,
      );
      return;
    }

    let offset = 0;
    const limit = 100; // Fetch in batches
    const maxAttempts = 10; // Prevent infinite loops
    let attempts = 0;
    let consecutiveEmptyResponses = 0;

    while (currentCount < requiredCount && attempts < maxAttempts) {
      attempts++;

      try {
        // Fetch clues from API
        const apiResponse = await this.cluebaseClient.fetchClues(
          round,
          limit,
          offset,
        );

        // Extract clues from response (handle different response structures)
        const clues = this.extractCluesFromResponse(apiResponse);

        if (clues.length === 0) {
          consecutiveEmptyResponses++;
          if (consecutiveEmptyResponses >= 2) {
            this.logger.warn(
              `No more clues available from API for ${round} round after ${consecutiveEmptyResponses} empty responses`,
            );
            break;
          }
          offset += limit;
          continue;
        }

        consecutiveEmptyResponses = 0;

        // Normalize and validate clues
        const normalizedClues = this.normalizeClues(clues, round);

        if (normalizedClues.length === 0) {
          this.logger.warn(
            `No valid clues found in API response for ${round} round`,
          );
          offset += limit;
          continue;
        }

        // Persist clues to database (handles duplicates automatically)
        const persistedClues = await this.persistClues(normalizedClues);

        // Check updated count in database
        currentCount = await this.countUniqueCluesInDatabase(round);

        this.logger.debug(
          `Fetched ${clues.length} clues from API, normalized ${normalizedClues.length}, persisted ${persistedClues.length} clues. Database now has ${currentCount}/${requiredCount} clues for ${round} round`,
        );

        // If we got fewer clues than requested, we may have reached the end
        if (clues.length < limit) {
          this.logger.warn(
            `API returned fewer clues than requested (${clues.length} < ${limit}). May have reached end of available clues.`,
          );
          break;
        }

        offset += limit;
      } catch (error) {
        if (error instanceof CluebaseApiException) {
          this.logger.error(
            `Cluebase API error: ${error.message}`,
            error.originalError,
          );
          throw error;
        }
        throw error;
      }
    }

    // Verify we have enough clues in database
    if (currentCount < requiredCount) {
      throw new Error(
        `Insufficient clues available for ${round} round. Have ${currentCount} in database, need ${requiredCount}. ` +
        `Please ensure Cluebase API is accessible and returns valid clues.`,
      );
    }

    this.logger.log(
      `Successfully ensured ${currentCount} clues are available in database for ${round} round`,
    );
  }

  /**
   * Count unique clues in database for a round
   */
  private async countUniqueCluesInDatabase(round: Round): Promise<number> {
    return this.prismaService.client.clue.count({
      where: { round },
    });
  }

  /**
   * Extract clues array from API response (handles different response structures)
   */
  private extractCluesFromResponse(
    response: unknown,
  ): CluebaseClueResponse[] {
    if (!response || typeof response !== 'object') {
      return [];
    }

    const apiResponse = response as Record<string, unknown>;

    // Try different possible response structures
    if (Array.isArray(apiResponse.clues)) {
      return apiResponse.clues as CluebaseClueResponse[];
    }
    if (Array.isArray(apiResponse.data)) {
      return apiResponse.data as CluebaseClueResponse[];
    }
    if (Array.isArray(apiResponse.results)) {
      return apiResponse.results as CluebaseClueResponse[];
    }
    if (Array.isArray(response)) {
      return response as CluebaseClueResponse[];
    }

    return [];
  }

  /**
   * Normalize Cluebase API response to internal Clue structure
   */
  private normalizeClues(
    clues: CluebaseClueResponse[],
    round: Round,
  ): NormalizedClue[] {
    const normalized: NormalizedClue[] = [];
    const expectedValues =
      round === Round.JEOPARDY
        ? [200, 400, 600, 800, 1000]
        : [400, 800, 1200, 1600, 2000];

    for (const clue of clues) {
      // Extract question (try multiple field names)
      const question =
        clue.clue || clue.question || (clue as Record<string, unknown>).text;
      if (!question || typeof question !== 'string' || question.trim() === '') {
        continue; // Skip invalid clues
      }

      // Extract answer (try multiple field names)
      const answer =
        clue.answer || clue.response || (clue as Record<string, unknown>).correct_response;
      if (!answer || typeof answer !== 'string' || answer.trim() === '') {
        continue; // Skip invalid clues
      }

      // Extract category
      const category = clue.category;
      if (!category || typeof category !== 'string' || category.trim() === '') {
        continue; // Skip invalid clues
      }

      // Extract value and validate it matches round requirements
      const value = clue.value;
      if (
        typeof value !== 'number' ||
        !expectedValues.includes(value)
      ) {
        continue; // Skip clues with invalid values
      }

      // Extract Daily Double flag
      const dailyDouble = Boolean(clue.daily_double);

      normalized.push({
        category: category.trim(),
        round,
        value,
        question: question.trim(),
        answer: answer.trim(),
        dailyDouble,
      });
    }

    return normalized;
  }

  /**
   * Persist normalized clues to database with duplicate detection
   */
  private async persistClues(
    normalizedClues: NormalizedClue[],
  ): Promise<Clue[]> {
    const prisma = this.prismaService.client;
    const persistedClues: Clue[] = [];

    // Process in batches to avoid large transactions
    const batchSize = 50;
    for (let i = 0; i < normalizedClues.length; i += batchSize) {
      const batch = normalizedClues.slice(i, i + batchSize);

      const batchResults = await prisma.$transaction(
        async (tx) => {
          const results: Clue[] = [];

          for (const clue of batch) {
            // Check if clue already exists using the duplicate detection index
            const existing = await tx.clue.findFirst({
              where: {
                round: clue.round,
                category: clue.category,
                question: clue.question,
                answer: clue.answer,
              },
            });

            if (existing) {
              results.push(existing);
              this.logger.debug(
                `Clue already exists, using existing: ${existing.id}`,
              );
            } else {
              // Create new clue
              const created = await tx.clue.create({
                data: {
                  category: clue.category,
                  round: clue.round,
                  value: clue.value,
                  question: clue.question,
                  answer: clue.answer,
                  dailyDouble: clue.dailyDouble,
                },
              });
              results.push(created);
              this.logger.debug(`Created new clue: ${created.id}`);
            }
          }

          return results;
        },
        {
          timeout: 30000, // 30 second timeout for large batches
        },
      );

      persistedClues.push(...batchResults);
    }

    return persistedClues;
  }
}
