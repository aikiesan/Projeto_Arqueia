import type { FieldReportSummary } from '@arqueia/contracts';

import type { FieldReportCountRow } from './ports/field-report-repository.port.js';

/**
 * Compila as contagens agregadas no resumo da página de informes.
 *
 * "Em aberto" é tudo que ainda não foi resolvido (NEW e IN_REVIEW). Função
 * pura: o banco só agrupa, a regra do que conta como aberto mora aqui.
 */
export function summarizeFieldReports(
  laboratoryId: string,
  rows: readonly FieldReportCountRow[],
): FieldReportSummary {
  const summary: FieldReportSummary = {
    laboratoryId,
    openByKind: {
      EQUIPMENT_PROBLEM: 0,
      MAINTENANCE_REQUEST: 0,
      SUPPLY_USAGE: 0,
      GENERAL_SUPPORT: 0,
    },
    byStatus: { NEW: 0, IN_REVIEW: 0, RESOLVED: 0 },
    openBlockingUse: 0,
  };

  for (const row of rows) {
    summary.byStatus[row.status] += row.count;
    if (row.status === 'RESOLVED') continue;
    summary.openByKind[row.kind] += row.count;
    if (row.blocksUse) summary.openBlockingUse += row.count;
  }

  return summary;
}
