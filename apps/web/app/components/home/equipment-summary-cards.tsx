import type { DashboardSummary } from '@arqueia/contracts';

export interface EquipmentSummaryCardsProps {
  readonly summary?: DashboardSummary['equipmentSummary'];
  readonly available: boolean;
  readonly loading?: boolean;
}

export function EquipmentSummaryCards({
  summary,
  available,
  loading = false,
}: EquipmentSummaryCardsProps) {
  const total = available && summary ? summary.total : null;
  const availableCount = available && summary ? summary.byStatus.AVAILABLE : null;
  const attentionCount =
    available && summary
      ? summary.byStatus.MAINTENANCE +
        summary.byStatus.UNDER_EVALUATION +
        summary.byStatus.UNAVAILABLE
      : null;

  const metrics = [
    {
      label: 'Equipamentos',
      value: loading ? '...' : total !== null ? String(total) : '—',
      detail: available ? 'ativos cadastrados' : 'dados indisponíveis',
      tone: 'brand',
    },
    {
      label: 'Disponíveis',
      value: loading ? '...' : availableCount !== null ? String(availableCount) : '—',
      detail: available ? 'prontos para operação' : 'dados indisponíveis',
      tone: 'neutral',
    },
    {
      label: 'Precisam de atenção',
      value: loading ? '...' : attentionCount !== null ? String(attentionCount) : '—',
      detail: available ? 'manutenção, avaliação ou indisponíveis' : 'dados indisponíveis',
      tone: attentionCount !== null && attentionCount > 0 ? 'warning' : 'neutral',
    },
  ] as const;

  return (
    <section aria-label="Indicadores operacionais" className="metric-grid">
      {metrics.map((metric) => (
        <article className={`metric-card metric-card--${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </article>
      ))}
    </section>
  );
}
