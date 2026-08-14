import { createDatabasePool, type DatabasePool } from '@arqueia/database';
import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';

import { loadApiEnvironment } from '../../configuration.js';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

@Injectable()
class DatabasePoolLifecycle implements OnApplicationShutdown {
  public constructor(@Inject(DATABASE_POOL) private readonly pool: DatabasePool) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: (): DatabasePool => {
        const environment = loadApiEnvironment();
        return createDatabasePool({ connectionString: environment.DATABASE_URL });
      },
    },
    DatabasePoolLifecycle,
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
