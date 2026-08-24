import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('Web BFF GET /api/health', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:4001');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns 200 with ok status and upstream api payload when api is healthy', async () => {
    const apiPayload = {
      status: 'ok',
      service: 'arqueia-api',
      timestamp: '2026-08-24T14:30:00.000Z',
      database: 'connected',
      redis: 'connected',
    };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(apiPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      service: 'arqueia-web',
      api: apiPayload,
    });
    expect(body.timestamp).toBeTypeOf('string');
  });

  it('returns 503 with error status when upstream api returns 503 service unavailable', async () => {
    const apiPayload = {
      status: 'error',
      service: 'arqueia-api',
      timestamp: '2026-08-24T14:30:00.000Z',
      database: 'disconnected',
      redis: 'connected',
    };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(apiPayload), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: apiPayload,
    });
  });

  it('returns 503 when upstream api is unreachable or times out', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: {
        status: 'disconnected',
        message: 'Connection refused',
      },
    });
  });
});
