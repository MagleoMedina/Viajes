/**
 * Datos de prueba para el modulo Relacion (ingresos / gastos / general).
 *
 * Todo lo que inserta queda marcado con la cadena "PRUEBA RELACION" (mas la
 * empresa "PRUEBA AVIN"), de modo que se puede borrar sin tocar los datos
 * reales.
 *
 * Uso (con el backend APAGADO, para que no sobrescriba el archivo):
 *   node scripts/datos-prueba.js            -> inserta el set de prueba
 *   node scripts/datos-prueba.js --borrar   -> elimina solo lo de prueba
 *
 * Volumen: 15 viajes (5 por empresa) + 4 gastos varios + 4 impuestos +
 * 4 gasoil, repartidos entre el 01/10/2026 y el 15/10/2026.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const MARCA = 'PRUEBA RELACION';
const EMPRESA_PRUEBA = 'PRUEBA AVIN';
const DESDE = '2026-10-01';
const HASTA = '2026-10-15';

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

const fecha = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** 15 viajes: 5 por empresa, con montos y gastos variados. */
function planViajes(empresas) {
  const fechas = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-08', '2026-10-11'];
  const montos = [250, 310, 180, 420, 275];
  const pagos = [1200, 0, 900, 1500, 0];
  const peajes = [350, 420, 0, 280, 0];
  const viaticos = [0, 600, 0, 0, 750];
  const filas = [];
  empresas.forEach((empresaId, e) => {
    fechas.forEach((f, i) => {
      filas.push({
        empresaId,
        fecha: f,
        montoViaje: montos[(i + e) % montos.length],
        pagoChofer: pagos[(i + e) % pagos.length],
        peajes: peajes[(i + e * 2) % peajes.length],
        viaticos: viaticos[(i + e) % viaticos.length],
        choferId: (i % 3) + 1,
        vehiculoId: (i % 4) + 1,
      });
    });
  });
  return filas;
}

async function main() {
  const borrar = process.argv.includes('--borrar');
  const dbFile =
    process.env.DB_PATH || path.join(__dirname, '..', 'data', 'viajes.db');

  if (!fs.existsSync(dbFile)) {
    console.error(`No existe la base: ${dbFile}`);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));
  const guardar = () => fs.writeFileSync(dbFile, Buffer.from(db.export()));

  const uno = (sql, params) => {
    const r = db.exec(sql, params);
    return r.length ? r[0].values : [];
  };

  const eliminados = borrarTodo(db);
  if (borrar) {
    guardar();
    db.close();
    const total = Object.values(eliminados).reduce((s, n) => s + n, 0);
    console.log(`Borrados ${total} registros de prueba en ${dbFile}`);
    for (const [tabla, n] of Object.entries(eliminados)) {
      if (n) console.log(`  ${tabla}: ${n}`);
    }
    return;
  }

  const tasa = Number(uno('SELECT valor FROM tasas ORDER BY id DESC LIMIT 1')[0]?.[0]) || 881.88;

  // Empresa de prueba.
  db.run('INSERT INTO empresas (nombre, direccion, eliminado) VALUES (?, ?, 0)', [
    EMPRESA_PRUEBA,
    'Empresa de prueba para el modulo Relacion',
  ]);
  const empresaPrueba = Number(uno('SELECT last_insert_rowid()')[0][0]);

  const empresas = [1, 4, empresaPrueba];

  // Viajes.
  for (const v of planViajes(empresas)) {
    const inicio = fecha(v.fecha);
    const fin = fecha(v.fecha);
    const gastos = v.pagoChofer + v.peajes + v.viaticos;
    const totalBs = round2(v.montoViaje * tasa - gastos);
    const totalUsd = tasa > 0 ? round2(totalBs / tasa) : 0;
    db.run(
      `INSERT INTO viajes
        (carga, combustible, fecha_fin, fecha_inicio, monto_viaje, pago_chofer, peajes, tasa,
         total_bs, total_usd, viaticos, chofer_id, empresa_id, punto_llegada_id, punto_salida_id,
         recorrido, vehiculo_id, litros, ref_combustible, ref_viaticos, ref_peajes, ref_pago_chofer)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3, 1, ?, ?, 0, ?, ?, ?, ?)`,
      [
        MARCA,
        fin,
        inicio,
        v.montoViaje,
        v.pagoChofer,
        v.peajes,
        tasa,
        totalBs,
        totalUsd,
        v.viaticos,
        v.choferId,
        v.empresaId,
        `${MARCA} ruta`,
        v.vehiculoId,
        MARCA,
        MARCA,
        MARCA,
        MARCA,
      ],
    );
  }

  // Gastos varios: 2 titulos, 4 registros.
  const titulosGasto = [`${MARCA} Combustible`, `${MARCA} Mantenimiento`];
  const idsTituloGasto = titulosGasto.map((nombre) => {
    db.run('INSERT INTO titulo_gasto (nombre) VALUES (?)', [nombre]);
    return Number(uno('SELECT last_insert_rowid()')[0][0]);
  });
  const varios = [
    { titulo: 0, fecha: '2026-10-02', usd: 120 },
    { titulo: 1, fecha: '2026-10-06', usd: 60 },
    { titulo: 0, fecha: '2026-10-09', usd: 45 },
    { titulo: 1, fecha: '2026-10-14', usd: 80 },
  ];
  for (const g of varios) {
    const bs = round2(g.usd * tasa);
    db.run(
      `INSERT INTO gastos_varios
        (titulo_gasto_id, fecha, numero, motivo, monto_usd, monto_bs, tasa, porcentaje_db, referencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idsTituloGasto[g.titulo],
        fecha(g.fecha),
        'PR-PRUEBA',
        MARCA,
        g.usd,
        bs,
        tasa,
        round2(bs * 0.3),
        MARCA,
      ],
    );
  }

  // Impuestos: 2 titulos, 4 registros.
  const titulosImpuesto = [`${MARCA} IVSS`, `${MARCA} ISLR`];
  const idsTituloImpuesto = titulosImpuesto.map((nombre) => {
    db.run('INSERT INTO titulo_impuesto (nombre) VALUES (?)', [nombre]);
    return Number(uno('SELECT last_insert_rowid()')[0][0]);
  });
  const impuestos = [
    { titulo: 0, fecha: '2026-10-02', usd: 95 },
    { titulo: 1, fecha: '2026-10-07', usd: 40 },
    { titulo: 0, fecha: '2026-10-12', usd: 130 },
    { titulo: 1, fecha: '2026-10-15', usd: 55 },
  ];
  for (const g of impuestos) {
    const bs = round2(g.usd * tasa);
    db.run(
      `INSERT INTO gastos_impuestos
        (titulo_impuesto_id, fecha, numero, motivo, monto_usd, monto_bs, tasa, porcentaje_db, referencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idsTituloImpuesto[g.titulo],
        fecha(g.fecha),
        'PR-PRUEBA',
        MARCA,
        g.usd,
        bs,
        tasa,
        round2(bs * 0.3),
        MARCA,
      ],
    );
  }

  // Gasoil: 3 con vehiculo y 1 sin vehiculo (bloque SIN VEHICULO del PDF).
  const gasoil = [
    { fecha: '2026-10-02', vehiculoId: 1, litros: 40, precio: 2.5 },
    { fecha: '2026-10-06', vehiculoId: 2, litros: 30, precio: 2.5 },
    { fecha: '2026-10-10', vehiculoId: 3, litros: 55, precio: 2.4 },
    { fecha: '2026-10-13', vehiculoId: null, litros: 20, precio: 2.5 },
  ];
  for (const g of gasoil) {
    const usd = round2(g.litros * g.precio);
    db.run(
      `INSERT INTO gastos_gasoil
        (vehiculo_id, fecha, estacion, litros, precio_litro, monto_usd, monto_bs, tasa, referencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        g.vehiculoId,
        fecha(g.fecha),
        MARCA,
        g.litros,
        g.precio,
        usd,
        round2(usd * tasa),
        tasa,
        MARCA,
      ],
    );
  }

  guardar();
  imprimirResumen(db, tasa);
  db.close();

  console.log(`\nDatos de prueba insertados en ${dbFile}`);
  console.log(`Rango para probar en Relacion: ${DESDE} a ${HASTA}`);
  console.log(`Para borrarlos: node scripts/datos-prueba.js --borrar`);
}

/** Borra en orden de FK; devuelve el conteo por tabla. */
function borrarTodo(db) {
  const conteos = {};
  const borrar = (tabla, sql, params) => {
    const antes = db.exec(`SELECT COUNT(*) FROM ${tabla}`)[0].values[0][0];
    db.run(sql, params);
    const despues = db.exec(`SELECT COUNT(*) FROM ${tabla}`)[0].values[0][0];
    conteos[tabla] = antes - despues;
  };

  borrar('gastos_varios', 'DELETE FROM gastos_varios WHERE motivo = ? OR referencia = ?', [
    MARCA,
    MARCA,
  ]);
  borrar('gastos_impuestos', 'DELETE FROM gastos_impuestos WHERE motivo = ? OR referencia = ?', [
    MARCA,
    MARCA,
  ]);
  borrar('gastos_gasoil', 'DELETE FROM gastos_gasoil WHERE estacion = ? OR referencia = ?', [
    MARCA,
    MARCA,
  ]);
  borrar('viajes', 'DELETE FROM viajes WHERE carga = ?', [MARCA]);
  borrar('titulo_gasto', 'DELETE FROM titulo_gasto WHERE nombre LIKE ?', [`${MARCA}%`]);
  borrar('titulo_impuesto', 'DELETE FROM titulo_impuesto WHERE nombre LIKE ?', [`${MARCA}%`]);
  borrar('empresas', 'DELETE FROM empresas WHERE nombre = ?', [EMPRESA_PRUEBA]);
  return conteos;
}

/** Resumen esperado de los 3 reportes en el rango (incluye datos reales). */
function imprimirResumen(db, tasa) {
  const q = (sql, params) => {
    const r = db.exec(sql, params);
    return r.length ? r[0].values : [];
  };
  const ini = fecha(DESDE);
  const fin = fecha(HASTA);

  console.log(`\nTasa usada: ${tasa}`);
  console.log('\n-- Reporte ingreso (por empresa) --');
  let ingresosUsd = 0;
  for (const [nombre, monto] of q(
    `SELECT COALESCE(e.nombre, 'SIN EMPRESA'), COALESCE(SUM(v.monto_viaje), 0)
       FROM viajes v LEFT JOIN empresas e ON e.id = v.empresa_id
      WHERE v.fecha_inicio BETWEEN ? AND ?
      GROUP BY COALESCE(e.nombre, 'SIN EMPRESA')
      ORDER BY 1`,
    [ini, fin],
  )) {
    const usd = round2(Number(monto));
    ingresosUsd += usd;
    console.log(`   ${nombre}: $ ${usd.toFixed(2)} | Bs ${(usd * tasa).toFixed(2)}`);
  }
  console.log(`   TOTAL: $ ${round2(ingresosUsd).toFixed(2)}`);

  console.log('\n-- Reporte gastos (varios e impuestos por título) --');
  const suma = (sql, params) => q(sql, params)[0] ?? [0, 0];
  // Una fila por título dentro de cada módulo; si no hay registros, la categoría en 0.
  const porTitulo = (sql, categoria) => {
    const filas = q(sql, [ini, fin]).map(([nombre, usd, bs]) => [
      String(nombre),
      [usd, bs],
    ]);
    return filas.length ? filas : [[categoria, [0, 0]]];
  };
  const tipos = [
    ...porTitulo(
      `SELECT COALESCE(t.nombre, 'SIN TÍTULO'), COALESCE(SUM(g.monto_usd),0), COALESCE(SUM(g.monto_bs),0)
         FROM gastos_varios g LEFT JOIN titulo_gasto t ON t.id = g.titulo_gasto_id
        WHERE g.fecha BETWEEN ? AND ?
        GROUP BY 1 ORDER BY 1`,
      'GASTOS VARIOS',
    ),
    ...porTitulo(
      `SELECT COALESCE(t.nombre, 'SIN TÍTULO'), COALESCE(SUM(g.monto_usd),0), COALESCE(SUM(g.monto_bs),0)
         FROM gastos_impuestos g LEFT JOIN titulo_impuesto t ON t.id = g.titulo_impuesto_id
        WHERE g.fecha BETWEEN ? AND ?
        GROUP BY 1 ORDER BY 1`,
      'IMPUESTOS',
    ),
    ['GASOIL', suma('SELECT COALESCE(SUM(monto_usd),0), COALESCE(SUM(monto_bs),0) FROM gastos_gasoil WHERE fecha BETWEEN ? AND ?', [ini, fin])],
    ['COMBUSTIBLE', suma('SELECT COALESCE(SUM(CASE WHEN tasa > 0 THEN combustible / tasa ELSE 0 END),0), COALESCE(SUM(combustible),0) FROM viajes WHERE fecha_inicio BETWEEN ? AND ?', [ini, fin])],
    ['PAGO A CHOFERES', suma('SELECT COALESCE(SUM(CASE WHEN tasa > 0 THEN pago_chofer / tasa ELSE 0 END),0), COALESCE(SUM(pago_chofer),0) FROM viajes WHERE fecha_inicio BETWEEN ? AND ?', [ini, fin])],
    ['PEAJES', suma('SELECT COALESCE(SUM(CASE WHEN tasa > 0 THEN peajes / tasa ELSE 0 END),0), COALESCE(SUM(peajes),0) FROM viajes WHERE fecha_inicio BETWEEN ? AND ?', [ini, fin])],
    ['VIÁTICOS', suma('SELECT COALESCE(SUM(CASE WHEN tasa > 0 THEN viaticos / tasa ELSE 0 END),0), COALESCE(SUM(viaticos),0) FROM viajes WHERE fecha_inicio BETWEEN ? AND ?', [ini, fin])],
  ];
  let egresosUsd = 0;
  for (const [nombre, valores] of tipos) {
    const usd = round2(Number(valores[0]));
    const bs = round2(Number(valores[1]));
    egresosUsd += usd;
    console.log(`   ${nombre}: $ ${usd.toFixed(2)} | Bs ${bs.toFixed(2)}`);
  }
  console.log(`   TOTAL: $ ${round2(egresosUsd).toFixed(2)}`);
  console.log(`\n-- Reporte general --\n   RELACIÓN: $ ${round2(ingresosUsd - egresosUsd).toFixed(2)}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
