import { describe, expect, it } from 'vitest';

import { loadWorkerConfiguration } from './configuration.js';

describe('loadWorkerConfiguration', () => {
  it('carrega uma configuracao valida sem acoplar ao Docker', () => {
    expect(
      loadWorkerConfiguration({
        NODE_ENV: 'test',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({
      nodeEnvironment: 'test',
      redisUrl: 'redis://localhost:6379',
    });
  });

  it('exige a URL do Redis', () => {
    expect(() => loadWorkerConfiguration({ NODE_ENV: 'test' })).toThrow(
      'REDIS_URL e obrigatoria',
    );
  });

  it('rejeita protocolos que nao sao Redis', () => {
    expect(() =>
      loadWorkerConfiguration({
        NODE_ENV: 'test',
        REDIS_URL: 'http://localhost:6379',
      }),
    ).toThrow('REDIS_URL deve usar o protocolo redis:// ou rediss://');
  });
});
