import type { DashboardQuickAction } from '@arqueia/contracts';

export interface QuickActionsProps {
  readonly actions: readonly DashboardQuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const items =
    actions.length > 0
      ? actions
      : [
          { id: 'default-equipments', label: 'Equipamentos', href: '/equipamentos' },
          { id: 'default-agenda', label: 'Agenda e reservas', href: '/agenda' },
        ];

  return (
    <section aria-label="Acesso rápido">
      <span className="section-kicker">Acesso rápido</span>
      {items.map((action) => (
        <a className="quiet-link" href={action.href} key={action.id}>
          <span>Ação</span>
          <strong>{action.label}</strong>
        </a>
      ))}
    </section>
  );
}
