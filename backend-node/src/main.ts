import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ipsLocales } from './common/sistema';

async function bootstrap() {
  // SQLite no crea directorios: el archivo data/viajes.db necesita que exista data/.
  if (!process.env.DB_PATH) {
    mkdirSync('data', { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  // Cualquier origen (otra PC, el celular) puede llamar /api sin CORS.
  app.enableCors();
  // Volcar la base local al recibir SIGTERM/CTRL+C (DbSaverService.onApplicationShutdown).
  app.enableShutdownHooks();
  // 0.0.0.0 escucha en localhost y en la IP de la red local.
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);

  const urls = [
    `http://localhost:${port}`,
    ...ipsLocales().map((ip) => `http://${ip}:${port}`),
  ];
  console.log(`Aplicación ejecutándose en ${urls.join('  |  ')}`);
}

void bootstrap();
