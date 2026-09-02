import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { loadApiEnvironment } from './configuration.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const environment = loadApiEnvironment();

  // The production API is bound to loopback and receives requests from the
  // Next.js BFF. Trust exactly that hop so Express derives request.ip from the
  // right-most forwarding address instead of application code parsing headers.
  const express = app.getHttpAdapter().getInstance() as {
    set(setting: string, value: string | number | boolean): void;
  };
  express.set('trust proxy', 1);

  app.enableShutdownHooks();
  app.enableCors({
    origin: environment.PUBLIC_ORIGIN,
    credentials: true,
  });

  await app.listen(environment.API_PORT, environment.API_HOST);
}

void bootstrap();
