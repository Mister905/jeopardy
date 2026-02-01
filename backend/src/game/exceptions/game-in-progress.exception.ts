import { BadRequestException } from '@nestjs/common';

export class GameInProgressException extends BadRequestException {
  constructor() {
    super(
      'You already have a game in progress. End or complete it before creating a new one.',
    );
  }
}
