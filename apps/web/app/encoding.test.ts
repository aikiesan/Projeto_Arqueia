import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const criticalInterfaceFiles = [
  'app/presentation.ts',
  'app/home-dashboard.tsx',
  'app/login/login-form.tsx',
  'app/usuarios/users-page-client.tsx',
] as const;

describe('UTF-8 interface regression', () => {
  it.each(criticalInterfaceFiles)('keeps %s free from replacement characters and mojibake', (file) => {
    const contents = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(contents).not.toContain('\uFFFD');
    expect(contents).not.toMatch(/Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]/u);
  });

  it('preserves the canonical Portuguese role label', () => {
    const contents = readFileSync(
      resolve(process.cwd(), 'app/usuarios/users-page-client.tsx'),
      'utf8',
    );

    expect(contents).toContain("USUARIO: 'Usuário Pesquisador'");
  });
});
