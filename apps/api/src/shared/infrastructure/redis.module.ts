import net from 'node:net';
import tls from 'node:tls';
import { URL } from 'node:url';

import { Global, Module } from '@nestjs/common';

import { loadApiEnvironment } from '../../configuration.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export interface RedisClient {
  ping(timeoutMs?: number): Promise<string>;
}

export function createRedisClient(options: { url: string }): RedisClient {
  const parsed = new URL(options.url);
  const isTls = parsed.protocol === 'rediss:';
  const host = parsed.hostname || '127.0.0.1';
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 6379;
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  return {
    async ping(timeoutMs = 2000): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        let socket: net.Socket;

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            if (socket) socket.destroy();
            reject(new Error('Redis ping timed out'));
          }
        }, timeoutMs);

        const cleanup = () => {
          clearTimeout(timer);
        };

        try {
          socket = isTls
            ? tls.connect({
                host,
                port,
                timeout: timeoutMs,
                servername: host,
                rejectUnauthorized: true,
              })
            : net.createConnection({ host, port, timeout: timeoutMs });
        } catch (err) {
          cleanup();
          return reject(err);
        }

        socket.setTimeout(timeoutMs);

        socket.on('error', (err) => {
          if (!settled) {
            settled = true;
            cleanup();
            socket.destroy();
            reject(err);
          }
        });

        socket.on('timeout', () => {
          if (!settled) {
            settled = true;
            cleanup();
            socket.destroy();
            reject(new Error('Redis socket timed out'));
          }
        });

        let authenticated = !password;

        socket.on(isTls ? 'secureConnect' : 'connect', () => {
          if (password) {
            socket.write(`AUTH ${password}\r\n`);
          } else {
            socket.write('PING\r\n');
          }
        });

        socket.on('data', (data) => {
          const response = data.toString();
          if (!authenticated) {
            if (response.startsWith('+OK')) {
              authenticated = true;
              socket.write('PING\r\n');
            } else {
              if (!settled) {
                settled = true;
                cleanup();
                socket.destroy();
                reject(new Error(`Redis authentication failed: ${response.trim()}`));
              }
            }
          } else {
            if (!settled) {
              settled = true;
              cleanup();
              socket.end();
              if (response.includes('PONG') || response.startsWith('+PONG')) {
                resolve('PONG');
              } else {
                reject(new Error(`Unexpected Redis response: ${response.trim()}`));
              }
            }
          }
        });
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
