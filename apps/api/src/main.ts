import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { loadApiEnvironment } from './configuration.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const environment = loadApiEnvironment();

  app.enableShutdownHooks();
  app.enableCors({
    origin: environment.PUBLIC_ORIGIN,
    credentials: true,
  });

  await app.listen(environment.API_PORT, '0.0.0.0');
}

void bootstrap();
