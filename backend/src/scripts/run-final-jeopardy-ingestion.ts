import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FinalJeopardyIngestionService } from '../data/ingestion/final-jeopardy-ingestion.service';

/**
 * Standalone script to execute Final Jeopardy database ingestion
 * Ingests parsed clues from JSON file into the database
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Final Jeopardy Ingestion - Execution Script');
  console.log('='.repeat(60));
  console.log('');

  let app;
  try {
    // Initialize NestJS application
    app = await NestFactory.createApplicationContext(AppModule);
    const ingestionService = app.get(FinalJeopardyIngestionService);

    console.log('Ingestion service initialized');
    console.log('');

    // Execute ingestion
    console.log('Starting ingestion process...');
    console.log('');
    const result = await ingestionService.ingestFromParsedFile();

    // Display results summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Ingestion Complete - Summary');
    console.log('='.repeat(60));
    console.log(`Total clues processed: ${result.totalCluesProcessed}`);
    console.log(`Valid clues: ${result.validClues}`);
    console.log(`Invalid clues: ${result.invalidClues}`);
    console.log(`Clues inserted: ${result.cluesInserted}`);
    console.log(`Duplicates skipped: ${result.duplicatesSkipped}`);

    if (result.errors.length > 0) {
      console.log('');
      console.log(`⚠️  Warnings: ${result.errors.length} errors encountered`);
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(
          `  ${index + 1}. [${error.type}] ${error.message}${
            error.clue ? ` (category: ${error.clue.category})` : ''
          }`,
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
    console.log('✅ Ingestion completed successfully');
    console.log('='.repeat(60));

    // Close application context
    await app.close();

    // Exit with success code
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Ingestion failed');
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

    // Close application context if it was created
    if (app) {
      await app.close();
    }

    // Exit with error code
    process.exit(1);
  }
}

// Execute the script
main();
