import { describe, expect, it, vi } from 'vitest';

import { runAgendaChecks, formatFindings, hasCriticalFinding, AGENDA_CHECKS } from './agenda-check.js';
import { parseArgs, requireDatabaseUrl } from './cli-runtime.js';
import { buildQrPayload, renderCsv, renderPrintableHtml, toLabels } from './qr-labels.js';
import { diagnose, type ResolvedQrRow } from './qr-resolve.js';

const equipmentId = '8f555951-9dc0-41d1-b245-5ffdce74fad2';
const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';

const resolved: ResolvedQrRow = {
  archived: false,
  equipmentCode: 'CP2b-HPLC-01',
  equipmentId,
  equipmentName: 'Cromatógrafo Líquido HPLC',
  equipmentStatus: 'AVAILABLE',
  laboratoryCode: 'CP2b',
  laboratoryId,
  laboratoryName: 'Laboratório CP2b',
};

describe('parseArgs', () => {
  it('aceita --chave=valor, --chave valor e sinalizador solto', () => {
    expect(parseArgs(['ARQ-EQP-1', '--format=html', '--laboratory', 'CP2b', '--verbose'])).toEqual({
      options: { format: 'html', laboratory: 'CP2b', verbose: 'true' },
      positional: ['ARQ-EQP-1'],
    });
  });
});

describe('requireDatabaseUrl', () => {
  it('falha com mensagem acionável quando a variável não está definida', () => {
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE_URL/);
    expect(requireDatabaseUrl({ DATABASE_URL: ' postgres://x ' })).toBe('postgres://x');
  });
});

describe('qr:resolve — diagnose', () => {
  it('monta a URL de destino quando a etiqueta resolve', () => {
    const diagnosis = diagnose(
      `ARQ-EQP-${equipmentId}`,
      resolved,
      'https://cp2b.unicamp.br',
      '/arqueia',
    );

    expect(diagnosis.parsedType).toBe('EQUIPMENT');
    expect(diagnosis.identifierIsUuid).toBe(true);
    expect(diagnosis.destinationUrl).toBe(
      `https://cp2b.unicamp.br/arqueia/agenda?laboratory=${laboratoryId}&equipmentId=${equipmentId}`,
    );
    expect(diagnosis.verdict).toContain('OK');
  });

  it('distingue equipamento arquivado de código inexistente', () => {
    const archived = diagnose(`ARQ-EQP-${equipmentId}`, { ...resolved, archived: true }, 'https://x', '/arqueia');
    expect(archived.verdict).toContain('ARQUIVADO');
    expect(archived.destinationUrl).toBeNull();

    const missing = diagnose(`ARQ-EQP-${equipmentId}`, null, 'https://x', '/arqueia');
    expect(missing.verdict).toContain('Nenhum equipamento');
    expect(missing.destinationUrl).toBeNull();
  });

  it('avisa quando a etiqueta é de lote, não de equipamento', () => {
    const diagnosis = diagnose('ARQ-LOT-LOTE-2026-A', null, 'https://x', '/arqueia');
    expect(diagnosis.verdict).toContain('lote');
  });

  it('funciona em implantação na raiz, sem prefixo', () => {
    const diagnosis = diagnose(`ARQ-EQP-${equipmentId}`, resolved, 'https://x', '/');
    expect(diagnosis.destinationUrl).toBe(
      `https://x/agenda?laboratory=${laboratoryId}&equipmentId=${equipmentId}`,
    );
  });
});

describe('qr:labels', () => {
  /** O payload precisa bater com `buildEquipmentQrPayload` do web, ou a etiqueta impressa não abre. */
  it('gera o mesmo payload que a etiqueta do app', () => {
    expect(buildQrPayload(equipmentId, 'https://cp2b.unicamp.br/', '/arqueia')).toBe(
      `https://cp2b.unicamp.br/arqueia/qr?code=${encodeURIComponent(`ARQ-EQP-${equipmentId}`)}`,
    );
  });

  const rows = [
    { code: 'CP2b-HPLC-01', id: equipmentId, laboratory_code: 'CP2b', name: 'HPLC "principal"', status: 'AVAILABLE' },
  ];

  it('escapa aspas no CSV', () => {
    const csv = renderCsv(toLabels(rows, 'https://x', '/arqueia'));
    expect(csv.split('\n')[0]).toBe('laboratorio,codigo,nome,status,equipamento_id,qr_payload');
    expect(csv).toContain('"HPLC ""principal"""');
  });

  it('escapa HTML no material de impressão', () => {
    const html = renderPrintableHtml(
      toLabels([{ ...rows[0]!, name: '<script>alert(1)</script>' }], 'https://x', '/arqueia'),
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('agenda:check', () => {
  function pool(rowsByIndex: Record<number, { id: string; detalhe: string | null }[]>) {
    let call = -1;
    return {
      query: vi.fn(async () => {
        call += 1;
        return { rows: rowsByIndex[call] ?? [] };
      }),
    } as never;
  }

  it('não relata nada quando o banco está consistente', async () => {
    const findings = await runAgendaChecks(pool({}));

    expect(findings).toEqual([]);
    expect(formatFindings(findings)).toContain('Agenda consistente');
    expect(hasCriticalFinding(findings)).toBe(false);
  });

  it('roda toda verificação e resume as ocorrências com amostra limitada', async () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ detalhe: null, id: `occ-${index}` }));
    const findings = await runAgendaChecks(pool({ 0: many }), AGENDA_CHECKS, 3);

    expect(findings).toHaveLength(1);
    expect(findings[0]!.check).toBe('ocupacao-orfa');
    expect(findings[0]!.count).toBe(9);
    expect(findings[0]!.sample).toHaveLength(3);
    expect(formatFindings(findings)).toContain('e mais 6');
    expect(hasCriticalFinding(findings)).toBe(true);
  });

  it('ocorrência apenas de atenção não é tratada como crítica', async () => {
    // Índice 5 é `codigo-de-equipamento-duplicado`, de severidade "atencao".
    const findings = await runAgendaChecks(pool({ 5: [{ detalhe: 'CP2B-HPLC-01 em 2', id: 'a / b' }] }));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('atencao');
    expect(hasCriticalFinding(findings)).toBe(false);
  });

  it('nenhuma verificação escreve no banco', () => {
    for (const check of AGENDA_CHECKS) {
      expect(check.sql).toMatch(/^\s*SELECT/);
      expect(check.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
    }
  });
});
