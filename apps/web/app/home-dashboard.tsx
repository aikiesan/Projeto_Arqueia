import type { DashboardSummary } from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';

import { LogoutButton } from './logout-button';
import type { WorkspacePresentation } from './presentation';

interface HomeDashboardProps {
  readonly presentation: WorkspacePresentation;
  readonly summary: DashboardSummary;
  readonly equipmentDataAvailable: boolean;
}

function ContextPanel({ summary, equipmentDataAvailable }: Pick<HomeDashboardProps, 'summary' | 'equipmentDataAvailable'>) {
  const updatedAt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(summary.generatedAt));
  return (
    <div className="context-stack">
      <section>
        <span className="section-kicker">Situação atual</span>
        <h2>Resumo do laboratório</h2>
        <dl className="context-details">
          <div><dt>Equipamentos</dt><dd>{equipmentDataAvailable ? summary.equipmentSummary.total : 'Indisponível'}</dd></div>
          <div><dt>Disponíveis</dt><dd>{equipmentDataAvailable ? summary.equipmentSummary.byStatus.AVAILABLE : '—'}</dd></div>
          <div><dt>Atualizado</dt><dd>{updatedAt}</dd></div>
        </dl>
        <a className="primary-button home-button-link" href="/equipamentos">Ver equipamentos</a>
      </section>
      <section className="context-note">
        <span className="context-note-icon"><ArqueiaIcon name="agenda" size={18} /></span>
        <div><strong>Agenda em preparação</strong><p>Reservas e bloqueios serão conectados no próximo módulo.</p></div>
      </section>
      <section>
        <span className="section-kicker">Acesso rápido</span>
        <a className="quiet-link" href="/equipamentos"><span>Cadastro</span><strong>Equipamentos</strong></a>
        <a className="quiet-link" href="/agenda"><span>Próximo módulo</span><strong>Agenda e reservas</strong></a>
      </section>
    </div>
  );
}

export function HomeDashboard({ presentation, summary, equipmentDataAvailable }: HomeDashboardProps) {
  const firstName = presentation.currentUser.name.split(' ')[0] ?? presentation.currentUser.name;
  const attentionCount = summary.equipmentSummary.byStatus.MAINTENANCE + summary.equipmentSummary.byStatus.UNDER_EVALUATION + summary.equipmentSummary.byStatus.UNAVAILABLE;
  const metrics = [
    { detail: equipmentDataAvailable ? 'ativos cadastrados' : 'dados indisponíveis', label: 'Equipamentos', tone: 'brand', value: equipmentDataAvailable ? String(summary.equipmentSummary.total) : '—' },
    { detail: 'prontos para operação', label: 'Disponíveis', tone: 'neutral', value: equipmentDataAvailable ? String(summary.equipmentSummary.byStatus.AVAILABLE) : '—' },
    { detail: 'manutenção, avaliação ou indisponíveis', label: 'Precisam de atenção', tone: attentionCount > 0 ? 'warning' : 'neutral', value: equipmentDataAvailable ? String(attentionCount) : '—' },
  ] as const;

  return (
    <WorkspaceShell
      activeLaboratoryId={presentation.activeLaboratoryId}
      activeModuleHref="/"
      appName="Arqueia"
      contextualPanel={<ContextPanel equipmentDataAvailable={equipmentDataAvailable} summary={summary} />}
      currentContext={presentation.currentContext}
      laboratories={presentation.laboratories}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Visão geral"
      userInitials={presentation.userInitials}
      userLabel={presentation.currentUser.name}
      userMenu={<LogoutButton />}
    >
      <section className="welcome-strip">
        <div>
          <span className="section-kicker">{presentation.currentContext}</span>
          <h2>Olá, {firstName}.</h2>
          <p>Acompanhe a estrutura disponível e acesse rapidamente as atividades do laboratório.</p>
        </div>
        <a className="scan-shortcut" href="/qr"><ArqueiaIcon name="qr" size={22} /><span>Escanear item</span></a>
      </section>

      {!equipmentDataAvailable ? <p className="dashboard-notice" role="status">Não foi possível atualizar os equipamentos agora. Os demais acessos continuam disponíveis.</p> : null}

      <section aria-label="Indicadores operacionais" className="metric-grid">
        {metrics.map((metric) => (
          <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><span className="section-kicker">Agenda</span><h2>Reservas de hoje</h2></div>
          <a href="/agenda">Abrir agenda</a>
        </div>
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon"><ArqueiaIcon name="agenda" size={25} /></span>
          <div><h3>A agenda será o próximo módulo</h3><p>Quando reservas e bloqueios estiverem ativos, os compromissos de hoje aparecerão aqui.</p></div>
        </div>
      </section>

      <section className="attention-grid">
        <article className={attentionCount > 0 ? 'attention-card attention-card--warning' : 'attention-card'}>
          <span className="attention-icon"><ArqueiaIcon name="equipamentos" size={21} /></span>
          <div><span className="section-kicker">Equipamentos</span><h3>{equipmentDataAvailable ? (attentionCount > 0 ? `${attentionCount} requerem atenção` : 'Tudo certo por aqui') : 'Atualização indisponível'}</h3><p>{equipmentDataAvailable ? 'Situação calculada a partir dos equipamentos cadastrados.' : 'Tente novamente em alguns instantes.'}</p></div>
          <a href="/equipamentos">Ver</a>
        </article>
        <article className="attention-card attention-card--pending">
          <span className="attention-icon"><ArqueiaIcon name="estoque" size={21} /></span>
          <div><span className="section-kicker">Estoque</span><h3>Aguardando livro de movimentações</h3><p>Alertas só serão exibidos quando puderem ser derivados do ledger real.</p></div>
          <a href="/estoque">Abrir</a>
        </article>
      </section>
    </WorkspaceShell>
  );
}
