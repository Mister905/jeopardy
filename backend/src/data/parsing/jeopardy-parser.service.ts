import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ParsedJeopardyClue,
  ParsingError,
  JeopardyParsingResult,
  RawClueRow,
  JeopardySeasonFileParseResult,
} from './types';

@Injectable()
export class JeopardyParserService {
  private readonly logger = new Logger(JeopardyParserService.name);
  private readonly rawDataDir: string;
  private readonly parsedDataDir: string;
  private readonly minSeason = 33;
  private readonly maxSeason = 41;

  // Valid dollar values for each round
  private readonly jeopardyValues = [200, 400, 600, 800, 1000];
  private readonly doubleJeopardyValues = [400, 800, 1200, 1600, 2000];

  constructor(
    @Optional() rawDataDir?: string,
    @Optional() parsedDataDir?: string,
  ) {
    // Resolve paths relative to project root, or use provided paths for testing
    if (rawDataDir && parsedDataDir) {
      this.rawDataDir = rawDataDir;
      this.parsedDataDir = parsedDataDir;
    } else {
      const projectRoot = path.resolve(__dirname, '../../..');
      this.rawDataDir = path.join(
        projectRoot,
        'data',
        'jeopardy_clue_dataset',
        'raw',
      );
      this.parsedDataDir = path.join(
        projectRoot,
        'data',
        'jeopardy_clue_dataset',
        'parsed',
      );
    }
  }

  /**
   * Main entry point: Parse all Jeopardy and Double Jeopardy clues from seasons 33-41
   */
  async parseAllSeasons(): Promise<JeopardyParsingResult> {
    this.logger.log('Starting Jeopardy and Double Jeopardy parsing process');

    // Ensure parsed directory exists
    await this.ensureParsedDirectoryExists();

    const result: JeopardyParsingResult = {
      totalFilesProcessed: 0,
      totalRowsRead: 0,
      jeopardyRowsFound: 0,
      validRows: 0,
      invalidRows: 0,
      duplicatesSkipped: 0,
      outputFile: '',
      errors: [],
    };

    const allParsedClues: ParsedJeopardyClue[] = [];
    const seenClues = new Set<string>();

    // Process each season file
    for (let season = this.minSeason; season <= this.maxSeason; season++) {
      const filename = `season${season}.tsv`;
      const filePath = path.join(this.rawDataDir, filename);

      try {
        const fileResult = await this.parseSeasonFile(filename, filePath);

        result.totalFilesProcessed++;
        result.totalRowsRead += fileResult.totalRowsRead;
        result.jeopardyRowsFound += fileResult.jeopardyRowsFound;
        result.errors.push(...fileResult.errors);

        // Deduplicate clues
        for (const clue of fileResult.parsedClues) {
          const key = this.createDeduplicationKey(clue);
          if (!seenClues.has(key)) {
            seenClues.add(key);
            allParsedClues.push(clue);
          } else {
            result.duplicatesSkipped = (result.duplicatesSkipped || 0) + 1;
            this.logger.debug(
              `Duplicate clue skipped: ${clue.sourceFile} - ${clue.category}`,
            );
          }
        }

        result.invalidRows += fileResult.invalidRows;

        this.logger.log(
          `Processed ${filename}: ${fileResult.parsedClues.length} valid clues, ${fileResult.invalidRows} invalid`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push({
          file: filename,
          message: `Failed to process file: ${errorMessage}`,
        });
        this.logger.error(`Error processing ${filename}: ${errorMessage}`);
      }
    }

    // Set validRows to actual count of unique clues after deduplication
    result.validRows = allParsedClues.length;

    // Write output file
    const outputFile = path.join(
      this.parsedDataDir,
      'jeopardy-clues.json',
    );
    const outputData = {
      metadata: {
        totalClues: allParsedClues.length,
        totalFilesProcessed: result.totalFilesProcessed,
        totalRowsRead: result.totalRowsRead,
        jeopardyRowsFound: result.jeopardyRowsFound,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        duplicatesSkipped: result.duplicatesSkipped || 0,
        processedAt: new Date().toISOString(),
      },
      clues: allParsedClues,
    };

    try {
      await fs.writeFile(
        outputFile,
        JSON.stringify(outputData, null, 2),
        'utf-8',
      );
      result.outputFile = outputFile;
      this.logger.log(`Output written to ${outputFile}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push({
        file: 'output',
        message: `Failed to write output file: ${errorMessage}`,
      });
      throw new Error(`Failed to write output file: ${errorMessage}`);
    }

    // Log summary
    this.logger.log('Parsing complete');
    this.logger.log(`Total files processed: ${result.totalFilesProcessed}`);
    this.logger.log(`Total rows read: ${result.totalRowsRead}`);
    this.logger.log(
      `Jeopardy/Double Jeopardy rows found: ${result.jeopardyRowsFound}`,
    );
    this.logger.log(`Valid clues: ${result.validRows}`);
    this.logger.log(`Invalid rows: ${result.invalidRows}`);
    this.logger.log(`Duplicates skipped: ${result.duplicatesSkipped || 0}`);
    this.logger.log(`Total unique clues: ${allParsedClues.length}`);
    if (result.errors.length > 0) {
      this.logger.warn(`Errors encountered: ${result.errors.length}`);
    }

    return result;
  }

  /**
   * Parse a single season TSV file
   */
  private async parseSeasonFile(
    filename: string,
    filePath: string,
  ): Promise<JeopardySeasonFileParseResult> {
    const errors: ParsingError[] = [];
    const parsedClues: ParsedJeopardyClue[] = [];
    let totalRowsRead = 0;
    let jeopardyRowsFound = 0;
    let invalidRows = 0;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Extract season number from filename
      const seasonMatch = filename.match(/season(\d+)\.tsv/);
      if (!seasonMatch) {
        throw new Error(`Invalid filename format: ${filename}`);
      }
      const seasonNumber = parseInt(seasonMatch[1], 10);

      // Skip header row (first line)
      for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        let line = lines[lineIndex];
        // Trim only for empty line check, but preserve tabs for parsing
        if (!line.trim()) {
          continue; // Skip empty lines
        }

        totalRowsRead++;

        try {
          const rawRow = this.parseTsvLine(line, lineIndex + 1);

          // Filter for Jeopardy (round = 1) and Double Jeopardy (round = 2)
          if (rawRow.round !== '1' && rawRow.round !== '2') {
            continue;
          }

          jeopardyRowsFound++;

          // Validate required fields
          const validationError = this.validateRow(rawRow);
          if (validationError) {
            invalidRows++;
            errors.push({
              file: filename,
              line: lineIndex + 1,
              message: validationError,
            });
            continue;
          }

          // Normalize and create parsed clue
          const parsedClue = this.normalizeClue(rawRow, seasonNumber, filename);
          parsedClues.push(parsedClue);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push({
            file: filename,
            line: lineIndex + 1,
            message: `Malformed TSV row: ${errorMessage}`,
          });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file ${filename}: ${errorMessage}`);
    }

    return {
      totalRowsRead,
      jeopardyRowsFound,
      parsedClues,
      invalidRows,
      errors,
    };
  }

  /**
   * Parse a single TSV line into a RawClueRow
   */
  private parseTsvLine(line: string, lineNumber: number): RawClueRow {
    // Remove trailing newline/carriage return but preserve tabs
    const cleanedLine = line.replace(/[\r\n]+$/, '');
    const columns = cleanedLine.split('\t');

    // Handle case where trailing tab creates empty last column
    // If we have exactly 8 columns and the line might have had a trailing tab,
    // pad with empty string to make 9 columns
    const paddedColumns = columns.length === 8 ? [...columns, ''] : columns;

    if (paddedColumns.length < 9) {
      throw new Error(
        `Expected 9 columns, found ${paddedColumns.length} at line ${lineNumber}`,
      );
    }

    return {
      round: paddedColumns[0] || '',
      clueValue: paddedColumns[1] || '',
      dailyDoubleValue: paddedColumns[2] || '',
      category: paddedColumns[3] || '',
      comments: paddedColumns[4] || '',
      answer: paddedColumns[5] || '',
      question: paddedColumns[6] || '',
      airDate: paddedColumns[7] || '',
      notes: paddedColumns[8] || '',
    };
  }

  /**
   * Validate a row's required fields
   */
  private validateRow(row: RawClueRow): string | null {
    const trimmedCategory = row.category.trim();
    const trimmedAnswer = row.answer.trim();
    const trimmedQuestion = row.question.trim();

    if (!trimmedCategory) {
      return 'Category is empty or only whitespace';
    }
    if (!trimmedAnswer) {
      return 'Answer is empty or only whitespace';
    }
    if (!trimmedQuestion) {
      return 'Question is empty or only whitespace';
    }

    // Validate round is 1 or 2
    if (row.round !== '1' && row.round !== '2') {
      return `Invalid round: ${row.round} (expected '1' or '2')`;
    }

    // Validate clue value is a number
    const clueValue = parseInt(row.clueValue, 10);
    if (isNaN(clueValue)) {
      return `Invalid clue value: ${row.clueValue} (not a number)`;
    }

    // Validate clue value matches round requirements
    if (row.round === '1') {
      if (!this.jeopardyValues.includes(clueValue)) {
        return `Invalid Jeopardy clue value: ${clueValue} (must be one of: ${this.jeopardyValues.join(', ')})`;
      }
    } else if (row.round === '2') {
      if (!this.doubleJeopardyValues.includes(clueValue)) {
        return `Invalid Double Jeopardy clue value: ${clueValue} (must be one of: ${this.doubleJeopardyValues.join(', ')})`;
      }
    }

    return null; // Valid
  }

  /**
   * Normalize a validated row into a ParsedJeopardyClue
   */
  private normalizeClue(
    row: RawClueRow,
    seasonNumber: number,
    sourceFile: string,
  ): ParsedJeopardyClue {
    const clueValue = parseInt(row.clueValue, 10);
    const dailyDoubleValue = parseInt(row.dailyDoubleValue, 10);

    const clue: ParsedJeopardyClue = {
      seasonNumber,
      round: row.round as '1' | '2',
      category: row.category.trim(),
      answer: row.answer.trim(),
      question: row.question.trim(),
      value: clueValue,
      dailyDouble: dailyDoubleValue > 0,
      sourceFile,
    };

    // Include airDate if available and non-empty
    const trimmedAirDate = row.airDate.trim();
    if (trimmedAirDate) {
      clue.airDate = trimmedAirDate;
    }

    return clue;
  }

  /**
   * Create a deduplication key from a clue
   */
  private createDeduplicationKey(clue: ParsedJeopardyClue): string {
    return `${clue.round}|${clue.category}|${clue.question}|${clue.answer}`;
  }

  /**
   * Ensure the parsed directory exists
   */
  private async ensureParsedDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.parsedDataDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.parsedDataDir, { recursive: true });
      this.logger.log(`Created parsed directory: ${this.parsedDataDir}`);
    }
  }
}
