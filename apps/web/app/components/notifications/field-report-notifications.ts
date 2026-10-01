import {
  fieldReportPageSchema,
  fieldReportSummarySchema,
  type FieldReport,
} from '@arqueia/contracts';
import type { NotificationItem } from '@arqueia/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { basePathFetch } from '../../lib/base-path';
import type { NotificationScope } from '../../presentation';
import { FIELD_REPORT_KIND_PRESENTATION } from '../field-reports/field-report-labels';

/** Com o app aberto, o sino se atualiza sozinho neste intervalo. */
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;
/** Quantos informes novos o painel do sino mostra; o resto fica em "Ver todos". */
export const NOTIFICATION_PREVIEW_LIMIT = 5;
/**
 * Disparado quando a página de informes muda um status: o sino recarrega na
 * hora, sem esperar o próximo ciclo.
 */
export const FIELD_REPORTS_CHANGED_EVENT = 'arqueia:field-reports-changed';

const relativeTime = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/** "agora", "há 5 min.", "há 2 h", "ontem"… e data curta depois de uma semana. */
export function relativeTimeLabel(isoTimestamp: string, now: Date): string {
  const timestamp = new Date(isoTimestamp);
  const seconds = Math.round((now.getTime() - timestamp.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3_600) return relativeTime.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86_400) return relativeTime.format(-Math.floor(seconds / 3_600), 'hour');
  if (seconds < 7 * 86_400) return relativeTime.format(-Math.floor(seconds / 86_400), 'day');
  return shortDate.format(timestamp);
}

export function toNotificationItem(
  report: FieldReport,
  laboratoryId: string,
  now: Date,
): NotificationItem {
  const kind = FIELD_REPORT_KIND_PRESENTATION[report.kind];
  return {
    id: report.id,
    title: kind.label,
    description: report.equipment ? `${report.equipment.name} · ${report.message}` : report.message,
    timeLabel: relativeTimeLabel(report.createdAt, now),
    href: `/informes?laboratory=${laboratoryId}`,
    urgent: report.blocksUse,
  };
}

export interface FieldReportNotificationsState {
  readonly count: number;
  readonly items: readonly NotificationItem[];
  readonly status: 'ready' | 'loading' | 'error';
  readonly refresh: () => void;
}

/**
 * Informes novos (ainda não triados) do laboratório ativo, para o sino.
 *
 * "Novo" é o status NEW: a fila é da coordenação, não de cada pessoa — quando
 * alguém tria, o contador cai para todos. Quem não revisa informes não faz
 * nenhuma chamada. A permissão real continua sendo checada na API.
 */
export function useFieldReportNotifications(
  scope: NotificationScope,
  intervalMs: number = NOTIFICATION_POLL_INTERVAL_MS,
): FieldReportNotificationsState {
  const enabled = scope.canReviewFieldReports && scope.laboratoryId !== '';
  const [state, setState] = useState<Omit<FieldReportNotificationsState, 'refresh'>>({
    count: 0,
    items: [],
    status: enabled ? 'loading' : 'ready',
  });
  const active = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    const summaryQuery = new URLSearchParams({ laboratoryId: scope.laboratoryId });
    const listQuery = new URLSearchParams({
      laboratoryId: scope.laboratoryId,
      status: 'NEW',
      limit: String(NOTIFICATION_PREVIEW_LIMIT),
    });
    try {
      const [summaryResponse, listResponse] = await Promise.all([
        basePathFetch(`/api/field-reports/summary?${summaryQuery.toString()}`, { cache: 'no-store' }),
        basePathFetch(`/api/field-reports?${listQuery.toString()}`, { cache: 'no-store' }),
      ]);
      if (!summaryResponse.ok || !listResponse.ok) throw new Error('UPSTREAM');
      const summary = fieldReportSummarySchema.safeParse(await summaryResponse.json());
      const page = fieldReportPageSchema.safeParse(await listResponse.json());
      if (!summary.success || !page.success) throw new Error('INCOMPATIBLE');
      if (!active.current) return;
      const now = new Date();
      setState({
        count: summary.data.byStatus.NEW,
        items: page.data.items.map((report) => toNotificationItem(report, scope.laboratoryId, now)),
        status: 'ready',
      });
    } catch {
      if (active.current) setState((current) => ({ ...current, status: 'error' }));
    }
  }, [enabled, scope.laboratoryId]);

  useEffect(() => {
    active.current = true;
    if (!enabled) return undefined;
    void load();
    const refreshWhenVisible = (): void => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener(FIELD_REPORTS_CHANGED_EVENT, refreshWhenVisible);
    return () => {
      active.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener(FIELD_REPORTS_CHANGED_EVENT, refreshWhenVisible);
    };
  }, [enabled, intervalMs, load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, refresh };
}
