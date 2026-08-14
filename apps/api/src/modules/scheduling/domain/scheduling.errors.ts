export class ReservationConflictError extends Error {
  public readonly code = 'RESERVATION_SLOT_CONFLICT' as const;

  public constructor(
    public readonly startsAt?: string,
    public readonly endsAt?: string,
    public readonly slotType: 'RESERVATION' | 'TECHNICAL_BLOCK' = 'RESERVATION',
  ) {
    super('O equipamento já está ocupado no horário selecionado.');
    this.name = 'ReservationConflictError';
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
