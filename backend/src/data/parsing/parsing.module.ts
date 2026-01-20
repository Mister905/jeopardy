import { Module } from '@nestjs/common';
import { FinalJeopardyParserService } from './final-jeopardy-parser.service';
import { JeopardyParserService } from './jeopardy-parser.service';

@Module({
  providers: [FinalJeopardyParserService, JeopardyParserService],
  exports: [FinalJeopardyParserService, JeopardyParserService],
})
export class ParsingModule {}
