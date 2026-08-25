import type { DatabasePool } from '@arqueia/database';
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_POOL } from '../shared/infrastructure/database.module.js';
import { REDIS_CLIENT, type RedisClient } from '../shared/infrastructure/redis.module.js';

export interface HealthStatus {
  status: 'ok' | 'error';
  service: 'arqueia-api';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  timestamp: string;
}

@Injectable()
export class HealthService {
  public constructor(
    @Inject(DATABASE_POOL) private readonly pool: DatabasePool,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  public async checkHealth(): Promise<HealthStatus> {
    const [databaseConnected, redisConnected] = await Promise.all([
      this.checkDatabase(2000),
      this.checkRedis(2000),
    ]);

    const isHealthy = databaseConnected && redisConnected;

    return {
      status: isHealthy ? 'ok' : 'error',
      service: 'arqueia-api',
      database: databaseConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  public async checkDatabase(timeoutMs = 2000): Promise<boolean> {
    try {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database query timed out')), timeoutMs);
      });
      const queryPromise = this.pool.query('SELECT 1');
      await Promise.race([queryPromise, timeoutPromise]);
      clearTimeout(timer!);
      return true;
    } catch {
      return false;
    }
  }

  public async checkRedis(timeoutMs = 2000): Promise<boolean> {
    try {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs);
      });
      const pingPromise = this.redis.ping(timeoutMs);
      const res = await Promise.race([pingPromise, timeoutPromise]);
      clearTimeout(timer!);
      return typeof res === 'string' && (res === 'PONG' || res.startsWith('+PONG') || res.includes('PONG'));
    } catch {
      return false;
    }
  }
}
