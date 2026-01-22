import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Script to clear all clue data from the database
 * WARNING: This will delete all clues, game clues, and final jeopardy records
 * Only run this if you want to start fresh with re-ingestion
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Clear Clue Data - Execution Script');
  console.log('='.repeat(60));
  console.log('');
  console.log('⚠️  WARNING: This will delete ALL clue-related data:');
  console.log('   - All Clue records');
  console.log('   - All GameClue records (this will break existing games!)');
  console.log('   - All FinalJeopardy records');
  console.log('');
  console.log('This should only be run before re-ingestion after fixing data issues.');
  console.log('');

  let app;
  try {
    // Initialize NestJS application
    app = await NestFactory.createApplicationContext(AppModule);
    const prismaService = app.get(PrismaService);
    const prisma = prismaService.client;

    // Check for existing games
    const gameCount = await prisma.game.count();
    if (gameCount > 0) {
      console.log(`⚠️  WARNING: Found ${gameCount} existing game(s) in the database.`);
      console.log('   Deleting clues will break these games.');
      console.log('');
    }

    // Delete in order to respect foreign key constraints
    console.log('Deleting GameClue records...');
    const gameClueCount = await prisma.gameClue.deleteMany({});
    console.log(`   Deleted ${gameClueCount.count} GameClue records`);

    console.log('Deleting FinalJeopardy records...');
    const finalJeopardyCount = await prisma.finalJeopardy.deleteMany({});
    console.log(`   Deleted ${finalJeopardyCount.count} FinalJeopardy records`);

    console.log('Deleting Clue records...');
    const clueCount = await prisma.clue.deleteMany({});
    console.log(`   Deleted ${clueCount.count} Clue records`);

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ All clue data cleared successfully');
    console.log('='.repeat(60));
    console.log('');
    console.log('You can now run the ingestion scripts:');
    console.log('  npm run ingest:jeopardy');
    console.log('  npm run ingest:final-jeopardy');
    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('');
    console.error('❌ Error clearing clue data:');
    console.error(`   ${errorMessage}`);
    console.error('');
    process.exit(1);
  } finally {
    if (app) {
      await app.close();
    }
  }
}

main();
