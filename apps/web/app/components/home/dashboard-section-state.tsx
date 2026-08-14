import type { ReactNode } from 'react';
import { ArqueiaIcon } from '@arqueia/ui';

export interface DashboardSectionStateProps {
  readonly title: string;
  readonly kicker?: string;
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly loading?: boolean;
  readonly available?: boolean;
  readonly unavailableMessage?: string;
  readonly empty?: boolean;
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly iconName?: 'agenda' | 'equipamentos' | 'estoque';
  readonly children?: ReactNode;
}

export function DashboardSectionState({
  title,
  kicker,
  actionHref,
  actionLabel,
  loading = false,
  available = true,
  unavailableMessage = 'Fonte de dados temporariamente indisponível.',
  empty = false,
  emptyTitle = 'Nenhum item registrado',
  emptyMessage = 'Não há dados disponíveis para exibição.',
  iconName = 'agenda',
  children,
}: DashboardSectionStateProps) {
  const showAction = !loading && available && Boolean(actionHref && actionLabel);

  return (
    <section
      aria-busy={loading ? 'true' : undefined}
      className="dashboard-section"
    >
      <div className="section-heading">
        <div>
          {kicker ? <span className="section-kicker">{kicker}</span> : null}
          <h2>{title}</h2>
        </div>
        {showAction && actionHref && actionLabel ? (
          <a href={actionHref}>{actionLabel}</a>
        ) : null}
      </div>

      {loading ? (
        <div aria-live="polite" className="dashboard-empty" role="status">
          <span className="dashboard-empty-icon">
            <ArqueiaIcon name={iconName} size={25} />
          </span>
          <div>
            <h3>Carregando...</h3>
            <p>Obtendo informações atualizadas do laboratório.</p>
          </div>
        </div>
      ) : !available ? (
        <div aria-live="polite" className="dashboard-empty" role="status">
          <span className="dashboard-empty-icon">
            <ArqueiaIcon name={iconName} size={25} />
          </span>
          <div>
            <h3>Fonte temporariamente indisponível</h3>
            <p>{unavailableMessage}</p>
          </div>
        </div>
      ) : empty ? (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">
            <ArqueiaIcon name={iconName} size={25} />
          </span>
          <div>
            <h3>{emptyTitle}</h3>
            <p>{emptyMessage}</p>
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
