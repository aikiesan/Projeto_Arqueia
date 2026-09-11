import { describe, expect, it } from 'vitest';

import { forwardedClientIp, hasTrustedOrigin } from './api-server';

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

  it('uses the nearest proxy address instead of a caller-controlled first hop', () => {
    const request = new Request('http://localhost:4002/api/session/login', {
      headers: {
        'x-forwarded-for': '198.51.100.99, 203.0.113.7',
      },
    });

    expect(forwardedClientIp(request)).toBe('203.0.113.7');
  });
});

describe('hasTrustedOrigin sob proxy reverso', () => {
  function requestWith(headers: Record<string, string>): Request {
    return new Request('http://127.0.0.1:4002/arqueia/api/session/login', { headers, method: 'POST' });
  }

  it('aceita a origem quando o Apache preserva o Host original', () => {
    expect(
      hasTrustedOrigin(
        requestWith({ host: 'cp2b.unicamp.br', origin: 'https://cp2b.unicamp.br' }),
      ),
    ).toBe(true);
  });

  it('rejeita quando o proxy reescreve o Host para o backend', () => {
    // Documenta por que `ProxyPreserveHost On` é obrigatório no VirtualHost:
    // sem ele o Host vira 127.0.0.1:4002 e todo login responde 403.
    expect(
      hasTrustedOrigin(
        requestWith({ host: '127.0.0.1:4002', origin: 'https://cp2b.unicamp.br' }),
      ),
    ).toBe(false);
  });
});
