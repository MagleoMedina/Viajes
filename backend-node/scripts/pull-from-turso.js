/**
 * Pull: Descarga la base completa de Turso y la sobrescribe en la SQLite local.
 *
 * Requiere las variables de entorno TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env.
 * - Conecta a Turso, lista las tablas y su DDL CREATE TABLE.
 * - Borra la local actual y la recrea usando ese DDL.
 * - Itera cada tabla, trae todas las filas de Turso e INSERT OR REPLACE en local.
 * - Exporta la nueva base a data/viajes.db.
 *
 * Nota: si la local tiene columnas que Turso desconoce (p. ej. `eliminado`),
 * aquellas columnas quedarán con el valor por defecto del CREATE TABLE de Turso.
 * Si se necesita preservar columnas locales personalizadas, se requiere una
 * versión "incremental" que fusiona cambios en lugar de reemplazo total.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { createClient } = require('@libsql/client');

const DB_LOCAL = path.resolve(__dirname, '..', 'data', 'viajes.db');

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const auth = process.env.TURSO_AUTH_TOKEN;
  if (!url || !auth) {
    throw new Error(
      'Faltan credenciales Turso: establece TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env',
    );
  }

  // ---------- 1. Conectar a Turso y listar tablas ----------
  const remote = createClient({ url, authToken: auth });

  const { rows: tables } = await remote.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );

  if (!tables.length) {
    console.log('⚠️  No hay tablas en Turso.');
    remote.close();
    return;
  }

  console.log(`📦  Tablas encontradas en Turso: ${tables.map((t) => t.name).join(', ')}`);

  // ---------- 2. Preparar la base local (sql.js) ----------
  const SQL = await initSqlJs();
  // Borramos la base actual para recrearla limpia.
  if (fs.existsSync(DB_LOCAL)) fs.unlinkSync(DB_LOCAL);
  const local = new SQL.Database();

  // ---------- 3. Para cada tabla: recrear DDL + insertar filas ----------
  for (const t of tables) {
    const name = t.name;
    const ddl = t.sql; // CREATE TABLE ... que trae Turso

    // Ejecutar el CREATE TABLE de Turso en local
    local.exec(ddl);
    console.log(`  ✔  Tabla ${name} recreada.`);

    // Traer todas las filas de Turso
    try {
      const { rows, columns } = await remote.execute(`SELECT * FROM ${name}`);
      console.log(`  📊  Tabla ${name}: ${rows?.length || 0} filas`);

      if (!rows || !rows.length) continue; // tabla vacía

      // Determinar los nombres de columna.
      // Turso puede devolver `columns` como array de strings u objeto con `name` property.
      let colNames = columns;
      if (colNames && typeof colNames === 'object') {
        // Algunos drivers devuelven array de strings, otros array de { name: 'col' }.
        if (colNames[0] && typeof colNames[0] === 'object' && 'name' in colNames[0]) {
          colNames = colNames.map((c) => c.name);
        } else {
          // Ya es array de strings.
        }
      }

      if (!colNames || colNames.length === 0) {
        console.log(`  ⚠️  No se pudieron determinar columnas para ${name}, saltando inserción.`);
        continue;
      }

      // Insertar cada fila. Usamos INSERT OR REPLACE para que sobreescriba si ya existiera.
      const placeholders = colNames.map(() => '?').join(',');
      const insertSql = `INSERT OR REPLACE INTO ${name} (${colNames.join(',')}) VALUES (${placeholders})`;

      for (const row of rows) {
        // row puede ser un array de valores u objeto { col: valor }.
        const valores = row && typeof row === 'object' ? Object.values(row) : (row || []);
        local.exec(insertSql, valores);
      }
      console.log(`  📥  ${rows.length} filas insertadas en ${name}.`);
    } catch (e) {
      console.log(`  ⚠️  Error al leer tabla ${name}: ${e.message}`);
    }
  }

  // ---------- 4. Guardar la base local ----------
  const buf = local.export();
  fs.writeFileSync(DB_LOCAL, Buffer.from(buf));
  console.log(`\n✅  Base local sobrescrita en ${DB_LOCAL}`);

  remote.close();
}

main().catch((e) => {
  console.error('❌  Error al hacer pull:', e.message);
  process.exit(1);
});