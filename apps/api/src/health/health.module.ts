import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/infrastructure/database.module.js';
import { RedisModule } from '../shared/infrastructure/redis.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
