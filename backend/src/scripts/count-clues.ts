import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { Round } from '@prisma/client';

/**
 * Script to count clues by round in the database
 */
async function main() {
  let app;
  try {
    // Initialize NestJS application
    app = await NestFactory.createApplicationContext(AppModule);
    const prismaService = app.get(PrismaService);
    const prisma = prismaService.client;

    console.log('='.repeat(60));
    console.log('Clue Count by Round');
    console.log('='.repeat(60));
    console.log('');

    // Count clues by round
    const jeopardyCount = await prisma.clue.count({
      where: { round: Round.JEOPARDY },
    });

    const doubleJeopardyCount = await prisma.clue.count({
      where: { round: Round.DOUBLE_JEOPARDY },
    });

    const finalJeopardyCount = await prisma.clue.count({
      where: { round: Round.FINAL },
    });

    const totalCount = await prisma.clue.count({});

    console.log(`Jeopardy Round:      ${jeopardyCount.toLocaleString()} clues`);
    console.log(`Double Jeopardy:     ${doubleJeopardyCount.toLocaleString()} clues`);
    console.log(`Final Jeopardy:      ${finalJeopardyCount.toLocaleString()} clues`);
    console.log('─'.repeat(60));
    console.log(`Total:               ${totalCount.toLocaleString()} clues`);
    console.log('');

    // Show expected counts from parsing
    console.log('Expected counts (from parsing):');
    console.log('  Jeopardy/Double Jeopardy: ~117,531 clues');
    console.log('  Final Jeopardy:           ~2,020 clues');
    console.log('');

    if (totalCount === 0) {
      console.log('⚠️  No clues found in database. Run ingestion scripts:');
      console.log('   npm run ingest:jeopardy');
      console.log('   npm run ingest:final-jeopardy');
    } else if (totalCount < 100000) {
      console.log('⚠️  Clue count is lower than expected. Ingestion may be incomplete.');
    } else {
      console.log('✅ Clue counts look good!');
    }

    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('');
    console.error('❌ Error counting clues:');
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
