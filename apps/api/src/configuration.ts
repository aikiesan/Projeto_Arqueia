import { apiEnvironmentSchema, type ApiEnvironment } from '@arqueia/config';

let cachedEnvironment: ApiEnvironment | undefined;

export function loadApiEnvironment(): ApiEnvironment {
  cachedEnvironment ??= apiEnvironmentSchema.parse(process.env);
  return cachedEnvironment;
}
