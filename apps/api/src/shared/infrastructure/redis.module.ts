import * as net from 'node:net';
import * as tls from 'node:tls';
import { Global, Module } from '@nestjs/common';
import { loadApiEnvironment } from '../../configuration.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export interface RedisClient {
  ping(timeoutMs?: number): Promise<string>;
}

export interface RedisClientOptions {
  url: string;
}

export function createRedisClient(options: RedisClientOptions): RedisClient {
  const parsed = new URL(options.url);
  const isTls = parsed.protocol === 'rediss:';
  const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
  const host = parsed.hostname || '127.0.0.1';
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  return {
    async ping(timeoutMs = 2000): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        let socket: net.Socket | tls.TLSSocket | null = null;
        let settled = false;

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            if (socket && !socket.destroyed) {
              socket.destroy();
            }
            reject(new Error(`Redis ping timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        const cleanup = () => {
          clearTimeout(timer);
          if (socket && !socket.destroyed) {
            socket.destroy();
          }
        };

        const onDone = (err?: Error, result?: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (err) {
            reject(err);
          } else {
            resolve(result ?? 'PONG');
          }
        };

        try {
          const socketOptions = { host, port };
          if (isTls) {
            socket = tls.connect({
              ...socketOptions,
              servername: host,
              rejectUnauthorized: true,
            });
          } else {
            socket = net.createConnection(socketOptions);
          }

          socket.setTimeout(timeoutMs);

          socket.on('error', (err) => {
            onDone(err);
          });

          socket.on('timeout', () => {
            onDone(new Error(`Socket connection timed out after ${timeoutMs}ms`));
          });

          let authenticated = !password;

          const onConnected = () => {
            if (password) {
              socket?.write(`AUTH ${password}\r\n`);
            } else {
              socket?.write('PING\r\n');
            }
          };

          if (isTls) {
            (socket as tls.TLSSocket).on('secureConnect', onConnected);
          } else {
            socket.on('connect', onConnected);
          }

          socket.on('data', (data) => {
            const response = data.toString();
            if (!authenticated) {
              if (response.startsWith('+OK')) {
                authenticated = true;
                socket?.write('PING\r\n');
                return;
              } else {
                onDone(new Error(`Redis AUTH failed: ${response.trim()}`));
                return;
              }
            }

            if (response.startsWith('+PONG') || response.trim() === 'PONG') {
              onDone(undefined, 'PONG');
            } else if (response.startsWith('-')) {
              onDone(new Error(`Redis error: ${response.trim()}`));
            } else {
              onDone(undefined, response.trim());
            }
          });
        } catch (err) {
          onDone(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },
  };
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): RedisClient => {
        const environment = loadApiEnvironment();
        return createRedisClient({ url: environment.REDIS_URL });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
