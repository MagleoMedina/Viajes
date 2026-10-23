/**
 * Sincronización SOLO DE BAJADA desde Turso hacia la base local.
 *
 * Pensado para una instalación que corre una build antigua y necesita traer
 * los datos de Turso sin perder nada de lo que ya tiene local:
 *   1. Alinea el esquema local con Turso: crea las tablas y columnas que falten
 *      (nunca borra tablas ni columnas locales).
 *   2. Inserta en local las filas que solo existen en Turso.
 *   3. Si hay un ancestro (data/viajes.sync-base.db) aplica solo los cambios
 *      que vinieron únicamente de Turso.
 *   4. Si una fila cambió en ambos lados, gana local (--conflictos=remoto
 *      invierte esa decisión). Las filas solo locales NUNCA se borran y una
 *      fila borrada en local no se resucita aunque siga en Turso.
 *   5. Guarda un respaldo y NO escribe en Turso.
 *
 * Después de revisar la app, el usuario pulsa «Sincronizar ahora»: ese botón
 * es el que sube la base local ya fusionada a Turso.
 *
 * El backend debe estar APAGADO: corre sobre sql.js en memoria y volcaría su
 * copia encima del archivo. Se aborta si la base cambia durante la corrida.
 *
 * Uso:
 *   node scripts/sync-local-desde-turso.js --dry-run
 *   node scripts/sync-local-desde-turso.js
 *   node scripts/sync-local-desde-turso.js --db="C:\otra-maquina\viajes.db"
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { createClient } = require('@libsql/client');

const RAIZ = path.resolve(__dirname, '..');

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
    esquema: true,
    baseline: true,
    db: null,
    env: null,
    ayuda: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') opciones.dryRun = true;
    else if (arg === '--sin-esquema') opciones.esquema = false;
    else if (arg === '--sin-baseline') opciones.baseline = false;
    else if (arg === '--ayuda' || arg === '--help' || arg === '-h') opciones.ayuda = true;
    else if (arg.startsWith('--db=')) opciones.db = arg.slice('--db='.length);
    else if (arg === '--db') opciones.db = argv[++i];
    else if (arg.startsWith('--env=')) opciones.env = arg.slice('--env='.length);
    else if (arg === '--env') opciones.env = argv[++i];
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
  console.log(`Uso: node scripts/sync-local-desde-turso.js [opciones]

Baja los datos de Turso a la base local sin subir nada. Después, abra la app
y pulse «Sincronizar ahora» para subir la base ya fusionada.

Opciones:
  --dry-run, -n         Muestra el plan sin escribir en la base local.
  --conflictos=local    Si ambos lados cambiaron una fila, conserva local (por defecto).
  --conflictos=remoto   En ese caso aplica la versión de Turso.
  --sin-esquema         No crea tablas ni columnas nuevas en local.
  --sin-baseline        No lee ni actualiza data/viajes.sync-base.db.
  --db=ruta             Base local distinta de data/viajes.db.
  --env=ruta            Archivo .env distinto de <app>/.env.
  --ayuda, -h           Muestra esta ayuda.
`);
}

/** Lee .env sin dependencias; las variables ya definidas tienen prioridad. */
function leerEnv(archivo) {
  if (!archivo || !fs.existsSync(archivo)) return;
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
 *   conflictos filas cambiadas en ambos lados que se conservan en local
 *   resueltosRemoto  conflictos que se resolvieron a favor de remoto
 *   localesSolo filas que no existen en remoto (no se tocan)
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
  const conflictos = [];
  const resueltosRemoto = [];
  const borradasLocal = [];

  for (const [id, remota] of remotoPorId) {
    const local = localPorId.get(id);
    if (!local) {
      // Si el ancestro la tenía, la fila se borró en local: no se resucita.
      if (basePorId.has(id)) {
        borradasLocal.push({ id });
        continue;
      }
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
      // Cambió solo en local: no se sube nada desde este script.
    } else if (!localIgualBase && !remotoIgualBase) {
      const detalle = { id, campos: camposDiferentes(local, remota, columnas) };
      if (politica === 'remoto') {
        actualizar.push(remota);
        resueltosRemoto.push(detalle);
      } else {
        conflictos.push(detalle);
      }
    }
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
    conflictos,
    resueltosRemoto,
    borradasLocal,
    localesSolo,
  };
}

function planearMerge(entradas, politica = 'local') {
  return entradas.map((entrada) => planearTabla(entrada, politica));
}

/** Inserta/actualiza en la base sql.js local. Las columnas locales extra no se tocan. */
function aplicarLocal(db, planes) {
  db.run('PRAGMA foreign_keys = OFF');
  try {
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
  } finally {
    db.run('PRAGMA foreign_keys = ON');
  }
}

/** Nombre de tipo seguro para un ALTER TABLE (evita inyectar SQL). */
function tipoSeguro(valor) {
  const tipo = String(valor ?? '').trim();
  return /^[A-Za-z0-9_() ,]+$/.test(tipo) ? tipo : '';
}

/** Valor por defecto seguro tal como lo devuelve PRAGMA table_info. */
function defaultSeguro(valor) {
  if (valor == null) return null;
  const v = String(valor).trim();
  if (!v) return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  if (/^'([^']|'')*'$/.test(v)) return v;
  if (/^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)$/i.test(v)) return v.toUpperCase();
  return null;
}

/** Fragmento `"columna" TIPO DEFAULT ...` para ALTER TABLE ADD COLUMN. */
function ddlColumna(col) {
  const tipo = tipoSeguro(col?.type);
  let sql = citar(col?.name);
  if (tipo) sql += ` ${tipo}`;
  const porDefecto = defaultSeguro(col?.dflt_value);
  if (porDefecto != null) sql += ` DEFAULT ${porDefecto}`;
  return sql;
}

/**
 * Crea en la base local las tablas y columnas que existen en Turso y faltan.
 * Nunca borra ni modifica columnas existentes. Devuelve la lista de cambios.
 */
function alinearEsquema(db, locales, remotas) {
  const cambios = [];
  db.run('PRAGMA foreign_keys = OFF');
  try {
    for (const [nombre, remota] of remotas) {
      const local = locales.get(nombre);
      if (!local) {
        if (!remota.ddl) continue;
        db.run(remota.ddl);
        cambios.push({ tipo: 'tabla', tabla: nombre });
        continue;
      }
      for (const col of remota.info ?? []) {
        if (!col?.name || local.columnas.includes(col.name)) continue;
        if (col.pk) continue; // la clave primaria ya existe en local
        db.run(`ALTER TABLE ${citar(nombre)} ADD COLUMN ${ddlColumna(col)}`);
        cambios.push({ tipo: 'columna', tabla: nombre, columna: col.name });
      }
    }
  } finally {
    db.run('PRAGMA foreign_keys = ON');
  }
  return cambios;
}

function columnasDe(db, nombre) {
  const info = db.exec(`PRAGMA table_info(${citar(nombre)})`);
  return info.length ? info[0].values.map((v) => v[1]) : [];
}

/** Lee todas las tablas de una base sql.js abierta. */
function leerTablas(db) {
  const tablas = new Map();
  const res = db.exec(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const filasEsquema = res.length ? res[0].values : [];
  for (const [nombre, ddl] of filasEsquema) {
    const columnas = columnasDe(db, nombre);
    const sel = db.exec(`SELECT * FROM ${citar(nombre)}`);
    const filas = sel.length
      ? sel[0].values.map((valores) =>
          Object.fromEntries(sel[0].columns.map((c, i) => [c, valores[i]])),
        )
      : [];
    tablas.set(nombre, { ddl, columnas, filas });
  }
  return tablas;
}

/** Lee las tablas de Turso con la misma forma que leerTablas(). */
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
    // Tipos y valores por defecto para poder crear columnas faltantes en local.
    let info = [];
    try {
      const pragma = await remoto.execute(`PRAGMA table_info(${citar(nombre)})`);
      info = (pragma.rows ?? []).map((r) =>
        Object.fromEntries((pragma.columns ?? []).map((c) => [c, r[c]])),
      );
    } catch {
      info = columnas.map((name) => ({ name, type: '', pk: 0, dflt_value: null }));
    }
    tablas.set(nombre, { ddl: fila.sql, columnas, filas, info });
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
  const tmp = path.join(dir, `.viajes-sync-${process.pid}.tmp`);
  const respaldo = path.join(dir, `viajes.db.bak-pre-sync-${marcaDeTiempo()}`);
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

function imprimirPlan(planes, opciones, extras) {
  const modo = opciones.dryRun ? 'SIMULACIÓN (no se escribe nada)' : 'Bajada';
  console.log(`\n== ${modo}: local <- Turso ==`);
  console.log(`Base local: ${extras.dbFile}`);
  console.log(
    extras.baseEsLocal
      ? 'Ancestro: no hay copia previa; se usa el estado local actual (local gana).'
      : `Ancestro: ${extras.baseFile}`,
  );

  if (extras.cambiosEsquema.length) {
    console.log('\n[i] Esquema local completado con lo que existe en Turso:');
    for (const c of extras.cambiosEsquema) {
      console.log(
        c.tipo === 'tabla'
          ? `    + tabla ${c.tabla}`
          : `    + columna ${c.tabla}.${c.columna}`,
      );
    }
  } else {
    console.log('\n[i] Esquema: sin tablas ni columnas nuevas.');
  }

  if (extras.soloEnRemoto.length) {
    console.log(
      `\n[!] Tablas solo en Turso (no se crean porque falta --sin-esquema): ${extras.soloEnRemoto.join(', ')}`,
    );
  }

  const ancho = Math.max(10, ...planes.map((p) => p.nombre.length));
  console.log(
    `\n${'Tabla'.padEnd(ancho)}  local  remoto   ins   act  cons  conf  sololocal`,
  );
  for (const p of planes) {
    console.log(
      `${p.nombre.padEnd(ancho)}  ${String(p.totalLocal).padStart(5)}  ${String(
        p.totalRemoto,
      ).padStart(6)}  ${String(p.insertar.length).padStart(5)}  ${String(
        p.actualizar.length,
      ).padStart(5)}  ${String(p.localesSolo.length).padStart(5)}  ${String(
        p.conflictos.length,
      ).padStart(5)}  ${String(p.localesSolo.length).padStart(10)}`,
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

  const borradas = planes.reduce((s, p) => s + p.borradasLocal.length, 0);
  if (borradas) {
    console.log(
      `\n[i] ${borradas} fila(s) borradas en local no se resucitan aunque sigan en Turso.`,
    );
  }

  const soloLocal = planes.filter((p) => p.remotaFaltante);
  if (soloLocal.length) {
    console.log(
      `\n[i] Tablas sin espejo en Turso (quedan intactas): ${soloLocal
        .map((p) => p.nombre)
        .join(', ')}. Se subirán al pulsar «Sincronizar ahora».`,
    );
  }
}

async function main() {
  const opciones = parseArgs(process.argv.slice(2));
  if (opciones.ayuda) {
    imprimirAyuda();
    return;
  }

  leerEnv(path.resolve(opciones.env || path.join(RAIZ, '.env')));

  // DB_PATH relativo se resuelve contra la carpeta de la app (igual que el backend);
  // --db relativo se resuelve contra el directorio actual.
  const dbFile = opciones.db
    ? path.resolve(opciones.db)
    : path.resolve(RAIZ, process.env.DB_PATH || path.join('data', 'viajes.db'));
  if (!fs.existsSync(dbFile)) throw new Error(`No existe la base local: ${dbFile}`);
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error(
      'Faltan TURSO_DATABASE_URL y TURSO_AUTH_TOKEN. Defínalas en el .env o pase --env=ruta.',
    );
  }

  const baseEnv = process.env.SYNC_BASE_PATH;
  const baseFile = baseEnv
    ? path.isAbsolute(baseEnv)
      ? baseEnv
      : path.resolve(path.dirname(dbFile), baseEnv)
    : path.join(path.dirname(dbFile), 'viajes.sync-base.db');
  if (baseFile === dbFile) throw new Error('El ancestro no puede ser la misma base local.');

  console.log('[i] El backend debe estar APAGADO. Se aborta si la base cambia durante la corrida.');

  const SQL = await initSqlJs();
  const statInicial = fs.statSync(dbFile);
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));

  let base = null;
  let baseEsLocal = true;
  if (opciones.baseline && fs.existsSync(baseFile)) {
    const dbBase = new SQL.Database(new Uint8Array(fs.readFileSync(baseFile)));
    base = leerTablas(dbBase);
    dbBase.close();
    baseEsLocal = false;
  }

  const remoto = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const tablasRemotas = await leerRemoto(remoto);
    if (!tablasRemotas.size) throw new Error('Turso no devolvió ninguna tabla.');

    let cambiosEsquema = [];
    if (opciones.esquema) {
      cambiosEsquema = alinearEsquema(db, leerTablas(db), tablasRemotas);
    }

    const locales = leerTablas(db);
    const nombres = ordenarNombres(new Set([...locales.keys(), ...tablasRemotas.keys()]));
    const entradas = [];
    const soloEnRemoto = [];

    for (const nombre of nombres) {
      const enLocal = locales.get(nombre);
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
    imprimirPlan(planes, opciones, { dbFile, baseFile, baseEsLocal, cambiosEsquema, soloEnRemoto });

    if (opciones.dryRun) {
      console.log('\nSimulación terminada. No se modificó la base local.');
      return;
    }

    const statAhora = fs.statSync(dbFile);
    if (statAhora.mtimeMs !== statInicial.mtimeMs || statAhora.size !== statInicial.size) {
      throw new Error(
        'La base local cambió durante la corrida. Cierre la app y vuelva a intentarlo.',
      );
    }

    aplicarLocal(db, planes);
    const violaciones = db.exec('PRAGMA foreign_key_check');
    const cantidadViolaciones = violaciones.length ? violaciones[0].values.length : 0;

    const respaldo = escribirAtomico(dbFile, db.export());
    console.log(`\n[ok] Base local fusionada. Respaldo: ${respaldo}`);

    if (opciones.baseline) {
      fs.copyFileSync(dbFile, baseFile);
      console.log(`[ok] Ancestro actualizado: ${baseFile}`);
    }

    if (cantidadViolaciones) {
      console.log(
        `[!] ${cantidadViolaciones} referencia(s) huérfanas tras la fusión (revisa PRAGMA foreign_key_check).`,
      );
    }

    console.log(
      '\n[ok] Turso NO se modificó. Abra la app, revise los datos y pulse «Sincronizar ahora».',
    );
  } finally {
    remoto.close();
    db.close();
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
  alinearEsquema,
  ddlColumna,
  defaultSeguro,
  tipoSeguro,
  leerTablas,
  leerRemoto,
  ordenarNombres,
  escribirAtomico,
};
