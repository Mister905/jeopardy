import { Module } from '@nestjs/common';
import { CluebaseService } from './cluebase.service';

@Module({
  providers: [CluebaseService],
  exports: [CluebaseService],
})
export class CluebaseModule {}

