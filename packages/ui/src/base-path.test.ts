import { describe, expect, it } from 'vitest';

import { joinBasePath, normalizeBasePath } from './base-path';

describe('normalizeBasePath', () => {
  it('trata ausência, vazio e raiz como implantação na raiz', () => {
    expect(normalizeBasePath(undefined)).toBe('');
    expect(normalizeBasePath('')).toBe('');
    expect(normalizeBasePath('   ')).toBe('');
    expect(normalizeBasePath('/')).toBe('');
  });

  it('remove espaços e barras finais', () => {
    expect(normalizeBasePath(' /arqueia ')).toBe('/arqueia');
    expect(normalizeBasePath('/arqueia/')).toBe('/arqueia');
    expect(normalizeBasePath('/arqueia//')).toBe('/arqueia');
  });
});

describe('joinBasePath', () => {
  it('é identidade quando não há prefixo', () => {
    expect(joinBasePath('', '/agenda')).toBe('/agenda');
    expect(joinBasePath(undefined, '/agenda')).toBe('/agenda');
    expect(joinBasePath('/', '/agenda')).toBe('/agenda');
  });

  it('prefixa caminhos internos', () => {
    expect(joinBasePath('/arqueia', '/agenda')).toBe('/arqueia/agenda');
    expect(joinBasePath('/arqueia', '/brand/cp2b-avatar.svg')).toBe('/arqueia/brand/cp2b-avatar.svg');
  });

  it('mapeia a raiz para o próprio prefixo, sem barra final', () => {
    expect(joinBasePath('/arqueia', '/')).toBe('/arqueia');
  });

  it('preserva query e fragmento', () => {
    expect(joinBasePath('/arqueia', '/?laboratory=lab-1')).toBe('/arqueia/?laboratory=lab-1');
    expect(joinBasePath('/arqueia', '/agenda?equipmentId=eq-1')).toBe('/arqueia/agenda?equipmentId=eq-1');
  });

  it('é idempotente', () => {
    expect(joinBasePath('/arqueia', '/arqueia/agenda')).toBe('/arqueia/agenda');
    expect(joinBasePath('/arqueia', '/arqueia')).toBe('/arqueia');
    expect(joinBasePath('/arqueia', joinBasePath('/arqueia', '/estoque'))).toBe('/arqueia/estoque');
  });

  it('não confunde prefixo com início de outro segmento', () => {
    expect(joinBasePath('/arqueia', '/arqueiadores')).toBe('/arqueia/arqueiadores');
  });

  it('deixa intactos fragmentos, caminhos relativos e URLs externas', () => {
    expect(joinBasePath('/arqueia', '#conteudo-principal')).toBe('#conteudo-principal');
    expect(joinBasePath('/arqueia', 'agenda')).toBe('agenda');
    expect(joinBasePath('/arqueia', 'https://cp2b.unicamp.br/pilar2b')).toBe('https://cp2b.unicamp.br/pilar2b');
    expect(joinBasePath('/arqueia', '//cp2b.unicamp.br/pilar2b')).toBe('//cp2b.unicamp.br/pilar2b');
  });
});
