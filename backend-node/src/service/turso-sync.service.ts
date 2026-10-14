import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ApiException } from '../web/api-exception';

const ejecutar = promisify(execFile);

export interface EstadoSync {
  configurado: boolean;
  fecha: string | null;
  exito: boolean | null;
  mensaje: string | null;
}

/**
 * Respaldo diario de la base local hacia Turso.
 *
 * Turso es hosting/respaldo, no la base en vivo (ver scripts/sync-turso.js).
 * Se ejecuta el mismo script para no duplicar la logica de espejo. Si Turso no
 * esta configurado, se omite sin fallar.
 *
 * Cada corrida (cron 3 a.m. o manual) guarda fecha/exito/mensaje en
 * data/sync-estado.json, que el sidebar lee por GET /api/sync.
 */
@Injectable()
export class TursoSyncService {
  private readonly logger = new Logger(TursoSyncService.name);

  /** data/sync-estado.json junto a la base local. */
  private get archivo(): string {
    const base = process.env.DB_PATH
      ? dirname(process.env.DB_PATH)
      : join(process.cwd(), 'data');
    return join(base, 'sync-estado.json');
  }

  /** Ultima sincronizacion registrada; vacia si nunca corrio. */
  estado(): EstadoSync {
    const configurado = Boolean(
      process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN,
    );
    if (!existsSync(this.archivo)) {
      return { configurado, fecha: null, exito: null, mensaje: null };
    }
    try {
      const guardado = JSON.parse(readFileSync(this.archivo, 'utf8'));
      return { configurado, ...guardado };
    } catch {
      return { configurado, fecha: null, exito: null, mensaje: null };
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sincronizar(): Promise<void> {
    await this.ejecutarSync(false);
  }

  /** Boton del sidebar: corre el respaldo ahora y devuelve el estado nuevo. */
  async sincronizarManual(): Promise<EstadoSync> {
    return this.ejecutarSync(true);
  }

  /** Sincronizacion automatica (llamar despues de CRUD). Ejecuta el script sin lanzar excepciones al API. */
  async syncNow(): Promise<{exito: boolean; mensaje: string}> {
    try {
      const script = join(process.cwd(), 'scripts', 'sync-turso.js');
      const { stdout } = await ejecutar('node', [script], { env: process.env });
      return { exito: true, mensaje: stdout.trim() };
    } catch (e) {
      const mensaje = (e as Error).message;
      return { exito: false, mensaje };
    }
  }

  async pullFromTurso(password: string): Promise<{exito: boolean; mensaje: string}> {
    if (password !== '30696510') {
      return { exito: false, mensaje: 'Contraseña incorrecta' };
    }
    try {
      const script = join(process.cwd(), 'scripts', 'pull-from-turso.js');
      execSync('node "' + script + '"', { env: process.env });
      return { exito: true, mensaje: 'Pull completado' };
    } catch (e: any) {
      return { exito: false, mensaje: e.message };
    }
  }

  private async ejecutarSync(manual: boolean): Promise<EstadoSync> {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      this.logger.warn('Turso sin configurar: se omite el respaldo.');
      if (manual) {
        throw new ApiException(
          400,
          'Turso sin configurar: defina TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env',
        );
      }
      return this.estado();
    }
    const script = join(process.cwd(), 'scripts', 'sync-turso.js');
    try {
      const { stdout } = await ejecutar('node', [script], { env: process.env });
      this.logger.log(stdout.trim());
      return this.registrar(true, stdout.trim());
    } catch (e) {
      const mensaje = (e as Error).message;
      this.logger.error(`Fallo el respaldo a Turso: ${mensaje}`);
      return this.registrar(false, mensaje);
    }
  }

  private registrar(exito: boolean, mensaje: string): EstadoSync {
    mkdirSync(dirname(this.archivo), { recursive: true });
    const guardado = { fecha: new Date().toISOString(), exito, mensaje };
    writeFileSync(this.archivo, JSON.stringify(guardado, null, 2));
    return { configurado: true, ...guardado };
  }
}
