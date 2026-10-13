import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { networkInterfaces } from 'os';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** IPv4 de red local (192.168.x.x, 10.x.x.x...): sin loopback ni link-local. */
function ipsLocales(): string[] {
  const ips: string[] = [];
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const dir of interfaces ?? []) {
      if (dir.family !== 'IPv4' || dir.internal) continue;
      if (dir.address.startsWith('169.254.')) continue;
      ips.push(dir.address);
    }
  }
  return ips;
}

async function bootstrap() {
  // SQLite no crea directorios: el archivo data/viajes.db necesita que exista data/.
  if (!process.env.DB_PATH) {
    mkdirSync('data', { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  // Cualquier origen (otra PC, el celular) puede llamar /api sin CORS.
  app.enableCors();
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
