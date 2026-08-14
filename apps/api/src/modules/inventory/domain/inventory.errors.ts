export class InsufficientStockError extends Error {
  public readonly code = 'INSUFFICIENT_STOCK' as const;

  public constructor(
    public readonly requestedQuantity: number,
    public readonly currentBalance: number,
  ) {
    super(
      `Saldo insuficiente no lote (solicitado: ${requestedQuantity}, disponível em estoque: ${currentBalance}).`,
    );
    this.name = 'InsufficientStockError';
  }
}

export class ProductNotFoundError extends Error {
  public constructor(public readonly productId: string) {
    super(`Produto ${productId} não foi encontrado.`);
    this.name = 'ProductNotFoundError';
  }
}

export class ProductConflictError extends Error {
  public constructor() {
    super('Já existe um produto cadastrado com este código no laboratório.');
    this.name = 'ProductConflictError';
  }
}

export class BatchNotFoundError extends Error {
  public constructor(public readonly identifier: string) {
    super(`Lote ${identifier} não foi encontrado.`);
    this.name = 'BatchNotFoundError';
  }
}
