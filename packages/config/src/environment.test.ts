import { describe, expect, it } from 'vitest';

import { apiEnvironmentSchema } from './environment.js';

describe('apiEnvironmentSchema', () => {
  it('parses the supported local-development configuration', () => {
    const environment = apiEnvironmentSchema.parse({
      DATABASE_URL: 'postgresql://arqueia:secret@localhost:5432/arqueia',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a'.repeat(32),
      PUBLIC_ORIGIN: 'http://localhost:4002',
    });

    expect(environment).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 4001,
      OIDC_ENABLED: false,
    });
  });

  it('rejects weak secrets and unsupported database protocols', () => {
    const result = apiEnvironmentSchema.safeParse({
      DATABASE_URL: 'mysql://localhost/arqueia',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'short',
      PUBLIC_ORIGIN: 'http://localhost:4002',
    });

    expect(result.success).toBe(false);
  });
});
