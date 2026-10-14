import { Injectable, Logger, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SqljsDriver } from 'typeorm/driver/sqljs/SqljsDriver';

/** Espera sin escrituras antes de volcar la base a disco. */
const ESPERA_MS = 900;

/**
 * sql.js guarda la base EN MEMORIA; con `autoSave` de TypeORM, cada operacion
 * exporta la base COMPLETA y la escribe a disco de forma sincrona. Con miles de
 * registros eso satura el event loop del backend: cada peticion tarda y la
 * interfaz deja de responder.
 *
 * Este servicio agrupa los guardados: marcarSucia() tras cada escritura y un
 * unico volcar cuando ya no hay actividad (mas uno al cerrar la aplicacion).
 * Riesgo aceptado: una caida abrupta pierde a lo sumo ESPERA_MS de escrituras.
 */
@Injectable()
export class DbSaverService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(DbSaverService.name);
  private timer: NodeJS.Timeout | null = null;
  private sucia = false;

  constructor(private readonly dataSource: DataSource) {}

  /** Llamar tras cualquier POST/PUT/PATCH/DELETE. */
  marcarSucia(): void {
    this.sucia = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.volcar();
    }, ESPERA_MS);
  }

  /** Anula el volcar pendiente, para no escribir encima de un pull en curso. */
  cancelar(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.sucia = false;
  }

  /** Volcado inmediato a data/viajes.db. */
  async volcar(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.sucia) return;
    this.sucia = false;
    try {
      await (this.dataSource.driver as SqljsDriver).save();
    } catch (e) {
      this.sucia = true;
      this.logger.error(`No se pudo guardar la base local: ${(e as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.volcar();
  }
}
