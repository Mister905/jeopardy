import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Round } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedJeopardyClue } from '../parsing/types';
import { IngestionError, IngestionResult } from './types';

interface ParsedFileData {
  metadata: {
    totalClues: number;
    [key: string]: unknown;
  };
  clues: ParsedJeopardyClue[];
}

@Injectable()
export class JeopardyIngestionService {
  private readonly logger = new Logger(JeopardyIngestionService.name);
  private readonly batchSize = 100; // Batch size for processing
  private readonly insertBatchSize = 25; // Smaller batch size for inserts to avoid transaction timeout
  private readonly transactionTimeout = 10000; // 10 seconds timeout for transactions

  // Valid dollar values for each round
  private readonly jeopardyValues = [200, 400, 600, 800, 1000];
  private readonly doubleJeopardyValues = [400, 800, 1200, 1600, 2000];

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Main entry point: Ingest Jeopardy and Double Jeopardy clues from parsed JSON file
   */
  async ingestFromParsedFile(filePath?: string): Promise<IngestionResult> {
    this.logger.log('Starting Jeopardy and Double Jeopardy ingestion process');

    const result: IngestionResult = {
      totalCluesProcessed: 0,
      validClues: 0,
      invalidClues: 0,
      cluesInserted: 0,
      duplicatesSkipped: 0,
      errors: [],
    };

    try {
      // Resolve file path
      const inputFile = filePath || this.getDefaultParsedFilePath();

      this.logger.log(`Reading parsed file: ${inputFile}`);

      // Read and parse file
      const parsedData = await this.readAndParseFile(inputFile);
      result.totalCluesProcessed = parsedData.clues.length;

      this.logger.log(`Found ${parsedData.clues.length} clues in parsed file`);

      // Process clues in batches
      const validClues: ParsedJeopardyClue[] = [];
      const seenInBatch = new Set<string>();

      // Step 1: Validate clues and deduplicate within batch
      for (let i = 0; i < parsedData.clues.length; i++) {
        const clue = parsedData.clues[i];

        // Validate clue
        const validationError = this.validateClue(clue);
        if (validationError) {
          result.invalidClues++;
          result.errors.push({
            clueIndex: i,
            clue: clue,
            message: validationError,
            type: 'validation',
          });
          continue;
        }

        // In-memory deduplication within batch
        const dedupKey = this.createDeduplicationKey(clue);
        if (seenInBatch.has(dedupKey)) {
          result.duplicatesSkipped++;
          this.logger.debug(
            `Duplicate clue skipped in batch (index ${i}): ${clue.category}`,
          );
          continue;
        }

        seenInBatch.add(dedupKey);
        validClues.push(clue);
      }

      result.validClues = validClues.length;

      this.logger.log(
        `Valid clues after validation: ${result.validClues}, Invalid: ${result.invalidClues}`,
      );

      // Step 2: Check for existing clues in database and insert new ones
      await this.processCluesInBatches(validClues, result);

      // Log summary
      this.logger.log('Ingestion complete');
      this.logger.log(`Total clues processed: ${result.totalCluesProcessed}`);
      this.logger.log(`Valid clues: ${result.validClues}`);
      this.logger.log(`Invalid clues: ${result.invalidClues}`);
      this.logger.log(`Clues inserted: ${result.cluesInserted}`);
      this.logger.log(`Duplicates skipped: ${result.duplicatesSkipped}`);
      if (result.errors.length > 0) {
        this.logger.warn(`Errors encountered: ${result.errors.length}`);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingestion failed: ${errorMessage}`);

      result.errors.push({
        message: `Ingestion failed: ${errorMessage}`,
        type: 'file',
      });

      throw error;
    }
  }

  /**
   * Read and parse the JSON file
   */
  private async readAndParseFile(filePath: string): Promise<ParsedFileData> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as ParsedFileData;

      if (!parsed.clues || !Array.isArray(parsed.clues)) {
        throw new Error(
          'Invalid file structure: missing or invalid clues array',
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in file: ${error.message}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Validate a clue's required fields
   */
  private validateClue(clue: ParsedJeopardyClue): string | null {
    const trimmedCategory = clue.category?.trim() || '';
    const trimmedAnswer = clue.answer?.trim() || '';
    const trimmedQuestion = clue.question?.trim() || '';

    if (!trimmedCategory) {
      return 'Category is empty or only whitespace';
    }
    if (!trimmedAnswer) {
      return 'Answer is empty or only whitespace';
    }
    if (!trimmedQuestion) {
      return 'Question is empty or only whitespace';
    }

    // Validate round is '1' or '2'
    if (clue.round !== '1' && clue.round !== '2') {
      return `Invalid round: ${clue.round} (expected '1' or '2')`;
    }

    // Validate value is a number
    if (typeof clue.value !== 'number' || isNaN(clue.value)) {
      return `Invalid value: ${clue.value} (not a number)`;
    }

    // Validate value matches round requirements
    if (clue.round === '1') {
      if (!this.jeopardyValues.includes(clue.value)) {
        return `Invalid Jeopardy clue value: ${clue.value} (must be one of: ${this.jeopardyValues.join(', ')})`;
      }
    } else if (clue.round === '2') {
      if (!this.doubleJeopardyValues.includes(clue.value)) {
        return `Invalid Double Jeopardy clue value: ${clue.value} (must be one of: ${this.doubleJeopardyValues.join(', ')})`;
      }
    }

    // Validate dailyDouble is boolean
    if (typeof clue.dailyDouble !== 'boolean') {
      return `Invalid dailyDouble: ${clue.dailyDouble} (expected boolean)`;
    }

    return null; // Valid
  }

  /**
   * Create deduplication key (same as parser service)
   * Note: Assumes clue fields are already trimmed from parser
   */
  private createDeduplicationKey(clue: ParsedJeopardyClue): string {
    return `${clue.round}|${clue.category}|${clue.question}|${clue.answer}`;
  }

  /**
   * Process clues in batches: check for duplicates and insert
   */
  private async processCluesInBatches(
    clues: ParsedJeopardyClue[],
    result: IngestionResult,
  ): Promise<void> {
    const prisma = this.prismaService.client;

    for (let i = 0; i < clues.length; i += this.batchSize) {
      const batch = clues.slice(i, i + this.batchSize);
      this.logger.debug(
        `Processing batch ${Math.floor(i / this.batchSize) + 1} (${batch.length} clues)`,
      );

      // Batch query for existing clues to reduce database round trips
      let existingClues: Array<{
        round: Round;
        category: string;
        question: string;
        answer: string;
      }> = [];
      try {
        if (batch.length > 0) {
          // Group clues by round for efficient querying
          const jeopardyClues = batch.filter((c) => c.round === '1');
          const doubleJeopardyClues = batch.filter((c) => c.round === '2');

          // Query for Jeopardy clues
          // OR query structure: Each object in the OR array represents an AND condition.
          // The query finds clues where (category=X AND question=Y AND answer=Z) OR
          // (category=A AND question=B AND answer=C) OR ... for all clues in the batch.
          // This efficiently checks for duplicates in a single database query.
          if (jeopardyClues.length > 0) {
            const jeopardyExisting = await prisma.clue.findMany({
              where: {
                round: Round.JEOPARDY,
                OR: jeopardyClues.map((clue) => ({
                  category: clue.category.trim(),
                  question: clue.question.trim(),
                  answer: clue.answer.trim(),
                })),
              },
              select: {
                round: true,
                category: true,
                question: true,
                answer: true,
              },
            });
            existingClues.push(...jeopardyExisting);
          }

          // Query for Double Jeopardy clues
          // OR query structure: Each object in the OR array represents an AND condition.
          // The query finds clues where (category=X AND question=Y AND answer=Z) OR
          // (category=A AND question=B AND answer=C) OR ... for all clues in the batch.
          // This efficiently checks for duplicates in a single database query.
          if (doubleJeopardyClues.length > 0) {
            const doubleJeopardyExisting = await prisma.clue.findMany({
              where: {
                round: Round.DOUBLE_JEOPARDY,
                OR: doubleJeopardyClues.map((clue) => ({
                  category: clue.category.trim(),
                  question: clue.question.trim(),
                  answer: clue.answer.trim(),
                })),
              },
              select: {
                round: true,
                category: true,
                question: true,
                answer: true,
              },
            });
            existingClues.push(...doubleJeopardyExisting);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error querying for existing clues: ${errorMessage}`,
        );
        // Add error for each clue in the batch
        batch.forEach((clue) => {
          result.errors.push({
            clue: clue,
            message: `Database query error: ${errorMessage}`,
            type: 'database',
          });
        });
        // Skip this batch if query fails
        continue;
      }

      // Create a Set of existing clue keys for O(1) lookup
      const existingKeys = new Set(
        existingClues.map(
          (c) => `${c.round}|${c.category}|${c.question}|${c.answer}`,
        ),
      );

      // Filter out duplicates
      // Note: We trim when creating the key to match the trimmed values used in the database query
      const cluesToInsert: ParsedJeopardyClue[] = [];
      for (const clue of batch) {
        const trimmedClue = {
          round: clue.round === '1' ? Round.JEOPARDY : Round.DOUBLE_JEOPARDY,
          category: clue.category.trim(),
          question: clue.question.trim(),
          answer: clue.answer.trim(),
        };
        const dedupKey = `${trimmedClue.round}|${trimmedClue.category}|${trimmedClue.question}|${trimmedClue.answer}`;

        if (existingKeys.has(dedupKey)) {
          result.duplicatesSkipped++;
          this.logger.debug(`Duplicate clue skipped (DB): ${clue.category}`);
        } else {
          cluesToInsert.push(clue);
        }
      }

      // Insert new clues in smaller sub-batches to avoid transaction timeout
      if (cluesToInsert.length > 0) {
        for (
          let insertIdx = 0;
          insertIdx < cluesToInsert.length;
          insertIdx += this.insertBatchSize
        ) {
          const insertBatch = cluesToInsert.slice(
            insertIdx,
            insertIdx + this.insertBatchSize,
          );
          try {
            await prisma.$transaction(
              async (tx) => {
                await Promise.all(
                  insertBatch.map((clue) =>
                    tx.clue.create({
                      data: {
                        category: clue.category.trim(),
                        round: clue.round === '1' ? Round.JEOPARDY : Round.DOUBLE_JEOPARDY,
                        value: clue.value,
                        question: clue.question.trim(),
                        answer: clue.answer.trim(),
                        dailyDouble: clue.dailyDouble,
                      },
                    }),
                  ),
                );
              },
              {
                timeout: this.transactionTimeout,
              },
            );

            result.cluesInserted += insertBatch.length;
            this.logger.debug(
              `Inserted ${insertBatch.length} clues (sub-batch ${Math.floor(insertIdx / this.insertBatchSize) + 1})`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            this.logger.error(`Error inserting sub-batch: ${errorMessage}`);

            // Add error for each clue in the failed sub-batch
            insertBatch.forEach((clue) => {
              result.errors.push({
                clue: clue,
                message: `Insertion failed: ${errorMessage}`,
                type: 'database',
              });
            });
          }
        }
        this.logger.log(
          `Inserted ${cluesToInsert.length} clues in batch (${Math.ceil(cluesToInsert.length / this.insertBatchSize)} sub-batches)`,
        );
      }
    }
  }

  /**
   * Get default path to parsed file
   */
  private getDefaultParsedFilePath(): string {
    const projectRoot = path.resolve(__dirname, '../../..');
    return path.join(
      projectRoot,
      'data',
      'jeopardy_clue_dataset',
      'parsed',
      'jeopardy-clues.json',
    );
  }
}
