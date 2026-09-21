import type { DatabasePool } from '../client.js';
import { isDirectExecution, parseArgs, runCli, withPool } from './cli-runtime.js';

/**
 * Auditoria de consistência da agenda.
 *
 * `equipment_occupations` é quem segura o horário — a exclusão por sobreposição
 * vive nela. `reservations` e `technical_blocks` compartilham o mesmo id. Se as
 * duas pontas se separarem, a agenda mente: ou mostra horário ocupado que não
 * existe, ou deixa livre um horário já reservado. Este script procura essas
 * separações; ele **não corrige nada**, só relata.
 */

export interface AgendaFinding {
  readonly check: string;
  readonly severity: 'critico' | 'atencao';
  readonly count: number;
  readonly explanation: string;
  readonly sample: readonly string[];
}

interface CheckDefinition {
  readonly check: string;
  readonly severity: AgendaFinding['severity'];
  readonly explanation: string;
  readonly sql: string;
}

/**
 * Cada consulta devolve `id` e `detalhe`. Nenhuma escreve.
 */
export const AGENDA_CHECKS: readonly CheckDefinition[] = [
  {
    check: 'ocupacao-orfa',
    explanation:
      'Ocupação viva sem reserva nem bloqueio: segura o horário mas ninguém consegue cancelar pela interface.',
    severity: 'critico',
    sql: `SELECT o.id::text AS id,
                 o.starts_at::text || ' → ' || o.ends_at::text AS detalhe
            FROM equipment_occupations o
       LEFT JOIN reservations r ON r.id = o.id
       LEFT JOIN technical_blocks b ON b.id = o.id
           WHERE o.archived_at IS NULL
             AND o.status NOT IN ('CANCELLED', 'RELEASED_ABSENCE')
             AND r.id IS NULL AND b.id IS NULL`,
  },
  {
    check: 'reserva-sem-ocupacao',
    explanation:
      'Reserva viva sem ocupação: não bloqueia o horário, então outra pessoa consegue reservar por cima.',
    severity: 'critico',
    sql: `SELECT r.id::text AS id, r.user_id::text AS detalhe
            FROM reservations r
       LEFT JOIN equipment_occupations o ON o.id = r.id
           WHERE r.archived_at IS NULL AND o.id IS NULL`,
  },
  {
    check: 'ocupacao-de-equipamento-arquivado',
    explanation:
      'Horário vivo preso a equipamento arquivado: some da agenda mas continua bloqueando a grade.',
    severity: 'atencao',
    sql: `SELECT o.id::text AS id, e.code AS detalhe
            FROM equipment_occupations o
            JOIN equipment e ON e.id = o.equipment_id
           WHERE o.archived_at IS NULL
             AND o.status NOT IN ('CANCELLED', 'RELEASED_ABSENCE')
             AND e.archived_at IS NOT NULL`,
  },
  {
    check: 'periodo-divergente',
    explanation:
      'A coluna `period`, que sustenta a exclusão por sobreposição, discorda de starts_at/ends_at.',
    severity: 'critico',
    sql: `SELECT o.id::text AS id,
                 o.period::text || ' ≠ [' || o.starts_at::text || ',' || o.ends_at::text || ')' AS detalhe
            FROM equipment_occupations o
           WHERE o.archived_at IS NULL
             AND o.period IS DISTINCT FROM tstzrange(o.starts_at, o.ends_at, '[)')`,
  },
  {
    check: 'em-andamento-sem-check-in',
    explanation:
      'Reserva marcada como IN_PROGRESS sem `started_at`: o check-in não gravou o horário real.',
    severity: 'atencao',
    sql: `SELECT o.id::text AS id, o.starts_at::text AS detalhe
            FROM equipment_occupations o
            JOIN reservations r ON r.id = o.id
           WHERE o.archived_at IS NULL
             AND o.status = 'IN_PROGRESS'
             AND r.started_at IS NULL`,
  },
  {
    check: 'codigo-de-equipamento-duplicado',
    explanation:
      'Mesmo código em laboratórios diferentes: a etiqueta por código vira ambígua e o servidor recusa resolvê-la. Só o QR com UUID funciona nesses equipamentos.',
    severity: 'atencao',
    sql: `SELECT string_agg(e.id::text, ' / ') AS id,
                 upper(e.code) || ' em ' || count(*)::text || ' laboratórios' AS detalhe
            FROM equipment e
           WHERE e.archived_at IS NULL
        GROUP BY upper(e.code)
          HAVING count(*) > 1`,
  },
];

export async function runAgendaChecks(
  pool: DatabasePool,
  checks: readonly CheckDefinition[] = AGENDA_CHECKS,
  sampleSize = 5,
): Promise<readonly AgendaFinding[]> {
  const findings: AgendaFinding[] = [];

  for (const definition of checks) {
    const result = await pool.query<{ id: string; detalhe: string | null }>(definition.sql);
    if (result.rows.length === 0) continue;

    findings.push({
      check: definition.check,
      count: result.rows.length,
      explanation: definition.explanation,
      sample: result.rows
        .slice(0, sampleSize)
        .map((row) => `${row.id}${row.detalhe ? ` — ${row.detalhe}` : ''}`),
      severity: definition.severity,
    });
  }

  return findings;
}

/** Núcleo puro do relatório: dado o que foi achado, o que se imprime. */
export function formatFindings(findings: readonly AgendaFinding[]): string {
  if (findings.length === 0) {
    return `Agenda consistente — ${AGENDA_CHECKS.length} verificações, nenhuma ocorrência.`;
  }

  const blocks = findings.map((finding) => {
    const head = `[${finding.severity.toUpperCase()}] ${finding.check} — ${finding.count} ocorrência(s)`;
    const lines = finding.sample.map((entry) => `    · ${entry}`);
    const truncated =
      finding.count > finding.sample.length
        ? [`    · … e mais ${finding.count - finding.sample.length}`]
        : [];
    return [head, `    ${finding.explanation}`, ...lines, ...truncated].join('\n');
  });

  return blocks.join('\n\n');
}

/** Só ocorrência crítica derruba o código de saída; atenção é informativo. */
export function hasCriticalFinding(findings: readonly AgendaFinding[]): boolean {
  return findings.some((finding) => finding.severity === 'critico');
}

export async function runAgendaCheck(
  argv: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<readonly AgendaFinding[]> {
  const { options } = parseArgs(argv);
  const sampleSize = Number.parseInt(options.sample ?? '5', 10);
  return withPool(
    (pool) => runAgendaChecks(pool, AGENDA_CHECKS, Number.isFinite(sampleSize) ? sampleSize : 5),
    environment,
  );
}

if (isDirectExecution(import.meta.url)) {
  runCli('database:agenda-check', async () => {
    const findings = await runAgendaCheck();
    console.info(formatFindings(findings));
    if (hasCriticalFinding(findings)) process.exitCode = 1;
  });
}
