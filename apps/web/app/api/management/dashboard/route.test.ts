import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiServer from '../../../lib/api-server';
import { GET } from './route';

vi.mock('../../../lib/api-server', async (importOriginal) => {
  const actual = await importOriginal<typeof apiServer>();
  return {
    ...actual,
    authorizedApiRequest: vi.fn(),
  };
});

const validLabA = '00000000-0000-4000-8000-000000000001';
const validLabB = '00000000-0000-4000-8000-000000000002';

const validSummary = {
  laboratoryId: validLabA,
  timezone: 'America/Sao_Paulo',
  equipmentSummary: {
    total: 3,
    byStatus: {
      AVAILABLE: 2,
      UNDER_EVALUATION: 0,
      UNAVAILABLE: 0,
      MAINTENANCE: 1,
    },
  },
  todayReservations: [
    {
      id: '11111111-1111-4111-a111-111111111111',
      equipmentId: '22222222-2222-4222-a222-222222222222',
      equipmentName: 'Espectrômetro',
      startsAt: '2026-08-14T14:00:00.000Z',
      endsAt: '2026-08-14T15:00:00.000Z',
      purpose: 'Análise de rotina',
      status: 'CONFIRMED',
      href: '/agenda?res=1',
    },
  ],
  upcomingActions: [],
  inventoryAlerts: [],
  quickActions: [],
  availability: {
    equipment: true,
    scheduling: true,
    inventory: true,
    maintenance: true,
    pendingActions: true,
  },
  generatedAt: '2026-08-14T12:00:00.000Z',
};

describe('BFF GET /api/management/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing or invalid UUID with 400 without calling upstream', async () => {
    const request = new Request('http://localhost:3000/api/management/dashboard?laboratoryId=invalid-uuid');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'INVALID_LABORATORY_ID' });
    expect(apiServer.authorizedApiRequest).not.toHaveBeenCalled();
  });

  it('forwards valid UUID to upstream and validates 2xx response against dashboardSummarySchema', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      new Response(JSON.stringify(validSummary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request(`http://localhost:3000/api/management/dashboard?laboratoryId=${validLabA}`);
    const response = await GET(request);

    expect(apiServer.authorizedApiRequest).toHaveBeenCalledWith(
      request,
      `/api/management/dashboard?laboratoryId=${validLabA}`,
      'GET',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    const body = await response.json();
    expect(body.laboratoryId).toBe(validLabA);
    expect(body.todayReservations).toHaveLength(1);
    expect(body).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('cookie');
  });

  it('returns 502 UPSTREAM_INCOMPATIBLE when upstream 2xx payload violates schema', async () => {
    const incompatiblePayload = {
      laboratoryId: validLabA,
      todayReservations: 'not-an-array',
    };

    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      new Response(JSON.stringify(incompatiblePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request(`http://localhost:3000/api/management/dashboard?laboratoryId=${validLabA}`);
    const response = await GET(request);

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'UPSTREAM_INCOMPATIBLE' });
  });

  it('preserves upstream 401 status without modifying payload', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }),
    );

    const request = new Request(`http://localhost:3000/api/management/dashboard?laboratoryId=${validLabA}`);
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('preserves upstream 403 status without modifying payload', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Acesso negado ao laboratório.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }),
    );

    const request = new Request(`http://localhost:3000/api/management/dashboard?laboratoryId=${validLabA}`);
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('preserves upstream 503 unavailability without returning fake or synthetic data', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      new Response(JSON.stringify({ code: 'API_UNAVAILABLE' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }),
    );

    const request = new Request(`http://localhost:3000/api/management/dashboard?laboratoryId=${validLabA}`);
    const response = await GET(request);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'API_UNAVAILABLE' });
    expect(body).not.toHaveProperty('equipmentSummary');
  });

  it('maintains strict isolation and does not substitute laboratory A by laboratory B', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      new Response(JSON.stringify({ ...validSummary, laboratoryId: validLabB }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request(`http://localhost:3000/api/management/dashboard?laboratoryId=${validLabB}`);
    const response = await GET(request);

    expect(apiServer.authorizedApiRequest).toHaveBeenCalledWith(
      request,
      `/api/management/dashboard?laboratoryId=${validLabB}`,
      'GET',
    );
    const body = await response.json();
    expect(body.laboratoryId).toBe(validLabB);
    expect(body.laboratoryId).not.toBe(validLabA);
  });
});
