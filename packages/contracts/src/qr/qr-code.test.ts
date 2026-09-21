import { describe, expect, it } from 'vitest';

import { isUuidIdentifier, parseQrCode, resolveEquipmentByQrQuerySchema } from './qr-code.js';

const equipmentId = '8f555951-9dc0-41d1-b245-5ffdce74fad2';

describe('parseQrCode', () => {
  it('lê a etiqueta impressa, que é uma URL envolvendo o código', () => {
    // Formato real gravado por `buildEquipmentQrPayload`.
    const parsed = parseQrCode(
      `https://cp2b.unicamp.br/arqueia/qr?code=${encodeURIComponent(`ARQ-EQP-${equipmentId}`)}`,
    );

    expect(parsed.type).toBe('EQUIPMENT');
    expect(parsed.identifier).toBe(equipmentId);
    expect(parsed.actionHint).toBe('reserve');
    expect(parsed.originalUrl).toContain('/arqueia/qr?code=');
  });

  it('lê o código cru digitado à mão', () => {
    expect(parseQrCode(`ARQ-EQP-${equipmentId}`)).toMatchObject({
      identifier: equipmentId,
      type: 'EQUIPMENT',
    });
  });

  it('reconhece o prefixo legível de equipamento', () => {
    expect(parseQrCode('CP2B-EQP-01')).toMatchObject({
      identifier: 'CP2B-EQP-01',
      type: 'EQUIPMENT',
    });
  });

  it('deixa o código canônico do equipamento como UNKNOWN, preservando o identificador', () => {
    // `CP2b-HPLC-01` é o código canônico gerado por `createEquipmentInputSchema`,
    // mas não casa com nenhum prefixo de etiqueta. Classificar por formato livre
    // roubaria códigos de lote; quem desempata é o caso de uso, que aceita
    // UNKNOWN e tenta resolver o identificador como id ou código.
    const parsed = parseQrCode('CP2b-HPLC-01');
    expect(parsed.type).toBe('UNKNOWN');
    expect(parsed.identifier).toBe('CP2b-HPLC-01');
  });

  it('lê um link direto de agenda', () => {
    expect(
      parseQrCode(`https://cp2b.unicamp.br/arqueia/agenda?equipmentId=${equipmentId}`),
    ).toMatchObject({ identifier: equipmentId, type: 'EQUIPMENT' });
  });

  it('distingue lote de equipamento', () => {
    expect(parseQrCode('ARQ-LOT-LOTE-2026-A')).toMatchObject({
      identifier: 'LOTE-2026-A',
      type: 'BATCH',
    });
    expect(parseQrCode('ARQ-SPC-01')).toMatchObject({ identifier: '01', type: 'SPACE' });
  });

  it('não classifica texto arbitrário como equipamento', () => {
    expect(parseQrCode('qualquer coisa').type).toBe('UNKNOWN');
    expect(parseQrCode('   ').type).toBe('UNKNOWN');
    expect(parseQrCode('   ').identifier).toBe('');
  });

  it('não explode com URL malformada', () => {
    expect(() => parseQrCode('http://[::malformada')).not.toThrow();
  });

  it('separa UUID de código legível', () => {
    expect(isUuidIdentifier(equipmentId)).toBe(true);
    expect(isUuidIdentifier('CP2b-HPLC-01')).toBe(false);
  });
});

describe('resolveEquipmentByQrQuerySchema', () => {
  it('recusa código vazio e payload gigante', () => {
    expect(() => resolveEquipmentByQrQuerySchema.parse({ code: '' })).toThrow();
    expect(() => resolveEquipmentByQrQuerySchema.parse({ code: 'x'.repeat(513) })).toThrow();
    expect(resolveEquipmentByQrQuerySchema.parse({ code: ' ARQ-EQP-1 ' }).code).toBe('ARQ-EQP-1');
  });
});
