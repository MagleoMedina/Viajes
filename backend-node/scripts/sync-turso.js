/**
 * Espeja la base local (SQLite/sql.js) hacia Turso.
 *
 * Turso actua como hosting/respaldo de la base: este script toma el archivo
 * local como fuente de verdad y recrea las tablas en Turso (drop + create +
 * insert) dentro de una transaccion. No se usa en la app en vivo.
 *
 * Uso: pnpm sync:turso   (lee TURSO_DATABASE_URL y TURSO_AUTH_TOKEN de .env)
 *
 * ponytail: espejo completo (drop/recreate), no incremental. Suficiente porque
 * el dataset es pequeno; si crece, cambiar a upsert por id.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { createClient } = require('@libsql/client');

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error('Faltan TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (usa --env-file=.env)');
  }

  const dbFile = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'viajes.db');
  if (!fs.existsSync(dbFile)) {
    throw new Error(`No existe la base local: ${dbFile}`);
  }

  const SQL = await initSqlJs();
  const local = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));
  const remote = createClient({ url, authToken });

  const esquema = local.exec(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )[0].values;

  const sentencias = [];
  for (const [nombre, ddl] of esquema) {
    sentencias.push(`DROP TABLE IF EXISTS ${nombre}`);
    sentencias.push(ddl);
    const filas = local.exec(`SELECT * FROM ${nombre}`);
    if (!filas.length) continue;
    const { columns, values } = filas[0];
    if (!values.length) continue;
    const marcadores = columns.map(() => '?').join(',');
    const insert = `INSERT INTO ${nombre} (${columns.join(',')}) VALUES (${marcadores})`;
    for (const fila of values) sentencias.push({ sql: insert, args: fila });
  }

  await remote.batch(sentencias, 'write');

  const resumen = esquema
    .map(([nombre]) => `${nombre}: ${local.exec(`SELECT count(*) FROM ${nombre}`)[0].values[0][0]}`)
    .join(', ');
  local.close();
  remote.close();
  console.log(`Sincronizado -> Turso. ${resumen}`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
