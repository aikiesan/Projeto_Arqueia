import { parseQrCode, type AuthenticatedPrincipal, type Equipment } from '@arqueia/contracts';

import { EquipmentNotFoundError } from '../domain/equipment.errors.js';
import type { EquipmentRepository } from '../domain/ports/equipment-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

/**
 * Etiqueta de QR → equipamento que o solicitante pode ver.
 *
 * Existe porque a etiqueta não carrega o laboratório: antes disso o cliente
 * precisava adivinhá-lo e varrer páginas de equipamentos procurando o UUID,
 * o que falhava sempre que o equipamento era de outro laboratório ou estava
 * além das primeiras páginas.
 *
 * A ordem importa: resolve primeiro, autoriza depois. É o equipamento que diz a
 * qual laboratório pertence — o cliente nunca informa isso (§4.5 do AGENTS.md).
 */
export class ResolveEquipmentByQrUseCase {
  public constructor(
    private readonly equipment: EquipmentRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(principal: AuthenticatedPrincipal, code: string): Promise<Equipment> {
    const parsed = parseQrCode(code);

    // UNKNOWN entra junto: o código canônico do equipamento (`CP2b-HPLC-01`)
    // não casa com nenhum prefixo de etiqueta e chega classificado assim.
    if (parsed.type !== 'EQUIPMENT' && parsed.type !== 'UNKNOWN') {
      throw new EquipmentNotFoundError(parsed.identifier || code);
    }
    if (!parsed.identifier) throw new EquipmentNotFoundError(code);

    const equipment = await this.equipment.findActiveByQrIdentifier(parsed.identifier);
    if (equipment === null) throw new EquipmentNotFoundError(parsed.identifier);

    this.permissions.assertCan(principal, 'equipment.read', equipment.laboratoryId);
    return equipment;
  }
}
