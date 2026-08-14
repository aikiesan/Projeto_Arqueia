import type { DashboardPendingAction } from '@arqueia/contracts';

import { DashboardSectionState } from './dashboard-section-state';

export interface PendingActionsCardProps {
  readonly actions: readonly DashboardPendingAction[];
  readonly available: boolean;
  readonly loading?: boolean;
}

export function PendingActionsCard({
  actions,
  available,
  loading = false,
}: PendingActionsCardProps) {
  if (!available && !loading) {
    return (
      <DashboardSectionState
        available={false}
        iconName="equipamentos"
        kicker="Pendências"
        title="Ações requeridas"
        unavailableMessage="Não foi possível consultar as pendências operacionais no momento."
      />
    );
  }

  if (available && actions.length === 0 && !loading) {
    return (
      <DashboardSectionState
        available={true}
        empty={true}
        emptyMessage="Nenhuma pendência operacional aguardando sua ação."
        emptyTitle="Sem pendências"
        iconName="equipamentos"
        kicker="Pendências"
        title="Ações requeridas"
      />
    );
  }

  return (
    <DashboardSectionState
      available={available}
      empty={actions.length === 0}
      emptyMessage="Nenhuma pendência operacional aguardando sua ação."
      emptyTitle="Sem pendências"
      iconName="equipamentos"
      kicker="Pendências"
      loading={loading}
      title="Ações requeridas"
    >
      <div className="schedule-list">
        {actions.map((action) => (
          <article className="schedule-item" key={action.id}>
            <span className={`priority-badge priority-badge--${action.priority.toLowerCase()}`}>
              {action.priority}
            </span>
            <div>
              <strong>{action.title}</strong>
              <span>{action.detail}</span>
            </div>
            <a href={action.href}>Acessar</a>
          </article>
        ))}
      </div>
    </DashboardSectionState>
  );
}
