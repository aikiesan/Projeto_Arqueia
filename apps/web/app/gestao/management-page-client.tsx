'use client';

import type {
  AuditLogDetail,
  AuditLogPage,
  AuthenticatedPrincipal,
  Laboratory,
  ManagementAnalytics,
  ProjectUsagePage,
} from '@arqueia/contracts';
import { WorkspaceShell } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createWorkspacePresentation } from '../presentation';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

function getDefaultPeriod(): { startsAt: string; endsAt: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível carregar os dados.');
  }
  return response.json() as Promise<T>;
}

export function ManagementPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLabId = searchParams.get('laboratory');

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [period, setPeriod] = useState(getDefaultPeriod);

  const [analytics, setAnalytics] = useState<ManagementAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const [projectUsagePage, setProjectUsagePage] = useState<ProjectUsagePage | null>(null);
  const [projectUsageError, setProjectUsageError] = useState<string | null>(null);
  const [loadingProjectUsage, setLoadingProjectUsage] = useState(true);

  const [auditPage, setAuditPage] = useState<AuditLogPage | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(true);

  const [selectedAuditDetail, setSelectedAuditDetail] = useState<AuditLogDetail | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        setPageData({ principal: session.principal, laboratories });
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          router.replace('/login');
        }
      }
    })();
  }, [router]);

  const activeLaboratory = useMemo(() => {
    if (!pageData) return null;
    if (requestedLabId) {
      const found = pageData.laboratories.find((lab) => lab.id === requestedLabId);
      if (found) return found;
    }
    return pageData.laboratories[0] ?? null;
  }, [pageData, requestedLabId]);

  const presentation = useMemo(
    () => (pageData === null ? null : createWorkspacePresentation(pageData.principal, pageData.laboratories)),
    [pageData],
  );

  const laboratoryId = activeLaboratory?.id;

  const loadDashboardData = useCallback(async () => {
    if (!laboratoryId) return;

    setLoadingAnalytics(true);
    setLoadingProjectUsage(true);
    setLoadingAudit(true);
    setAnalyticsError(null);
    setProjectUsageError(null);
    setAuditError(null);

    const queryStr = `laboratoryId=${laboratoryId}&startsAt=${encodeURIComponent(period.startsAt)}&endsAt=${encodeURIComponent(period.endsAt)}`;

    const [analyticsResult, usageResult, auditResult] = await Promise.allSettled([
      readJson<ManagementAnalytics>(`/api/management/analytics?${queryStr}`),
      readJson<ProjectUsagePage>(`/api/management/project-usage?${queryStr}`),
      readJson<AuditLogPage>(`/api/management/audit-logs?${queryStr}`),
    ]);

    if (analyticsResult.status === 'fulfilled') {
      setAnalytics(analyticsResult.value);
    } else {
      setAnalytics(null);
      setAnalyticsError(
        analyticsResult.reason instanceof Error && analyticsResult.reason.message === 'FORBIDDEN'
          ? 'Você não possui permissão para visualizar relatórios de gestão neste laboratório.'
          : 'Falha ao carregar indicadores de gestão.',
      );
    }
    setLoadingAnalytics(false);

    if (usageResult.status === 'fulfilled') {
      setProjectUsagePage(usageResult.value);
    } else {
      setProjectUsagePage(null);
      setProjectUsageError(
        usageResult.reason instanceof Error && usageResult.reason.message === 'FORBIDDEN'
          ? 'Você não possui permissão para visualizar o uso de projetos.'
          : 'Falha ao carregar consumo por projeto.',
      );
    }
    setLoadingProjectUsage(false);

    if (auditResult.status === 'fulfilled') {
      setAuditPage(auditResult.value);
    } else {
      setAuditPage(null);
      setAuditError(
        auditResult.reason instanceof Error && auditResult.reason.message === 'FORBIDDEN'
          ? 'Você não possui permissão para visualizar o livro de auditoria.'
          : 'Falha ao carregar eventos de auditoria.',
      );
    }
    setLoadingAudit(false);
  }, [laboratoryId, period.startsAt, period.endsAt]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const openAuditDetail = async (auditId: string) => {
    if (!laboratoryId) return;
    try {
      const detail = await readJson<AuditLogDetail>(
        `/api/management/audit-logs/${auditId}?laboratoryId=${laboratoryId}`,
      );
      setSelectedAuditDetail(detail);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao carregar detalhe da auditoria.');
    }
  };

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        Carregando painel de gestão...
      </main>
    );
  }

  const userInitials = pageData.principal.user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const laboratoryRail = pageData.laboratories.map((lab) => ({
    href: `/gestao?laboratory=${lab.id}`,
    id: lab.id,
    ...(lab.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: lab.name,
    shortName: lab.code.slice(0, 2),
  }));

  const displayTimezone = analytics?.timezone ?? activeLaboratory.timezone ?? 'America/Sao_Paulo';

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/gestao"
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Gestão e Histórico"
      userInitials={userInitials}
      userLabel={pageData.principal.user.name}
    >
      {/* Header & Preset Selector */}
      <section className="equipment-toolbar" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <span className="section-kicker">Gestão Operacional — {activeLaboratory.name}</span>
          <h2>Indicadores, Analytics & Auditoria</h2>
          <p>Visão em tempo real de ocupação de equipamentos, livro-razão de insumos e histórico auditável.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#718096', fontWeight: 600 }}>Fuso: {displayTimezone}</span>
          <button
            className="secondary-button"
            onClick={() => {
              const end = new Date();
              const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
              setPeriod({ startsAt: start.toISOString(), endsAt: end.toISOString() });
            }}
            type="button"
          >
            Últimos 7 dias
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              const end = new Date();
              const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
              setPeriod({ startsAt: start.toISOString(), endsAt: end.toISOString() });
            }}
            type="button"
          >
            Últimos 30 dias
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              const end = new Date();
              const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
              setPeriod({ startsAt: start.toISOString(), endsAt: end.toISOString() });
            }}
            type="button"
          >
            Últimos 90 dias
          </button>
        </div>
      </section>

      {/* Section 1: KPI Cards */}
      <section style={{ margin: '1.5rem 0' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Resumo de Indicadores da Plataforma</h3>

        {loadingAnalytics ? (
          <p style={{ color: '#718096' }}>Carregando métricas de indicadores...</p>
        ) : analyticsError ? (
          <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', padding: '0.8rem 1rem', borderRadius: '8px', color: '#c53030' }}>
            ⚠️ {analyticsError}
          </div>
        ) : analytics ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="equipment-card" style={{ padding: '1rem', background: '#f7fafc', borderLeft: '4px solid #319795' }}>
              <span style={{ fontSize: '0.75rem', color: '#4a5568', textTransform: 'uppercase', fontWeight: 700 }}>Equipamentos Ativos</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2d3748', marginTop: '0.2rem' }}>
                {analytics.equipmentMetrics.totalActiveEquipment}
              </div>
            </div>

            <div className="equipment-card" style={{ padding: '1rem', background: '#f7fafc', borderLeft: '4px solid #3182ce' }}>
              <span style={{ fontSize: '0.75rem', color: '#4a5568', textTransform: 'uppercase', fontWeight: 700 }}>Horas Reservadas</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2d3748', marginTop: '0.2rem' }}>
                {analytics.equipmentMetrics.totalReservedHours}h
              </div>
              <span style={{ fontSize: '0.75rem', color: '#718096' }}>{analytics.equipmentMetrics.reservationCount} agendamentos</span>
            </div>

            <div className="equipment-card" style={{ padding: '1rem', background: '#f7fafc', borderLeft: '4px solid #d69e2e' }}>
              <span style={{ fontSize: '0.75rem', color: '#4a5568', textTransform: 'uppercase', fontWeight: 700 }}>Lotes Operacionais</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2d3748', marginTop: '0.2rem' }}>
                {analytics.inventoryMetrics.totalActiveBatches}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#718096' }}>{analytics.inventoryMetrics.totalWithdrawalsCount} retiradas efetuadas</span>
            </div>

            <div className="equipment-card" style={{ padding: '1rem', background: '#f7fafc', borderLeft: '4px solid #e53e3e' }}>
              <span style={{ fontSize: '0.75rem', color: '#4a5568', textTransform: 'uppercase', fontWeight: 700 }}>Alertas de Insumos</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c53030', marginTop: '0.2rem' }}>
                {analytics.inventoryMetrics.lowStockProductsCount + analytics.inventoryMetrics.expiringBatchesCount}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                {analytics.inventoryMetrics.lowStockProductsCount} com estoque baixo / {analytics.inventoryMetrics.expiringBatchesCount} a vencer
              </span>
            </div>
          </div>
        ) : null}
      </section>

      {/* Section 2: Consumo por Projeto */}
      <section style={{ margin: '2rem 0' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Consumo e Horas por Projeto de Pesquisa</h3>

        {loadingProjectUsage ? (
          <p style={{ color: '#718096' }}>Carregando dados de uso por projeto...</p>
        ) : projectUsageError ? (
          <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', padding: '0.8rem 1rem', borderRadius: '8px', color: '#c53030' }}>
            ⚠️ {projectUsageError}
          </div>
        ) : projectUsagePage && projectUsagePage.items.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <thead style={{ background: '#f7fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Projeto</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Horas Reservadas</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Agendamentos</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Retiradas</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Produtos Consumidos</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.85rem' }}>
                {projectUsagePage.items.map((proj) => (
                  <tr key={proj.projectId ?? 'sem-projeto'} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {proj.projectName}
                      {proj.projectCode ? <small style={{ display: 'block', color: '#718096', fontWeight: 400 }}>{proj.projectCode}</small> : null}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{proj.reservedHours}h</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{proj.reservationCount}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{proj.withdrawalCount}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {proj.consumedProducts.length === 0 ? (
                        <span style={{ color: '#a0aec0' }}>Nenhum insumo retirado</span>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                          {proj.consumedProducts.map((p) => (
                            <li key={p.productId}>
                              {p.productName} ({p.totalQuantity} {p.unitOfMeasure})
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#718096' }}>Nenhum registro de uso por projeto no período selecionado.</p>
        )}
      </section>

      {/* Section 3: Timeline de Auditoria Sanitizada */}
      <section style={{ margin: '2rem 0' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Livro de Auditoria Imutável do Laboratório</h3>

        {loadingAudit ? (
          <p style={{ color: '#718096' }}>Carregando registros de auditoria...</p>
        ) : auditError ? (
          <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', padding: '0.8rem 1rem', borderRadius: '8px', color: '#c53030' }}>
            ⚠️ {auditError}
          </div>
        ) : auditPage && auditPage.items.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <thead style={{ background: '#f7fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Data/Hora</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ator</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ação</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Entidade</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Origem</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Detalhes</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.85rem' }}>
                {auditPage.items.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {new Date(event.occurredAt).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{event.actorName}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <code>{event.action}</code>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {event.entity} <small style={{ color: '#718096' }}>({event.entityId.slice(0, 8)})</small>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#718096' }}>{event.origin}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        className="secondary-button"
                        onClick={() => void openAuditDetail(event.id)}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        type="button"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#718096' }}>Nenhum evento de auditoria encontrado para este filtro.</p>
        )}
      </section>

      {/* Audit Log Detail Modal */}
      {selectedAuditDetail && (
        <dialog
          open
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            padding: '1.5rem',
            maxWidth: '650px',
            width: '90%',
            zIndex: 100,
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Detalhes do Evento de Auditoria</h4>
            <button
              className="secondary-button"
              onClick={() => setSelectedAuditDetail(null)}
              type="button"
            >
              ✕ Fechar
            </button>
          </div>

          <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            <p><strong>ID do Evento:</strong> <code>{selectedAuditDetail.id}</code></p>
            <p><strong>Ação:</strong> <code>{selectedAuditDetail.action}</code></p>
            <p><strong>Ator:</strong> {selectedAuditDetail.actorName}</p>
            <p><strong>Entidade:</strong> {selectedAuditDetail.entity} ({selectedAuditDetail.entityId})</p>

            {selectedAuditDetail.redactedFields.length > 0 && (
              <div style={{ background: '#fffaf0', border: '1px solid #fbd38d', padding: '0.5rem 0.75rem', borderRadius: '6px', margin: '0.75rem 0', color: '#744210' }}>
                🔒 <strong>Campos Omitidos por Segurança/Allowlist:</strong> {selectedAuditDetail.redactedFields.join(', ')}
              </div>
            )}

            {selectedAuditDetail.after && (
              <div style={{ marginTop: '0.75rem' }}>
                <strong>Estado Resultante Sanitizado:</strong>
                <pre style={{ background: '#f7fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.78rem' }}>
                  {JSON.stringify(selectedAuditDetail.after, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </dialog>
      )}
    </WorkspaceShell>
  );
}
