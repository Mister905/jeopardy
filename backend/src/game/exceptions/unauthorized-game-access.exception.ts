import { ForbiddenException } from '@nestjs/common';

export class UnauthorizedGameAccessException extends ForbiddenException {
  constructor() {
    super('You do not have access to this game');
  }
}
