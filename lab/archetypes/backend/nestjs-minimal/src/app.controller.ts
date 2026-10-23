import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  @Get('api')
  getApi() {
    return { message: 'NestJS Minimal Archetype API' };
  }

  @Get('api/users')
  getUsers() {
    return this.appService.getUsers();
  }
}
