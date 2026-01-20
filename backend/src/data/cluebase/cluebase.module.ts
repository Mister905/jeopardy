import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { CluebaseClient } from './cluebase-client';
import { CluebaseService } from './cluebase.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [CluebaseClient, CluebaseService],
  exports: [CluebaseService],
})
export class CluebaseModule {}
