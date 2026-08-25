import type { DatabasePool } from '@arqueia/database';
import { describe, expect, it, vi } from 'vitest';

import type { RedisClient } from '../shared/infrastructure/redis.module.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the stable process health contract when healthy', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    } as unknown as DatabasePool;

    const mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    } as unknown as RedisClient;

    const controller = new HealthController(mockPool, mockRedis);
    const health = await controller.getHealth();

    expect(health).toMatchObject({
      status: 'ok',
      service: 'arqueia-api',
      database: 'connected',
      redis: 'connected',
    });
    expect(typeof health.timestamp).toBe('string');
  });
});
