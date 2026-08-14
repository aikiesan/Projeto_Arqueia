import { loadWorkerConfiguration } from './configuration.js';

const configuration = loadWorkerConfiguration(process.env);
const redisEndpoint = new URL(configuration.redisUrl);

console.info(
  `[worker] iniciado em ${configuration.nodeEnvironment}; Redis em ${redisEndpoint.hostname}:${redisEndpoint.port || '6379'}`,
);

// Mantem o processo pronto para receber os consumidores de fila da Fase 3.
// O timer nao implementa regras de negocio nem depende do ambiente Docker.
const lifecycleTimer = setInterval(() => undefined, 60_000);

function shutdown(signal: NodeJS.Signals): void {
  console.info(`[worker] encerrando apos ${signal}`);
  clearInterval(lifecycleTimer);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
