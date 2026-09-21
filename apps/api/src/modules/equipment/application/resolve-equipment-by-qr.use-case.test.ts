import type { AuthenticatedPrincipal, Equipment } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { AuthorizationDeniedError } from '../../identity/domain/errors/authorization-denied.error.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { EquipmentNotFoundError } from '../domain/equipment.errors.js';
import type { EquipmentRepository } from '../domain/ports/equipment-repository.port.js';
import { ResolveEquipmentByQrUseCase } from './resolve-equipment-by-qr.use-case.js';

const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const equipmentId = '8f555951-9dc0-41d1-b245-5ffdce74fad2';
const principal = { user: { id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8' } } as AuthenticatedPrincipal;
const equipment = { id: equipmentId, laboratoryId, code: 'CP2b-HPLC-01' } as Equipment;

function repository(overrides: Partial<EquipmentRepository> = {}): EquipmentRepository {
  return {
    list: vi.fn(),
    findActiveById: vi.fn(),
    findActiveByQrIdentifier: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function permissions(allowed = true) {
  return {
    assertCan: vi.fn(() => {
      if (!allowed) throw new AuthorizationDeniedError();
    }),
  } as unknown as PermissionEvaluator;
}

describe('ResolveEquipmentByQrUseCase', () => {
  it('resolve a etiqueta impressa sem receber laboratório do cliente', async () => {
    const findActiveByQrIdentifier = vi.fn().mockResolvedValue(equipment);
    const repo = repository({ findActiveByQrIdentifier });
    const permission = permissions();

    const resolved = await new ResolveEquipmentByQrUseCase(repo, permission).execute(
      principal,
      `https://cp2b.unicamp.br/arqueia/qr?code=${encodeURIComponent(`ARQ-EQP-${equipmentId}`)}`,
    );

    expect(findActiveByQrIdentifier).toHaveBeenCalledWith(equipmentId);
    expect(resolved).toBe(equipment);
  });

  it('autoriza pelo laboratório do equipamento resolvido, não por um informado', async () => {
    const repo = repository({ findActiveByQrIdentifier: vi.fn().mockResolvedValue(equipment) });
    const permission = permissions();

    await new ResolveEquipmentByQrUseCase(repo, permission).execute(
      principal,
      `ARQ-EQP-${equipmentId}`,
    );

    expect(permission.assertCan).toHaveBeenCalledWith(principal, 'equipment.read', laboratoryId);
  });

  it('nega quando o solicitante não pode ler o laboratório do equipamento', async () => {
    const repo = repository({ findActiveByQrIdentifier: vi.fn().mockResolvedValue(equipment) });

    await expect(
      new ResolveEquipmentByQrUseCase(repo, permissions(false)).execute(
        principal,
        `ARQ-EQP-${equipmentId}`,
      ),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
  });

  it('resolve também o código canônico, que a etiqueta classifica como UNKNOWN', async () => {
    const findActiveByQrIdentifier = vi.fn().mockResolvedValue(equipment);
    const repo = repository({ findActiveByQrIdentifier });

    await new ResolveEquipmentByQrUseCase(repo, permissions()).execute(principal, 'CP2b-HPLC-01');

    expect(findActiveByQrIdentifier).toHaveBeenCalledWith('CP2b-HPLC-01');
  });

  it('não procura equipamento quando a etiqueta é de lote', async () => {
    const findActiveByQrIdentifier = vi.fn();
    const repo = repository({ findActiveByQrIdentifier });

    await expect(
      new ResolveEquipmentByQrUseCase(repo, permissions()).execute(principal, 'ARQ-LOT-LOTE-2026-A'),
    ).rejects.toBeInstanceOf(EquipmentNotFoundError);
    expect(findActiveByQrIdentifier).not.toHaveBeenCalled();
  });

  it('não autoriza nada quando o equipamento não existe', async () => {
    const repo = repository({ findActiveByQrIdentifier: vi.fn().mockResolvedValue(null) });
    const permission = permissions();

    await expect(
      new ResolveEquipmentByQrUseCase(repo, permission).execute(principal, `ARQ-EQP-${equipmentId}`),
    ).rejects.toBeInstanceOf(EquipmentNotFoundError);
    expect(permission.assertCan).not.toHaveBeenCalled();
  });
});
