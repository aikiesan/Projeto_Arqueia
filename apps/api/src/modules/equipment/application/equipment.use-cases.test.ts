import type {
  AuthenticatedPrincipal,
  CreateEquipmentInput,
  Equipment,
} from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { EquipmentNotFoundError } from '../domain/equipment.errors.js';
import type { EquipmentRepository } from '../domain/ports/equipment-repository.port.js';
import { CreateEquipmentUseCase } from './create-equipment.use-case.js';
import { ListEquipmentUseCase } from './list-equipment.use-case.js';
import { UpdateEquipmentUseCase } from './update-equipment.use-case.js';

const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';
const equipmentId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const userId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const principal = { user: { id: userId } } as AuthenticatedPrincipal;
const equipment = { id: equipmentId, laboratoryId } as Equipment;
const context = { origin: 'api:http', requestId: null };

function repository(overrides: Partial<EquipmentRepository> = {}): EquipmentRepository {
  return {
    list: vi.fn(),
    findActiveById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function permissions() {
  return { assertCan: vi.fn() } as unknown as PermissionEvaluator;
}

describe('equipment use cases', () => {
  it('authorizes laboratory-scoped listing before querying', async () => {
    const repo = repository({
      list: vi.fn().mockResolvedValue({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
    });
    const policy = permissions();
    const query = { laboratoryId, limit: 25 };

    await new ListEquipmentUseCase(repo, policy).execute(principal, query);

    expect(policy.assertCan).toHaveBeenCalledWith(principal, 'equipment.read', laboratoryId);
    expect(repo.list).toHaveBeenCalledWith(query);
  });

  it('adds the authenticated actor to an authorized creation', async () => {
    const repo = repository({ create: vi.fn().mockResolvedValue(equipment) });
    const policy = permissions();
    const input = {
      laboratoryId,
      catalogOptionId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      code: 'EQ-01',
      name: 'Equipamento principal',
    } satisfies CreateEquipmentInput;

    await new CreateEquipmentUseCase(repo, policy).execute(principal, input, context);

    expect(policy.assertCan).toHaveBeenCalledWith(principal, 'equipment.manage', laboratoryId);
    expect(repo.create).toHaveBeenCalledWith(input, { ...context, actorId: userId });
  });

  it('does not authorize or update an unknown equipment id', async () => {
    const repo = repository({ findActiveById: vi.fn().mockResolvedValue(null) });
    const policy = permissions();

    await expect(
      new UpdateEquipmentUseCase(repo, policy).execute(
        principal,
        equipmentId,
        { name: 'Novo nome' },
        context,
      ),
    ).rejects.toBeInstanceOf(EquipmentNotFoundError);
    expect(policy.assertCan).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
