import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'arqueia-api' } {
    return { status: 'ok', service: 'arqueia-api' };
  }
}
