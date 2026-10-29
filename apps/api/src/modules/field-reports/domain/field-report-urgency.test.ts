import { describe, expect, it } from 'vitest';

import {
  assessFieldReportUrgency,
  normalizeForMatching,
} from './field-report-urgency.js';

function assess(message: string, blocksUse = false) {
  return assessFieldReportUrgency({ message, blocksUse });
}

describe('normalizeForMatching', () => {
  it('tira acento e caixa', () => {
    expect(normalizeForMatching('EMERGÊNCIA')).toBe('emergencia');
    expect(normalizeForMatching('Explosão')).toBe('explosao');
  });

  it('reduz letra repetida, que é como se escreve com pressa', () => {
    expect(normalizeForMatching('SOCORRRO')).toBe('socoro');
    expect(normalizeForMatching('socorro')).toBe('socoro');
    expect(normalizeForMatching('URGENTEEE')).toBe('urgente');
  });
});

describe('assessFieldReportUrgency — o que dispara', () => {
  it('dispara por palavra de emergência', () => {
    expect(assess('URGENTE: a capela parou').urgent).toBe(true);
    expect(assess('tem um vazamento de solvente na bancada').urgent).toBe(true);
    expect(assess('alguém se feriu com o vidro').urgent).toBe(true);
  });

  it('dispara mesmo com a palavra escrita errada por pressa', () => {
    // Foi assim que o pedido desta função chegou: "SOCORRRO", com três erres.
    // Bate apesar do erro de digitação, mas o motivo guarda a grafia correta:
    // o alerta não pode parecer escrito errado por nós.
    expect(assess('SOCORRRO estourou a mangueira').reasons).toContain('keyword:socorro');
    expect(assess('socorro').urgent).toBe(true);
    expect(assess('Socorro!').urgent).toBe(true);
  });

  it('dispara quando quem enviou marcou que o equipamento não pode ser usado', () => {
    const assessment = assess('O ultrafreezer está desligado.', true);

    expect(assessment.urgent).toBe(true);
    expect(assessment.reasons).toEqual(['blocks_use']);
  });

  it('acumula os motivos quando os dois sinais aparecem', () => {
    const assessment = assess('URGENTE: incêndio na sala', true);

    expect(assessment.reasons).toEqual(['blocks_use', 'keyword:urgente', 'keyword:incendio']);
  });
});

describe('assessFieldReportUrgency — o que NÃO dispara', () => {
  it('ignora informe de rotina', () => {
    expect(assess('Acabou o metanol grau HPLC.').urgent).toBe(false);
    expect(assess('A bomba do HPLC está fazendo um barulho estranho.').urgent).toBe(false);
    expect(assess('Favor repor luvas tamanho M.').urgent).toBe(false);
  });

  it('não dispara por palavra contida dentro de outra', () => {
    // Sem a fronteira de palavra, "fogo" acenderia aqui.
    expect(assess('o equipamento está em um afogamento de ruído').urgent).toBe(false);
  });

  it('não dispara pelo tipo do informe — só mensagem e bloqueio importam', () => {
    expect(assess('Problema no agitador magnético: não gira.').urgent).toBe(false);
  });
});
