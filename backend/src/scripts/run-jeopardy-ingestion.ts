import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { JeopardyIngestionService } from '../data/ingestion/jeopardy-ingestion.service';
import { JeopardyParserService } from '../data/parsing/jeopardy-parser.service';

/**
 * Standalone script to execute Jeopardy and Double Jeopardy parsing and database ingestion
 * First parses TSV files, then ingests parsed clues from JSON file into the database
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Jeopardy/Double Jeopardy Ingestion - Execution Script');
  console.log('='.repeat(60));
  console.log('');

  let app;
  try {
    // Initialize NestJS application
    app = await NestFactory.createApplicationContext(AppModule);
    const parserService = app.get(JeopardyParserService);
    const ingestionService = app.get(JeopardyIngestionService);

    console.log('Services initialized');
    console.log('');

    // Step 1: Parse TSV files
    console.log('Step 1: Parsing TSV files...');
    console.log('');
    const parseResult = await parserService.parseAllSeasons();

    console.log('');
    console.log('='.repeat(60));
    console.log('Parsing Complete - Summary');
    console.log('='.repeat(60));
    console.log(`Total files processed: ${parseResult.totalFilesProcessed}`);
    console.log(`Total rows read: ${parseResult.totalRowsRead}`);
    console.log(`Jeopardy/Double Jeopardy rows found: ${parseResult.jeopardyRowsFound}`);
    console.log(`Valid clues: ${parseResult.validRows}`);
    console.log(`Invalid rows: ${parseResult.invalidRows}`);
    console.log(`Duplicates skipped: ${parseResult.duplicatesSkipped || 0}`);
    console.log(`Output file: ${parseResult.outputFile}`);

    if (parseResult.errors.length > 0) {
      console.log('');
      console.log(`⚠️  Warnings: ${parseResult.errors.length} errors encountered during parsing`);
      parseResult.errors.slice(0, 10).forEach((error, index) => {
        console.log(
          `  ${index + 1}. [${error.file}${error.line ? `:${error.line}` : ''}] ${error.message}`,
        );
      });
      if (parseResult.errors.length > 10) {
        console.log(`  ... and ${parseResult.errors.length - 10} more errors`);
      }
    } else {
      console.log('');
      console.log('✅ No parsing errors encountered');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('');

    // Step 2: Ingest parsed clues into database
    console.log('Step 2: Ingesting clues into database...');
    console.log('');
    const ingestionResult = await ingestionService.ingestFromParsedFile(parseResult.outputFile);

    // Display ingestion results summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Ingestion Complete - Summary');
    console.log('='.repeat(60));
    console.log(`Total clues processed: ${ingestionResult.totalCluesProcessed}`);
    console.log(`Valid clues: ${ingestionResult.validClues}`);
    console.log(`Invalid clues: ${ingestionResult.invalidClues}`);
    console.log(`Clues inserted: ${ingestionResult.cluesInserted}`);
    console.log(`Duplicates skipped: ${ingestionResult.duplicatesSkipped}`);

    if (ingestionResult.errors.length > 0) {
      console.log('');
      console.log(`⚠️  Warnings: ${ingestionResult.errors.length} errors encountered during ingestion`);
      ingestionResult.errors.slice(0, 10).forEach((error, index) => {
        console.log(
          `  ${index + 1}. [${error.type}] ${error.message}${
            error.clue ? ` (category: ${(error.clue as any).category})` : ''
          }`,
        );
      });
      if (ingestionResult.errors.length > 10) {
        console.log(`  ... and ${ingestionResult.errors.length - 10} more errors`);
      }
    } else {
      console.log('');
      console.log('✅ No ingestion errors encountered');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Complete ingestion process finished successfully');
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
