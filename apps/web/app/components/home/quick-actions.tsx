import type { DashboardQuickAction } from '@arqueia/contracts';

import { withBasePath } from '../../lib/base-path';

export interface QuickActionsProps {
  readonly actions: readonly DashboardQuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section aria-label="Acesso rápido">
      <span className="section-kicker">Acesso rápido</span>
      {actions.map((action) => (
        <a className="quiet-link" href={withBasePath(action.href)} key={action.id}>
          <span>Ação</span>
          <strong>{action.label}</strong>
        </a>
      ))}
    </section>
  );
}
