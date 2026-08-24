import net from 'node:net';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRedisClient } from './redis.module.js';

describe('createRedisClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockSocket() {
    const socket = new EventEmitter() as EventEmitter & {
      write: ReturnType<typeof vi.fn>;
      setTimeout: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };
    socket.write = vi.fn();
    socket.setTimeout = vi.fn();
    socket.destroy = vi.fn();
    socket.end = vi.fn();
    return socket;
  }

  it('returns PONG on successful socket response', async () => {
    const mockSocket = createMockSocket();

    vi.spyOn(net, 'createConnection').mockImplementation(() => {
      setTimeout(() => {
        mockSocket.emit('connect');
        mockSocket.emit('data', Buffer.from('+PONG\r\n'));
      }, 5);
      return mockSocket as unknown as net.Socket;
    });

    const client = createRedisClient({ url: 'redis://localhost:6379' });
    const result = await client.ping(1000);

    expect(result).toBe('PONG');
    expect(mockSocket.write).toHaveBeenCalledWith('PING\r\n');
    expect(mockSocket.end).toHaveBeenCalled();
  });

  it('authenticates with password when present in REDIS_URL', async () => {
    const mockSocket = createMockSocket();

    vi.spyOn(net, 'createConnection').mockImplementation(() => {
      setTimeout(() => {
        mockSocket.emit('connect');
        // after AUTH, respond +OK
        mockSocket.emit('data', Buffer.from('+OK\r\n'));
        // after PING, respond +PONG
        mockSocket.emit('data', Buffer.from('+PONG\r\n'));
      }, 5);
      return mockSocket as unknown as net.Socket;
    });

    const client = createRedisClient({ url: 'redis://:secretpass@localhost:6379' });
    const result = await client.ping(1000);

    expect(result).toBe('PONG');
    expect(mockSocket.write).toHaveBeenCalledWith('AUTH secretpass\r\n');
  });

  it('waits for a secure TLS connection before sending PING for rediss URLs', async () => {
    const mockSocket = createMockSocket();

    vi.spyOn(tls, 'connect').mockImplementation(() => {
      setTimeout(() => {
        mockSocket.emit('secureConnect');
        mockSocket.emit('data', Buffer.from('+PONG\r\n'));
      }, 5);
      return mockSocket as unknown as tls.TLSSocket;
    });

    const client = createRedisClient({ url: 'rediss://localhost:6380' });
    await expect(client.ping(1000)).resolves.toBe('PONG');

    expect(mockSocket.write).toHaveBeenCalledWith('PING\r\n');
  });

  it('rejects on socket error event', async () => {
    const mockSocket = createMockSocket();

    vi.spyOn(net, 'createConnection').mockImplementation(() => {
      setTimeout(() => {
        mockSocket.emit('error', new Error('ECONNREFUSED'));
      }, 5);
      return mockSocket as unknown as net.Socket;
    });

    const client = createRedisClient({ url: 'redis://localhost:6379' });
    await expect(client.ping(1000)).rejects.toThrow('ECONNREFUSED');
  });

  it('rejects when socket times out', async () => {
    const mockSocket = createMockSocket();

    vi.spyOn(net, 'createConnection').mockImplementation(() => {
      setTimeout(() => {
        mockSocket.emit('timeout');
      }, 5);
      return mockSocket as unknown as net.Socket;
    });

    const client = createRedisClient({ url: 'redis://localhost:6379' });
    await expect(client.ping(1000)).rejects.toThrow('timed out');
  });
});
