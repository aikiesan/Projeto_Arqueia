import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Em produção o app vive sob NEXT_PUBLIC_BASE_PATH=/arqueia.
 *
 * O <Link> do Next e o router prefixam o basePath sozinhos (next.config.ts o
 * declara), mas um <a href="/algo"> cru NÃO: ele aponta para a raiz do domínio
 * e cai no 404 do site do CP2b. Foi exatamente o que aconteceu com o botão
 * "Reservar Horário", que levava a cp2b.unicamp.br/agenda em vez de
 * cp2b.unicamp.br/arqueia/agenda.
 *
 * Este teste varre o código em vez de testar um componente porque o defeito é
 * de classe: cada <a> novo é uma chance de repetir o erro.
 */
const APP_DIR = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '.next') return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx$/.test(entry) || /\.test\.tsx$/.test(entry)) return [];
    return [full];
  });
}

/** Trechos `<a ... >` de um arquivo, sem o conteúdo interno. */
function anchorTags(source: string): string[] {
  const tags: string[] = [];
  const pattern = /<a\s[^>]*>/g;
  let match = pattern.exec(source);
  while (match !== null) {
    tags.push(match[0]);
    match = pattern.exec(source);
  }
  return tags;
}

/** href que aponta para a raiz do domínio sem passar por withBasePath. */
function hasUnprefixedHref(tag: string): boolean {
  const href = /href=\{?["'`]\/[^"'`]*["'`]\}?/.exec(tag);
  return href !== null && !tag.includes('withBasePath');
}

describe('Links internos sob basePath', () => {
  it('nenhum <a> aponta para caminho absoluto sem withBasePath', () => {
    const offenders = sourceFiles(APP_DIR).flatMap((file) =>
      anchorTags(readFileSync(file, 'utf8'))
        .filter(hasUnprefixedHref)
        .map((tag) => `${file.replace(APP_DIR, 'app')}: ${tag.replace(/\s+/g, ' ')}`),
    );

    expect(offenders).toEqual([]);
  });

  it('a varredura realmente detecta o defeito que ocorreu em produção', () => {
    const regressao = '<a className="equipment-reserve-link" href={`/agenda?equipmentId=${id}`}>';
    const corrigido = '<a className="x" href={withBasePath(`/agenda?equipmentId=${id}`)}>';
    const externo = '<a href="https://cp2b.unicamp.br">CP2b</a>';
    const ancora = '<a href="#conteudo">pular</a>';

    expect(anchorTags(regressao).filter(hasUnprefixedHref)).toHaveLength(1);
    expect(anchorTags(corrigido).filter(hasUnprefixedHref)).toHaveLength(0);
    expect(anchorTags(externo).filter(hasUnprefixedHref)).toHaveLength(0);
    expect(anchorTags(ancora).filter(hasUnprefixedHref)).toHaveLength(0);
  });
});
