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
      API_HOST: '127.0.0.1',
      API_PORT: 4001,
      OIDC_ENABLED: false,
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCKOUT_DURATION_SECONDS: 900,
      AUTH_RATE_LIMIT_MAX_ATTEMPTS: 10,
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 60,
    });
  });

  it('parses optional OIDC and SMTP configurations properly', () => {
    const environment = apiEnvironmentSchema.parse({
      DATABASE_URL: 'postgresql://arqueia:secret@localhost:5432/arqueia',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a'.repeat(32),
      PUBLIC_ORIGIN: 'http://localhost:4002',
      OIDC_ENABLED: 'true',
      OIDC_DISPLAY_NAME: 'Unicamp SSO',
      OIDC_AUTHORIZATION_URL: 'https://auth.unicamp.br/oauth2/v1/authorize',
      OIDC_ISSUER_URL: 'https://auth.unicamp.br',
      OIDC_CLIENT_ID: 'arqueia-client-id',
      OIDC_CLIENT_SECRET: 'super-secret-oidc-key',
      SMTP_HOST: 'smtp.unicamp.br',
      SMTP_PORT: '465',
      SMTP_USER: 'notifier',
      SMTP_PASSWORD: 'smtp-password',
      SMTP_FROM: 'nao-responda@unicamp.br',
    });

    expect(environment).toMatchObject({
      OIDC_ENABLED: true,
      OIDC_DISPLAY_NAME: 'Unicamp SSO',
      OIDC_AUTHORIZATION_URL: 'https://auth.unicamp.br/oauth2/v1/authorize',
      OIDC_ISSUER_URL: 'https://auth.unicamp.br',
      OIDC_CLIENT_ID: 'arqueia-client-id',
      OIDC_CLIENT_SECRET: 'super-secret-oidc-key',
      SMTP_HOST: 'smtp.unicamp.br',
      SMTP_PORT: 465,
      SMTP_USER: 'notifier',
      SMTP_PASSWORD: 'smtp-password',
      SMTP_FROM: 'nao-responda@unicamp.br',
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
