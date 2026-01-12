import { ExecutionContext } from '@nestjs/common';
import { currentUserFactory, REQUEST_USER_KEY } from './current-user.decorator';
import { AuthenticatedUser } from '../types';

describe('CurrentUser', () => {
  const mockUser: AuthenticatedUser = {
    userId: 'user-123',
    email: 'test@example.com',
  };

  const createMockExecutionContext = (
    user?: AuthenticatedUser,
  ): ExecutionContext => {
    const request: any = {};
    if (user) {
      request[REQUEST_USER_KEY] = user;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  it('should extract authenticated user from request', () => {
    const context = createMockExecutionContext(mockUser);
    const result = currentUserFactory(null, context);

    expect(result).toEqual(mockUser);
  });

  it('should throw error when user is not found in request', () => {
    const context = createMockExecutionContext();

    expect(() => currentUserFactory(null, context)).toThrow(
      'Authenticated user not found in request. Ensure AuthGuard is applied to this route.',
    );
  });

  it('should return user with only userId when email is not available', () => {
    const userWithoutEmail: AuthenticatedUser = {
      userId: 'user-456',
    };

    const context = createMockExecutionContext(userWithoutEmail);
    const result = currentUserFactory(null, context);

    expect(result).toEqual(userWithoutEmail);
    expect(result.email).toBeUndefined();
  });
});
