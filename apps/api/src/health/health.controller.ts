import type { DatabasePool } from '@arqueia/database';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';

import { DATABASE_POOL } from '../shared/infrastructure/database.module.js';
import { REDIS_CLIENT, type RedisClient } from '../shared/infrastructure/redis.module.js';

export interface HealthResponse {
  status: 'ok' | 'error';
  service: 'arqueia-api';
  timestamp: string;
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
}

const CHECK_TIMEOUT_MS = 2000;

@Controller(['health', 'api/health'])
export class HealthController {
  public constructor(
    @Inject(DATABASE_POOL) private readonly pool: DatabasePool,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  @Get()
  public async getHealth(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();

    const [dbOk, redisOk] = await Promise.all([
      this.checkDatabase(CHECK_TIMEOUT_MS),
      this.checkRedis(CHECK_TIMEOUT_MS),
    ]);

    const database = dbOk ? 'connected' : 'disconnected';
    const redis = redisOk ? 'connected' : 'disconnected';

    if (!dbOk || !redisOk) {
      throw new HttpException(
        {
          status: 'error',
          service: 'arqueia-api',
          timestamp,
          database,
          redis,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ok',
      service: 'arqueia-api',
      timestamp,
      database: 'connected',
      redis: 'connected',
    };
  }

  private async checkDatabase(timeoutMs: number): Promise<boolean> {
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database query timed out')), timeoutMs);
      });

      await Promise.race([
        this.pool.query('SELECT 1'),
        timeoutPromise,
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(timeoutMs: number): Promise<boolean> {
    try {
      const response = await this.redis.ping(timeoutMs);
      return typeof response === 'string' && (response === 'PONG' || response.includes('PONG'));
    } catch {
      return false;
    }
  }
}
