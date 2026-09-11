import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * `sw.js` é servido como arquivo estático e não passa pelo build do Next, então
 * não tem acesso a `NEXT_PUBLIC_BASE_PATH`. Sob `/arqueia`, caminhos crus
 * fariam `cache.addAll` rejeitar no primeiro 404 e o service worker nunca
 * instalaria; o guarda de `/api/` também deixaria de casar.
 */
describe('service worker', () => {
  const source = readFileSync(join(__dirname, 'sw.js'), 'utf8');

  it('deriva o prefixo da própria URL do script', () => {
    expect(source).toContain("new URL('./', self.location).pathname");
  });

  it('não referencia caminhos absolutos crus', () => {
    for (const raw of ["'/icons/", "'/brand/", "'/manifest.webmanifest'", "'/api/'"]) {
      expect(source.includes(`startsWith(${raw}`)).toBe(false);
      expect(source.includes(`\n  ${raw}`)).toBe(false);
    }
    expect(source).not.toContain("pathname === '/manifest.webmanifest'");
  });
});
