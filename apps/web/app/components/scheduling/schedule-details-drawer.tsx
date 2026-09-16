import type { ScheduleItem, TechnicalBlockReason } from '@arqueia/contracts';
import React, { useEffect, useId, useMemo, useRef } from 'react';

export interface ScheduleDetailsDrawerProps {
  readonly item: ScheduleItem | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly timezone: string;
  readonly errorMessage?: string | null;
  readonly onCancelItem?: ((item: ScheduleItem) => void) | undefined;
  readonly isCancelling?: boolean | undefined;
  readonly onCheckInItem?: ((item: ScheduleItem) => void) | undefined;
  readonly isCheckingIn?: boolean | undefined;
  readonly onCompleteItem?: ((item: ScheduleItem) => void) | undefined;
  readonly isCompleting?: boolean | undefined;
  readonly className?: string | undefined;
}

const blockReasonFriendlyNames: Record<TechnicalBlockReason, string> = {
  MAINTENANCE: 'Manutenção Preventiva / Corretiva',
  CALIBRATION: 'Calibração / Ajuste Técnico',
  INTERRUPTED_SERVICE: 'Interrupção Técnica de Serviço',
  OTHER: 'Outro Bloqueio Operacional',
};

const statusFriendlyNames: Record<ScheduleItem['status'], string> = {
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'Em Andamento',
  ACTIVE: 'Ativo',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluído',
  RELEASED_ABSENCE: 'Liberada por Ausência',
};

export function ScheduleDetailsDrawer({
  item,
  isOpen,
  onClose,
  timezone,
  errorMessage = null,
  onCancelItem,
  isCancelling = false,
  onCheckInItem,
  isCheckingIn = false,
  onCompleteItem,
  isCompleting = false,
  className = '',
}: ScheduleDetailsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      const first = focusableElements[0];
      const last = focusableElements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialogRef.current?.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
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
  const isCancelled = item.status === 'CANCELLED' || item.status === 'RELEASED_ABSENCE';
  const isInProgress = item.status === 'IN_PROGRESS';

  return (
    <div
      className="schedule-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`schedule-drawer-container ${className}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="schedule-drawer-header">
          <div className="schedule-drawer-header-left">
            <span
              className={`schedule-drawer-badge ${
                isBlock
                  ? 'schedule-drawer-badge--block'
                  : isInProgress
                  ? 'schedule-drawer-badge--in-progress'
                  : item.isMine
                  ? 'schedule-drawer-badge--mine'
                  : 'schedule-drawer-badge--other'
              }`}
            >
              {isBlock
                ? 'Bloqueio Técnico'
                : isInProgress
                ? 'Em Execução'
                : item.isMine
                ? 'Minha Reserva'
                : 'Reserva'}
            </span>
            <h2 className="schedule-drawer-title" id={titleId}>
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

              {!isBlock && (
                <div>
                  <dt>Reservado por</dt>
                  <dd>{item.reservedBy ?? 'Não informado'}</dd>
                </div>
              )}

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
                    className={`schedule-status-tag ${
                      isCancelled
                        ? 'schedule-status-tag--cancelled'
                        : isInProgress
                        ? 'schedule-status-tag--in-progress'
                        : 'schedule-status-tag--active'
                    }`}
                  >
                    {statusFriendlyNames[item.status]}
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
                {item.reservationDetails.purpose && (
                  <div>
                    <dt>Finalidade</dt>
                    <dd>{item.reservationDetails.purpose}</dd>
                  </div>
                )}

                {item.reservationDetails.projectLabel && (
                  <div>
                    <dt>Projeto (texto livre)</dt>
                    <dd>{item.reservationDetails.projectLabel}</dd>
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

                {item.reservationDetails.startedAt && (
                  <div>
                    <dt>Início Real (Check-In)</dt>
                    <dd>{new Date(item.reservationDetails.startedAt).toLocaleTimeString('pt-BR')}</dd>
                  </div>
                )}

                {item.reservationDetails.completedAt && (
                  <div>
                    <dt>Conclusão Real</dt>
                    <dd>{new Date(item.reservationDetails.completedAt).toLocaleTimeString('pt-BR')}</dd>
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

        {errorMessage ? (
          <p className="form-error equipment-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <footer className="schedule-drawer-footer">
          {/* Check-In Button */}
          {item.canCheckIn && onCheckInItem && (
            <button
              aria-label="Fazer check-in e iniciar uso do equipamento"
              className="schedule-drawer-btn schedule-drawer-btn--primary"
              disabled={isCheckingIn}
              onClick={() => onCheckInItem(item)}
              type="button"
            >
              {isCheckingIn ? 'Iniciando...' : '▶ Iniciar Uso (Check-In)'}
            </button>
          )}

          {/* Complete Usage Button */}
          {item.canComplete && onCompleteItem && (
            <button
              aria-label="Finalizar e concluir uso do equipamento"
              className="schedule-drawer-btn schedule-drawer-btn--complete"
              disabled={isCompleting}
              onClick={() => onCompleteItem(item)}
              type="button"
            >
              {isCompleting ? 'Finalizando...' : '✓ Finalizar Uso'}
            </button>
          )}

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
