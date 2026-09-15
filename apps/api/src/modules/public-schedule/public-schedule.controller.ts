import {
  publicScheduleQuerySchema,
  type PublicLaboratory,
  type PublicScheduleResponse,
} from '@arqueia/contracts';
import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import type { z } from 'zod';

import { ZodValidationPipe } from '../../shared/interface/zod-validation.pipe.js';
import { PostgresPublicScheduleReader } from './postgres-public-schedule-reader.js';

/**
 * Agenda pública — o ÚNICO controller do Arqueia sem JwtAuthGuard.
 *
 * Tudo aqui é servido para a internet aberta, sem sessão. Duas regras ao mexer
 * neste arquivo:
 *   1. Não adicione endpoint que escreva. Somente leitura.
 *   2. Não amplie o retorno sem revisar os schemas em public-schedule.ts — eles
 *      são a fronteira do que é publicado.
 *
 * A janela de consulta é limitada pelo contrato (31 dias) para que a página não
 * vire um dump do histórico do laboratório.
 */
@Controller('api/public')
export class PublicScheduleController {
  public constructor(
    @Inject(PostgresPublicScheduleReader)
    private readonly reader: PostgresPublicScheduleReader,
  ) {}

  @Get('laboratories')
  public laboratories(): Promise<readonly PublicLaboratory[]> {
    return this.reader.listLaboratories();
  }

  @Get('schedule')
  public async schedule(
    @Query(new ZodValidationPipe(publicScheduleQuerySchema))
    query: z.output<typeof publicScheduleQuerySchema>,
  ): Promise<PublicScheduleResponse> {
    const response = await this.reader.listSchedule(query);
    if (!response) throw new NotFoundException({ code: 'LABORATORY_NOT_FOUND' });
    return response;
  }
}
