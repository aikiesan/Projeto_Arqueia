import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IdentityModule } from './identity.module.js';
import { AccessController } from './interface/access.controller.js';
import { AuthController } from './interface/auth.controller.js';
import { LaboratoriesController } from './interface/laboratories.controller.js';
import { ProjectsController } from './interface/projects.controller.js';
import { UsersController } from './interface/users.controller.js';

describe('IdentityModule composition', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves controllers and their explicit use-case tokens', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://arqueia:test@localhost:5432/arqueia_test');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('JWT_SECRET', 'test-secret-with-at-least-32-characters');
    vi.stubEnv('PUBLIC_ORIGIN', 'http://localhost:4002');

    const module = await Test.createTestingModule({ imports: [IdentityModule] }).compile();

    expect(module.get(AuthController)).toBeInstanceOf(AuthController);
    expect(module.get(UsersController)).toBeInstanceOf(UsersController);
    expect(module.get(LaboratoriesController)).toBeInstanceOf(LaboratoriesController);
    expect(module.get(ProjectsController)).toBeInstanceOf(ProjectsController);
    expect(module.get(AccessController)).toBeInstanceOf(AccessController);

    await module.close();
  });
});
