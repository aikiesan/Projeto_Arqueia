import { describe, expect, it } from 'vitest';

import { externalUrl } from './external-url';

describe('externalUrl', () => {
  it('aceita URL https absoluta', () => {
    expect(externalUrl('https://limhc.fm.usp.br/guia.pdf')).toBe('https://limhc.fm.usp.br/guia.pdf');
  });

  it.each(['/boas-praticas', 'http://exemplo.com', '//exemplo.com', 'javascript:alert(1)'])(
    'recusa %s',
    (url) => {
      expect(() => externalUrl(url)).toThrow();
    },
  );
});
