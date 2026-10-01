'use client';

import {
  fieldReportKinds,
  type AuthenticatedPrincipal,
  type FieldReport,
  type FieldReportKind,
  type FieldReportPage,
  type FieldReportStatus,
  type FieldReportSummary,
  type Laboratory,
} from '@arqueia/contracts';
import { WorkspaceShell } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  FIELD_REPORT_KIND_PRESENTATION,
  FIELD_REPORT_STATUS_LABEL,
} from '../components/field-reports/field-report-labels';
import { FIELD_REPORTS_CHANGED_EVENT } from '../components/notifications/field-report-notifications';
import { WorkspaceNotifications } from '../components/notifications/workspace-notifications';
import { FieldReportQrDialog } from '../components/field-reports/field-report-qr-dialog';
import { BASE_PATH, withBasePath } from '../lib/base-path';
import { principalCan } from '../lib/permissions';
import { LogoutButton } from '../logout-button';
import { createWorkspacePresentation } from '../presentation';

interface PageData {
  readonly principal: AuthenticatedPrincipal;
  readonly laboratories: readonly Laboratory[];
}

type StatusFilter = FieldReportStatus | 'ALL';

const STATUS_FILTERS: readonly { readonly value: StatusFilter; readonly label: string }[] = [
  { value: 'NEW', label: 'Novos' },
  { value: 'IN_REVIEW', label: 'Em análise' },
  { value: 'RESOLVED', label: 'Resolvidos' },
  { value: 'ALL', label: 'Todos' },
];

const PAGE_SIZE = 20;
const receivedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBasePath(url), { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível carregar os informes.');
  }
  return response.json() as Promise<T>;
}

/** Ações de triagem oferecidas a partir do status atual. */
function nextActions(status: FieldReportStatus): readonly { status: FieldReportStatus; label: string }[] {
  if (status === 'NEW') {
    return [
      { status: 'IN_REVIEW', label: 'Iniciar análise' },
      { status: 'RESOLVED', label: 'Marcar resolvido' },
    ];
  }
  if (status === 'IN_REVIEW') return [{ status: 'RESOLVED', label: 'Marcar resolvido' }];
  return [{ status: 'IN_REVIEW', label: 'Reabrir' }];
}

function FieldReportCard({
  onReview,
  report,
}: {
  readonly onReview: (report: FieldReport, status: FieldReportStatus, note: string) => Promise<void>;
  readonly report: FieldReport;
}): React.JSX.Element {
  const [note, setNote] = useState(report.reviewNote ?? '');
  const [pending, setPending] = useState(false);
  const kind = FIELD_REPORT_KIND_PRESENTATION[report.kind];

  async function review(status: FieldReportStatus): Promise<void> {
    setPending(true);
    try {
      await onReview(report, status, note);
    } finally {
      setPending(false);
    }
  }

  return (
    <article className={`field-report-card is-${report.status.toLowerCase()}`}>
      <header className="field-report-card-header">
        <div>
          <span className="field-report-kind-label">{kind.label}</span>
          <h3>
            {report.equipment ? `${report.equipment.name} · ${report.equipment.code}` : 'Sem equipamento indicado'}
          </h3>
        </div>
        <div className="field-report-card-meta">
          <span className={`field-report-status is-${report.status.toLowerCase()}`}>
            {FIELD_REPORT_STATUS_LABEL[report.status]}
          </span>
          {report.blocksUse && report.status !== 'RESOLVED' ? (
            <span className="field-report-blocking">Impede o uso</span>
          ) : null}
        </div>
      </header>

      <p className="field-report-message">{report.message}</p>

      <dl className="field-report-details">
        <div>
          <dt>Protocolo</dt>
          <dd>{report.reference}</dd>
        </div>
        <div>
          <dt>Recebido</dt>
          <dd>{receivedAt.format(new Date(report.createdAt))}</dd>
        </div>
        <div>
          <dt>Enviado por</dt>
          <dd>
            {report.reporterName ?? 'Anônimo'}
            {report.reporterContact ? ` · ${report.reporterContact}` : ''}
          </dd>
        </div>
        {report.reviewedBy && report.reviewedAt ? (
          <div>
            <dt>Última triagem</dt>
            <dd>
              {report.reviewedBy.name} · {receivedAt.format(new Date(report.reviewedAt))}
            </dd>
          </div>
        ) : null}
      </dl>

      <label className="field-report-note">
        <span>Nota da coordenação (visível só para a coordenação)</span>
        <textarea
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: técnico avisado; reagente reposto no estoque."
          rows={2}
          value={note}
        />
      </label>

      <div className="field-report-actions">
        {nextActions(report.status).map((action) => (
          <button
            className={action.status === 'RESOLVED' ? 'primary-button' : 'secondary-button'}
            disabled={pending}
            key={action.status}
            onClick={() => void review(action.status)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}

export function FieldReportsPageClient(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLaboratoryId = searchParams?.get('laboratory') ?? '';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('NEW');
  const [kindFilter, setKindFilter] = useState<FieldReportKind | null>(null);
  const [summary, setSummary] = useState<FieldReportSummary | null>(null);
  const [reports, setReports] = useState<readonly FieldReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        if (!active) return;
        if (laboratories.length === 0) throw new Error('Nenhum laboratório disponível.');
        setPageData({ principal: session.principal, laboratories });
      } catch (error) {
        if (!active) return;
        if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Falha ao carregar a página.');
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const activeLaboratory = useMemo(
    () =>
      pageData?.laboratories.find(({ id }) => id === requestedLaboratoryId) ??
      pageData?.laboratories[0] ??
      null,
    [pageData, requestedLaboratoryId],
  );
  const presentation = useMemo(
    () =>
      pageData && activeLaboratory
        ? createWorkspacePresentation(pageData.principal, pageData.laboratories, activeLaboratory.id)
        : null,
    [activeLaboratory, pageData],
  );
  const laboratoryId = activeLaboratory?.id ?? null;
  const canReview =
    pageData !== null &&
    laboratoryId !== null &&
    principalCan(pageData.principal, 'field-report.review', laboratoryId);

  const loadSummary = useCallback(async () => {
    if (laboratoryId === null) return;
    const query = new URLSearchParams({ laboratoryId });
    try {
      setSummary(await readJson<FieldReportSummary>(`/api/field-reports/summary?${query.toString()}`));
    } catch {
      setSummary(null);
    }
  }, [laboratoryId]);

  const loadReports = useCallback(
    async (cursor: string | null) => {
      if (laboratoryId === null) return;
      setLoadingReports(true);
      setReportsError(null);
      const query = new URLSearchParams({ laboratoryId, limit: String(PAGE_SIZE) });
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (kindFilter !== null) query.set('kind', kindFilter);
      if (cursor !== null) query.set('cursor', cursor);
      try {
        const page = await readJson<FieldReportPage>(`/api/field-reports?${query.toString()}`);
        setReports((current) => (cursor === null ? page.items : [...current, ...page.items]));
        setNextCursor(page.pageInfo.nextCursor);
      } catch (error) {
        setReportsError(
          error instanceof Error && error.message === 'FORBIDDEN'
            ? 'Você não tem permissão para ver os informes deste laboratório.'
            : 'Não foi possível carregar os informes.',
        );
      } finally {
        setLoadingReports(false);
      }
    },
    [kindFilter, laboratoryId, statusFilter],
  );

  useEffect(() => {
    if (!canReview) return;
    void loadSummary();
  }, [canReview, loadSummary]);

  useEffect(() => {
    if (!canReview) return;
    void loadReports(null);
  }, [canReview, loadReports]);

  const review = useCallback(
    async (report: FieldReport, status: FieldReportStatus, note: string) => {
      setNotice(null);
      try {
        const updated = await readJson<FieldReport>(`/api/field-reports/${report.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, reviewNote: note.trim() === '' ? null : note.trim() }),
        });
        setReports((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setNotice(`${updated.reference} agora está “${FIELD_REPORT_STATUS_LABEL[updated.status]}”.`);
        void loadSummary();
        // O sino do topo recarrega na hora, sem esperar o próximo ciclo.
        window.dispatchEvent(new Event(FIELD_REPORTS_CHANGED_EVENT));
      } catch {
        setNotice('Não foi possível atualizar o informe. Tente novamente.');
      }
    },
    [loadSummary],
  );

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        {loadError ? <p role="alert">{loadError}</p> : (<><span className="loading-pulse" />Carregando informes...</>)}
      </main>
    );
  }

  const laboratoryRail = pageData.laboratories.map((laboratory) => ({
    href: `/informes?laboratory=${laboratory.id}`,
    id: laboratory.id,
    ...(laboratory.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: laboratory.name,
    shortName: laboratory.code.slice(0, 2).toUpperCase(),
  }));

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/informes"
      appName="Arqueia"
      basePath={BASE_PATH}
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      notifications={<WorkspaceNotifications scope={presentation.notificationScope} />}
      reportAction={presentation.reportAction}
      qrAction={{ href: `/qr?laboratory=${activeLaboratory.id}`, label: 'Ler QR Code' }}
      sectionLabel="Informes"
      userInitials={presentation.userInitials}
      userLabel={presentation.currentUser.name}
      userMenu={<LogoutButton />}
    >
      <section className="field-reports-intro">
        <div>
          <span className="section-kicker">Compilado da coordenação</span>
          <h2>O que a comunidade do laboratório avisou</h2>
          <p>
            Informes enviados pelo QR, sem login. Só a coordenação vê esta página: quem envia recebe
            apenas o protocolo.
          </p>
        </div>
        {canReview ? (
          <button className="secondary-button" onClick={() => setQrOpen(true)} type="button">
            QR para imprimir
          </button>
        ) : null}
      </section>

      {!canReview ? (
        <p className="field-reports-empty" role="alert">
          Os informes são visíveis só para a coordenação deste laboratório.
        </p>
      ) : (
        <>
          <section aria-label="Resumo dos informes em aberto" className="field-reports-summary">
            {fieldReportKinds.map((kind) => (
              <button
                aria-pressed={kindFilter === kind}
                className="field-reports-summary-card"
                key={kind}
                onClick={() => setKindFilter((current) => (current === kind ? null : kind))}
                type="button"
              >
                <strong>{summary?.openByKind[kind] ?? '–'}</strong>
                <span>{FIELD_REPORT_KIND_PRESENTATION[kind].label}</span>
                <small>em aberto</small>
              </button>
            ))}
          </section>
          {summary && summary.openBlockingUse > 0 ? (
            <p className="field-reports-alert" role="status">
              {summary.openBlockingUse === 1
                ? '1 informe em aberto relata equipamento que não pode ser usado.'
                : `${summary.openBlockingUse} informes em aberto relatam equipamento que não pode ser usado.`}
            </p>
          ) : null}

          <div className="field-reports-toolbar" role="tablist" aria-label="Filtrar por status">
            {STATUS_FILTERS.map((filter) => (
              <button
                aria-selected={statusFilter === filter.value}
                className="field-reports-tab"
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                role="tab"
                type="button"
              >
                {filter.label}
                {filter.value !== 'ALL' && summary ? ` (${summary.byStatus[filter.value]})` : ''}
              </button>
            ))}
            {kindFilter !== null ? (
              <button className="field-reports-clear" onClick={() => setKindFilter(null)} type="button">
                {FIELD_REPORT_KIND_PRESENTATION[kindFilter].label} ×
              </button>
            ) : null}
          </div>

          {notice ? (
            <p className="field-reports-notice" role="status">
              {notice}
            </p>
          ) : null}
          {reportsError ? (
            <p className="form-error" role="alert">
              {reportsError}
            </p>
          ) : null}

          <section aria-busy={loadingReports} className="field-reports-list">
            {reports.map((report) => (
              <FieldReportCard key={report.id} onReview={review} report={report} />
            ))}
            {!loadingReports && reports.length === 0 && !reportsError ? (
              <p className="field-reports-empty">Nenhum informe neste filtro.</p>
            ) : null}
            {loadingReports ? <span className="loading-pulse" /> : null}
          </section>

          {nextCursor !== null && !loadingReports ? (
            <button className="secondary-button field-reports-more" onClick={() => void loadReports(nextCursor)} type="button">
              Carregar mais
            </button>
          ) : null}
        </>
      )}

      {qrOpen ? (
        <FieldReportQrDialog
          laboratoryId={activeLaboratory.id}
          laboratoryName={activeLaboratory.name}
          onClose={() => setQrOpen(false)}
        />
      ) : null}
    </WorkspaceShell>
  );
}
