import {
  listCatalogOptionsQuerySchema,
  type AuthenticatedPrincipal,
  type CatalogOptionPage,
  type CatalogOptionKind,
} from '@arqueia/contracts';
import { Controller, Get, Inject, Query, UseFilters, UseGuards } from '@nestjs/common';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { ListCatalogOptionsUseCase } from '../application/list-catalog-options.use-case.js';
import { CurrentPrincipal } from '../../identity/interface/current-principal.decorator.js';
import { IdentityExceptionFilter } from '../../identity/interface/identity-exception.filter.js';
import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';

interface ParsedCatalogQuery {
  laboratoryId: string;
  kind: CatalogOptionKind;
  search?: string;
  cursor?: string;
  limit: number;
}

@Controller('api/catalog/options')
@UseGuards(JwtAuthGuard)
@UseFilters(IdentityExceptionFilter)
export class CatalogOptionsController {
  public constructor(
    @Inject(ListCatalogOptionsUseCase)
    private readonly listCatalogOptions: ListCatalogOptionsUseCase,
  ) {}

  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(listCatalogOptionsQuerySchema)) query: ParsedCatalogQuery,
  ): Promise<CatalogOptionPage> {
    return this.listCatalogOptions.execute(principal, query);
  }
}
