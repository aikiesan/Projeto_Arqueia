import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);

const serviceUrl = (protocols: readonly string[]) =>
  z.string().url().refine((value) => protocols.includes(new URL(value).protocol), {
    message: `Protocolo esperado: ${protocols.join(' ou ')}`,
  });

export const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  API_HOST: z.string().trim().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  DATABASE_URL: serviceUrl(['postgres:', 'postgresql:']),
  REDIS_URL: serviceUrl(['redis:', 'rediss:']),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  PUBLIC_ORIGIN: z.string().url(),
  OIDC_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  OIDC_DISPLAY_NAME: z.string().trim().min(1).max(80).default('Entrar com Unicamp'),
  OIDC_AUTHORIZATION_URL: z.string().url().optional().or(z.literal('')),
  OIDC_ISSUER_URL: z.string().url().optional().or(z.literal('')),
  OIDC_CLIENT_ID: z.string().trim().optional().or(z.literal('')),
  OIDC_CLIENT_SECRET: z.string().optional().or(z.literal('')),
  SMTP_HOST: z.string().trim().optional().or(z.literal('')),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587).optional(),
  SMTP_USER: z.string().trim().optional().or(z.literal('')),
  SMTP_PASSWORD: z.string().optional().or(z.literal('')),
  SMTP_FROM: z.string().trim().optional().or(z.literal('')),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_DURATION_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
});

export const workerEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  DATABASE_URL: serviceUrl(['postgres:', 'postgresql:']),
  REDIS_URL: serviceUrl(['redis:', 'rediss:']),
});

export const webEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  WEB_PORT: z.coerce.number().int().min(1).max(65_535).default(4002),
  NEXT_PUBLIC_API_URL: z.string().url(),
  API_INTERNAL_URL: z.string().url().optional(),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;
export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;
