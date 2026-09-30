import { describe, expect, it } from 'vitest';

import { buildFieldReportQrPayload } from './field-report-qr';

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const equipmentId = '22222222-2222-4222-a222-222222222222';

describe('buildFieldReportQrPayload', () => {
  it('aponta para o formulário público sob o subcaminho de produção', () => {
    expect(buildFieldReportQrPayload('https://cp2b.unicamp.br/', '/arqueia', laboratoryId)).toBe(
      `https://cp2b.unicamp.br/arqueia/informar?laboratory=${laboratoryId}`,
    );
  });

  it('funciona na raiz do domínio e pré-seleciona o equipamento', () => {
    expect(buildFieldReportQrPayload('http://localhost:4002', '', laboratoryId, equipmentId)).toBe(
      `http://localhost:4002/informar?laboratory=${laboratoryId}&equipment=${equipmentId}`,
    );
  });

  it('nunca aponta para a rota /qr, que exige login', () => {
    expect(buildFieldReportQrPayload('https://cp2b.unicamp.br', '/arqueia', laboratoryId)).not.toContain(
      '/qr?',
    );
  });
});
