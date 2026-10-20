/**
 * Crea la base local con el esquema si no tiene tablas y aplica las
 * migraciones pendientes (idempotente: solo anade columnas que faltan).
 *
 * La app corre con `synchronize: false` (TypeORM no crea tablas ni columnas),
 * asi que un archivo vacio provoca `no such table` y una columna nueva no
 * agregada provoca `no such column`.
 *
 * Uso:
 *   pnpm db:init                      -> data/viajes.db
 *   node scripts/init-db.js <ruta.db> -> cualquier archivo (ej. test/seed.db)
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

/** Columnas nuevas que el esquema base no trae. */
const MIGRACIONES = [
  { tabla: 'viajes', columna: 'vehiculo_id', ddl: 'ALTER TABLE viajes ADD COLUMN vehiculo_id bigint' },
  {
    tabla: 'viajes',
    columna: 'litros',
    ddl: 'ALTER TABLE viajes ADD COLUMN litros real NOT NULL DEFAULT 0',
  },
  {
    tabla: 'viajes',
    columna: 'ref_combustible',
    ddl: "ALTER TABLE viajes ADD COLUMN ref_combustible varchar(100) NOT NULL DEFAULT '0'",
  },
  {
    tabla: 'viajes',
    columna: 'ref_viaticos',
    ddl: "ALTER TABLE viajes ADD COLUMN ref_viaticos varchar(100) NOT NULL DEFAULT '0'",
  },
  {
    tabla: 'viajes',
    columna: 'ref_peajes',
    ddl: "ALTER TABLE viajes ADD COLUMN ref_peajes varchar(100) NOT NULL DEFAULT '0'",
  },
  {
    tabla: 'viajes',
    columna: 'ref_pago_chofer',
    ddl: "ALTER TABLE viajes ADD COLUMN ref_pago_chofer varchar(100) NOT NULL DEFAULT '0'",
  },
  {
    tabla: 'empresas',
    columna: 'eliminado',
    ddl: 'ALTER TABLE empresas ADD COLUMN eliminado integer NOT NULL DEFAULT 0',
  },
  {
    tabla: 'choferes',
    columna: 'eliminado',
    ddl: 'ALTER TABLE choferes ADD COLUMN eliminado integer NOT NULL DEFAULT 0',
  },
  {
    tabla: 'puntos',
    columna: 'eliminado',
    ddl: 'ALTER TABLE puntos ADD COLUMN eliminado integer NOT NULL DEFAULT 0',
  },
  {
    tabla: 'vehiculos',
    columna: 'eliminado',
    ddl: 'ALTER TABLE vehiculos ADD COLUMN eliminado integer NOT NULL DEFAULT 0',
  },
  {
    tabla: 'titulo_gasto',
    columna: 'id',
    ddl: `CREATE TABLE IF NOT EXISTS titulo_gasto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre varchar(100) NOT NULL UNIQUE
    )`,
  },
  {
    tabla: 'gastos_varios',
    columna: 'id',
    ddl: `CREATE TABLE IF NOT EXISTS gastos_varios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo_gasto_id bigint NOT NULL REFERENCES titulo_gasto(id),
      fecha integer NOT NULL,
      numero varchar(50) NOT NULL DEFAULT '0',
      motivo varchar(200) NOT NULL DEFAULT '',
      monto_usd real NOT NULL DEFAULT 0,
      monto_bs real NOT NULL DEFAULT 0,
      tasa real NOT NULL DEFAULT 0,
      porcentaje_db real NOT NULL DEFAULT 0,
      referencia varchar(100) NOT NULL DEFAULT '0'
    )`,
  },
  {
    tabla: 'titulo_impuesto',
    columna: 'id',
    ddl: `CREATE TABLE IF NOT EXISTS titulo_impuesto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre varchar(100) NOT NULL UNIQUE
    )`,
  },
  {
    tabla: 'gastos_impuestos',
    columna: 'id',
    ddl: `CREATE TABLE IF NOT EXISTS gastos_impuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo_impuesto_id bigint NOT NULL REFERENCES titulo_impuesto(id),
      fecha integer NOT NULL,
      numero varchar(50) NOT NULL DEFAULT '0',
      motivo varchar(200) NOT NULL DEFAULT '',
      monto_usd real NOT NULL DEFAULT 0,
      monto_bs real NOT NULL DEFAULT 0,
      tasa real NOT NULL DEFAULT 0,
      porcentaje_db real NOT NULL DEFAULT 0,
      referencia varchar(100) NOT NULL DEFAULT '0'
    )`,
  },
  {
    tabla: 'gastos_gasoil',
    columna: 'id',
    ddl: `CREATE TABLE IF NOT EXISTS gastos_gasoil (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id bigint NULL REFERENCES vehiculos(id),
      fecha integer NOT NULL,
      estacion varchar(100) NOT NULL DEFAULT '',
      litros real NOT NULL DEFAULT 0,
      precio_litro real NOT NULL DEFAULT 0,
      monto_usd real NOT NULL DEFAULT 0,
      monto_bs real NOT NULL DEFAULT 0,
      tasa real NOT NULL DEFAULT 0,
      referencia varchar(100) NOT NULL DEFAULT '0'
    )`,
  },
  {
    tabla: 'gasoil_estacionario',
    columna: 'id',
    ddl: `CREATE TABLE IF NOT EXISTS gasoil_estacionario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id bigint NOT NULL REFERENCES vehiculos(id),
      fecha integer NOT NULL,
      litros real NOT NULL DEFAULT 0,
      referencia varchar(100) NOT NULL DEFAULT '0',
      motivo varchar(200) NOT NULL DEFAULT ''
    )`,
  },
];

/**
 * `gastos_gasoil.vehiculo_id` nacio NOT NULL: ahora el vehiculo es opcional.
 * SQLite no cambia la restriccion con ALTER, asi que se reconstruye la tabla
 * conservando los registros (idempotente: solo actua si sigue siendo NOT NULL).
 */
function permitirVehiculoNulo(db) {
  const info = db.exec('PRAGMA table_info(gastos_gasoil)');
  if (!info.length) return false;
  const col = info[0].values.find((v) => v[1] === 'vehiculo_id');
  if (!col || col[3] !== 1) return false; // notnull: 0 -> ya es opcional

  db.run('PRAGMA foreign_keys = OFF');
  db.run(`CREATE TABLE gastos_gasoil_nueva (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehiculo_id bigint NULL REFERENCES vehiculos(id),
    fecha integer NOT NULL,
    estacion varchar(100) NOT NULL DEFAULT '',
    litros real NOT NULL DEFAULT 0,
    precio_litro real NOT NULL DEFAULT 0,
    monto_usd real NOT NULL DEFAULT 0,
    monto_bs real NOT NULL DEFAULT 0,
    tasa real NOT NULL DEFAULT 0,
    referencia varchar(100) NOT NULL DEFAULT '0'
  )`);
  db.run(`INSERT INTO gastos_gasoil_nueva
      (id, vehiculo_id, fecha, estacion, litros, precio_litro, monto_usd, monto_bs, tasa, referencia)
    SELECT id, vehiculo_id, fecha, estacion, litros, precio_litro, monto_usd, monto_bs, tasa, referencia
    FROM gastos_gasoil`);
  db.run('DROP TABLE gastos_gasoil');
  db.run('ALTER TABLE gastos_gasoil_nueva RENAME TO gastos_gasoil');
  db.run('PRAGMA foreign_keys = ON');
  return true;
}

async function main() {
  const dbFile = process.argv[2] || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'viajes.db');
  const seedFile = path.join(__dirname, '..', 'test', 'seed.db');
  const SQL = await initSqlJs();

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const nueva = !fs.existsSync(dbFile) || fs.statSync(dbFile).size === 0;
  const db = nueva
    ? new SQL.Database()
    : new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));

  const guardar = () => fs.writeFileSync(dbFile, Buffer.from(db.export()));

  if (nueva) {
    const seed = new SQL.Database(new Uint8Array(fs.readFileSync(seedFile)));
    const ddl = seed.exec("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL");
    seed.close();
    for (const [sql] of ddl[0].values) db.run(sql);
    console.log(`Esquema creado en ${dbFile}`);
  }

  const aplicadas = [];
  for (const m of MIGRACIONES) {
    const info = db.exec(`PRAGMA table_info(${m.tabla})`);
    const columnas = info.length ? info[0].values.map((v) => v[1]) : [];
    if (!columnas.includes(m.columna)) {
      db.run(m.ddl);
      aplicadas.push(`${m.tabla}.${m.columna}`);
    }
  }

  if (permitirVehiculoNulo(db)) {
    aplicadas.push('gastos_gasoil.vehiculo_id (opcional)');
  }

  guardar();
  db.close();

  console.log(
    aplicadas.length
      ? `Migrado ${dbFile}: + ${aplicadas.join(', ')}`
      : `${dbFile} al dia${nueva ? ' (esquema + migraciones)' : ''}`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
