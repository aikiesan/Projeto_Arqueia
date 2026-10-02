/**
 * Marca um link deliberadamente EXTERNO, que não deve receber o basePath.
 *
 * Existe para a varredura de `base-path-links.test.ts`, que reprova qualquer
 * `href` vindo de variável: passar por aqui diz "isto é externo de propósito".
 * Recusa caminho interno, para que ninguém use a marca como atalho.
 */
export function externalUrl(url: string): string {
  if (!/^https:\/\/[^/]/.test(url)) throw new Error(`Link externo precisa ser https:// absoluto: ${url}`);
  return url;
}
