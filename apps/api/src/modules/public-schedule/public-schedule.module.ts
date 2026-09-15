import type { DatabasePool } from '@arqueia/database';
import { Module } from '@nestjs/common';

import { DATABASE_POOL, DatabaseModule } from '../../shared/infrastructure/database.module.js';
import { PostgresPublicScheduleReader } from './postgres-public-schedule-reader.js';
import { PublicScheduleController } from './public-schedule.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PublicScheduleController],
  providers: [
    {
      provide: PostgresPublicScheduleReader,
      inject: [DATABASE_POOL],
      useFactory: (pool: DatabasePool) => new PostgresPublicScheduleReader(pool),
    },
  ],
})
export class PublicScheduleModule {}
