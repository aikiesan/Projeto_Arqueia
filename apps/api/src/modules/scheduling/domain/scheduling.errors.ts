export class ReservationConflictError extends Error {
  public readonly code = 'RESERVATION_SLOT_CONFLICT' as const;

  public constructor(
    public readonly startsAt: string,
    public readonly endsAt: string,
  ) {
    super('O equipamento já está ocupado no horário selecionado.');
    this.name = 'ReservationConflictError';
  }
}

export class ScheduleResultLimitExceededError extends Error {
  public constructor(public readonly limit: number) {
    super(`A consulta excedeu o limite de ${limit} itens. Reduza o intervalo ou filtre por equipamento.`);
    this.name = 'ScheduleResultLimitExceededError';
  }
}

export class InvalidReservationProjectError extends Error {
  public constructor() {
    super('O projeto informado não está ativo neste laboratório.');
    this.name = 'InvalidReservationProjectError';
  }
}

export class EquipmentTrainingRequiredError extends Error {
  public readonly code = 'EQUIPMENT_TRAINING_REQUIRED' as const;

  public constructor() {
    super('Este equipamento exige habilitação de treinamento ainda não registrada no Arqueia.');
    this.name = 'EquipmentTrainingRequiredError';
  }
}

export class ReservationApprovalRequiredError extends Error {
  public readonly code = 'RESERVATION_APPROVAL_REQUIRED' as const;

  public constructor() {
    super('Este equipamento exige aprovação técnica, cujo fluxo ainda não está disponível.');
    this.name = 'ReservationApprovalRequiredError';
  }
}

export class SchedulingStartsInPastError extends Error {
  public readonly code = 'SCHEDULING_STARTS_IN_PAST' as const;

  public constructor() {
    super('O início do agendamento deve estar no futuro.');
    this.name = 'SchedulingStartsInPastError';
  }
}

export class ReservationNotFoundError extends Error {
  public constructor(public readonly reservationId: string) {
    super(`Reserva ${reservationId} não foi encontrada.`);
    this.name = 'ReservationNotFoundError';
  }
}

export class ReservationCancellationNoticeError extends Error {
  public constructor() {
    super('Cancelamento direto só é permitido com no mínimo 30 minutos de antecedência.');
    this.name = 'ReservationCancellationNoticeError';
  }
}

export class TechnicalBlockNotFoundError extends Error {
  public constructor(public readonly technicalBlockId: string) {
    super(`Bloqueio técnico ${technicalBlockId} não foi encontrado.`);
    this.name = 'TechnicalBlockNotFoundError';
  }
}

export class EquipmentUnavailableError extends Error {
  public constructor(public readonly status: string) {
    super(`Equipamento indisponível para reserva no momento (status: ${status}).`);
    this.name = 'EquipmentUnavailableError';
  }
}
