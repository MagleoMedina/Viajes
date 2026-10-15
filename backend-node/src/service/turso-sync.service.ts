import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { SqljsDriver } from 'typeorm/driver/sqljs/SqljsDriver';
import { DbSaverService } from '../common/db-saver.service';
import { TotalReparacionService } from './total-reparacion.service';
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

  constructor(
    private readonly dataSource: DataSource,
    private readonly dbSaver: DbSaverService,
    private readonly totales: TotalReparacionService,
  ) {}

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
    const script = join(process.cwd(), 'scripts', 'pull-from-turso.js');
    let stdout = '';
    try {
      // Async a proposito: con execSync el backend entero deja de responder
      // durante todo el pull (puede tardar minutos con bases grandes).
      const salida = await ejecutar('node', [script], { env: process.env });
      stdout = salida.stdout ?? '';
    } catch (e: any) {
      return { exito: false, mensaje: e.message };
    }
    try {
      await this.recargarBaseLocal();
    } catch (e) {
      return {
        exito: false,
        mensaje: `Pull guardado en disco, pero el backend no pudo recargarlo: ${(e as Error).message}`,
      };
    }
    // Reparacion unica ya aplicada (15/10/2026): sin recalculo tras el pull.
    // try {
    //   await this.totales.reparar();
    // } catch (e) {
    //   this.logger.warn(
    //     `Pull completado, pero los totales no se pudieron recalcular: ${(e as Error).message}`,
    //   );
    // }
    return { exito: true, mensaje: stdout.trim() || 'Pull completado' };
  }

  /**
   * TypeORM corre sobre sqljs: la base vive en memoria y `autoSave` la escribe a
   * data/viajes.db tras cada operacion. El pull solo reemplaza el archivo, asi
   * que hay que importarlo otra vez en el driver; sin esto la interfaz seguira
   * mostrando la copia vieja (y el autoSave la reescribiria encima) hasta
   * reiniciar el backend.
   */
  private async recargarBaseLocal(): Promise<void> {
    // Ningun volcar pendiente puede escribir la copia vieja encima del pull.
    this.dbSaver.cancelar();
    const driver = this.dataSource.driver as SqljsDriver;
    const ubicacion = driver.options.location ?? 'data/viajes.db';
    driver.databaseConnection.close();
    // load() crea una conexion nueva desde el archivo y re-aplica foreign_keys.
    await driver.load(ubicacion);
    this.logger.log(`Base local recargada desde ${ubicacion}`);
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
