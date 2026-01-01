import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Decorator to extract userId from request
 *
 * This is a placeholder implementation. Replace with actual JWT authentication guard.
 * The decorator expects the authentication middleware to set request.user with userId.
 *
 * Example JWT guard implementation:
 * - Create an AuthGuard that validates JWT token
 * - Extract userId from token payload
 * - Set request.user = { userId: extractedUserId }
 *
 * For now, this assumes request.user.userId or request.user.id is set by auth middleware.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.userId || request.user?.id;

    if (!userId) {
      throw new UnauthorizedException(
        'User ID not found in request. Ensure JWT authentication middleware is configured.',
      );
    }

    return userId;
  },
);

