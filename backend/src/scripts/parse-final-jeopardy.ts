import { FinalJeopardyParserService } from '../data/parsing/final-jeopardy-parser.service';

/**
 * Standalone script to execute Final Jeopardy parsing
 * Processes all raw TSV files from Seasons 33-41 and produces cleaned JSON output
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Final Jeopardy Parser - Execution Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Initialize parser service with default paths
    const parser = new FinalJeopardyParserService();
    console.log('Parser service initialized');
    console.log('');

    // Execute parsing
    console.log('Starting parsing process...');
    console.log('');
    const result = await parser.parseAllSeasons();

    // Display results summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Parsing Complete - Summary');
    console.log('='.repeat(60));
    console.log(`Total files processed: ${result.totalFilesProcessed}`);
    console.log(`Total rows read: ${result.totalRowsRead}`);
    console.log(`Final Jeopardy rows found: ${result.finalJeopardyRowsFound}`);
    console.log(`Valid clues (after deduplication): ${result.validRows}`);
    console.log(`Invalid rows: ${result.invalidRows}`);
    console.log(`Duplicates skipped: ${result.duplicatesSkipped || 0}`);
    console.log(`Output file: ${result.outputFile}`);

    if (result.errors.length > 0) {
      console.log('');
      console.log(`⚠️  Warnings: ${result.errors.length} errors encountered`);
      result.errors.slice(0, 10).forEach((error) => {
        console.log(
          `  - ${error.file}${error.line ? ` (line ${error.line})` : ''}: ${error.message}`,
        );
      });
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`);
      }
    } else {
      console.log('');
      console.log('✅ No errors encountered');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Parsing completed successfully');
    console.log('='.repeat(60));

    // Exit with success code
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Parsing failed');
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

    // Exit with error code
    process.exit(1);
  }
}

// Execute the script
main();
