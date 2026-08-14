import {
  dashboardSummarySchema,
  type AuthenticatedPrincipal,
  type DashboardQuickAction,
  type DashboardSummary,
} from '@arqueia/contracts';

import type {
  DashboardSectionAccess,
  ManagementRepository,
} from '../domain/ports/management-repository.port.js';
import type { PermissionEvaluator } from '../../identity/domain/services/permission-evaluator.js';

export class GetDashboardSummaryUseCase {
  public constructor(
    private readonly repository: ManagementRepository,
    private readonly permissions: PermissionEvaluator,
  ) {}

  public async execute(
    principal: AuthenticatedPrincipal,
    laboratoryId: string,
  ): Promise<DashboardSummary> {
    this.permissions.assertCan(principal, 'identity.laboratory.read', laboratoryId);

    const access: DashboardSectionAccess = {
      equipment: this.permissions.can(principal, 'equipment.read', laboratoryId),
      scheduling:
        this.permissions.can(principal, 'scheduling.reserve', laboratoryId) ||
        this.permissions.can(principal, 'scheduling.approve', laboratoryId),
      inventory: this.permissions.can(principal, 'inventory.read', laboratoryId),
      maintenance: this.permissions.can(principal, 'equipment.manage', laboratoryId),
    };

    const summary = await this.repository.getDashboardSummary(laboratoryId, access);
    return dashboardSummarySchema.parse({
      ...summary,
      quickActions: this.buildQuickActions(laboratoryId, access),
    });
  }

  private buildQuickActions(
    laboratoryId: string,
    access: DashboardSectionAccess,
  ): DashboardQuickAction[] {
    const query = `?laboratory=${encodeURIComponent(laboratoryId)}`;
    const actions: DashboardQuickAction[] = [];

    if (access.scheduling) {
      actions.push({ id: 'scheduling', label: 'Agenda e reservas', href: `/agenda${query}` });
    }
    if (access.inventory) {
      actions.push({ id: 'inventory', label: 'Consultar estoque', href: `/estoque${query}` });
    }
    if (access.equipment) {
      actions.push({ id: 'equipment', label: 'Ver equipamentos', href: `/equipamentos${query}` });
    }

    return actions;
  }
}
