import type { DatabasePool } from '@arqueia/database';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_POOL } from '../shared/infrastructure/database.module.js';
import { REDIS_CLIENT, type RedisClient } from '../shared/infrastructure/redis.module.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockRedis: { ping: ReturnType<typeof vi.fn> };
  let controller: HealthController;

  beforeEach(() => {
    mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    };
    mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    };
    controller = new HealthController(
      mockPool as unknown as DatabasePool,
      mockRedis as unknown as RedisClient,
    );
  });

  it('returns HTTP 200 with connected statuses when database and redis are healthy', async () => {
    const result = await controller.getHealth();

    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    expect(mockRedis.ping).toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'ok',
      service: 'arqueia-api',
      database: 'connected',
      redis: 'connected',
    });
    expect(result.timestamp).toBeTypeOf('string');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('throws HTTP 503 when database check fails', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('PostgreSQL connection lost'));

    await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(HttpException);
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const response = httpErr.getResponse() as Record<string, unknown>;
      expect(response).toMatchObject({
        status: 'error',
        service: 'arqueia-api',
        database: 'disconnected',
        redis: 'connected',
      });
      return true;
    });
  });

  it('throws HTTP 503 when redis check fails', async () => {
    mockRedis.ping.mockRejectedValueOnce(new Error('Redis connection refused'));

    await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(HttpException);
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const response = httpErr.getResponse() as Record<string, unknown>;
      expect(response).toMatchObject({
        status: 'error',
        service: 'arqueia-api',
        database: 'connected',
        redis: 'disconnected',
      });
      return true;
    });
  });

  it('throws HTTP 503 when both database and redis fail', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB failure'));
    mockRedis.ping.mockRejectedValueOnce(new Error('Redis failure'));

    await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(HttpException);
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const response = httpErr.getResponse() as Record<string, unknown>;
      expect(response).toMatchObject({
        status: 'error',
        service: 'arqueia-api',
        database: 'disconnected',
        redis: 'disconnected',
      });
      return true;
    });
  });

  it('resolves in a NestJS dependency injection context through infrastructure tokens', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DATABASE_POOL,
          useValue: mockPool,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    const injectedController = moduleRef.get(HealthController);
    expect(injectedController).toBeInstanceOf(HealthController);

    const result = await injectedController.getHealth();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.redis).toBe('connected');
  });
});
