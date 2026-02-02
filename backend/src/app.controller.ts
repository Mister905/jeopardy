import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Health check for ALB/ECS. Returns 200 with { status: 'ok' }.
   * No auth required. Use this path for target group health checks.
   */
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
