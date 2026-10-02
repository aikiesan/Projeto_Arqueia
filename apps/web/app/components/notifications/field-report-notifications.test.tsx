import type { FieldReport, FieldReportSummary } from '@arqueia/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FIELD_REPORTS_CHANGED_EVENT,
  relativeTimeLabel,
  toNotificationItem,
  useFieldReportNotifications,
} from './field-report-notifications';

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const now = new Date('2026-10-01T12:00:00.000Z');

const report: FieldReport = {
  id: '6a7b8c9d-6666-4666-a666-666666666666',
  createdAt: '2026-10-01T11:55:00.000Z',
  updatedAt: '2026-10-01T11:55:00.000Z',
  archivedAt: null,
  laboratoryId,
  reference: 'INF-6A7B8C9D',
  kind: 'EQUIPMENT_PROBLEM',
  status: 'NEW',
  equipment: { id: '77777777-7777-4777-a777-777777777777', code: 'HPLC-01', name: 'HPLC Shimadzu' },
  message: 'Erro de pressão ao iniciar a corrida.',
  blocksUse: true,
  reporterName: null,
  reporterContact: null,
  reviewNote: null,
  reviewedBy: null,
  reviewedAt: null,
};

const summary: FieldReportSummary = {
  laboratoryId,
  openByKind: { EQUIPMENT_PROBLEM: 1, MAINTENANCE_REQUEST: 0, SUPPLY_USAGE: 2, GENERAL_SUPPORT: 0 },
  byStatus: { NEW: 3, IN_REVIEW: 0, RESOLVED: 1 },
  openBlockingUse: 1,
};

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function mockApi(status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (status !== 200) return json({ code: 'AUTHORIZATION_DENIED' }, status);
    if (url.startsWith('/api/field-reports/summary?')) return json(summary);
    if (url.startsWith('/api/field-reports?')) {
      return json({ items: [report], pageInfo: { hasNextPage: false, nextCursor: null } });
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

describe('relativeTimeLabel', () => {
  it.each([
    ['2026-10-01T11:59:30.000Z', 'agora'],
    ['2026-10-01T11:55:00.000Z', 'há 5 min.'],
    ['2026-10-01T09:00:00.000Z', 'há 3 h'],
    ['2026-09-30T11:00:00.000Z', 'ontem'],
  ])('%s → %s', (timestamp, label) => {
    expect(relativeTimeLabel(timestamp, now)).toBe(label);
  });

  it('usa data curta depois de uma semana', () => {
    expect(relativeTimeLabel('2026-09-01T12:00:00.000Z', now)).toBe('01/09');
  });
});

describe('toNotificationItem', () => {
  it('leva ao compilado do laboratório e destaca o que impede o uso', () => {
    expect(toNotificationItem(report, laboratoryId, now)).toEqual({
      id: report.id,
      title: 'Problema em equipamento',
      description: 'HPLC Shimadzu · Erro de pressão ao iniciar a corrida.',
      timeLabel: 'há 5 min.',
      href: `/informes?laboratory=${laboratoryId}`,
      urgent: true,
    });
  });

  it('sem equipamento, mostra só a mensagem', () => {
    const item = toNotificationItem({ ...report, equipment: null, blocksUse: false }, laboratoryId, now);
    expect(item.description).toBe('Erro de pressão ao iniciar a corrida.');
    expect(item.urgent).toBe(false);
  });
});

describe('useFieldReportNotifications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não faz nenhuma chamada para quem não revisa informes', async () => {
    const fetchMock = mockApi();

    const { result } = renderHook(() =>
      useFieldReportNotifications({ laboratoryId, canReviewFieldReports: false }),
    );

    expect(result.current).toMatchObject({ count: 0, items: [], status: 'ready' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('conta os informes novos e traz os mais recentes para o painel', async () => {
    const fetchMock = mockApi();

    const { result } = renderHook(() =>
      useFieldReportNotifications({ laboratoryId, canReviewFieldReports: true }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.count).toBe(3);
    expect(result.current.items).toHaveLength(1);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain(`/api/field-reports/summary?laboratoryId=${laboratoryId}`);
    expect(urls).toContain(`/api/field-reports?laboratoryId=${laboratoryId}&status=NEW&limit=5`);
  });

  it('atualiza sozinho no intervalo e na hora em que a triagem muda algo', async () => {
    const fetchMock = mockApi();

    renderHook(() =>
      useFieldReportNotifications({ laboratoryId, canReviewFieldReports: true }, 40),
    );

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4));
    const before = fetchMock.mock.calls.length;
    act(() => {
      window.dispatchEvent(new Event(FIELD_REPORTS_CHANGED_EVENT));
    });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });

  it('sinaliza erro quando a API recusa', async () => {
    mockApi(403);

    const { result } = renderHook(() =>
      useFieldReportNotifications({ laboratoryId, canReviewFieldReports: true }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.count).toBe(0);
  });
});
