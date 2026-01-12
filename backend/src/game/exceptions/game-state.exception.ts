import { BadRequestException } from '@nestjs/common';
import { GameState } from '@prisma/client';

export class GameStateException extends BadRequestException {
  constructor(currentState: GameState, requiredState?: GameState) {
    const message = requiredState
      ? `Game is in ${currentState} state, but ${requiredState} is required`
      : `Invalid game state: ${currentState}`;
    super(message);
  }
}
