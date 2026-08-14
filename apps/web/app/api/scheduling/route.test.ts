import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiServer from '../../lib/api-server';
import { GET } from './route';

vi.mock('../../lib/api-server', async (importOriginal) => {
  const actual = await importOriginal<typeof apiServer>();
  return { ...actual, authorizedApiRequest: vi.fn() };
});

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const otherLaboratoryId = '22222222-2222-4222-a222-222222222222';
const startsAt = '2026-08-14T03:00:00.000Z';
const endsAt = '2026-08-15T03:00:00.000Z';

const validSchedule = {
  laboratoryId,
  timezone: 'America/Sao_Paulo',
  startsAt,
  endsAt,
  capabilities: { canReserve: true, canManageBlocks: false },
  items: [],
};

describe('BFF GET /api/scheduling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid or excessive ranges before calling the API', async () => {
    const request = new Request(
      `http://localhost:3000/api/scheduling?laboratoryId=${laboratoryId}&startsAt=2026-08-01T00%3A00%3A00.000Z&endsAt=2026-09-13T00%3A00%3A00.001Z`,
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(apiServer.authorizedApiRequest).not.toHaveBeenCalled();
  });

  it('normalizes false flags and validates the successful response', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      Response.json(validSchedule, { status: 200 }),
    );
    const request = new Request(
      `http://localhost:3000/api/scheduling?laboratoryId=${laboratoryId}&startsAt=${encodeURIComponent(startsAt)}&endsAt=${encodeURIComponent(endsAt)}&onlyMine=false&includeCancelled=false`,
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(apiServer.authorizedApiRequest).toHaveBeenCalledWith(
      request,
      expect.stringContaining('onlyMine=false&includeCancelled=false'),
    );
    await expect(response.json()).resolves.toMatchObject({
      laboratoryId,
      timezone: 'America/Sao_Paulo',
    });
  });

  it('rejects a successful response from another laboratory', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      Response.json({ ...validSchedule, laboratoryId: otherLaboratoryId }, { status: 200 }),
    );
    const request = new Request(
      `http://localhost:3000/api/scheduling?laboratoryId=${laboratoryId}&startsAt=${encodeURIComponent(startsAt)}&endsAt=${encodeURIComponent(endsAt)}`,
    );

    const response = await GET(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_SCOPE_MISMATCH' });
  });

  it('rejects an upstream payload that violates the shared contract', async () => {
    vi.mocked(apiServer.authorizedApiRequest).mockResolvedValue(
      Response.json({ ...validSchedule, timezone: null }, { status: 200 }),
    );
    const request = new Request(
      `http://localhost:3000/api/scheduling?laboratoryId=${laboratoryId}&startsAt=${encodeURIComponent(startsAt)}&endsAt=${encodeURIComponent(endsAt)}`,
    );

    const response = await GET(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_INCOMPATIBLE' });
  });
});
