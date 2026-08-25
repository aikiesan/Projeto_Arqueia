import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('Milestone 1 Empirical Challenge: Web BFF /api/health Proxy Stress Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:4001');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns HTTP 200 with full API payload and no-store caching when upstream is healthy', async () => {
    const upstreamPayload = {
      status: 'ok',
      service: 'arqueia-api',
      timestamp: '2026-08-24T14:40:00.000Z',
      database: 'connected',
      redis: 'connected',
    };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(upstreamPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'ok',
      service: 'arqueia-web',
      api: upstreamPayload,
    });
    expect(data.timestamp).toBeTypeOf('string');
  });

  it('returns HTTP 503 with upstream degraded payload when API reports database: disconnected', async () => {
    const upstreamPayload = {
      status: 'error',
      service: 'arqueia-api',
      timestamp: '2026-08-24T14:40:00.000Z',
      database: 'disconnected',
      redis: 'connected',
    };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(upstreamPayload), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await GET();

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: upstreamPayload,
    });
  });

  it('returns HTTP 503 with upstream degraded payload when API reports redis: disconnected', async () => {
    const upstreamPayload = {
      status: 'error',
      service: 'arqueia-api',
      timestamp: '2026-08-24T14:40:00.000Z',
      database: 'connected',
      redis: 'disconnected',
    };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(upstreamPayload), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await GET();

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: upstreamPayload,
    });
  });

  it('returns HTTP 503 when upstream API connection is refused', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4001'));

    const res = await GET();

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: {
        status: 'disconnected',
        message: 'connect ECONNREFUSED 127.0.0.1:4001',
      },
    });
  });

  it('returns HTTP 503 when upstream API request aborts or times out', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout'));

    const res = await GET();

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: {
        status: 'disconnected',
        message: 'The operation was aborted due to timeout',
      },
    });
  });

  it('handles non-Error rejection in upstream fetch gracefully with fallback message', async () => {
    global.fetch = vi.fn().mockRejectedValue('Fatal network crash');

    const res = await GET();

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: {
        status: 'disconnected',
        message: 'API indisponível',
      },
    });
  });

  it('handles upstream returning non-JSON error page (e.g. 502 HTML from reverse proxy) gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const res = await GET();

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toMatchObject({
      status: 'error',
      service: 'arqueia-web',
      api: {
        status: 'error',
      },
    });
  });
});
