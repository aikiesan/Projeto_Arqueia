import { describe, expect, it, vi } from 'vitest';

import { runAgendaChecks, formatFindings, hasCriticalFinding, AGENDA_CHECKS } from './agenda-check.js';
import { isDirectExecution, parseArgs, requireDatabaseUrl } from './cli-runtime.js';
import { buildQrPayload, renderCsv, renderPrintableHtml, toLabels } from './qr-labels.js';
import { diagnose, findEquipmentForQr, type ResolvedQrRow } from './qr-resolve.js';

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
      [resolved],
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
    const archived = diagnose(`ARQ-EQP-${equipmentId}`, [{ ...resolved, archived: true }], 'https://x', '/arqueia');
    expect(archived.verdict).toContain('ARQUIVADO');
    expect(archived.destinationUrl).toBeNull();

    const missing = diagnose(`ARQ-EQP-${equipmentId}`, [], 'https://x', '/arqueia');
    expect(missing.verdict).toContain('Nenhum equipamento');
    expect(missing.destinationUrl).toBeNull();
  });

  const otherLab: ResolvedQrRow = {
    ...resolved,
    equipmentId: '9c666a62-9dc0-41d1-b245-5ffdce74fad4',
    laboratoryCode: 'LAB-SEC',
    laboratoryId: '8e555951-9dc0-41d1-b245-5ffdce74fad3',
  };

  /**
   * A API recusa código presente em mais de um laboratório. A primeira versão
   * da CLI pegava o primeiro com `LIMIT 1` e dizia "OK" para uma etiqueta que o
   * app rejeita — diagnóstico que aprova o que o sistema recusa.
   */
  it('acusa código ambíguo entre laboratórios, como o servidor faz', () => {
    const diagnosis = diagnose('CP2b-HPLC-01', [resolved, otherLab], 'https://x', '/arqueia');

    expect(diagnosis.destinationUrl).toBeNull();
    expect(diagnosis.verdict).toContain('AMBÍGUO');
    expect(diagnosis.verdict).toContain('CP2b, LAB-SEC');
  });

  it('resolve quando só um dos candidatos está ativo, como o servidor faz', () => {
    const diagnosis = diagnose(
      'CP2b-HPLC-01',
      [resolved, { ...otherLab, archived: true }],
      'https://x',
      '/arqueia',
    );

    expect(diagnosis.verdict).toContain('OK');
    expect(diagnosis.equipment?.laboratoryCode).toBe('CP2b');
  });

  it('avisa quando a etiqueta é de lote, não de equipamento', () => {
    const diagnosis = diagnose('ARQ-LOT-LOTE-2026-A', [], 'https://x', '/arqueia');
    expect(diagnosis.verdict).toContain('lote');
  });

  it('funciona em implantação na raiz, sem prefixo', () => {
    const diagnosis = diagnose(`ARQ-EQP-${equipmentId}`, [resolved], 'https://x', '/');
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

describe('isDirectExecution', () => {
  const windowsUrl =
    'file:///C:/Users/Lucas/Documents/Projeto_Arqueia/packages/database/src/cli/qr-labels.ts';
  const windowsScript =
    'C:\\Users\\Lucas\\Documents\\Projeto_Arqueia\\packages\\database\\src\\cli\\qr-labels.ts';

  /**
   * Regressão: no Windows as três CLIs saíam em silêncio, com código 0. A
   * comparação usava `URL.pathname`, que ali vira `/C:/Users/...`.
   */
  it('reconhece a execução direta com caminho do Windows', () => {
    expect(isDirectExecution(windowsUrl, windowsScript, 'win32')).toBe(true);
  });

  it('ignora a caixa da letra da unidade no Windows', () => {
    expect(isDirectExecution(windowsUrl, windowsScript.replace(/^C:/, 'c:'), 'win32')).toBe(true);
  });

  it('reconhece a execução direta no Linux da VM', () => {
    expect(
      isDirectExecution(
        'file:///data/arqueia/repo/packages/database/src/cli/qr-labels.ts',
        '/data/arqueia/repo/packages/database/src/cli/qr-labels.ts',
        'linux',
      ),
    ).toBe(true);
  });

  it('não dispara quando o módulo é importado por outro script', () => {
    expect(isDirectExecution(windowsUrl, 'C:\\Users\\Lucas\\outro.ts', 'win32')).toBe(false);
    expect(isDirectExecution(windowsUrl, undefined, 'win32')).toBe(false);
  });
});

describe('qr:resolve — findEquipmentForQr', () => {
  function capture() {
    const query = vi.fn(async () => ({ rows: [] }));
    return { pool: { query } as never, query };
  }

  /** Cada `$n` enviado precisa ser lido pelo SQL, ou o Postgres não infere o tipo. */
  function expectEveryParameterReferenced(sql: string, parameters: readonly unknown[]) {
    parameters.forEach((_, index) => {
      expect(sql, `o SQL não usa $${index + 1}`).toMatch(new RegExp(`\\$${index + 1}(?!\\d)`));
    });
  }

  /**
   * Regressão da VM: `qr:resolve` com código legível abortava com "could not
   * determine data type of parameter $1". O SQL só lia `$2`, mas recebia
   * `[null, código]`.
   */
  it('usa todo parâmetro que envia, na busca por código', async () => {
    const { pool, query } = capture();
    await findEquipmentForQr(pool, 'CP2b-HPLC-01');

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual(['CP2b-HPLC-01']);
    expect(sql).not.toContain('::uuid');
    expectEveryParameterReferenced(sql, parameters);
  });

  it('usa todo parâmetro que envia, na busca por UUID', async () => {
    const { pool, query } = capture();
    await findEquipmentForQr(pool, equipmentId);

    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual([equipmentId]);
    expect(sql).toContain('e.id = $1::uuid');
    expectEveryParameterReferenced(sql, parameters);
  });

  it('não esconde candidatos: pede vários para o veredito poder acusar ambiguidade', async () => {
    const { pool, query } = capture();
    await findEquipmentForQr(pool, 'CP2b-HPLC-01');

    const [sql] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toMatch(/LIMIT 1\b/);
  });
});
