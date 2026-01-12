import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameService } from './game.service';

@Module({
  imports: [PrismaModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
