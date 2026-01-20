import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FinalJeopardyIngestionService } from './final-jeopardy-ingestion.service';
import { JeopardyIngestionService } from './jeopardy-ingestion.service';

@Module({
  imports: [PrismaModule],
  providers: [FinalJeopardyIngestionService, JeopardyIngestionService],
  exports: [FinalJeopardyIngestionService, JeopardyIngestionService],
})
export class IngestionModule {}
