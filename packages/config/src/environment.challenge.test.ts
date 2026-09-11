import { describe, expect, it } from 'vitest';

import {
  apiEnvironmentSchema,
  webEnvironmentSchema,
  workerEnvironmentSchema,
} from './environment.js';

describe('Milestone 1 Empirical Challenge: Environment Config Parsing & Validation', () => {
  const baseValidApiEnv = {
    DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/arqueia_test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: '0123456789abcdef0123456789abcdef',
    PUBLIC_ORIGIN: 'http://localhost:4002',
  };

  describe('OIDC Configuration Stress Tests', () => {
    it('accepts valid complete OIDC configuration', () => {
      const parsed = apiEnvironmentSchema.parse({
        ...baseValidApiEnv,
        OIDC_ENABLED: 'true',
        OIDC_DISPLAY_NAME: 'UNICAMP Single Sign-On',
        OIDC_ISSUER_URL: 'https://auth.unicamp.br',
        OIDC_AUTHORIZATION_URL: 'https://auth.unicamp.br/oauth2/v1/authorize',
        OIDC_CLIENT_ID: 'arqueia-client-id-production',
        OIDC_CLIENT_SECRET: 'super-secret-production-oidc-key',
      });

      expect(parsed.OIDC_ENABLED).toBe(true);
      expect(parsed.OIDC_DISPLAY_NAME).toBe('UNICAMP Single Sign-On');
      expect(parsed.OIDC_ISSUER_URL).toBe('https://auth.unicamp.br');
      expect(parsed.OIDC_AUTHORIZATION_URL).toBe('https://auth.unicamp.br/oauth2/v1/authorize');
      expect(parsed.OIDC_CLIENT_ID).toBe('arqueia-client-id-production');
      expect(parsed.OIDC_CLIENT_SECRET).toBe('super-secret-production-oidc-key');
    });

    it('accepts partial/empty OIDC configuration when disabled or omitted', () => {
      const parsed = apiEnvironmentSchema.parse({
        ...baseValidApiEnv,
        OIDC_ENABLED: 'false',
        OIDC_ISSUER_URL: '',
        OIDC_AUTHORIZATION_URL: '',
        OIDC_CLIENT_ID: '',
        OIDC_CLIENT_SECRET: '',
      });

      expect(parsed.OIDC_ENABLED).toBe(false);
      expect(parsed.OIDC_ISSUER_URL).toBe('');
      expect(parsed.OIDC_AUTHORIZATION_URL).toBe('');
      expect(parsed.OIDC_CLIENT_ID).toBe('');
      expect(parsed.OIDC_CLIENT_SECRET).toBe('');
    });

    it('accepts omitted optional OIDC variables and supplies default display name', () => {
      const parsed = apiEnvironmentSchema.parse(baseValidApiEnv);

      expect(parsed.OIDC_ENABLED).toBe(false);
      expect(parsed.OIDC_DISPLAY_NAME).toBe('Entrar com Unicamp');
      expect(parsed.OIDC_ISSUER_URL).toBeUndefined();
      expect(parsed.OIDC_AUTHORIZATION_URL).toBeUndefined();
      expect(parsed.OIDC_CLIENT_ID).toBeUndefined();
      expect(parsed.OIDC_CLIENT_SECRET).toBeUndefined();
    });

    it('rejects invalid OIDC_ENABLED values (e.g. 1, yes, true-ish)', () => {
      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          OIDC_ENABLED: 'yes',
        }),
      ).toThrow();

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          OIDC_ENABLED: '1',
        }),
      ).toThrow();
    });

    it('rejects malformed OIDC_ISSUER_URL and OIDC_AUTHORIZATION_URL', () => {
      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          OIDC_ISSUER_URL: 'not-a-url',
        }),
      ).toThrow();

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          OIDC_AUTHORIZATION_URL: 'invalid-uri-scheme',
        }),
      ).toThrow();
    });
  });

  describe('SMTP Configuration Stress Tests', () => {
    it('accepts complete valid SMTP configuration', () => {
      const parsed = apiEnvironmentSchema.parse({
        ...baseValidApiEnv,
        SMTP_HOST: 'smtp.unicamp.br',
        SMTP_PORT: '465',
        SMTP_USER: 'notifier@unicamp.br',
        SMTP_PASSWORD: 'secret-smtp-password',
        SMTP_FROM: 'Arqueia <nao-responda@unicamp.br>',
      });

      expect(parsed.SMTP_HOST).toBe('smtp.unicamp.br');
      expect(parsed.SMTP_PORT).toBe(465);
      expect(parsed.SMTP_USER).toBe('notifier@unicamp.br');
      expect(parsed.SMTP_PASSWORD).toBe('secret-smtp-password');
      expect(parsed.SMTP_FROM).toBe('Arqueia <nao-responda@unicamp.br>');
    });

    it('accepts partial/empty SMTP configuration when omitted or empty strings', () => {
      const parsed = apiEnvironmentSchema.parse({
        ...baseValidApiEnv,
        SMTP_HOST: '',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        SMTP_FROM: '',
      });

      expect(parsed.SMTP_HOST).toBe('');
      expect(parsed.SMTP_PORT).toBe(587); // Default SMTP port
      expect(parsed.SMTP_USER).toBe('');
      expect(parsed.SMTP_PASSWORD).toBe('');
      expect(parsed.SMTP_FROM).toBe('');
    });

    it('rejects invalid SMTP_PORT out of range or non-numeric', () => {
      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          SMTP_PORT: '0',
        }),
      ).toThrow();

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          SMTP_PORT: '70000',
        }),
      ).toThrow();

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          SMTP_PORT: 'not-a-port',
        }),
      ).toThrow();
    });
  });

  describe('Infrastructure and Security Parameters Validation', () => {
    it('enforces postgres / postgresql protocols for DATABASE_URL', () => {
      expect(
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          DATABASE_URL: 'postgres://user:pass@host:5432/db',
        }).DATABASE_URL,
      ).toBe('postgres://user:pass@host:5432/db');

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          DATABASE_URL: 'mysql://user:pass@host:3306/db',
        }),
      ).toThrow(/Protocolo esperado/);
    });

    it('enforces redis / rediss protocols for REDIS_URL', () => {
      expect(
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          REDIS_URL: 'rediss://user:pass@host:6380',
        }).REDIS_URL,
      ).toBe('rediss://user:pass@host:6380');

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          REDIS_URL: 'http://localhost:6379',
        }),
      ).toThrow(/Protocolo esperado/);
    });

    it('enforces minimum 32 character JWT_SECRET', () => {
      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          JWT_SECRET: 'too-short-secret',
        }),
      ).toThrow();
    });

    it('enforces authentication rate limit boundaries', () => {
      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          AUTH_MAX_FAILED_ATTEMPTS: '2', // Min is 3
        }),
      ).toThrow();

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          AUTH_MAX_FAILED_ATTEMPTS: '25', // Max is 20
        }),
      ).toThrow();

      expect(() =>
        apiEnvironmentSchema.parse({
          ...baseValidApiEnv,
          AUTH_LOCKOUT_DURATION_SECONDS: '30', // Min is 60
        }),
      ).toThrow();
    });
  });

  describe('Web and Worker Environment Schemas', () => {
    it('validates web environment configuration', () => {
      const parsed = webEnvironmentSchema.parse({
        WEB_PORT: '4002',
        NEXT_PUBLIC_API_URL: 'http://localhost:4002/api',
        API_INTERNAL_URL: 'http://127.0.0.1:4001',
      });
      expect(parsed.WEB_PORT).toBe(4002);
      expect(parsed.API_INTERNAL_URL).toBe('http://127.0.0.1:4001');
      expect(parsed.NEXT_PUBLIC_BASE_PATH).toBe('');
    });

    it('exige API_INTERNAL_URL: o BFF fala com a API por loopback', () => {
      expect(() =>
        webEnvironmentSchema.parse({
          WEB_PORT: '4002',
          NEXT_PUBLIC_API_URL: 'http://localhost:4002/api',
        }),
      ).toThrow();
    });

    it('aceita o base path da VM do CP2b', () => {
      const parsed = webEnvironmentSchema.parse({
        API_INTERNAL_URL: 'http://127.0.0.1:4001',
        NEXT_PUBLIC_BASE_PATH: '/arqueia',
      });
      expect(parsed.NEXT_PUBLIC_BASE_PATH).toBe('/arqueia');
    });

    it('rejeita base path sem barra inicial ou com barra final', () => {
      for (const value of ['arqueia', '/arqueia/', '/']) {
        expect(() =>
          webEnvironmentSchema.parse({
            API_INTERNAL_URL: 'http://127.0.0.1:4001',
            NEXT_PUBLIC_BASE_PATH: value,
          }),
        ).toThrow();
      }
    });

    it('validates worker environment configuration', () => {
      const parsed = workerEnvironmentSchema.parse({
        DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/arqueia_test',
        REDIS_URL: 'redis://localhost:6379',
      });
      expect(parsed.NODE_ENV).toBe('development');
    });
  });
});
