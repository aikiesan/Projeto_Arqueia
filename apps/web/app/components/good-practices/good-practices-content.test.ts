import { describe, expect, it } from 'vitest';

import {
  CHEMICAL_INCOMPATIBILITIES,
  DETAIL_SECTIONS,
  EMERGENCY_NUMBERS,
  ESSENTIAL_SECTIONS,
  filterIncompatibilities,
  GOOD_PRACTICES_SOURCE,
  RISK_TYPES,
  UNICAMP_EMERGENCY_CONTACTS,
} from './good-practices-content';

function allText(): string {
  return JSON.stringify({ ESSENTIAL_SECTIONS, DETAIL_SECTIONS, UNICAMP_EMERGENCY_CONTACTS });
}

describe('Conteúdo de boas práticas', () => {
  it('cita a fonte e aponta o PDF para o endereço oficial da USP, sem hospedá-lo', () => {
    expect(GOOD_PRACTICES_SOURCE.url).toMatch(/^https:\/\/limhc\.fm\.usp\.br\/.+\.pdf$/);
    expect(GOOD_PRACTICES_SOURCE.publisher).toContain('HC-FMUSP');
    expect(GOOD_PRACTICES_SOURCE.year).toBe(2015);
  });

  /**
   * Os telefones do guia original são de São Paulo. Numa emergência no CP2b,
   * levariam a pessoa a ligar para o lugar errado.
   */
  it('não traz os telefones de emergência da FMUSP', () => {
    for (const phone of ['0800 0148110', '2661-6228', '3061-7326', '3061-7199', '3896-1200']) {
      expect(allText()).not.toContain(phone);
    }
  });

  it('usa os contatos da Unicamp, com números discáveis', () => {
    const svc = UNICAMP_EMERGENCY_CONTACTS.find((contact) => contact.id === 'svc');
    expect(svc?.phones[0]).toEqual({ display: '(19) 3521-6000', dial: '+551935216000' });
    const ciatox = UNICAMP_EMERGENCY_CONTACTS.find((contact) => contact.id === 'ciatox');
    expect(ciatox?.phones[0]?.dial).toBe('+551935217555');
    for (const contact of UNICAMP_EMERGENCY_CONTACTS) {
      for (const phone of contact.phones) expect(phone.dial).toMatch(/^\+5519\d{8}$/);
    }
    expect(EMERGENCY_NUMBERS.map((entry) => entry.number)).toEqual(['192', '193', '190']);
  });

  it('não fixa concentração de hipoclorito: remete ao POP do laboratório', () => {
    const decontamination = JSON.stringify(DETAIL_SECTIONS.find((section) => section.id === 'descontaminacao'));
    expect(decontamination).toContain('hipoclorito');
    expect(decontamination).toContain('POP');
    expect(decontamination).not.toMatch(/hipoclorito[^.]*\d+\s?%/i);
  });

  it('mantém os cinco tipos de risco com as cores do mapa de risco (NR-5)', () => {
    expect(RISK_TYPES.map((risk) => [risk.id, risk.mapColorName])).toEqual([
      ['fisico', 'verde'],
      ['quimico', 'vermelho'],
      ['biologico', 'marrom'],
      ['ergonomico', 'amarelo'],
      ['acidente', 'azul'],
    ]);
  });

  it('cada seção tem id único e itens', () => {
    const sections = [...ESSENTIAL_SECTIONS, ...DETAIL_SECTIONS];
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
    for (const section of sections) {
      expect(section.groups.flatMap((group) => group.items).length).toBeGreaterThan(0);
    }
  });
});

describe('filterIncompatibilities', () => {
  it('busca sem acento e sem caixa, nas duas colunas', () => {
    expect(filterIncompatibilities('ACIDO PERCLORICO').map((row) => row.substance)).toContain(
      'Ácido perclórico',
    );
    const withMethane = filterIncompatibilities('metano').map((row) => row.substance);
    expect(withMethane).toContain('Cloro');
  });

  it('devolve tudo com busca vazia e nada quando não encontra', () => {
    expect(filterIncompatibilities('   ')).toHaveLength(CHEMICAL_INCOMPATIBILITIES.length);
    expect(filterIncompatibilities('unobtânio')).toHaveLength(0);
  });
});
