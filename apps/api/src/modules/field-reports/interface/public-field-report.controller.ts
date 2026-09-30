import {
  publicFieldReportFormQuerySchema,
  submitFieldReportInputSchema,
  type ParsedSubmitFieldReportInput,
  type PublicFieldReportForm,
  type SubmitFieldReportResult,
} from '@arqueia/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../../shared/interface/zod-validation.pipe.js';
import { GetPublicFieldReportFormUseCase } from '../application/get-public-field-report-form.use-case.js';
import { SubmitFieldReportUseCase } from '../application/submit-field-report.use-case.js';
import { FieldReportExceptionFilter } from './field-report-exception.filter.js';
import { FieldReportRateLimitGuard } from './field-report-rate-limit.guard.js';
import { requestContext } from './request-context.js';

/**
 * Informes públicos — servido para a internet aberta, SEM JwtAuthGuard.
 *
 * Fora do login, é o único endpoint do Arqueia que GRAVA conteúdo sem sessão,
 * por decisão do laboratório (quem escaneia a etiqueta não precisa de conta).
 * Regras ao mexer aqui:
 *   1. Nada que leia informes. Ler é só em `FieldReportController`, com
 *      permissão `field-report.review`.
 *   2. O envio passa sempre pelo `FieldReportRateLimitGuard`.
 *   3. O formulário expõe só o que `publicFieldReportFormSchema` permite.
 */
@Controller('api/public/field-reports')
@UseFilters(FieldReportExceptionFilter)
export class PublicFieldReportController {
  public constructor(
    @Inject(GetPublicFieldReportFormUseCase)
    private readonly getForm: GetPublicFieldReportFormUseCase,
    @Inject(SubmitFieldReportUseCase) private readonly submitReport: SubmitFieldReportUseCase,
  ) {}

  @Get('form')
  public form(
    @Query(new ZodValidationPipe(publicFieldReportFormQuerySchema))
    query: z.output<typeof publicFieldReportFormQuerySchema>,
  ): Promise<PublicFieldReportForm> {
    return this.getForm.execute(query.laboratoryId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(FieldReportRateLimitGuard)
  public submit(
    @Body(new ZodValidationPipe(submitFieldReportInputSchema)) input: ParsedSubmitFieldReportInput,
    @Headers('x-request-id') requestId?: string,
  ): Promise<SubmitFieldReportResult> {
    return this.submitReport.execute(input, requestContext('api:public', requestId));
  }
}
