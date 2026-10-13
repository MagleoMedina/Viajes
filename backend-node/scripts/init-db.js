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
];

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
