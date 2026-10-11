import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // SQLite no crea directorios: el archivo data/viajes.db necesita que exista data/.
  if (!process.env.DB_PATH) {
    mkdirSync('data', { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 8080);
}

void bootstrap();