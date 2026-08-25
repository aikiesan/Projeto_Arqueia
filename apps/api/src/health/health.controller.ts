import type { DatabasePool } from '@arqueia/database';
import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { DATABASE_POOL } from '../shared/infrastructure/database.module.js';
import { REDIS_CLIENT, type RedisClient } from '../shared/infrastructure/redis.module.js';
import { HealthService, type HealthStatus } from './health.service.js';

@Controller(['health', 'api/health'])
export class HealthController {
  private readonly healthService: HealthService;

  public constructor(
    @Inject(DATABASE_POOL) pool: DatabasePool,
    @Inject(REDIS_CLIENT) redis: RedisClient,
    healthService?: HealthService,
  ) {
    this.healthService = healthService ?? new HealthService(pool, redis);
  }

  @Get()
  public async getHealth(): Promise<HealthStatus> {
    const health = await this.healthService.checkHealth();
    if (health.status !== 'ok' || health.database !== 'connected' || health.redis !== 'connected') {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
