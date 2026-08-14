import { describe, expect, it } from 'vitest';

import {
  adjustStockInputSchema,
  createBatchInputSchema,
  createProductInputSchema,
  withdrawStockInputSchema,
} from './index.js';

describe('Inventory Contracts (Checkpoint 1)', () => {
  const labId = '11111111-1111-4111-a111-111111111111';
  const productId = '22222222-2222-4222-a222-222222222222';
  const batchId = '33333333-3333-4333-a333-333333333333';
  const projectId = '44444444-4444-4444-a444-444444444444';

  it('validates a correct product input', () => {
    const productPayload = {
      laboratoryId: labId,
      code: 'ACT-PA-2.5L',
      name: 'Acetona PA 99.5%',
      casNumber: '67-64-1',
      category: 'SOLVENT' as const,
      unitOfMeasure: 'ML' as const,
      minimumStockThreshold: 5000,
      description: 'Solvente para limpeza e extração cromatográfica.',
    };

    const parsed = createProductInputSchema.parse(productPayload);
    expect(parsed.name).toBe('Acetona PA 99.5%');
    expect(parsed.category).toBe('SOLVENT');
    expect(parsed.unitOfMeasure).toBe('ML');
  });

  it('validates a batch entry input', () => {
    const batchPayload = {
      laboratoryId: labId,
      productId,
      batchNumber: 'LOT-2026-ACT1',
      manufacturer: 'Sigma-Aldrich',
      expirationDate: '2027-10-31T23:59:59.000Z',
      initialQuantity: 2500,
    };

    const parsed = createBatchInputSchema.parse(batchPayload);
    expect(parsed.batchNumber).toBe('LOT-2026-ACT1');
    expect(parsed.initialQuantity).toBe(2500);
  });

  it('rejects stock withdrawal missing mandatory projectId', () => {
    const invalidWithdrawal = {
      laboratoryId: labId,
      batchId,
      quantity: 500,
      purpose: 'Extração de metabólitos foliares',
    };

    expect(() => withdrawStockInputSchema.parse(invalidWithdrawal)).toThrow();
  });

  it('validates stock withdrawal input with valid project and purpose', () => {
    const validWithdrawal = {
      laboratoryId: labId,
      batchId,
      projectId,
      quantity: 500,
      purpose: 'Extração de metabólitos foliares',
      notes: 'Usado 2 frascos de 250mL.',
    };

    const parsed = withdrawStockInputSchema.parse(validWithdrawal);
    expect(parsed.quantity).toBe(500);
    expect(parsed.projectId).toBe(projectId);
  });

  it('requires a minimum 10 character audit reason for manual stock adjustment', () => {
    const shortReason = {
      laboratoryId: labId,
      batchId,
      newBalance: 1800,
      reason: 'Ajuste', // less than 10 chars
    };

    expect(() => adjustStockInputSchema.parse(shortReason)).toThrow(
      'A justificativa de ajuste deve ter no mínimo 10 caracteres.',
    );

    const validReason = {
      laboratoryId: labId,
      batchId,
      newBalance: 1800,
      reason: 'Ajuste pós-inventário físico de fim de mês.',
    };

    const parsed = adjustStockInputSchema.parse(validReason);
    expect(parsed.newBalance).toBe(1800);
  });
});
