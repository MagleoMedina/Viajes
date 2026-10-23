import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SqljsDriver } from 'typeorm/driver/sqljs/SqljsDriver';

const logger = new Logger('Migraciones');

interface ColumnaNueva {
  tabla: string;
  columna: string;
  ddl: string;
}

/** Columnas nuevas que puede no tener una base ya existente. */
const COLUMNAS: ColumnaNueva[] = [
  {
    tabla: 'ingresos',
    columna: 'factura_num',
    ddl: 'ALTER TABLE ingresos ADD COLUMN factura_num integer NULL',
  },
  {
    tabla: 'ingresos',
    columna: 'iva',
    ddl: 'ALTER TABLE ingresos ADD COLUMN iva real NOT NULL DEFAULT 0',
  },
];

/**
 * Migraciones de arranque.
 *
 * La app instalada trae su propio data/viajes.db y nunca ejecuta
 * scripts/init-db.js, asi que una build nueva con columnas nuevas fallaria con
 * `no such column` sobre la base del usuario. Esto agrega solo lo que falta
 * (idempotente) y guarda el archivo antes de escuchar peticiones.
 */
export async function aplicarMigraciones(dataSource: DataSource): Promise<void> {
  const driver = dataSource.driver as SqljsDriver;
  const db = driver.databaseConnection;
  if (!db) return;

  const aplicadas: string[] = [];
  for (const m of COLUMNAS) {
    if (!existeTabla(db, m.tabla)) continue;
    if (columnasDe(db, m.tabla).includes(m.columna)) continue;
    try {
      db.run(m.ddl);
      aplicadas.push(`${m.tabla}.${m.columna}`);
    } catch (e) {
      logger.error(`No se pudo migrar ${m.tabla}.${m.columna}: ${(e as Error).message}`);
    }
  }

  if (crearIndiceFacturaUnica(db)) {
    aplicadas.push('ingresos.factura_num (unico)');
  }

  if (!aplicadas.length) return;
  await driver.save();
  logger.log(`Migrado: + ${aplicadas.join(', ')}`);
}

function existeTabla(db: any, tabla: string): boolean {
  const res = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tabla.replace(/'/g, "''")}'`,
  );
  return Boolean(res.length && res[0].values.length);
}

function columnasDe(db: any, tabla: string): string[] {
  const info = db.exec(`PRAGMA table_info("${tabla.replace(/"/g, '""')}")`);
  return info.length ? info[0].values.map((fila: any[]) => fila[1]) : [];
}

/**
 * FACTURA No. unica. SQLite no permite UNIQUE en ALTER TABLE ADD COLUMN, asi
 * que la restriccion se agrega como indice (admite varios NULL para los
 * ingresos historicos sin factura).
 */
function crearIndiceFacturaUnica(db: any): boolean {
  if (!existeTabla(db, 'ingresos')) return false;
  if (!columnasDe(db, 'ingresos').includes('factura_num')) return false;

  const yaExiste = db.exec(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ingresos_factura_num'",
  );
  if (yaExiste.length && yaExiste[0].values.length) return false;

  try {
    db.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_factura_num ON ingresos(factura_num)',
    );
  } catch (e) {
    logger.error(`No se pudo crear el indice unico de facturas: ${(e as Error).message}`);
    return false;
  }
  return true;
}
