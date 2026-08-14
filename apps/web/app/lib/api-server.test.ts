import { describe, expect, it } from 'vitest';

import { hasTrustedOrigin } from './api-server';

describe('web API boundary', () => {
  it('accepts same-origin mutations and rejects missing or foreign origins', () => {
    expect(
      hasTrustedOrigin(
        new Request('http://localhost:4002/api/equipment', {
          headers: { host: 'localhost:4002', origin: 'http://localhost:4002' },
        }),
      ),
    ).toBe(true);
    expect(
      hasTrustedOrigin(
        new Request('http://localhost:4002/api/equipment', {
          headers: { host: 'localhost:4002', origin: 'https://malicioso.example' },
        }),
      ),
    ).toBe(false);
    expect(hasTrustedOrigin(new Request('http://localhost:4002/api/equipment'))).toBe(false);
  });
});
