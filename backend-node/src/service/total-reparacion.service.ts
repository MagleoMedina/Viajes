import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DbSaverService } from '../common/db-saver.service';

/**
 * Repara total_bs y total_usd de TODOS los viajes con la formula vigente:
 *
 *   total_bs  = (monto del viaje $ x tasa)
 *              - (combustible + viaticos + peajes + pago a chofer + gastos varios)
 *   total_usd = total_bs / tasa  (0 si total_bs es 0 o la tasa es 0)
 *
 * La reparacion ya se ejecuto una vez (15/10/2026, sobre los 15 viajes
 * existentes). Los gatillos (arranque y pull) quedan COMENTADOS a proposito:
 * no se recalcula nada automaticamente. Descomentarlos si vuelve a hacer falta.
 */
@Injectable()
export class TotalReparacionService {
  private readonly logger = new Logger(TotalReparacionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dbSaver: DbSaverService,
  ) {}

  // Reparacion unica ya aplicada: sin recalculo en cada arranque.
  // async onModuleInit(): Promise<void> {
  //   await this.reparar();
  // }

  /** Recalcula los totales; devuelve cuantos viajes toco. */
  async reparar(): Promise<number> {
    const bruto = `ROUND(COALESCE(viajes.monto_viaje, 0) * COALESCE(viajes.tasa, 0))`;
    const gastos = `(
      COALESCE(viajes.combustible, 0) +
      COALESCE(viajes.viaticos, 0) +
      COALESCE(viajes.peajes, 0) +
      COALESCE(viajes.pago_chofer, 0) +
      COALESCE((SELECT SUM(g.monto) FROM gastos g WHERE g.viaje_id = viajes.id), 0)
    )`;
    const total = `(${bruto} - ${gastos})`;

    await this.dataSource.query(`
      UPDATE viajes SET
        total_bs = ${total},
        total_usd = CASE
          WHEN ${total} = 0 OR COALESCE(viajes.tasa, 0) = 0 THEN 0
          ELSE ROUND(${total} / viajes.tasa, 2)
        END
    `);

    // El UPDATE crudo no pasa por el interceptor que marca la base como sucia:
    // se marca a mano para que el volcado agrupado escriba los totales
    // corregidos a data/viajes.db.
    this.dbSaver.marcarSucia();

    const filas = await this.dataSource.query(
      'SELECT COUNT(*) AS n FROM viajes',
    );
    const cantidad = Number(filas?.[0]?.n ?? 0);
    this.logger.log(
      `Totales recalculados con la formula vigente sobre ${cantidad} viajes`,
    );
    return cantidad;
  }
}
