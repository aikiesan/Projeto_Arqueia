import { z } from 'zod';

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);

const serviceUrl = (protocols: readonly string[]) =>
  z.string().url().refine((value) => protocols.includes(new URL(value).protocol), {
    message: `Protocolo esperado: ${protocols.join(' ou ')}`,
  });

export const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  DATABASE_URL: serviceUrl(['postgres:', 'postgresql:']),
  REDIS_URL: serviceUrl(['redis:', 'rediss:']),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  PUBLIC_ORIGIN: z.string().url(),
  OIDC_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  OIDC_DISPLAY_NAME: z.string().trim().min(1).max(80).default('Entrar com Unicamp'),
  OIDC_AUTHORIZATION_URL: z.string().url().optional().or(z.literal('')),
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
