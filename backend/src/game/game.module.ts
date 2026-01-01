import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CluebaseModule } from '../cluebase/cluebase.module';

@Module({
  imports: [PrismaModule, CluebaseModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}

