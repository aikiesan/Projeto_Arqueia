import type { DashboardSummary } from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';

import {
  EquipmentSummaryCards,
  InventoryAlertsCard,
  PendingActionsCard,
  QuickActions,
  TodayReservationsCard,
} from './components/home';
import { LogoutButton } from './logout-button';
import type { WorkspacePresentation } from './presentation';

interface HomeDashboardProps {
  readonly presentation: WorkspacePresentation;
  readonly summary: DashboardSummary;
}

function formatUpdatedAt(summary: DashboardSummary): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: summary.timezone,
    }).format(new Date(summary.generatedAt));
  } catch {
    return 'Indisponível';
  }
}

function ContextPanel({ summary }: Pick<HomeDashboardProps, 'summary'>) {
  const equipmentAvailable = summary.availability.equipment;

  return (
    <div className="context-stack">
      <section>
        <span className="section-kicker">Situação atual</span>
        <h2>Resumo do laboratório</h2>
        <dl className="context-details">
          <div>
            <dt>Equipamentos</dt>
            <dd>{equipmentAvailable ? summary.equipmentSummary.total : 'Indisponível'}</dd>
          </div>
          <div>
            <dt>Disponíveis</dt>
            <dd>{equipmentAvailable ? summary.equipmentSummary.byStatus.AVAILABLE : '—'}</dd>
          </div>
          <div>
            <dt>Atualizado</dt>
            <dd>{formatUpdatedAt(summary)}</dd>
          </div>
        </dl>
      </section>
      <QuickActions actions={summary.quickActions} />
    </div>
  );
}

export function HomeDashboard({ presentation, summary }: HomeDashboardProps) {
  const firstName = presentation.currentUser.name.split(' ')[0] ?? presentation.currentUser.name;
  const schedulingAction = summary.quickActions.find(({ id }) => id === 'scheduling');

  return (
    <WorkspaceShell
      activeLaboratoryId={presentation.activeLaboratoryId}
      activeModuleHref="/"
      appName="Arqueia"
      contextualPanel={<ContextPanel summary={summary} />}
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
          <p>
            Acompanhe a operação de hoje e acesse somente as atividades autorizadas para este
            laboratório.
          </p>
        </div>
        {schedulingAction ? (
          <a className="scan-shortcut" href={schedulingAction.href}>
            <ArqueiaIcon name="agenda" size={22} />
            <span>{schedulingAction.label}</span>
          </a>
        ) : null}
      </section>

      <EquipmentSummaryCards
        available={summary.availability.equipment}
        summary={summary.equipmentSummary}
      />

      <TodayReservationsCard
        available={summary.availability.scheduling}
        reservations={summary.todayReservations}
        timezone={summary.timezone}
      />

      <div className="attention-grid attention-grid--single">
        <InventoryAlertsCard
          alerts={summary.inventoryAlerts}
          available={summary.availability.inventory}
        />
      </div>

      <div className="home-dashboard-section">
        <PendingActionsCard
          actions={summary.upcomingActions}
          available={summary.availability.pendingActions}
        />
      </div>
    </WorkspaceShell>
  );
}
