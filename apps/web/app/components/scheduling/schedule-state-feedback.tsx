import React from 'react';

import type { ScheduleFeedbackState } from './types';

export interface ScheduleStateFeedbackProps {
  readonly state: Exclude<ScheduleFeedbackState, 'ready'>;
  readonly title?: string | undefined;
  readonly message?: string | undefined;
  readonly onRetry?: (() => void) | undefined;
  readonly className?: string | undefined;
}

export function ScheduleStateFeedback({
  state,
  title,
  message,
  onRetry,
  className = '',
}: ScheduleStateFeedbackProps) {
  if (state === 'loading') {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className={`schedule-feedback schedule-feedback--loading ${className}`}
        role="status"
      >
        <div aria-hidden="true" className="schedule-loading-spinner" />
        <div className="schedule-feedback-content">
          <h3 className="schedule-feedback-title">
            {title ?? 'Carregando agenda...'}
          </h3>
          <p className="schedule-feedback-message">
            {message ?? 'Buscando os compromissos e bloqueios do período.'}
          </p>
        </div>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div
        aria-live="polite"
        className={`schedule-feedback schedule-feedback--empty ${className}`}
        role="status"
      >
        <div aria-hidden="true" className="schedule-feedback-icon">
          📅
        </div>
        <div className="schedule-feedback-content">
          <h3 className="schedule-feedback-title">
            {title ?? 'Nenhum compromisso encontrado'}
          </h3>
          <p className="schedule-feedback-message">
            {message ?? 'Não há reservas ou bloqueios técnicos registrados para este período.'}
          </p>
        </div>
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div
        aria-live="polite"
        className={`schedule-feedback schedule-feedback--unavailable ${className}`}
        role="status"
      >
        <div aria-hidden="true" className="schedule-feedback-icon">
          ⚠️
        </div>
        <div className="schedule-feedback-content">
          <h3 className="schedule-feedback-title">
            {title ?? 'Agenda temporariamente indisponível'}
          </h3>
          <p className="schedule-feedback-message">
            {message ?? 'Não foi possível carregar a grade de horários no momento.'}
          </p>
          {onRetry && (
            <button
              className="schedule-feedback-retry-btn"
              onClick={onRetry}
              type="button"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div
      aria-live="assertive"
      className={`schedule-feedback schedule-feedback--error ${className}`}
      role="alert"
    >
      <div aria-hidden="true" className="schedule-feedback-icon">
        ⛔
      </div>
      <div className="schedule-feedback-content">
        <h3 className="schedule-feedback-title">
          {title ?? 'Erro ao carregar a agenda'}
        </h3>
        <p className="schedule-feedback-message">
          {message ?? 'Ocorreu uma falha ao consultar os dados de agendamento.'}
        </p>
        {onRetry && (
          <button
            className="schedule-feedback-retry-btn"
            onClick={onRetry}
            type="button"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
