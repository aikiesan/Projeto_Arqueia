import {
  LABORATORY_ROLE_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  type LaboratoryRole,
  type SystemRole,
} from '@arqueia/contracts';
import type { DatabasePool } from '@arqueia/database';

import type {
  FieldReportAlertRecipient,
  FieldReportAlertRecipientReader,
} from '../domain/ports/urgent-field-report-alert.port.js';

const REVIEW_PERMISSION = 'field-report.review';

/**
 * Os papéis são derivados do mapa de permissões, e não escritos à mão aqui.
 *
 * É o que mantém uma verdade só: se amanhã o TECNICO ganhar
 * `field-report.review`, ele passa a receber os alertas sem ninguém lembrar de
 * editar este arquivo — e se perder a permissão, para de receber.
 */
export function laboratoryRolesThatReview(): readonly LaboratoryRole[] {
  return (Object.keys(LABORATORY_ROLE_PERMISSIONS) as LaboratoryRole[]).filter((role) =>
    (LABORATORY_ROLE_PERMISSIONS[role] as readonly string[]).includes(REVIEW_PERMISSION),
  );
}

export function systemRolesThatReview(): readonly SystemRole[] {
  return (Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRole[]).filter((role) =>
    (SYSTEM_ROLE_PERMISSIONS[role] as readonly string[]).includes(REVIEW_PERMISSION),
  );
}

export class PostgresFieldReportAlertRecipientReader implements FieldReportAlertRecipientReader {
  public constructor(private readonly pool: DatabasePool) {}

  public async listForLaboratory(
    laboratoryId: string,
  ): Promise<readonly FieldReportAlertRecipient[]> {
    const laboratoryRoles = laboratoryRolesThatReview();
    const systemRoles = systemRolesThatReview();
    if (laboratoryRoles.length === 0 && systemRoles.length === 0) return [];

    const result = await this.pool.query<{ name: string; email: string }>(
      `SELECT DISTINCT u.name, u.email
         FROM users u
        WHERE u.status = 'ACTIVE'
          AND u.archived_at IS NULL
          AND (
            EXISTS (
              SELECT 1 FROM memberships m
               WHERE m.user_id = u.id
                 AND m.archived_at IS NULL
                 AND m.laboratory_id = $1
                 AND m.role = ANY($2::text[])
            )
            OR EXISTS (
              SELECT 1 FROM system_role_assignments s
               WHERE s.user_id = u.id
                 AND s.archived_at IS NULL
                 AND s.role = ANY($3::text[])
            )
          )
        ORDER BY u.name`,
      [laboratoryId, [...laboratoryRoles], [...systemRoles]],
    );

    return result.rows.map((row) => ({ name: row.name, email: row.email }));
  }
}
