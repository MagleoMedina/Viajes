import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const ejecutar = promisify(execFile);

/**
 * Respaldo diario de la base local hacia Turso.
 *
 * Turso es hosting/respaldo, no la base en vivo (ver scripts/sync-turso.js).
 * Se ejecuta el mismo script para no duplicar la logica de espejo. Si Turso no
 * esta configurado, se omite sin fallar.
 */
@Injectable()
export class TursoSyncService {
  private readonly logger = new Logger(TursoSyncService.name);

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sincronizar(): Promise<void> {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      this.logger.warn('Turso sin configurar: se omite el respaldo diario.');
      return;
    }
    const script = join(process.cwd(), 'scripts', 'sync-turso.js');
    try {
      const { stdout } = await ejecutar('node', [script], { env: process.env });
      this.logger.log(stdout.trim());
    } catch (e) {
      this.logger.error(`Fallo el respaldo a Turso: ${(e as Error).message}`);
    }
  }
}
