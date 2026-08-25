import * as net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRedisClient } from './redis.module.js';

describe('RedisModule & Native RedisClient', () => {
  let server: net.Server;
  let serverPort: number;

  beforeAll(async () => {
    server = net.createServer((socket) => {
      socket.on('data', (data) => {
        const text = data.toString();
        if (text.startsWith('PING')) {
          socket.write('+PONG\r\n');
        } else if (text.startsWith('AUTH secret')) {
          socket.write('+OK\r\n');
        } else if (text.startsWith('AUTH wrong')) {
          socket.write('-ERR invalid password\r\n');
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('connects to mock server and pings successfully', async () => {
    const client = createRedisClient({ url: `redis://127.0.0.1:${serverPort}` });
    const res = await client.ping(1000);
    expect(res).toBe('PONG');
  });

  it('authenticates with password and pings successfully', async () => {
    const client = createRedisClient({ url: `redis://:secret@127.0.0.1:${serverPort}` });
    const res = await client.ping(1000);
    expect(res).toBe('PONG');
  });

  it('rejects on wrong password', async () => {
    const client = createRedisClient({ url: `redis://:wrong@127.0.0.1:${serverPort}` });
    await expect(client.ping(1000)).rejects.toThrow(/Redis AUTH failed/);
  });

  it('rejects on connection refused when server is down', async () => {
    const client = createRedisClient({ url: 'redis://127.0.0.1:59998' });
    await expect(client.ping(500)).rejects.toThrow();
  });
});
