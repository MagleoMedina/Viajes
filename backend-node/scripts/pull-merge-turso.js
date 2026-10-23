/**
 * Pull con fusión (merge) desde Turso hacia la base local.
 *
 * A diferencia de pull-from-turso.js (que reemplaza la base completa), este
 * script:
 *   1. Conserva todas las filas que solo existen en local.
 *   2. Inserta en local las filas que solo existen en Turso.
 *   3. Fusiona en tres vías usando data/viajes.sync-base.db como ancestro:
 *        - cambió solo Turso  -> se aplica en local
 *        - cambió solo local  -> se conserva y se sube a Turso
 *        - cambiaron ambos    -> conflicto: gana local (--conflictos=remoto invierte)
 *   4. Sube a Turso las filas locales que falten o hayan cambiado solo en local.
 *   5. Guarda un respaldo de la base local antes de escribir.
 *
 * El esquema local manda (synchronize: false): las tablas o columnas que solo
 * existen en local nunca se borran. Si Turso no tiene una tabla local (por
 * ejemplo gasoil_estacionario), se omite al subir salvo --crear-tablas.
 *
 * El backend debe estar APAGADO: corre sobre sql.js en memoria y su autoSave
 * reescribe data/viajes.db. El script aborta si el archivo cambia durante la
 * corrida.
 *
 * Uso:
 *   pnpm pull:turso
 *   pnpm pull:turso -- --dry-run
 *   pnpm pull:turso -- --conflictos=remoto --crear-tablas
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { createClient } = require('@libsql/client');

const RAIZ = path.resolve(__dirname, '..');
const DB_LOCAL = path.join(RAIZ, 'data', 'viajes.db');

/** Padres antes que hijos, para respetar las claves foráneas. */
const ORDEN_TABLAS = [
  'choferes',
  'empresas',
  'puntos',
  'recorridos',
  'vehiculos',
  'titulo_gasto',
  'titulo_impuesto',
  'tasas',
  'viajes',
  'gastos',
  'gastos_varios',
  'gastos_impuestos',
  'gastos_gasoil',
  'gasoil_estacionario',
  'ingresos',
];

const citar = (nombre) => `"${String(nombre).replace(/"/g, '""')}"`;

function parseArgs(argv) {
  const opciones = {
    dryRun: false,
    conflictos: 'local',
    subir: true,
    crearTablas: false,
    db: null,
    sinBaseline: false,
    ayuda: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') opciones.dryRun = true;
    else if (arg === '--sin-subir') opciones.subir = false;
    else if (arg === '--crear-tablas') opciones.crearTablas = true;
    else if (arg === '--sin-baseline') opciones.sinBaseline = true;
    else if (arg === '--ayuda' || arg === '--help' || arg === '-h') opciones.ayuda = true;
    else if (arg.startsWith('--db=')) opciones.db = arg.slice('--db='.length);
    else if (arg === '--db') opciones.db = argv[++i];
    else if (arg.startsWith('--conflictos=')) opciones.conflictos = arg.slice('--conflictos='.length);
    else if (arg === '--conflictos') opciones.conflictos = argv[++i];
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (!['local', 'remoto'].includes(opciones.conflictos)) {
    throw new Error('--conflictos debe ser "local" o "remoto"');
  }
  return opciones;
}

function imprimirAyuda() {
  console.log(`Uso: node scripts/pull-merge-turso.js [opciones]

Opciones:
  --dry-run, -n         Muestra el plan sin escribir en local ni en Turso.
  --conflictos=local    Si ambos lados cambiaron, conserva local (por defecto).
  --conflictos=remoto   Si ambos lados cambiaron, aplica Turso.
  --sin-subir           No escribe en Turso (solo baja cambios a local).
  --crear-tablas        Crea en Turso las tablas locales que falten.
  --sin-baseline        No lee ni actualiza data/viajes.sync-base.db.
  --db=ruta             Base local distinta de data/viajes.db.
  --ayuda, -h           Muestra esta ayuda.
`);
}

/** Lee .env sin dependencias; las variables ya definidas tienen prioridad. */
function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return;
  const lineas = fs.readFileSync(archivo, 'utf8').split(/\r?\n/);
  for (const linea of lineas) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let valor = m[2].trim();
    const comilla = valor[0];
    const entreComillas =
      (comilla === '"' || comilla === "'") && valor.length >= 2 && valor.endsWith(comilla);
    if (entreComillas) valor = valor.slice(1, -1);
    else valor = valor.replace(/\s+#.*$/, '').trim();
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}

const idDe = (fila) => (fila && fila.id != null ? String(fila.id) : null);

/** Firma canónica para comparar filas usando solo columnas compartidas. */
function firma(fila, columnas) {
  return columnas
    .map((c) => {
      const v = fila?.[c];
      return v === undefined || v === null ? '\u0000' : `${typeof v}:${v}`;
    })
    .join('\u0001');
}

function camposDiferentes(a, b, columnas) {
  return columnas.filter((c) => {
    const va = a?.[c];
    const vb = b?.[c];
    const na = va === undefined || va === null ? null : String(va);
    const nb = vb === undefined || vb === null ? null : String(vb);
    return na !== nb;
  });
}

function indexar(filas) {
  const mapa = new Map();
  for (const fila of filas ?? []) {
    const id = idDe(fila);
    if (id != null) mapa.set(id, fila);
  }
  return mapa;
}

/**
 * Plan de una tabla. Devuelve listas nuevas (sin mutar las entradas):
 *   insertar   filas solo en remoto (se insertan en local)
 *   actualizar filas cuyo único cambio vino de remoto
 *   empujar    filas cuyo único cambio fue local (se suben a Turso)
 *   conflictos filas cambiadas en ambos lados que se conservan en local
 *   resueltosRemoto  conflictos que se resolvieron a favor de remoto
 *   localesSolo filas que no existen en remoto (se suben a Turso)
 */
function planearTabla(entrada, politica = 'local') {
  const {
    nombre,
    locales = [],
    remotas = [],
    base = [],
    columnas = [],
    ddlLocal = null,
    remotaFaltante = false,
  } = entrada;

  const localPorId = indexar(locales);
  const remotoPorId = indexar(remotas);
  const basePorId = indexar(base);

  const insertar = [];
  const actualizar = [];
  const empujar = [];
  const conflictos = [];
  const resueltosRemoto = [];

  for (const [id, remota] of remotoPorId) {
    const local = localPorId.get(id);
    if (!local) {
      insertar.push(remota);
      continue;
    }
    if (firma(local, columnas) === firma(remota, columnas)) continue;

    const ancestro = basePorId.get(id);
    if (!ancestro) {
      const detalle = { id, campos: camposDiferentes(local, remota, columnas) };
      conflictos.push(detalle);
      continue;
    }

    const localIgualBase = firma(local, columnas) === firma(ancestro, columnas);
    const remotoIgualBase = firma(remota, columnas) === firma(ancestro, columnas);

    if (localIgualBase && !remotoIgualBase) {
      actualizar.push(remota);
    } else if (!localIgualBase && remotoIgualBase) {
      empujar.push(local);
    } else if (!localIgualBase && !remotoIgualBase) {
      const detalle = { id, campos: camposDiferentes(local, remota, columnas) };
      if (politica === 'remoto') {
        actualizar.push(remota);
        resueltosRemoto.push(detalle);
      } else {
        conflictos.push(detalle);
      }
    }
    // localIgualBase && remotoIgualBase es imposible: las firmas ya difieren.
  }

  const localesSolo = [];
  for (const [id, local] of localPorId) {
    if (!remotoPorId.has(id)) localesSolo.push(local);
  }

  return {
    nombre,
    columnas,
    ddlLocal,
    remotaFaltante,
    totalLocal: locales.length,
    totalRemoto: remotas.length,
    insertar,
    actualizar,
    empujar,
    conflictos,
    resueltosRemoto,
    localesSolo,
  };
}

function planearMerge(entradas, politica = 'local') {
  return entradas.map((entrada) => planearTabla(entrada, politica));
}

/** Inserta/actualiza en la base sql.js local. Las columnas locales extra no se tocan. */
function aplicarLocal(db, planes) {
  db.run('PRAGMA foreign_keys = OFF');
  for (const plan of planes) {
    if (!plan.columnas.includes('id')) continue;

    for (const fila of plan.insertar) {
      const columnas = plan.columnas;
      const sql = `INSERT INTO ${citar(plan.nombre)} (${columnas
        .map(citar)
        .join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`;
      db.run(
        sql,
        columnas.map((c) => (fila[c] === undefined ? null : fila[c])),
      );
    }

    const columnasUpdate = plan.columnas.filter((c) => c !== 'id');
    if (!columnasUpdate.length) continue;
    for (const fila of plan.actualizar) {
      const sql = `UPDATE ${citar(plan.nombre)} SET ${columnasUpdate
        .map((c) => `${citar(c)} = ?`)
        .join(', ')} WHERE ${citar('id')} = ?`;
      db.run(sql, [
        ...columnasUpdate.map((c) => (fila[c] === undefined ? null : fila[c])),
        fila.id,
      ]);
    }
  }
  db.run('PRAGMA foreign_keys = ON');
}

/**
 * Sube a Turso las filas locales que faltan o que cambiaron solo en local.
 * Devuelve conteos. Los conflictos no se suben.
 */
async function aplicarRemoto(remoto, planes, opciones = {}) {
  const { crearTablas = false } = opciones;
  const conteos = { insertadas: 0, actualizadas: 0, omitidas: 0, tablasCreadas: [] };
  const pendientes = [];

  for (const plan of planes) {
    if (plan.remotaFaltante) {
      if (!crearTablas) {
        conteos.omitidas += plan.localesSolo.length + plan.empujar.length;
        continue;
      }
      if (!plan.ddlLocal) {
        conteos.omitidas += plan.localesSolo.length + plan.empujar.length;
        continue;
      }
      await remoto.execute(plan.ddlLocal);
      conteos.tablasCreadas.push(plan.nombre);
    }

    if (!plan.columnas.includes('id')) {
      conteos.omitidas += plan.localesSolo.length + plan.empujar.length;
      continue;
    }

    for (const fila of plan.localesSolo) {
      const columnas = plan.columnas;
      pendientes.push({
        sql: `INSERT INTO ${citar(plan.nombre)} (${columnas
          .map(citar)
          .join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
        args: columnas.map((c) => (fila[c] === undefined ? null : fila[c])),
      });
      conteos.insertadas++;
    }

    const columnasUpdate = plan.columnas.filter((c) => c !== 'id');
    if (!columnasUpdate.length) continue;
    for (const fila of plan.empujar) {
      pendientes.push({
        sql: `UPDATE ${citar(plan.nombre)} SET ${columnasUpdate
          .map((c) => `${citar(c)} = ?`)
          .join(', ')} WHERE ${citar('id')} = ?`,
        args: [
          ...columnasUpdate.map((c) => (fila[c] === undefined ? null : fila[c])),
          fila.id,
        ],
      });
      conteos.actualizadas++;
    }
  }

  // Lotes chicos: menos presión sobre Turso y errores más fáciles de ubicar.
  for (let i = 0; i < pendientes.length; i += 400) {
    await remoto.batch(pendientes.slice(i, i + 400), 'write');
  }
  return conteos;
}

/** Lee todas las tablas de un archivo SQLite con sql.js. */
function leerLocal(dbFile, SQL) {
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));
  const tablas = new Map();
  const res = db.exec(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const filasEsquema = res.length ? res[0].values : [];
  for (const [nombre, ddl] of filasEsquema) {
    const info = db.exec(`PRAGMA table_info(${citar(nombre)})`);
    const columnas = info.length ? info[0].values.map((v) => v[1]) : [];
    const sel = db.exec(`SELECT * FROM ${citar(nombre)}`);
    const filas = sel.length
      ? sel[0].values.map((valores) =>
          Object.fromEntries(sel[0].columns.map((c, i) => [c, valores[i]])),
        )
      : [];
    tablas.set(nombre, { ddl, columnas, filas });
  }
  return { db, tablas };
}

/** Lee las tablas de Turso con la misma forma que leerLocal(). */
async function leerRemoto(remoto) {
  const { rows } = await remoto.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tablas = new Map();
  for (const fila of rows) {
    const nombre = fila.name;
    const res = await remoto.execute(`SELECT * FROM ${citar(nombre)}`);
    const columnas = res.columns ?? [];
    const filas = (res.rows ?? []).map((r) =>
      Object.fromEntries(columnas.map((c) => [c, r[c]])),
    );
    tablas.set(nombre, { ddl: fila.sql, columnas, filas });
  }
  return tablas;
}

/** Ordena padres antes que hijos; el resto queda al final en orden alfabético. */
function ordenarNombres(nombres) {
  const prioridad = new Map(ORDEN_TABLAS.map((n, i) => [n, i]));
  return [...nombres].sort((a, b) => {
    const pa = prioridad.has(a) ? prioridad.get(a) : ORDEN_TABLAS.length;
    const pb = prioridad.has(b) ? prioridad.get(b) : ORDEN_TABLAS.length;
    return pa - pb || a.localeCompare(b);
  });
}

function marcaDeTiempo() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Escribe la base de forma segura: temporal -> respaldo -> rename. */
function escribirAtomico(dbFile, datos) {
  const dir = path.dirname(dbFile);
  const tmp = path.join(dir, `.viajes-merge-${process.pid}.tmp`);
  const respaldo = path.join(dir, `viajes.db.bak-pre-pull-${marcaDeTiempo()}`);
  fs.writeFileSync(tmp, Buffer.from(datos));
  fs.renameSync(dbFile, respaldo);
  try {
    fs.renameSync(tmp, dbFile);
  } catch (e) {
    fs.renameSync(respaldo, dbFile);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* noop */
    }
    throw e;
  }
  return respaldo;
}

function tamanoDeLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function imprimirPlan(planes, opciones, extras) {
  const modo = opciones.dryRun ? 'SIMULACIÓN (no se escribe nada)' : 'Fusión';
  console.log(`\n== ${modo}: local <- Turso ==`);
  console.log(`Base local: ${extras.dbFile}`);
  console.log(
    extras.baseEsLocal
      ? 'Ancestro: primera corrida, se usa una copia del estado local actual.'
      : `Ancestro: ${extras.baseFile}`,
  );
  if (extras.soloEnRemoto.length) {
    console.log(
      `\n[!] Tablas solo en Turso (no se tocan porque el esquema local manda): ${extras.soloEnRemoto.join(', ')}`,
    );
  }

  const ancho = Math.max(10, ...planes.map((p) => p.nombre.length));
  console.log(
    `\n${'Tabla'.padEnd(ancho)}  local  remoto   ins   act   cons  conf  sube`,
  );
  for (const p of planes) {
    console.log(
      `${p.nombre.padEnd(ancho)}  ${String(p.totalLocal).padStart(5)}  ${String(
        p.totalRemoto,
      ).padStart(6)}  ${String(p.insertar.length).padStart(5)}  ${String(
        p.actualizar.length,
      ).padStart(5)}  ${String(p.localesSolo.length).padStart(5)}  ${String(
        p.conflictos.length,
      ).padStart(5)}  ${String(p.localesSolo.length + p.empujar.length).padStart(5)}`,
    );
  }

  const conflictos = planes.flatMap((p) =>
    p.conflictos.map((c) => ({ tabla: p.nombre, ...c })),
  );
  const resueltos = planes.flatMap((p) =>
    p.resueltosRemoto.map((c) => ({ tabla: p.nombre, ...c })),
  );
  if (resueltos.length) {
    console.log(`\n[!] ${resueltos.length} conflicto(s) resueltos a favor de Turso (--conflictos=remoto).`);
  }
  if (conflictos.length) {
    console.log(`\n[!] ${conflictos.length} conflicto(s) conservan local:`);
    for (const c of conflictos.slice(0, 20)) {
      console.log(`    ${c.tabla} id=${c.id}: ${c.campos.join(', ') || '(fila distinta)'}`);
    }
    if (conflictos.length > 20) console.log(`    ... y ${conflictos.length - 20} más.`);
  }

  const sinSubir = planes.filter((p) => p.remotaFaltante && !opciones.crearTablas);
  if (sinSubir.length && opciones.subir) {
    console.log(
      `\n[!] Sin subir (falta la tabla en Turso): ${sinSubir
        .map((p) => p.nombre)
        .join(', ')}. Usa --crear-tablas para crearla.`,
    );
  }
  if (!opciones.subir) console.log('\n[i] --sin-subir: no se escribirá en Turso.');
}

async function main() {
  const opciones = parseArgs(process.argv.slice(2));
  if (opciones.ayuda) {
    imprimirAyuda();
    return;
  }

  leerEnv(path.join(RAIZ, '.env'));
  const dbFile = path.resolve(opciones.db || process.env.DB_PATH || DB_LOCAL);
  if (!fs.existsSync(dbFile)) throw new Error(`No existe la base local: ${dbFile}`);
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('Faltan TURSO_DATABASE_URL y TURSO_AUTH_TOKEN (revisa .env)');
  }

  const baseFile = path.resolve(
    process.env.SYNC_BASE_PATH || path.join(path.dirname(dbFile), 'viajes.sync-base.db'),
  );

  console.log('[i] El backend debe estar APAGADO. Se aborta si la base cambia durante la corrida.');

  const SQL = await initSqlJs();
  const statInicial = fs.statSync(dbFile);
  const local = leerLocal(dbFile, SQL);

  let base = null;
  let baseEsLocal = false;
  if (!opciones.sinBaseline) {
    if (fs.existsSync(baseFile)) {
      const leida = leerLocal(baseFile, SQL);
      base = leida.tablas;
      leida.db.close();
    } else {
      base = local.tablas;
      baseEsLocal = true;
    }
  } else {
    base = local.tablas;
    baseEsLocal = true;
  }

  const remoto = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const tablasRemotas = await leerRemoto(remoto);
    if (!tablasRemotas.size) throw new Error('Turso no devolvió ninguna tabla.');

    const nombres = ordenarNombres(
      new Set([...local.tablas.keys(), ...tablasRemotas.keys()]),
    );
    const entradas = [];
    const soloEnRemoto = [];

    for (const nombre of nombres) {
      const enLocal = local.tablas.get(nombre);
      const enRemoto = tablasRemotas.get(nombre);
      if (!enLocal && enRemoto) {
        soloEnRemoto.push(nombre);
        continue;
      }
      if (!enLocal) continue;

      const ancestro = base?.get(nombre);
      if (!enRemoto) {
        entradas.push({
          nombre,
          locales: enLocal.filas,
          remotas: [],
          base: ancestro?.filas ?? enLocal.filas,
          columnas: enLocal.columnas,
          ddlLocal: enLocal.ddl,
          remotaFaltante: true,
        });
        continue;
      }

      const columnas = enLocal.columnas.filter((c) => enRemoto.columnas.includes(c));
      if (!columnas.includes('id')) {
        console.log(`[!] Tabla ${nombre} sin columna id compartida: se omite.`);
        continue;
      }

      entradas.push({
        nombre,
        locales: enLocal.filas,
        remotas: enRemoto.filas,
        base: ancestro?.filas ?? enLocal.filas,
        columnas,
        ddlLocal: enLocal.ddl,
        remotaFaltante: false,
      });
    }

    const planes = planearMerge(entradas, opciones.conflictos);
    imprimirPlan(planes, opciones, { dbFile, baseFile, baseEsLocal, soloEnRemoto });

    if (opciones.dryRun) {
      console.log('\nSimulación terminada. No se modificó la base local ni Turso.');
      return;
    }

    const statAhora = fs.statSync(dbFile);
    if (statAhora.mtimeMs !== statInicial.mtimeMs || statAhora.size !== statInicial.size) {
      throw new Error(
        'La base local cambió durante la corrida. Apaga el backend y vuelve a intentarlo.',
      );
    }

    aplicarLocal(local.db, planes);
    local.db.run('PRAGMA foreign_keys = ON');
    const violaciones = local.db.exec('PRAGMA foreign_key_check');
    const cantidadViolaciones = violaciones.length ? violaciones[0].values.length : 0;

    const respaldo = escribirAtomico(dbFile, local.db.export());
    console.log(`\n[ok] Base local fusionada. Respaldo: ${respaldo}`);

    if (!opciones.sinBaseline) {
      fs.copyFileSync(dbFile, baseFile);
      console.log(`[ok] Ancestro actualizado: ${baseFile}`);
    }

    if (cantidadViolaciones) {
      console.log(
        `[!] ${cantidadViolaciones} referencia(s) huérfanas tras la fusión (revisa PRAGMA foreign_key_check).`,
      );
    }

    if (opciones.subir) {
      const conteos = await aplicarRemoto(remoto, planes, {
        crearTablas: opciones.crearTablas,
      });
      console.log(
        `[ok] Turso: ${conteos.insertadas} insertada(s), ${conteos.actualizadas} actualizada(s)` +
          (conteos.omitidas ? `, ${conteos.omitidas} omitida(s)` : '') +
          (conteos.tablasCreadas.length
            ? `. Tablas creadas: ${conteos.tablasCreadas.join(', ')}`
            : ''),
      );
    } else {
      console.log('[i] --sin-subir: Turso no se modificó.');
    }

    const tam = fs.statSync(dbFile).size;
    console.log(`\n[ok] Listo. ${dbFile} (${tamanoDeLegible(tam)})`);
  } finally {
    remoto.close();
    local.db.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`\n[error] ${e.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  leerEnv,
  planearTabla,
  planearMerge,
  aplicarLocal,
  aplicarRemoto,
  leerLocal,
  leerRemoto,
  ordenarNombres,
  escribirAtomico,
};
