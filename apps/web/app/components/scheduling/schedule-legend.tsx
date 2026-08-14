import React from 'react';

export interface ScheduleLegendProps {
  readonly showCancelled?: boolean | undefined;
  readonly className?: string | undefined;
}

export function ScheduleLegend({ showCancelled = false, className = '' }: ScheduleLegendProps) {
  return (
    <aside
      aria-label="Legenda de ocupações da agenda"
      className={`schedule-legend-container ${className}`}
      role="region"
    >
      <div className="schedule-legend-items">
        <div className="schedule-legend-item">
          <span
            aria-hidden="true"
            className="schedule-legend-dot schedule-legend-dot--mine"
          />
          <span className="schedule-legend-label">Minha reserva</span>
        </div>

        <div className="schedule-legend-item">
          <span
            aria-hidden="true"
            className="schedule-legend-dot schedule-legend-dot--other"
          />
          <span className="schedule-legend-label">Outras reservas</span>
        </div>

        <div className="schedule-legend-item">
          <span
            aria-hidden="true"
            className="schedule-legend-dot schedule-legend-dot--block"
          />
          <span className="schedule-legend-label">Bloqueio técnico</span>
        </div>

        {showCancelled && (
          <div className="schedule-legend-item">
            <span
              aria-hidden="true"
              className="schedule-legend-dot schedule-legend-dot--cancelled"
            />
            <span className="schedule-legend-label">Cancelado</span>
          </div>
        )}
      </div>
    </aside>
  );
}
