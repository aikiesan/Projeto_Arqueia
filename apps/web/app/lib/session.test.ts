import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiServer from './api-server';
import { loadDashboardSummary } from './session';

vi.mock('./api-server', async (importOriginal) => {
  const actual = await importOriginal<typeof apiServer>();
  return {
    ...actual,
    apiBaseUrl: vi.fn(),
    sessionToken: vi.fn(),
  };
});

const labA = '00000000-0000-4000-8000-000000000001';
const labB = '00000000-0000-4000-8000-000000000002';

const validSummary = {
  laboratoryId: labA,
  timezone: 'America/Sao_Paulo',
  equipmentSummary: {
    total: 5,
    byStatus: {
      AVAILABLE: 4,
      UNDER_EVALUATION: 0,
      UNAVAILABLE: 0,
      MAINTENANCE: 1,
    },
  },
  todayReservations: [],
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

describe('loadDashboardSummary loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiServer.apiBaseUrl).mockReturnValue('http://api-internal.local');
    vi.mocked(apiServer.sessionToken).mockResolvedValue('mock-session-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and parses a valid DashboardSummary using the provided laboratoryId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validSummary,
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await loadDashboardSummary(labA);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://api-internal.local/api/management/dashboard?laboratoryId=${labA}`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-session-token' },
      }),
    );
    expect(summary).not.toBeNull();
    expect(summary?.laboratoryId).toBe(labA);
    expect(summary?.timezone).toBe('America/Sao_Paulo');
  });

  it('does not have hardcoded CP2b and dynamically uses any valid requested laboratoryId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...validSummary, laboratoryId: labB }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await loadDashboardSummary(labB);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://api-internal.local/api/management/dashboard?laboratoryId=${labB}`,
      expect.any(Object),
    );
    expect(summary?.laboratoryId).toBe(labB);
  });

  it('returns null and does not produce synthetic data when upstream fails with 5xx or network error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await loadDashboardSummary(labA);

    expect(summary).toBeNull();
  });

  it('returns null when upstream payload is invalid or incompatible with schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: 'payload-without-required-fields' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const summary = await loadDashboardSummary(labA);

    expect(summary).toBeNull();
  });

  it('returns null when session token is absent', async () => {
    vi.mocked(apiServer.sessionToken).mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await loadDashboardSummary(labA);

    expect(summary).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
