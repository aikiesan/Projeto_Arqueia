import type { DashboardInventoryAlert } from '@arqueia/contracts';
import { ArqueiaIcon } from '@arqueia/ui';

export interface InventoryAlertsCardProps {
  readonly alerts: readonly DashboardInventoryAlert[];
  readonly available: boolean;
  readonly loading?: boolean;
}

export function InventoryAlertsCard({
  alerts,
  available,
  loading = false,
}: InventoryAlertsCardProps) {
  const hasAlerts = available && alerts.length > 0;
  const cardClass = hasAlerts ? 'attention-card attention-card--warning' : 'attention-card';

  return (
    <article className={cardClass}>
      <span className="attention-icon">
        <ArqueiaIcon name="estoque" size={21} />
      </span>
      <div>
        <span className="section-kicker">Estoque</span>
        <h3>
          {loading
            ? 'Carregando estoque...'
            : !available
              ? 'Atualização indisponível'
              : alerts.length > 0
                ? `${alerts.length} alerta(s) ativo(s)`
                : 'Estoque sem alertas'}
        </h3>
        <p>
          {loading
            ? 'Consultando dados do ledger...'
            : !available
              ? 'Não foi possível consultar o ledger agora.'
              : alerts[0]?.detail ?? 'Saldos e validades calculados a partir do ledger.'}
        </p>
      </div>
      <a href={alerts[0]?.href ?? '/estoque'}>Abrir</a>
    </article>
  );
}
