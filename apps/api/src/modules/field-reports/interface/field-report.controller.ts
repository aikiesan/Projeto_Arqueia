import {
  fieldReportParamsSchema,
  fieldReportSummaryQuerySchema,
  listFieldReportsQuerySchema,
  reviewFieldReportInputSchema,
  type AuthenticatedPrincipal,
  type FieldReport,
  type FieldReportPage,
  type FieldReportSummary,
  type ListFieldReportsQuery,
  type ParsedReviewFieldReportInput,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { CurrentPrincipal } from '../../identity/interface/current-principal.decorator.js';
import { JwtAuthGuard } from '../../identity/interface/jwt-auth.guard.js';
import { ListFieldReportsUseCase } from '../application/list-field-reports.use-case.js';
import { ReviewFieldReportUseCase } from '../application/review-field-report.use-case.js';
import { SummarizeFieldReportsUseCase } from '../application/summarize-field-reports.use-case.js';
import { FieldReportExceptionFilter } from './field-report-exception.filter.js';
import { requestContext } from './request-context.js';

/** Leitura e triagem dos informes — só para quem tem `field-report.review`. */
@Controller('api/field-reports')
@UseGuards(JwtAuthGuard)
@UseFilters(FieldReportExceptionFilter)
export class FieldReportController {
  public constructor(
    @Inject(ListFieldReportsUseCase) private readonly listReports: ListFieldReportsUseCase,
    @Inject(SummarizeFieldReportsUseCase)
    private readonly summarizeReports: SummarizeFieldReportsUseCase,
    @Inject(ReviewFieldReportUseCase) private readonly reviewReport: ReviewFieldReportUseCase,
  ) {}

  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(listFieldReportsQuerySchema)) query: ListFieldReportsQuery,
  ): Promise<FieldReportPage> {
    return this.listReports.execute(principal, query);
  }

  @Get('summary')
  public summary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(fieldReportSummaryQuerySchema))
    query: z.output<typeof fieldReportSummaryQuerySchema>,
  ): Promise<FieldReportSummary> {
    return this.summarizeReports.execute(principal, query.laboratoryId);
  }

  @Patch(':fieldReportId')
  public review(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param(new ZodValidationPipe(fieldReportParamsSchema))
    params: z.output<typeof fieldReportParamsSchema>,
    @Body(new ZodValidationPipe(reviewFieldReportInputSchema)) input: ParsedReviewFieldReportInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<FieldReport> {
    return this.reviewReport.execute(
      principal,
      params.fieldReportId,
      input,
      requestContext('api:http', requestId),
    );
  }
}
