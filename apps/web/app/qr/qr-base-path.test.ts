import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão: `qr-page-client` chamava `lookupAndResolveQr` sem passar o fetcher
 * prefixado, então o default `customFetch = fetch` batia em `/api/...` — fora
 * do base path, ou seja, na SPA do CP2b — quebrando toda a resolução de QR.
 */
describe('resolução de QR sob base path', () => {
  const requestedUrls: string[] = [];

  beforeEach(() => {
    requestedUrls.length = 0;
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requestedUrls.push(String(input));
        return new Response(null, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('entrega ao fetch injetado a URL já prefixada', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/arqueia');
    const { basePathFetch } = await import('../lib/base-path');
    const { lookupAndResolveQr } = await import('./qr-resolver');

    await lookupAndResolveQr('ARQ-LOT-abc123', 'lab-cp2b', basePathFetch);

    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url.startsWith('/arqueia/api/')).toBe(true);
    }
  });

  it('mantém as URLs na raiz quando não há base path', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    const { basePathFetch } = await import('../lib/base-path');
    const { lookupAndResolveQr } = await import('./qr-resolver');

    await lookupAndResolveQr('ARQ-LOT-abc123', 'lab-cp2b', basePathFetch);

    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url.startsWith('/api/')).toBe(true);
    }
  });

  it('prefixa o destino de navegação derivado do código lido', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/arqueia');
    const { withBasePath } = await import('../lib/base-path');
    const { lookupAndResolveQr } = await import('./qr-resolver');

    const result = await lookupAndResolveQr('ARQ-EQP-eq-1', 'lab-cp2b');

    expect(withBasePath(result.destinationUrl)).toBe(`/arqueia${result.destinationUrl}`);
  });
});
