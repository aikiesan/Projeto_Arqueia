import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the stable process health contract', () => {
    expect(new HealthController().getHealth()).toEqual({
      status: 'ok',
      service: 'arqueia-api',
    });
  });
});
