import type { AuthenticatedPrincipal, Laboratory, LaboratoryRole } from '@arqueia/contracts';
import { describe, expect, it } from 'vitest';

import { createWorkspacePresentation } from './presentation';

const metadata = {
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
} as const;

const cp2b: Laboratory = {
  ...metadata,
  id: '11111111-1111-4111-a111-111111111111',
  institutionId: '22222222-2222-4222-a222-222222222222',
  name: 'Laboratório CP2b',
  code: 'CP2b',
  timezone: 'America/Sao_Paulo',
};

const other: Laboratory = { ...cp2b, id: '33333333-3333-4333-a333-333333333333', code: 'LMU', name: 'LMU' };

function principal(role: LaboratoryRole, laboratoryId = cp2b.id): AuthenticatedPrincipal {
  return {
    user: {
      ...metadata,
      id: '44444444-4444-4444-a444-444444444444',
      institutionId: cp2b.institutionId,
      loginCode: 'ARQ-TESTE-01',
      name: 'Pessoa Teste',
      email: 'pessoa@unicamp.br',
      academicCategory: 'POS_DOUTORADO',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
    memberships: [
      { ...metadata, id: '55555555-5555-4555-a555-555555555555', userId: '44444444-4444-4444-a444-444444444444', laboratoryId, role },
    ],
    systemRoles: [],
  };
}

describe('createWorkspacePresentation — Informar e notificações', () => {
  it('a ação Informar abre o formulário já no laboratório ativo, para qualquer papel', () => {
    for (const role of ['USUARIO', 'TECNICO', 'GESTOR_ACESSO_CP2B'] as const) {
      const presentation = createWorkspacePresentation(principal(role), [cp2b, other], cp2b.id);
      expect(presentation.reportAction).toEqual({
        href: `/informar?laboratory=${cp2b.id}`,
        label: 'Informar',
      });
    }
  });

  it('só a coordenação do laboratório ativo recebe notificações de informes', () => {
    expect(
      createWorkspacePresentation(principal('GESTOR_ACESSO_CP2B'), [cp2b], cp2b.id).notificationScope,
    ).toEqual({ laboratoryId: cp2b.id, canReviewFieldReports: true });
    expect(
      createWorkspacePresentation(principal('USUARIO'), [cp2b], cp2b.id).notificationScope
        .canReviewFieldReports,
    ).toBe(false);
    expect(
      createWorkspacePresentation(principal('GESTOR_ACESSO_CP2B', other.id), [cp2b, other], cp2b.id)
        .notificationScope.canReviewFieldReports,
    ).toBe(false);
  });
});

describe('createWorkspacePresentation — Boas Práticas no menu lateral', () => {
  it('todo papel vê Boas Práticas logo antes do Guia de Uso, no laboratório ativo', () => {
    for (const role of ['USUARIO', 'TECNICO', 'GESTOR_ACESSO_CP2B'] as const) {
      const { moduleNavigation } = createWorkspacePresentation(principal(role), [cp2b, other], cp2b.id);
      const labels = moduleNavigation.map((item) => item.label);
      const index = labels.indexOf('Boas Práticas');

      expect(moduleNavigation[index]).toEqual({
        description: 'Segurança no laboratório',
        href: `/seguranca?laboratory=${cp2b.id}`,
        icon: 'seguranca',
        label: 'Boas Práticas',
      });
      expect(labels[index + 1]).toBe('Guia de Uso');
    }
  });
});
