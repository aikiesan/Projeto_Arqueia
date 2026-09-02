import { describe, expect, it, beforeEach } from 'vitest';
import type { AuthenticatedPrincipal } from '@arqueia/contracts';

import { InMemoryEquipmentRepository } from '../../../../test/in-memory/in-memory-equipment-repository.js';
import { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';
import { CreateEquipmentUseCase } from './create-equipment.use-case.js';
import { ListEquipmentUseCase } from './list-equipment.use-case.js';
import { UpdateEquipmentUseCase } from './update-equipment.use-case.js';
import {
  EquipmentConflictError,
  EquipmentNotFoundError,
} from '../domain/equipment.errors.js';

describe('Equipment Domain Real Use Cases & Edge Cases (No Mocks)', () => {
  const labAId = '11111111-1111-4111-a111-111111111111';
  const labBId = '22222222-2222-4222-a222-222222222222';
  const catalogOptionId = '33333333-3333-4333-a333-333333333333';
  const userId = '44444444-4444-4444-a444-444444444444';

  function createPrincipal(
    role: 'ADMIN' | 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS',
    laboratoryId = labAId,
  ): AuthenticatedPrincipal {
    const isSystemAdmin = role === 'ADMIN';
    return {
      user: {
        id: userId,
        institutionId: 'inst-1',
        name: 'Técnico Responsável',
        email: 'tecnico@arqueia.local',
        supervisorUserId: null,
        status: 'ACTIVE',
        identityProvider: 'LOCAL',
        createdAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        archivedAt: null,
      },
      memberships: isSystemAdmin
        ? []
        : [
            {
              id: 'm-1',
              userId,
              laboratoryId,
              role: role as 'TECNICO' | 'USUARIO' | 'RESPONSAVEL_CONTROLADOS',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ],
      systemRoles: isSystemAdmin
        ? [
            {
              id: 'sr-1',
              userId,
              role: 'ADMIN',
              createdAt: '2026-08-14T00:00:00.000Z',
              updatedAt: '2026-08-14T00:00:00.000Z',
              archivedAt: null,
            },
          ]
        : [],
    };
  }

  let repository: InMemoryEquipmentRepository;
  let permissions: PermissionEvaluator;
  const context = { origin: 'api:test', requestId: 'req-eq-123' };

  beforeEach(() => {
    repository = new InMemoryEquipmentRepository();
    permissions = new PermissionEvaluator();
  });

  describe('Equipment Creation & Listing', () => {
    it('creates equipment and lists with search and status filtering', async () => {
      const createUseCase = new CreateEquipmentUseCase(repository, permissions);
      const listUseCase = new ListEquipmentUseCase(repository, permissions);
      const gestor = createPrincipal('TECNICO');

      const eq1 = await createUseCase.execute(
        gestor,
        {
          laboratoryId: labAId,
          catalogOptionId,
          code: 'EQ-HACH-DR6000',
          name: 'Espectrofotômetro UV-Vis Hach DR6000',
          assetTag: 'FAPESP-2018-002',
          serialNumber: 'SN-DR6000-01',
          reservationPolicy: {
            maxReservationMinutes: 480,
            requiresTraining: true,
            requiresApproval: false,
            absenceReleaseMinutes: 30,
          },
          notes: 'Equipamento analítico UV-Vis FAPESP',
        },
        context,
      );

      const eq2 = await createUseCase.execute(
        gestor,
        {
          laboratoryId: labAId,
          catalogOptionId,
          code: 'EQ-ADAMO-F2DM',
          name: 'Forno Mufla Microprocessado Adamo F2-DM',
          assetTag: 'FAPESP-2018-001',
          serialNumber: 'SN-F2DM-01',
          reservationPolicy: {
            maxReservationMinutes: 720,
            requiresTraining: true,
            requiresApproval: false,
            absenceReleaseMinutes: 30,
          },
        },
        context,
      );

      expect(eq1.id).toBeDefined();
      expect(eq1.status).toBe('AVAILABLE');
      expect(eq2.id).toBeDefined();

      // List all in labA
      const all = await listUseCase.execute(gestor, { laboratoryId: labAId, limit: 10 });
      expect(all.items).toHaveLength(2);

      // Search equipment by partial text
      const search = await listUseCase.execute(gestor, {
        laboratoryId: labAId,
        search: 'Mufla',
        limit: 10,
      });
      expect(search.items).toHaveLength(1);
      expect(search.items[0]!.code).toBe('EQ-ADAMO-F2DM');

      // Search by asset tag
      const searchTag = await listUseCase.execute(gestor, {
        laboratoryId: labAId,
        search: 'FAPESP-2018-002',
        limit: 10,
      });
      expect(searchTag.items).toHaveLength(1);
      expect(searchTag.items[0]!.code).toBe('EQ-HACH-DR6000');
    });

    it('rejects duplicate equipment code in the same laboratory', async () => {
      const createUseCase = new CreateEquipmentUseCase(repository, permissions);
      const gestor = createPrincipal('TECNICO');

      await createUseCase.execute(
        gestor,
        {
          laboratoryId: labAId,
          catalogOptionId,
          code: 'EQ-SHIMADZU-GC2030',
          name: 'Cromatógrafo Gasoso Shimadzu GC-2030NS',
        },
        context,
      );

      await expect(
        createUseCase.execute(
          gestor,
          {
            laboratoryId: labAId,
            catalogOptionId,
            code: 'EQ-SHIMADZU-GC2030',
            name: 'Cromatógrafo Duplicado',
          },
          context,
        ),
      ).rejects.toBeInstanceOf(EquipmentConflictError);
    });

    it('allows same equipment code in a different laboratory', async () => {
      const createUseCase = new CreateEquipmentUseCase(repository, permissions);
      const admin = createPrincipal('ADMIN');

      const eq1 = await createUseCase.execute(
        admin,
        {
          laboratoryId: labAId,
          catalogOptionId,
          code: 'EQ-CITUA-BIO1',
          name: 'Biodigestor 5L Citua - Lab A',
        },
        context,
      );

      const eq2 = await createUseCase.execute(
        admin,
        {
          laboratoryId: labBId,
          catalogOptionId,
          code: 'EQ-CITUA-BIO1',
          name: 'Biodigestor 5L Citua - Lab B',
        },
        context,
      );

      expect(eq1.id).not.toBe(eq2.id);
      expect(eq1.laboratoryId).toBe(labAId);
      expect(eq2.laboratoryId).toBe(labBId);
    });
  });

  describe('Equipment Updates & State Transitions', () => {
    it('updates status through the maintenance lifecycle', async () => {
      const createUseCase = new CreateEquipmentUseCase(repository, permissions);
      const updateUseCase = new UpdateEquipmentUseCase(repository, permissions);
      const gestor = createPrincipal('TECNICO');

      const eq = await createUseCase.execute(
        gestor,
        {
          laboratoryId: labAId,
          catalogOptionId,
          code: 'EQ-LIMA-ANAER1',
          name: 'Reator Anaeróbio M. Lima',
        },
        context,
      );

      expect(eq.status).toBe('AVAILABLE');

      // Put in maintenance
      const inMaint = await updateUseCase.execute(
        gestor,
        eq.id,
        {
          status: 'MAINTENANCE',
          notes: 'Preventiva semestral de vedação e calibração de sensores',
        },
        context,
      );
      expect(inMaint.status).toBe('MAINTENANCE');
      expect(inMaint.notes).toBe('Preventiva semestral de vedação e calibração de sensores');

      // Return to evaluation
      const inEval = await updateUseCase.execute(
        gestor,
        eq.id,
        { status: 'UNDER_EVALUATION' },
        context,
      );
      expect(inEval.status).toBe('UNDER_EVALUATION');

      // Return to available
      const backAvailable = await updateUseCase.execute(
        gestor,
        eq.id,
        { status: 'AVAILABLE' },
        context,
      );
      expect(backAvailable.status).toBe('AVAILABLE');
    });

    it('rejects update for non-existent equipment', async () => {
      const updateUseCase = new UpdateEquipmentUseCase(repository, permissions);
      const gestor = createPrincipal('TECNICO');

      await expect(
        updateUseCase.execute(
          gestor,
          '00000000-0000-0000-0000-000000000000',
          { name: 'Equipamento Fantasma' },
          context,
        ),
      ).rejects.toBeInstanceOf(EquipmentNotFoundError);
    });

    it('enforces reservation policy updates', async () => {
      const createUseCase = new CreateEquipmentUseCase(repository, permissions);
      const updateUseCase = new UpdateEquipmentUseCase(repository, permissions);
      const gestor = createPrincipal('TECNICO');

      const eq = await createUseCase.execute(
        gestor,
        {
          laboratoryId: labAId,
          catalogOptionId,
          code: 'EQ-GERHARDT-VAP450',
          name: 'Destilador Kjeldahl VAPODEST 450',
        },
        context,
      );

      const updated = await updateUseCase.execute(
        gestor,
        eq.id,
        {
          reservationPolicy: {
            maxReservationMinutes: 360,
            requiresTraining: true,
            requiresApproval: true,
            absenceReleaseMinutes: 15,
          },
        },
        context,
      );

      expect(updated.reservationPolicy.maxReservationMinutes).toBe(360);
      expect(updated.reservationPolicy.requiresApproval).toBe(true);
      expect(updated.reservationPolicy.absenceReleaseMinutes).toBe(15);
    });
  });
});
