import type { DatabasePool } from '@arqueia/database';
import { HttpException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRedisClient, type RedisClient } from '../shared/infrastructure/redis.module.js';
import { HealthController } from './health.controller.js';

describe('Milestone 1 Empirical Challenge: API Health Controller Stress Tests', () => {
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

  describe('1. Database Failure & Timeout Scenarios', () => {
    it('returns HTTP 503 with database: "disconnected" on database connection failure', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection terminated unexpectedly'));

      try {
        await controller.getHealth();
        expect.unreachable('Should have thrown HttpException');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'disconnected',
          redis: 'connected',
        });
      }
    });

    it('returns HTTP 503 with database: "disconnected" when database query fails with timeout error', async () => {
      mockPool.query.mockRejectedValue(new Error('Database query timed out'));

      await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'disconnected',
          redis: 'connected',
        });
        return true;
      });
    });

    it('handles non-Error thrown objects in database check without crashing', async () => {
      mockPool.query.mockRejectedValue('Fatal string error');

      await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'disconnected',
        });
        return true;
      });
    });
  });

  describe('2. Redis Failure & Timeout Scenarios', () => {
    it('returns HTTP 503 with redis: "disconnected" on Redis client failure', async () => {
      mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));

      try {
        await controller.getHealth();
        expect.unreachable('Should have thrown HttpException');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'connected',
          redis: 'disconnected',
        });
      }
    });

    it('returns HTTP 503 with redis: "disconnected" when Redis ping rejects with timeout', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis ping timed out'));

      await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'connected',
          redis: 'disconnected',
        });
        return true;
      });
    });

    it('treats unexpected Redis responses (e.g. error replies) as disconnected', async () => {
      mockRedis.ping.mockResolvedValue('-NOAUTH Authentication required.');

      await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'connected',
          redis: 'disconnected',
        });
        return true;
      });
    });

    it('handles non-Error thrown objects in redis check without crashing', async () => {
      mockRedis.ping.mockRejectedValue(null);

      await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          redis: 'disconnected',
        });
        return true;
      });
    });
  });

  describe('3. Combined Simultaneous Failures', () => {
    it('returns HTTP 503 with both database and redis marked disconnected', async () => {
      mockPool.query.mockRejectedValue(new Error('PostgreSQL Down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis Down'));

      await expect(controller.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          service: 'arqueia-api',
          database: 'disconnected',
          redis: 'disconnected',
        });
        return true;
      });
    });
  });

  describe('4. Real Socket Redis Client Offline Behavior', () => {
    it('createRedisClient rejects ping when target Redis server is offline on unused port and marks redis disconnected in controller', async () => {
      const realClient = createRedisClient({ url: 'redis://127.0.0.1:59999' });

      await expect(realClient.ping(500)).rejects.toThrow();

      const realHealthController = new HealthController(
        mockPool as unknown as DatabasePool,
        realClient,
      );

      await expect(realHealthController.getHealth()).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toMatchObject({
          status: 'error',
          redis: 'disconnected',
          database: 'connected',
        });
        return true;
      });
    });
  });
});
