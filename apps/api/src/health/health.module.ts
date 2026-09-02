import { Module } from '@nestjs/common';

import { DatabaseModule } from '../shared/infrastructure/database.module.js';
import { RedisModule } from '../shared/infrastructure/redis.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
