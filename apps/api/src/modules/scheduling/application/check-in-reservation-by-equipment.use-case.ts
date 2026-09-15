import type {
  AuthenticatedPrincipal,
  CheckInByEquipmentInput,
  Reservation,
} from '@arqueia/contracts';

import type {
  SchedulingMutationContext,
  SchedulingRepository,
} from '../domain/ports/scheduling-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

/**
 * Check-in pela leitura do QR do equipamento: o sistema resolve qual é a reserva
 * ativa do próprio ator naquele equipamento, em vez de receber um reservationId.
 *
 * Exige apenas 'scheduling.reserve' — nenhuma permissão nova. Note que
 * 'scheduling.approve' deliberadamente NÃO amplia a busca aqui (ver a porta).
 */
export class CheckInReservationByEquipmentUseCase {
  public constructor(
    private readonly repository: SchedulingRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public execute(
    principal: AuthenticatedPrincipal,
    input: CheckInByEquipmentInput,
    context: Omit<SchedulingMutationContext, 'actorId'>,
  ): Promise<Reservation> {
    this.permissions.assertCan(principal, 'scheduling.reserve', input.laboratoryId);

    return this.repository.checkInReservationByEquipment(input.laboratoryId, input.equipmentId, {
      ...context,
      actorId: principal.user.id,
    });
  }
}
