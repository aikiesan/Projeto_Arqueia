import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const validBody = {
  laboratoryId,
  kind: 'EQUIPMENT_PROBLEM',
  message: 'O banho-maria não aquece mais.',
  reporterName: '',
  reporterContact: '',
  website: '',
};

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:4002/api/public/field-reports', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:4002',
      origin: 'http://localhost:4002',
      'x-forwarded-for': '203.0.113.9',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('BFF POST /api/public/field-reports', () => {
  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://127.0.0.1:4001';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recusa envio de outra origem sem chamar a API', async () => {
    const upstream = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request(validBody, { origin: 'https://spam.example' }));

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('finge sucesso para robô que preenche o campo-armadilha e não grava nada', async () => {
    const upstream = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request({ ...validBody, website: 'https://spam.example' }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ reference: 'INF-00000000' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('recusa campos de revisão enxertados antes de chegar à API', async () => {
    const upstream = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request({ ...validBody, status: 'RESOLVED' }));

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('recusa corpo acima do teto', async () => {
    const response = await POST(request({ ...validBody, message: 'x'.repeat(20_000) }));

    expect(response.status).toBe(413);
  });

  it('repassa o IP do cliente e devolve só o protocolo', async () => {
    const upstream = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { reference: 'INF-1A2B3C4D', receivedAt: '2026-09-30T12:00:00.000Z' },
        { status: 201 },
      ),
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      reference: 'INF-1A2B3C4D',
      receivedAt: '2026-09-30T12:00:00.000Z',
    });
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:4001/api/public/field-reports');
    expect((init.headers as Record<string, string>)['X-Forwarded-For']).toBe('203.0.113.9');
    expect(JSON.parse(String(init.body))).toEqual({
      laboratoryId,
      kind: 'EQUIPMENT_PROBLEM',
      equipmentId: null,
      message: 'O banho-maria não aquece mais.',
      blocksUse: false,
      reporterName: null,
      reporterContact: null,
    });
  });

  it('traduz o limite de envios da API com Retry-After', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'FIELD_REPORT_RATE_LIMIT_EXCEEDED' }), {
        status: 429,
        headers: { 'retry-after': '600' },
      }),
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('600');
    expect(await response.json()).toMatchObject({ code: 'FIELD_REPORT_RATE_LIMIT_EXCEEDED' });
  });
});
