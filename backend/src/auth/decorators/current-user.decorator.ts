import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types';

/**
 * Request property key where authenticated user is stored
 */
export const REQUEST_USER_KEY = 'user';

/**
 * Factory function to extract authenticated user from request
 * Exported for testing purposes
 * @param data - Decorator data (unused)
 * @param ctx - Execution context
 * @returns Authenticated user
 * @throws Error if user is not found in request
 */
export const currentUserFactory = (
  data: unknown,
  ctx: ExecutionContext,
): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  const user = request[REQUEST_USER_KEY];

  if (!user) {
    throw new Error(
      'Authenticated user not found in request. Ensure AuthGuard is applied to this route.',
    );
  }

  return user;
};

/**
 * Decorator to extract authenticated user from request
 * Use in controller methods: @CurrentUser() user: AuthenticatedUser
 *
 * @throws Error if user is not found in request (should not happen if guard is properly applied)
 */
export const CurrentUser = createParamDecorator(currentUserFactory);
