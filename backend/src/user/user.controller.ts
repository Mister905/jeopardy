import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import type { UserProfileResponse } from './dto/user-profile.dto';

@Controller('me')
@UseGuards(AuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * GET /me/dashboard
   * Get current user's profile and statistics
   */
  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileResponse> {
    this.logger.log(`Fetching dashboard for user: ${user.userId}`);
    return this.userService.getUserProfile(user.userId);
  }
}
