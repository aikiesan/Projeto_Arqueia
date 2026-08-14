import {
  adjustStockInputSchema,
  createBatchInputSchema,
  createProductInputSchema,
  listBatchesQuerySchema,
  listProductsQuerySchema,
  listStockMovementsQuerySchema,
  withdrawStockInputSchema,
  type AdjustStockInput,
  type AuthenticatedPrincipal,
  type Batch,
  type BatchPage,
  type CreateBatchInput,
  type CreateProductInput,
  type ListBatchesQuery,
  type ListProductsQuery,
  type ListStockMovementsQuery,
  type Product,
  type ProductPage,
  type StockMovement,
  type StockMovementPage,
  type WithdrawStockInput,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { InventoryExceptionFilter } from './inventory-exception.filter.js';
import { CurrentPrincipal } from '../../identity/interface/current-principal.decorator.js';
import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';
import { AdjustStockUseCase } from '../application/adjust-stock.use-case.js';
import { CreateBatchEntryUseCase } from '../application/create-batch-entry.use-case.js';
import { CreateProductUseCase } from '../application/create-product.use-case.js';
import { ListBatchesUseCase } from '../application/list-batches.use-case.js';
import { ListProductsUseCase } from '../application/list-products.use-case.js';
import { ListStockMovementsUseCase } from '../application/list-stock-movements.use-case.js';
import { WithdrawStockUseCase } from '../application/withdraw-stock.use-case.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from '../domain/ports/inventory-repository.port.js';

function requestContext(req: Request, requestId?: string): { origin: string; requestId: string | null } {
  return {
    origin: req.ip ?? 'api:http',
    requestId: requestId !== undefined && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null,
  };
}

@Controller('api/inventory')
@UseGuards(JwtAuthGuard)
@UseFilters(InventoryExceptionFilter)
export class InventoryController {
  public constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly repository: InventoryRepository,
    @Inject(CreateProductUseCase) private readonly createProductUseCase: CreateProductUseCase,
    @Inject(ListProductsUseCase) private readonly listProductsUseCase: ListProductsUseCase,
    @Inject(CreateBatchEntryUseCase) private readonly createBatchEntryUseCase: CreateBatchEntryUseCase,
    @Inject(ListBatchesUseCase) private readonly listBatchesUseCase: ListBatchesUseCase,
    @Inject(WithdrawStockUseCase) private readonly withdrawStockUseCase: WithdrawStockUseCase,
    @Inject(AdjustStockUseCase) private readonly adjustStockUseCase: AdjustStockUseCase,
    @Inject(ListStockMovementsUseCase)
    private readonly listStockMovementsUseCase: ListStockMovementsUseCase,
  ) {}

  @Post('products')
  public createProduct(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Product> {
    const input = createProductInputSchema.parse(body) as CreateProductInput;
    return this.createProductUseCase.execute(principal, input, requestContext(req, requestId));
  }

  @Get('products')
  public listProducts(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<ProductPage> {
    const parsedQuery = listProductsQuerySchema.parse(query) as ListProductsQuery;
    return this.listProductsUseCase.execute(principal, parsedQuery);
  }

  @Post('batches')
  public createBatchEntry(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('x-request-id') requestId?: string,
  ): Promise<Batch> {
    const input = createBatchInputSchema.parse(body) as CreateBatchInput;
    return this.createBatchEntryUseCase.execute(principal, input, requestContext(req, requestId));
  }

  @Get('batches')
  public listBatches(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<BatchPage> {
    const parsedQuery = listBatchesQuerySchema.parse(query) as ListBatchesQuery;
    return this.listBatchesUseCase.execute(principal, parsedQuery);
  }

  @Get('batches/by-qr/:qrCode')
  public async getBatchByQr(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('qrCode') qrCode: string,
  ): Promise<Batch> {
    const batch = await this.repository.findBatchByQrCode(qrCode);
    if (!batch) {
      throw new Error(`Lote com QR Code ${qrCode} não foi encontrado.`);
    }
    return batch;
  }

  @Post('withdrawals')
  public withdrawStock(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('x-request-id') requestId?: string,
  ): Promise<StockMovement> {
    const input = withdrawStockInputSchema.parse(body) as WithdrawStockInput;
    return this.withdrawStockUseCase.execute(principal, input, requestContext(req, requestId));
  }

  @Post('adjustments')
  public adjustStock(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('x-request-id') requestId?: string,
  ): Promise<StockMovement> {
    const input = adjustStockInputSchema.parse(body) as AdjustStockInput;
    return this.adjustStockUseCase.execute(principal, input, requestContext(req, requestId));
  }

  @Get('movements')
  public listMovements(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: unknown,
  ): Promise<StockMovementPage> {
    const parsedQuery = listStockMovementsQuerySchema.parse(query) as ListStockMovementsQuery;
    return this.listStockMovementsUseCase.execute(principal, parsedQuery);
  }
}
