import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedFinalJeopardyClue, ParsingResult } from '../data/parsing/types';

interface OutputMetadata {
  totalClues: number;
  totalFilesProcessed: number;
  totalRowsRead: number;
  finalJeopardyRowsFound: number;
  validRows: number;
  invalidRows: number;
  duplicatesSkipped: number;
  processedAt: string;
}

interface OutputData {
  metadata: OutputMetadata;
  clues: ParsedFinalJeopardyClue[];
}

interface ValidationError {
  check: string;
  message: string;
}

/**
 * Standalone script to verify parsed Final Jeopardy output
 * Validates file structure, metadata consistency, and data integrity
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Final Jeopardy Parser - Output Verification');
  console.log('='.repeat(60));
  console.log('');

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  try {
    // Resolve output file path
    // __dirname is backend/src/scripts/ when run with ts-node
    // Go up two levels to reach backend/ directory
    const projectRoot = path.resolve(__dirname, '../..');
    const outputFile = path.join(
      projectRoot,
      'data',
      'jeopardy_clue_dataset',
      'parsed',
      'final-jeopardy-clues.json',
    );

    console.log(`Reading output file: ${outputFile}`);

    // Check file existence
    try {
      await fs.access(outputFile);
    } catch {
      errors.push({
        check: 'File Existence',
        message: `Output file does not exist: ${outputFile}`,
      });
      reportResults(errors, warnings);
      process.exit(1);
    }

    // Read and parse JSON
    let outputData: OutputData;
    try {
      const fileContent = await fs.readFile(outputFile, 'utf-8');
      outputData = JSON.parse(fileContent);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push({
        check: 'JSON Validity',
        message: `Failed to parse JSON: ${errorMessage}`,
      });
      reportResults(errors, warnings);
      process.exit(1);
    }

    console.log('✅ File read and parsed successfully');
    console.log('');

    // Validate metadata structure
    console.log('Validating metadata...');
    if (!outputData.metadata) {
      errors.push({
        check: 'Metadata Structure',
        message: 'Missing metadata object',
      });
    } else {
      const metadata = outputData.metadata;

      // Check required metadata fields
      const requiredFields: (keyof OutputMetadata)[] = [
        'totalClues',
        'totalFilesProcessed',
        'totalRowsRead',
        'finalJeopardyRowsFound',
        'validRows',
        'invalidRows',
        'duplicatesSkipped',
        'processedAt',
      ];

      for (const field of requiredFields) {
        if (!(field in metadata)) {
          errors.push({
            check: 'Metadata Structure',
            message: `Missing required metadata field: ${field}`,
          });
        }
      }

      // Validate metadata consistency
      // totalClues should equal the actual number of clues in the array (after deduplication)
      if (metadata.totalClues !== outputData.clues.length) {
        errors.push({
          check: 'Metadata Consistency',
          message: `totalClues (${metadata.totalClues}) does not match clues array length (${outputData.clues.length})`,
        });
      }

      // validRows should equal clues.length since it represents unique clues after deduplication
      if (metadata.validRows !== outputData.clues.length) {
        errors.push({
          check: 'Metadata Consistency',
          message: `validRows (${metadata.validRows}) does not match clues array length (${outputData.clues.length})`,
        });
      }

      // Expect 9 files (seasons 33-41), but use warning instead of error for flexibility
      if (metadata.totalFilesProcessed !== 9) {
        warnings.push({
          check: 'File Count',
          message: `Expected 9 files processed, found ${metadata.totalFilesProcessed}`,
        });
      }

      // duplicatesSkipped should never be negative
      if (metadata.duplicatesSkipped < 0) {
        errors.push({
          check: 'Metadata Validity',
          message: `duplicatesSkipped must be non-negative, found ${metadata.duplicatesSkipped}`,
        });
      }

      // Validate timestamp format - must be a valid ISO 8601 date string
      try {
        const timestamp = new Date(metadata.processedAt);
        if (isNaN(timestamp.getTime())) {
          errors.push({
            check: 'Metadata Validity',
            message: `processedAt is not a valid ISO timestamp: ${metadata.processedAt}`,
          });
        }
      } catch {
        errors.push({
          check: 'Metadata Validity',
          message: `processedAt is not a valid ISO timestamp: ${metadata.processedAt}`,
        });
      }

      // finalJeopardyRowsFound should be >= totalClues because duplicates are removed
      // (finalJeopardyRowsFound is before deduplication, totalClues is after)
      if (metadata.finalJeopardyRowsFound < metadata.totalClues) {
        errors.push({
          check: 'Metadata Consistency',
          message: `finalJeopardyRowsFound (${metadata.finalJeopardyRowsFound}) should be >= totalClues (${metadata.totalClues})`,
        });
      }
    }

    console.log('✅ Metadata validation complete');
    console.log('');

    // Validate data integrity
    console.log('Validating data integrity...');
    if (!Array.isArray(outputData.clues)) {
      errors.push({
        check: 'Data Structure',
        message: 'clues must be an array',
      });
    } else {
      const clues = outputData.clues;
      const deduplicationKeys = new Set<string>();
      const seasonRange = { min: 33, max: 41 };
      const sourceFilePattern = /^season(3[3-9]|4[01])\.tsv$/;

      for (let i = 0; i < clues.length; i++) {
        const clue = clues[i];

        // Validate seasonNumber: must be a number between 33-41 (inclusive)
        if (typeof clue.seasonNumber !== 'number') {
          errors.push({
            check: 'Data Completeness',
            message: `Clue ${i}: seasonNumber must be a number, found ${typeof clue.seasonNumber}`,
          });
        } else if (
          clue.seasonNumber < seasonRange.min ||
          clue.seasonNumber > seasonRange.max
        ) {
          errors.push({
            check: 'Season Range',
            message: `Clue ${i}: seasonNumber ${clue.seasonNumber} is outside valid range (33-41)`,
          });
        }

        // Validate category: must be a non-empty string after trimming whitespace
        if (typeof clue.category !== 'string' || !clue.category.trim()) {
          errors.push({
            check: 'Data Completeness',
            message: `Clue ${i}: category must be a non-empty string`,
          });
        }

        // Validate answer: must be a non-empty string after trimming whitespace
        if (typeof clue.answer !== 'string' || !clue.answer.trim()) {
          errors.push({
            check: 'Data Completeness',
            message: `Clue ${i}: answer must be a non-empty string`,
          });
        }

        // Validate question: must be a non-empty string after trimming whitespace
        if (typeof clue.question !== 'string' || !clue.question.trim()) {
          errors.push({
            check: 'Data Completeness',
            message: `Clue ${i}: question must be a non-empty string`,
          });
        }

        // Validate sourceFile: must be a string matching pattern season{33-41}.tsv
        if (typeof clue.sourceFile !== 'string') {
          errors.push({
            check: 'Data Completeness',
            message: `Clue ${i}: sourceFile must be a string`,
          });
        } else if (!sourceFilePattern.test(clue.sourceFile)) {
          errors.push({
            check: 'Source File Pattern',
            message: `Clue ${i}: sourceFile "${clue.sourceFile}" does not match expected pattern (season{33-41}.tsv)`,
          });
        }

        // Check for duplicates using composite key: category|question|answer
        // This matches the deduplication logic used in the parser service
        const dedupKey = `${clue.category}|${clue.question}|${clue.answer}`;
        if (deduplicationKeys.has(dedupKey)) {
          errors.push({
            check: 'Deduplication',
            message: `Clue ${i}: Duplicate found (category: "${clue.category}")`,
          });
        } else {
          deduplicationKeys.add(dedupKey);
        }
      }

      // Verify deduplication worked: Set size should equal array length
      // If they differ, it means duplicates were not properly removed
      if (deduplicationKeys.size !== clues.length) {
        errors.push({
          check: 'Deduplication',
          message: `Found ${clues.length - deduplicationKeys.size} duplicate clues in the dataset`,
        });
      }
    }

    console.log('✅ Data integrity validation complete');
    console.log('');

    // Report results
    reportResults(errors, warnings, outputData.metadata);

    // Exit with appropriate code
    if (errors.length > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Verification failed with unexpected error');
    console.error('='.repeat(60));
    console.error('');

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('Error:', errorMessage);
    if (errorStack) {
      console.error('');
      console.error('Stack trace:');
      console.error(errorStack);
    }

    console.error('');
    console.error('='.repeat(60));

    process.exit(1);
  }
}

function reportResults(
  errors: ValidationError[],
  warnings: ValidationError[],
  metadata?: OutputMetadata,
) {
  console.log('='.repeat(60));
  console.log('Verification Results');
  console.log('='.repeat(60));
  console.log('');

  if (metadata) {
    console.log('Output Statistics:');
    console.log(`  Total clues: ${metadata.totalClues}`);
    console.log(`  Files processed: ${metadata.totalFilesProcessed}`);
    console.log(`  Rows read: ${metadata.totalRowsRead}`);
    console.log(
      `  Final Jeopardy rows found: ${metadata.finalJeopardyRowsFound}`,
    );
    console.log(`  Valid rows: ${metadata.validRows}`);
    console.log(`  Invalid rows: ${metadata.invalidRows}`);
    console.log(`  Duplicates skipped: ${metadata.duplicatesSkipped}`);
    console.log(`  Processed at: ${metadata.processedAt}`);
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (${warnings.length}):`);
    warnings.forEach((warning) => {
      console.log(`  [${warning.check}] ${warning.message}`);
    });
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}):`);
    errors.forEach((error) => {
      console.log(`  [${error.check}] ${error.message}`);
    });
    console.log('');
    console.log('='.repeat(60));
    console.log('❌ Verification failed');
    console.log('='.repeat(60));
  } else {
    console.log('='.repeat(60));
    console.log('✅ All validations passed');
    console.log('='.repeat(60));
  }
}

// Execute the script
main();
