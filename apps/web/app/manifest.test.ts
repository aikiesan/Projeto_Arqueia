import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('manifest do PWA', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('declara escopo, id e start_url dentro do base path', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/arqueia');
    const { default: manifest } = await import('./manifest');

    const result = manifest();
    // A barra final importa: `/arqueia` como escopo também casaria `/arqueiaXYZ`.
    expect(result.scope).toBe('/arqueia/');
    expect(result.start_url).toBe('/arqueia/');
    expect(result.id).toBe('/arqueia/');
    expect(result.icons?.map((icon) => icon.src)).toEqual([
      '/arqueia/icons/arqueia.svg',
      '/arqueia/icons/arqueia-maskable.svg',
    ]);
  });

  it('permanece na raiz quando não há base path', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    const { default: manifest } = await import('./manifest');

    const result = manifest();
    expect(result.scope).toBe('/');
    expect(result.start_url).toBe('/');
    expect(result.icons?.map((icon) => icon.src)).toEqual([
      '/icons/arqueia.svg',
      '/icons/arqueia-maskable.svg',
    ]);
  });
});
