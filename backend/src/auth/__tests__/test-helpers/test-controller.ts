import { Controller, Get } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';
import { AuthenticatedUser } from '../../types';

/**
 * Test controller for authentication E2E tests
 * This controller should only be used in test environments
 */
@Controller('test')
export class TestController {
  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected() {
    return {
      message: 'Protected route accessed successfully',
      authenticated: true,
    };
  }

  @Get('public')
  @Public()
  getPublic() {
    return {
      message: 'Public route accessed successfully',
      authenticated: false,
    };
  }

  @Get('current-user')
  @UseGuards(AuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'Current user extracted successfully',
      user: {
        userId: user.userId,
        email: user.email,
      },
    };
  }
}
