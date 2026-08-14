import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import {
  BatchNotFoundError,
  InsufficientStockError,
  ProductConflictError,
  ProductNotFoundError,
} from '../domain/inventory.errors.js';

@Catch(
  InsufficientStockError,
  ProductNotFoundError,
  ProductConflictError,
  BatchNotFoundError,
)
export class InventoryExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof InsufficientStockError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        requestedQuantity: exception.requestedQuantity,
        currentBalance: exception.currentBalance,
      });
      return;
    }

    if (exception instanceof ProductConflictError) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        code: 'PRODUCT_CONFLICT',
        message: exception.message,
      });
      return;
    }

    if (
      exception instanceof ProductNotFoundError ||
      exception instanceof BatchNotFoundError
    ) {
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: exception.message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno ao processar operação de estoque.',
    });
  }
}
