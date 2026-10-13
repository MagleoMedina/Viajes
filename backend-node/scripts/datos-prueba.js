/* Crea datos de prueba por la API para validar el reporte historico.
 * Borrar todo lo creado con: node scripts\datos-prueba.js --borrar
 */
const API = process.env.API || 'http://localhost:8080/api';

async function ruta(metodo, path, cuerpo) {
  const res = await fetch(`${API}${path}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${metodo} ${path} -> ${res.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function borrar() {
  const viajes = await ruta('GET', '/viajes');
  for (const v of viajes) await ruta('DELETE', `/viajes/${v.id}`);
  const recorridos = await ruta('GET', '/recorridos');
  for (const r of recorridos) await ruta('DELETE', `/recorridos/${r.id}`);
  const vehiculos = await ruta('GET', '/vehiculos');
  for (const v of vehiculos) await ruta('DELETE', `/vehiculos/${v.id}`);
  const puntos = await ruta('GET', '/puntos');
  for (const p of puntos) await ruta('DELETE', `/puntos/${p.id}`);
  const choferes = await ruta('GET', '/choferes');
  for (const c of choferes) await ruta('DELETE', `/choferes/${c.id}`);
  const empresas = await ruta('GET', '/empresas');
  for (const e of empresas) await ruta('DELETE', `/empresas/${e.id}`);
  console.log('Datos de prueba borrados.');
}

async function crear() {
  const e1 = await ruta('POST', '/empresas', { nombre: 'MINERA DEL CARONI' });
  const e2 = await ruta('POST', '/empresas', { nombre: 'TRANSPORTES ORINOCO' });

  const c1 = await ruta('POST', '/choferes', { nombre: 'Luis', apellido: 'Pérez', cedula: 'V-20111222' });
  const c2 = await ruta('POST', '/choferes', { nombre: 'María', apellido: 'Gómez', cedula: 'V-19888777' });

  const p1 = await ruta('POST', '/puntos', { nombre: 'Matanzas' });
  const p2 = await ruta('POST', '/puntos', { nombre: 'Puerto Ordaz' });
  const p3 = await ruta('POST', '/puntos', { nombre: 'Caracas' });

  const v1 = await ruta('POST', '/vehiculos', { marca: 'Toyota', modelo: 'Hilux', tipo: 'Camioneta', placa: 'AB123CD' });
  const v2 = await ruta('POST', '/vehiculos', { marca: 'Mercedes', modelo: 'Actros', tipo: 'Tractocamión', placa: 'XY999ZZ' });

  await ruta('POST', '/recorridos', { nombre: 'Puerto Ordaz - Caracas' });
  await ruta('POST', '/recorridos', { nombre: 'Upata - Matanzas' });

  const viajes = [
    {
      fechaInicio: '2026-10-01', fechaFin: '2026-10-01', choferId: c1.id, empresaId: e1.id,
      vehiculoId: v1.id, puntoSalidaId: p1.id, puntoLlegadaId: p2.id,
      carga: 'Minerales de hierro', montoViaje: 180, combustible: 60, viaticos: 20,
      peajes: 10, pagoChofer: 10, recorrido: 'Upata - Matanzas',
      gastos: [{ monto: 15, descripcion: 'Café y peaje extra' }],
    },
    {
      fechaInicio: '2026-10-05', fechaFin: '2026-10-06', choferId: c2.id, empresaId: e1.id,
      vehiculoId: v2.id, puntoSalidaId: p2.id, puntoLlegadaId: p3.id,
      carga: 'Bobinas de acero', montoViaje: 420, combustible: 150, viaticos: 45,
      peajes: 25, pagoChofer: 20, recorrido: 'Puerto Ordaz - Caracas',
    },
    {
      fechaInicio: '2026-10-12', fechaFin: '2026-10-12', choferId: c1.id, empresaId: e2.id,
      vehiculoId: v1.id, puntoSalidaId: p3.id, puntoLlegadaId: p1.id,
      carga: 'Repuestos industriales', montoViaje: 95, combustible: 40, viaticos: 5,
      peajes: 8, pagoChofer: 12, recorrido: 'Upata - Matanzas',
    },
    {
      fechaInicio: '2026-09-20', fechaFin: '2026-09-21', choferId: c2.id, empresaId: e2.id,
      vehiculoId: v2.id, puntoSalidaId: p1.id, puntoLlegadaId: p3.id,
      carga: 'Alimentos balanceados', montoViaje: 310, combustible: 120, viaticos: 30,
      peajes: 18, pagoChofer: 15, recorrido: 'Puerto Ordaz - Caracas',
    },
  ];
  for (const v of viajes) await ruta('POST', '/viajes', v);

  const totalOct = 180 + 420 + 95;
  console.log(`Datos de prueba creados. Viajes oct-2026: ${viajes.length - 1}, suma montoViaje $ ${totalOct.toFixed(2)}.`);
}

(process.argv.includes('--borrar') ? borrar() : crear()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
