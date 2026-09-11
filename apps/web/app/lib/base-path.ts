import { joinBasePath, normalizeBasePath } from '@arqueia/ui';

/**
 * Prefixo público da implantação, definido em build por `NEXT_PUBLIC_BASE_PATH`
 * e espelhado em `next.config.ts`. Vazio quando o app roda na raiz do domínio.
 *
 * Este é o único ponto do cliente que lê a variável: todo o resto usa
 * `withBasePath` / `navigateTo`.
 */
export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/** Prefixa um caminho interno. Idempotente; ver `joinBasePath`. */
export function withBasePath(path: string): string {
  return joinBasePath(BASE_PATH, path);
}

/**
 * `fetch` que prefixa caminhos internos. Usado nas rotas do BFF (`/api/*`),
 * que sob implantação em subcaminho vivem em `/arqueia/api/*`.
 */
export const basePathFetch: typeof fetch = (input, init) =>
  fetch(typeof input === 'string' ? withBasePath(input) : input, init);

/** Navegação dura (troca de sessão), preservando o prefixo. */
export function navigateTo(path: string): void {
  window.location.assign(withBasePath(path));
}
