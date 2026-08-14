export type WorkerEnvironment = 'development' | 'test' | 'production';

export interface WorkerConfiguration {
  nodeEnvironment: WorkerEnvironment;
  redisUrl: string;
}

const SUPPORTED_ENVIRONMENTS = new Set<WorkerEnvironment>([
  'development',
  'test',
  'production',
]);

export function loadWorkerConfiguration(
  environment: NodeJS.ProcessEnv,
): WorkerConfiguration {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';

  if (!SUPPORTED_ENVIRONMENTS.has(nodeEnvironment as WorkerEnvironment)) {
    throw new Error(`NODE_ENV invalido: ${nodeEnvironment}`);
  }

  const redisUrl = environment.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL e obrigatoria');
  }

  const parsedRedisUrl = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(parsedRedisUrl.protocol)) {
    throw new Error('REDIS_URL deve usar o protocolo redis:// ou rediss://');
  }

  return {
    nodeEnvironment: nodeEnvironment as WorkerEnvironment,
    redisUrl,
  };
}
