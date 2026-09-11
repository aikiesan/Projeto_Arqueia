import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { metadata } from './layout';

describe('root layout metadata', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('publishes the Arqueia SVG and maskable apple touch icon', () => {
    expect(metadata.icons).toEqual({
      apple: [{ url: '/icons/arqueia-maskable.svg' }],
      icon: [{ type: 'image/svg+xml', url: '/icons/arqueia.svg' }],
    });
  });

  it('prefixa ícones e manifest com o base path da implantação', async () => {
    // O Next não aplica `basePath` a `Metadata.icons` nem a `Metadata.manifest`,
    // então os três valores 404 sob `/arqueia` se não forem prefixados aqui.
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/arqueia');
    const { metadata: prefixed } = await import('./layout');

    expect(prefixed.icons).toEqual({
      apple: [{ url: '/arqueia/icons/arqueia-maskable.svg' }],
      icon: [{ type: 'image/svg+xml', url: '/arqueia/icons/arqueia.svg' }],
    });
    expect(prefixed.manifest).toBe('/arqueia/manifest.webmanifest');
  });

  it('mantém os caminhos na raiz quando não há base path', () => {
    expect(metadata.manifest).toBe('/manifest.webmanifest');
  });

  it('configures Apple web app standalone capability', () => {
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: 'default',
      title: 'Arqueia',
    });
  });
});
