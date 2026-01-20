import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CluebaseModule } from '../data/cluebase/cluebase.module';
import { GameService } from './game.service';
import { GameController } from './game.controller';

@Module({
  imports: [PrismaModule, AuthModule, CluebaseModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
