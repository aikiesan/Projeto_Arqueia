'use client';

import type {
  AuditLogDetail,
  AuditLogPage,
  AuthenticatedPrincipal,
  Laboratory,
  ManagementAnalytics,
  Project,
  ProjectUsagePage,
  User,
} from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { createWorkspacePresentation } from '../presentation';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

type ManagementTab = 'analytics' | 'laboratories' | 'projects' | 'users';

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
  const [activeTab, setActiveTab] = useState<ManagementTab>('analytics');
  const [period, setPeriod] = useState(getDefaultPeriod);

  // General state
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tab 1: Analytics & Audit
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

  // Tab 2: Laboratories CRUD
  const [newLabModalOpen, setNewLabModalOpen] = useState(false);
  const [editLabModal, setEditLabModal] = useState<Laboratory | null>(null);

  // Tab 3: Projects CRUD
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [editProjectModal, setEditProjectModal] = useState<Project | null>(null);

  // Tab 4: Users Overview
  const [users, setUsers] = useState<readonly User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadInitialData = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

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
  const isGlobalAdmin = pageData?.principal.systemRoles.some(
    (role) => role.role === 'ADMIN' && role.archivedAt === null,
  ) ?? false;

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

  const loadProjectsData = useCallback(async () => {
    if (!laboratoryId) return;
    setLoadingProjects(true);
    try {
      const data = await readJson<readonly Project[]>(`/api/projects?laboratoryId=${laboratoryId}`);
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [laboratoryId]);

  const loadUsersData = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await readJson<readonly User[]>('/api/users');
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      void loadDashboardData();
    } else if (activeTab === 'projects') {
      void loadProjectsData();
    } else if (activeTab === 'users') {
      void loadUsersData();
    }
  }, [activeTab, loadDashboardData, loadProjectsData, loadUsersData]);

  // Laboratory CRUD handlers
  const handleCreateLaboratory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pageData) return;
    setPending(true);
    setActionError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson('/api/laboratories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: pageData.principal.user.institutionId,
          name: form.get('name'),
          code: form.get('code'),
          timezone: form.get('timezone') || 'America/Sao_Paulo',
        }),
      });

      setNewLabModalOpen(false);
      setNotice('✅ Laboratório criado com sucesso!');
      await loadInitialData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao criar laboratório.');
    } finally {
      setPending(false);
    }
  };

  const handleUpdateLaboratory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editLabModal) return;
    setPending(true);
    setActionError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson(`/api/laboratories/${editLabModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          timezone: form.get('timezone'),
        }),
      });

      setEditLabModal(null);
      setNotice('✅ Dados do laboratório atualizados com sucesso!');
      await loadInitialData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao atualizar laboratório.');
    } finally {
      setPending(false);
    }
  };

  // Project CRUD handlers
  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setActionError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          code: form.get('code'),
          name: form.get('name'),
          description: form.get('description'),
        }),
      });

      setNewProjectModalOpen(false);
      setNotice('✅ Projeto de pesquisa cadastrado com sucesso!');
      await loadProjectsData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao cadastrar projeto.');
    } finally {
      setPending(false);
    }
  };

  const handleUpdateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editProjectModal) return;
    setPending(true);
    setActionError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson(`/api/projects/${editProjectModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description'),
          status: form.get('status'),
        }),
      });

      setEditProjectModal(null);
      setNotice('✅ Projeto atualizado com sucesso!');
      await loadProjectsData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao atualizar projeto.');
    } finally {
      setPending(false);
    }
  };

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
        Carregando painel de gestão administrativa...
      </main>
    );
  }

  const userInitials = pageData.principal.user.loginCode.replace(/^ARQ-/, '').slice(0, 2);

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
      qrAction={{ href: `/qr?laboratory=${activeLaboratory.id}`, label: 'Ler QR Code' }}
      sectionLabel="Painel de Gestão & Administração"
      userInitials={userInitials}
      userLabel={pageData.principal.user.loginCode}
    >
      {/* Header & Main Info */}
      <section className="equipment-toolbar" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <span className="section-kicker">Administração Operacional — {activeLaboratory.name}</span>
          <h2>Indicadores, Analytics & Auditoria</h2>
          <p>Supervisão de indicadores, laboratórios, projetos de pesquisa, acessos e auditoria.</p>
        </div>

        {activeTab === 'analytics' && (
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
              7 dias
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
              30 dias
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
              90 dias
            </button>
          </div>
        )}
      </section>

      {/* Action Notices / Errors */}
      {notice && (
        <div style={{ background: '#e6fffa', border: '1px solid #38b2ac', color: '#234e52', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.75rem 0', fontSize: '0.85rem' }}>
          {notice}
        </div>
      )}

      {actionError && (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.75rem 0', fontSize: '0.85rem' }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* Tabs Navigation */}
      <nav style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0 1.5rem 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.2rem', overflowX: 'auto' }}>
        <button
          onClick={() => { setActiveTab('analytics'); setActionError(null); setNotice(null); }}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '3px solid #319795' : '3px solid transparent',
            color: activeTab === 'analytics' ? '#234e52' : '#718096',
            fontWeight: activeTab === 'analytics' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
          type="button"
        >
          📊 Indicadores & Auditoria
        </button>

        <button
          onClick={() => { setActiveTab('laboratories'); setActionError(null); setNotice(null); }}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'laboratories' ? '3px solid #319795' : '3px solid transparent',
            color: activeTab === 'laboratories' ? '#234e52' : '#718096',
            fontWeight: activeTab === 'laboratories' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
          type="button"
        >
          🏢 Laboratórios ({pageData.laboratories.length})
        </button>

        <button
          onClick={() => { setActiveTab('projects'); setActionError(null); setNotice(null); }}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'projects' ? '3px solid #319795' : '3px solid transparent',
            color: activeTab === 'projects' ? '#234e52' : '#718096',
            fontWeight: activeTab === 'projects' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
          type="button"
        >
          📁 Projetos de Pesquisa
        </button>

        <button
          onClick={() => { setActiveTab('users'); setActionError(null); setNotice(null); }}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #319795' : '3px solid transparent',
            color: activeTab === 'users' ? '#234e52' : '#718096',
            fontWeight: activeTab === 'users' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
          type="button"
        >
          👥 Equipe & Usuários
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: ANALYTICS & AUDIT LOGS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <>
          {/* KPI Cards */}
          <section style={{ margin: '1rem 0 1.5rem 0' }}>
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

          {/* Consumo por Projeto */}
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

          {/* Timeline de Auditoria */}
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
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LABORATORIES CRUD                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'laboratories' && (
        <section style={{ margin: '1rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Laboratórios da Instituição</h3>
              <p style={{ fontSize: '0.85rem', color: '#718096', margin: '0.2rem 0 0 0' }}>
                Gerencie unidades, códigos identificadores e fusos horários de operação.
              </p>
            </div>
            {isGlobalAdmin && (
              <button className="primary-button" onClick={() => setNewLabModalOpen(true)} type="button">
                <ArqueiaIcon name="mais" size={18} /> Novo Laboratório
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {pageData.laboratories.map((lab) => (
              <article key={lab.id} className="equipment-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ background: '#e6fffa', color: '#234e52', fontWeight: 700, fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    {lab.code}
                  </span>
                  {lab.id === activeLaboratory.id && (
                    <span style={{ fontSize: '0.75rem', background: '#ebf8ff', color: '#2b6cb0', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                      Ativo agora
                    </span>
                  )}
                </div>

                <h4 style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '1.05rem' }}>{lab.name}</h4>
                <p style={{ fontSize: '0.8rem', color: '#718096', margin: 0 }}>Fuso: {lab.timezone}</p>

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #edf2f7', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    className="secondary-button"
                    onClick={() => router.push(`/gestao?laboratory=${lab.id}`)}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    type="button"
                  >
                    Alternar Para
                  </button>
                  {isGlobalAdmin && (
                    <button
                      className="primary-button"
                      onClick={() => setEditLabModal(lab)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      type="button"
                    >
                      Editar Dados
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PROJECTS CRUD                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'projects' && (
        <section style={{ margin: '1rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Projetos de Pesquisa — {activeLaboratory.name}</h3>
              <p style={{ fontSize: '0.85rem', color: '#718096', margin: '0.2rem 0 0 0' }}>
                Projetos vinculados aos agendamentos de equipamentos e retiradas de insumos.
              </p>
            </div>
            <button className="primary-button" onClick={() => setNewProjectModalOpen(true)} type="button">
              <ArqueiaIcon name="mais" size={18} /> Novo Projeto
            </button>
          </div>

          {loadingProjects ? (
            <p style={{ color: '#718096' }}>Carregando projetos...</p>
          ) : projects.length === 0 ? (
            <div className="equipment-empty">
              <h3>Nenhum projeto de pesquisa encontrado</h3>
              <p>Cadastre o primeiro projeto para vincular aos agendamentos deste laboratório.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {projects.map((proj) => (
                <article key={proj.id} className="equipment-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ background: '#edf2f7', color: '#2d3748', fontWeight: 700, fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {proj.code}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background: proj.status === 'ACTIVE' ? '#c6f6d5' : '#fed7d7',
                        color: proj.status === 'ACTIVE' ? '#22543d' : '#742a2a',
                      }}
                    >
                      {proj.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'}
                    </span>
                  </div>

                  <h4 style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '1.05rem' }}>{proj.name}</h4>
                  <p style={{ fontSize: '0.82rem', color: '#718096', margin: '0 0 0.5rem 0', minHeight: '2.5rem' }}>
                    {proj.description || 'Sem descrição cadastrada.'}
                  </p>

                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #edf2f7', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="secondary-button"
                      onClick={() => setEditProjectModal(proj)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      type="button"
                    >
                      Editar Projeto
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: USERS & TEAM OVERVIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <section style={{ margin: '1rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Equipe & Pesquisadores</h3>
              <p style={{ fontSize: '0.85rem', color: '#718096', margin: '0.2rem 0 0 0' }}>
                Resumo dos usuários cadastrados no Arqueia.
              </p>
            </div>
            <Link className="primary-button" href="/usuarios" style={{ textDecoration: 'none' }}>
              Abrir Gestão Completa de Usuários & RBAC →
            </Link>
          </div>

          {loadingUsers ? (
            <p style={{ color: '#718096' }}>Carregando equipe...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <thead style={{ background: '#f7fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Categoria</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Credencial</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Ações</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.85rem' }}>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{u.loginCode}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><code>{u.academicCategory}</code></td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            background: u.status === 'ACTIVE' ? '#c6f6d5' : '#feebc8',
                            color: u.status === 'ACTIVE' ? '#22543d' : '#744210',
                          }}
                        >
                          {u.status === 'ACTIVE' ? 'Ativo' : u.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#718096' }}>
                        {u.mustChangePassword ? 'Troca de senha pendente' : 'Senha local'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <Link
                          className="secondary-button"
                          href="/usuarios"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                        >
                          Gerenciar Acessos
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* Modal Criar Laboratório */}
      {newLabModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="new-lab-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Gestão Institucional</span>
                <h2 id="new-lab-title">Cadastrar Novo Laboratório</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setNewLabModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateLaboratory}>
              <label className="field-wide">
                <span>Nome do Laboratório *</span>
                <input name="name" placeholder="Ex: Laboratório de Bioquímica e Biologia Celular" required maxLength={120} />
              </label>

              <label className="field-wide">
                <span>Código / Sigla Única *</span>
                <input name="code" placeholder="Ex: LBBC" required maxLength={32} />
              </label>

              <label className="field-wide">
                <span>Fuso Horário Operacional</span>
                <input name="timezone" defaultValue="America/Sao_Paulo" required maxLength={64} />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setNewLabModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Criando...' : 'Confirmar Laboratório'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Editar Laboratório */}
      {editLabModal && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="edit-lab-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Gestão Institucional</span>
                <h2 id="edit-lab-title">Editar Laboratório ({editLabModal.code})</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setEditLabModal(null)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleUpdateLaboratory}>
              <label className="field-wide">
                <span>Nome do Laboratório *</span>
                <input name="name" defaultValue={editLabModal.name} required maxLength={120} />
              </label>

              <label className="field-wide">
                <span>Fuso Horário Operacional *</span>
                <input name="timezone" defaultValue={editLabModal.timezone} required maxLength={64} />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setEditLabModal(null)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Criar Projeto */}
      {newProjectModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="new-proj-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">{activeLaboratory.name}</span>
                <h2 id="new-proj-title">Cadastrar Novo Projeto de Pesquisa</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setNewProjectModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateProject}>
              <label className="field-wide">
                <span>Código do Projeto *</span>
                <input name="code" placeholder="Ex: FAPESP-2026-0412" required maxLength={32} />
              </label>

              <label className="field-wide">
                <span>Nome do Projeto *</span>
                <input name="name" placeholder="Ex: Rastreamento de Biomarcadores em Microescala" required maxLength={120} />
              </label>

              <label className="field-wide">
                <span>Descrição dos Objetivos (Opcional)</span>
                <textarea name="description" placeholder="Resumo dos objetivos e escopo de pesquisa" rows={3} maxLength={1000} />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setNewProjectModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Cadastrando...' : 'Confirmar Projeto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Editar Projeto */}
      {editProjectModal && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="edit-proj-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">{activeLaboratory.name}</span>
                <h2 id="edit-proj-title">Editar Projeto ({editProjectModal.code})</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setEditProjectModal(null)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleUpdateProject}>
              <label className="field-wide">
                <span>Nome do Projeto *</span>
                <input name="name" defaultValue={editProjectModal.name} required maxLength={120} />
              </label>

              <label className="field-wide">
                <span>Status do Projeto *</span>
                <select name="status" defaultValue={editProjectModal.status} required>
                  <option value="ACTIVE">Ativo (Permite novas reservas e consumo)</option>
                  <option value="ARCHIVED">Arquivado (Somente leitura e histórico)</option>
                </select>
              </label>

              <label className="field-wide">
                <span>Descrição</span>
                <textarea name="description" defaultValue={editProjectModal.description ?? ''} rows={3} maxLength={1000} />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setEditProjectModal(null)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Detalhes de Auditoria */}
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
