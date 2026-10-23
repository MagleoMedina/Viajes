/**
 * Espeja la base local (SQLite/sql.js) hacia Turso.
 *
 * Turso actua como hosting/respaldo de la base: este script toma el archivo
 * local como fuente de verdad y recrea las tablas en Turso (drop + create +
 * insert) dentro de una transaccion. No se usa en la app en vivo.
 *
 * El orden importa: Turso exige las claves foraneas. Primero se eliminan las
 * tablas hijas y luego las padres; al crear e insertar va al reves (padres
 * primero). Ese orden sale de PRAGMA foreign_key_list, no de una lista fija.
 * Si se hiciera en el orden de sqlite_master, el DROP de un padre con hijos
 * cargados dispara un DELETE implicito y falla con FOREIGN KEY constraint.
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

const citar = (nombre) => `"${String(nombre).replace(/"/g, '""')}"`;

/**
 * Ordena las tablas con las padres antes que las hijas (orden topologico).
 * `fks` es Map<tabla, tablasReferenciadas[]>. Los empates y los ciclos se
 * resuelven con el orden original de `nombres` (el de sqlite_master).
 */
function ordenarPorDependencias(nombres, fks) {
  const posicion = new Map(nombres.map((nombre, i) => [nombre, i]));
  const pendientes = new Set(nombres);
  const orden = [];

  while (pendientes.size) {
    const listos = [...pendientes].filter((nombre) =>
      (fks.get(nombre) ?? []).every((padre) => !pendientes.has(padre)),
    );
    // Ciclo: se libera la primera tabla pendiente para no quedar en bucle.
    const lote = listos.length ? listos : [[...pendientes][0]];
    lote.sort((a, b) => posicion.get(a) - posicion.get(b));
    for (const nombre of lote) {
      pendientes.delete(nombre);
      orden.push(nombre);
    }
  }

  return orden;
}

/** Lee las tablas referenciadas por cada tabla (solo las que existen). */
function leerDependencias(db, nombres) {
  const existentes = new Set(nombres);
  const fks = new Map();

  for (const nombre of nombres) {
    const res = db.exec(`PRAGMA foreign_key_list(${citar(nombre)})`);
    const padres = new Set();
    if (res.length) {
      const columna = res[0].columns.indexOf('table');
      for (const fila of res[0].values) {
        const padre = fila[columna];
        if (padre && padre !== nombre && existentes.has(padre)) padres.add(padre);
      }
    }
    fks.set(nombre, [...padres]);
  }

  return fks;
}

/**
 * Arma el lote completo: DROP de todas las tablas (hijas primero) y luego
 * CREATE + INSERT (padres primero). Funciona igual en libsql y en sql.js.
 */
function construirSentencias(db, tablas, ddls) {
  const sentencias = [];

  for (const nombre of [...tablas].reverse()) {
    sentencias.push(`DROP TABLE IF EXISTS ${citar(nombre)}`);
  }

  for (const nombre of tablas) {
    const ddl = ddls.get(nombre);
    if (!ddl) continue;
    sentencias.push(ddl);

    const filas = db.exec(`SELECT * FROM ${citar(nombre)}`);
    if (!filas.length) continue;
    const { columns, values } = filas[0];
    if (!values.length) continue;

    const marcadores = columns.map(() => '?').join(',');
    const insert = `INSERT INTO ${citar(nombre)} (${columns.map(citar).join(',')}) VALUES (${marcadores})`;
    for (const fila of values) sentencias.push({ sql: insert, args: fila });
  }

  return sentencias;
}

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
  const nombres = esquema.map(([nombre]) => nombre);
  const ddls = new Map(esquema.map(([nombre, ddl]) => [nombre, ddl]));

  const fks = leerDependencias(local, nombres);
  const tablas = ordenarPorDependencias(nombres, fks);
  const sentencias = construirSentencias(local, tablas, ddls);

  console.log(`[i] Orden (padres primero): ${tablas.join(', ')}`);
  await remote.batch(sentencias, 'write');

  const resumen = tablas
    .map((nombre) => `${nombre}: ${local.exec(`SELECT count(*) FROM ${citar(nombre)}`)[0].values[0][0]}`)
    .join(', ');
  local.close();
  remote.close();
  console.log(`Sincronizado -> Turso. ${resumen}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

module.exports = {
  citar,
  ordenarPorDependencias,
  leerDependencias,
  construirSentencias,
};
