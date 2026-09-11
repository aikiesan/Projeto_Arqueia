/**
 * Prefixa caminhos internos com o base path da implantação (ex.: `/arqueia`).
 *
 * A função é pura de propósito: `packages/ui` não lê variáveis de ambiente nem
 * depende de Next. Quem conhece o prefixo é a aplicação, que o injeta por prop.
 */

/** Remove barra final e espaços do prefixo. Vazio significa implantação na raiz. */
export function normalizeBasePath(basePath: string | undefined): string {
  const trimmed = (basePath ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '';
  return trimmed.replace(/\/+$/, '');
}

/**
 * Junta prefixo e caminho. É idempotente e deixa intactos fragmentos,
 * caminhos relativos, URLs absolutas e caminhos com protocolo relativo.
 */
export function joinBasePath(basePath: string | undefined, path: string): string {
  const prefix = normalizeBasePath(basePath);
  if (prefix === '') return path;
  if (!path.startsWith('/')) return path;
  if (path.startsWith('//')) return path;
  if (path === '/') return prefix;
  if (path === prefix) return path;
  if (path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`)) {
    return path;
  }
  return `${prefix}${path}`;
}
