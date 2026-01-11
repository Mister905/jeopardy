import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FinalJeopardyIngestionService } from './final-jeopardy-ingestion.service';

@Module({
  imports: [PrismaModule],
  providers: [FinalJeopardyIngestionService],
  exports: [FinalJeopardyIngestionService],
})
export class IngestionModule {}
