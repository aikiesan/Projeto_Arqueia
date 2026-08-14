import type { ScheduleItem, TechnicalBlockReason } from '@arqueia/contracts';
import React, { useEffect, useMemo, useRef } from 'react';

export interface ScheduleDetailsDrawerProps {
  readonly item: ScheduleItem | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly timezone: string;
  readonly onCancelItem?: ((item: ScheduleItem) => void) | undefined;
  readonly isCancelling?: boolean | undefined;
  readonly className?: string | undefined;
}

const blockReasonFriendlyNames: Record<TechnicalBlockReason, string> = {
  MAINTENANCE: 'Manutenção Preventiva / Corretiva',
  CALIBRATION: 'Calibração / Ajuste Técnico',
  INTERRUPTED_SERVICE: 'Interrupção Técnica de Serviço',
  OTHER: 'Outro Bloqueio Operacional',
};

export function ScheduleDetailsDrawer({
  item,
  isOpen,
  onClose,
  timezone,
  onCancelItem,
  isCancelling = false,
  className = '',
}: ScheduleDetailsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const formattedTimes = useMemo(() => {
    if (!item) return null;
    try {
      const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
      });

      const startDate = new Date(item.startsAt);
      const endDate = new Date(item.endsAt);

      const dateStr = dateFormatter.format(startDate);
      const startTimeStr = timeFormatter.format(startDate);
      const endTimeStr = timeFormatter.format(endDate);

      return {
        date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        time: `${startTimeStr} às ${endTimeStr}`,
      };
    } catch {
      return {
        date: item.startsAt,
        time: `${item.startsAt} – ${item.endsAt}`,
      };
    }
  }, [item, timezone]);

  if (!isOpen || !item) {
    return null;
  }

  const isBlock = item.type === 'TECHNICAL_BLOCK';
  const isCancelled = item.status === 'CANCELLED';

  return (
    <div
      aria-labelledby="schedule-drawer-title"
      aria-modal="true"
      className="schedule-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className={`schedule-drawer-container ${className}`}>
        <header className="schedule-drawer-header">
          <div className="schedule-drawer-header-left">
            <span
              className={`schedule-drawer-badge ${isBlock ? 'schedule-drawer-badge--block' : item.isMine ? 'schedule-drawer-badge--mine' : 'schedule-drawer-badge--other'}`}
            >
              {isBlock ? 'Bloqueio Técnico' : item.isMine ? 'Minha Reserva' : 'Reserva'}
            </span>
            <h2 className="schedule-drawer-title" id="schedule-drawer-title">
              {item.title}
            </h2>
          </div>

          <button
            aria-label="Fechar detalhes"
            className="schedule-drawer-close-btn"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="schedule-drawer-content">
          <section className="schedule-drawer-section">
            <h3 className="schedule-drawer-section-heading">Informações Gerais</h3>
            <dl className="schedule-drawer-details-grid">
              <div>
                <dt>Equipamento</dt>
                <dd>{item.equipmentName}</dd>
              </div>

              <div>
                <dt>Data</dt>
                <dd>{formattedTimes?.date}</dd>
              </div>

              <div>
                <dt>Horário</dt>
                <dd>{formattedTimes?.time}</dd>
              </div>

              <div>
                <dt>Status</dt>
                <dd>
                  <span
                    className={`schedule-status-tag ${isCancelled ? 'schedule-status-tag--cancelled' : 'schedule-status-tag--active'}`}
                  >
                    {item.status}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Reservation Details */}
          {item.reservationDetails && (
            <section className="schedule-drawer-section">
              <h3 className="schedule-drawer-section-heading">Detalhes da Reserva</h3>
              <dl className="schedule-drawer-details-grid">
                <div>
                  <dt>Finalidade</dt>
                  <dd>{item.reservationDetails.purpose}</dd>
                </div>

                {item.reservationDetails.userName && (
                  <div>
                    <dt>Solicitante</dt>
                    <dd>{item.reservationDetails.userName}</dd>
                  </div>
                )}

                {item.reservationDetails.projectCode && (
                  <div>
                    <dt>Projeto</dt>
                    <dd>{item.reservationDetails.projectCode}</dd>
                  </div>
                )}

                {typeof item.reservationDetails.sampleCount === 'number' && (
                  <div>
                    <dt>Amostras</dt>
                    <dd>{item.reservationDetails.sampleCount}</dd>
                  </div>
                )}

                {item.reservationDetails.notes && (
                  <div className="schedule-drawer-details-full">
                    <dt>Observações</dt>
                    <dd>{item.reservationDetails.notes}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Technical Block Details */}
          {item.blockDetails && (
            <section className="schedule-drawer-section">
              <h3 className="schedule-drawer-section-heading">Detalhes do Bloqueio</h3>
              <dl className="schedule-drawer-details-grid">
                <div>
                  <dt>Motivo</dt>
                  <dd>
                    {blockReasonFriendlyNames[item.blockDetails.reason] ??
                      item.blockDetails.reason}
                  </dd>
                </div>

                <div className="schedule-drawer-details-full">
                  <dt>Descrição</dt>
                  <dd>{item.blockDetails.description}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>

        <footer className="schedule-drawer-footer">
          {/* Cancel button is ONLY shown if item.canCancel is true */}
          {item.canCancel && onCancelItem && (
            <button
              aria-label={`Cancelar ${isBlock ? 'bloqueio' : 'reserva'}`}
              className="schedule-drawer-btn schedule-drawer-btn--danger"
              disabled={isCancelling}
              onClick={() => onCancelItem(item)}
              type="button"
            >
              {isCancelling
                ? 'Cancelando...'
                : `Cancelar ${isBlock ? 'Bloqueio' : 'Reserva'}`}
            </button>
          )}

          <button
            className="schedule-drawer-btn schedule-drawer-btn--neutral"
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
