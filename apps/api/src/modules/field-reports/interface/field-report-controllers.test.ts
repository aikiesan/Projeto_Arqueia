import 'reflect-metadata';

import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it } from 'vitest';

import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';
import { FieldReportController } from './field-report.controller.js';
import { FieldReportRateLimitGuard } from './field-report-rate-limit.guard.js';
import { PublicFieldReportController } from './public-field-report.controller.js';

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];
}

describe('Fronteira pública × restrita dos informes', () => {
  it('o envio público passa sempre pelo limite de envios por origem', () => {
    expect(guardsOf(PublicFieldReportController.prototype.submit)).toContain(
      FieldReportRateLimitGuard,
    );
  });

  it('o controller público não expõe leitura de informes', () => {
    const methods = Object.getOwnPropertyNames(PublicFieldReportController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(methods.sort()).toEqual(['form', 'submit']);
  });

  it('leitura e triagem exigem sessão', () => {
    expect(guardsOf(FieldReportController)).toContain(JwtAuthGuard);
  });
});
