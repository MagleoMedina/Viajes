import { Politica } from './harness';

/**
 * Secuencias de peticiones identicas para ambos backends. Se ejecutan en orden
 * sobre copias de la misma siembra: los estados evolucionan igual y cada
 * respuesta se compara en vivo.
 */
export const choferes: Politica[] = [
  { name: 'listar', method: 'GET', path: '/api/choferes' },
  { name: 'crear', method: 'POST', path: '/api/choferes', body: { nombre: 'Ana', apellido: 'Perez', cedula: 'V-12345' } },
  { name: 'duplicado', method: 'POST', path: '/api/choferes', body: { nombre: 'Ana', apellido: 'Perez', cedula: 'V-12345' } },
  { name: 'validacion', method: 'POST', path: '/api/choferes', body: { nombre: 'Ana', apellido: 'Perez' } },
  { name: 'actualizar', method: 'PUT', path: '/api/choferes/1', body: { nombre: 'Nelson', apellido: 'Muñoz', cedula: '30696510' } },
  { name: 'actualizar-404', method: 'PUT', path: '/api/choferes/9999', body: { nombre: 'X', apellido: 'Y', cedula: 'Z-1' } },
  { name: 'actualizar-409', method: 'PUT', path: '/api/choferes/1', body: { nombre: 'Nelson', apellido: 'Muñoz', cedula: 'V-12345' } },
  { name: 'eliminar', method: 'DELETE', path: '/api/choferes/3', ignoreBody: true },
  { name: 'eliminar-404', method: 'DELETE', path: '/api/choferes/3', ignoreBody: true },
  { name: 'eliminar-en-uso', method: 'DELETE', path: '/api/choferes/1', ignoreBody: true },
  { name: 'listar-tras-ocultar', method: 'GET', path: '/api/choferes' },
];

export const empresas: Politica[] = [
  { name: 'listar', method: 'GET', path: '/api/empresas' },
  { name: 'crear', method: 'POST', path: '/api/empresas', body: { nombre: 'MINERA DEL SUR', direccion: 'Av. Guayana, Galpón 1, Sector Centro, Ciudad Guayana, Bolívar' } },
  { name: 'duplicado-ignore-case', method: 'POST', path: '/api/empresas', body: { nombre: 'minera del sur' } },
  { name: 'validacion', method: 'POST', path: '/api/empresas', body: {} },
  { name: 'actualizar', method: 'PUT', path: '/api/empresas/4', body: { nombre: 'MINERA DEL SUR C.A.' } },
  { name: 'actualizar-409', method: 'PUT', path: '/api/empresas/4', body: { nombre: 'cabelum' } },
  { name: 'eliminar', method: 'DELETE', path: '/api/empresas/4', ignoreBody: true },
  { name: 'eliminar-en-uso', method: 'DELETE', path: '/api/empresas/2', ignoreBody: true },
  { name: 'eliminar-404', method: 'DELETE', path: '/api/empresas/4', ignoreBody: true },
  { name: 'listar-tras-ocultar', method: 'GET', path: '/api/empresas' },
];

export const puntos: Politica[] = [
  { name: 'listar', method: 'GET', path: '/api/puntos' },
  { name: 'crear', method: 'POST', path: '/api/puntos', body: { nombre: 'MATANZAS' } },
  { name: 'duplicado-ignore-case', method: 'POST', path: '/api/puntos', body: { nombre: 'matanzas' } },
  { name: 'validacion', method: 'POST', path: '/api/puntos', body: {} },
  { name: 'actualizar', method: 'PUT', path: '/api/puntos/3', body: { nombre: 'MATANZAS SUR' } },
  { name: 'actualizar-409', method: 'PUT', path: '/api/puntos/3', body: { nombre: 'CABELUM' } },
  { name: 'eliminar', method: 'DELETE', path: '/api/puntos/3', ignoreBody: true },
  { name: 'eliminar-en-uso', method: 'DELETE', path: '/api/puntos/1', ignoreBody: true },
  { name: 'eliminar-404', method: 'DELETE', path: '/api/puntos/3', ignoreBody: true },
  { name: 'listar-tras-ocultar', method: 'GET', path: '/api/puntos' },
];

export const vehiculos: Politica[] = [
  { name: 'listar', method: 'GET', path: '/api/vehiculos' },
  { name: 'crear', method: 'POST', path: '/api/vehiculos', body: { marca: 'Toyota', modelo: 'Hilux', tipo: 'Camioneta', placa: 'abc12' } },
  { name: 'placa-mayusculas', method: 'GET', path: '/api/vehiculos' },
  { name: 'duplicado-placa', method: 'POST', path: '/api/vehiculos', body: { marca: 'X', modelo: 'Y', tipo: 'Z', placa: 'ABC12' } },
  { name: 'validacion', method: 'POST', path: '/api/vehiculos', body: { marca: 'Toyota' } },
  { name: 'actualizar-404', method: 'PUT', path: '/api/vehiculos/9999', body: { marca: 'A', modelo: 'B', tipo: 'C', placa: 'D1' } },
  { name: 'eliminar', method: 'DELETE', path: '/api/vehiculos/3', ignoreBody: true },
  { name: 'eliminar-404', method: 'DELETE', path: '/api/vehiculos/3', ignoreBody: true },
];

export const recorridos: Politica[] = [
  { name: 'listar', method: 'GET', path: '/api/recorridos' },
  { name: 'crear', method: 'POST', path: '/api/recorridos', body: { nombre: 'Nueva Ruta 7' } },
  { name: 'duplicado', method: 'POST', path: '/api/recorridos', body: { nombre: 'Nueva Ruta 7' } },
  { name: 'validacion', method: 'POST', path: '/api/recorridos', body: {} },
  { name: 'eliminar', method: 'DELETE', path: '/api/recorridos/3', ignoreBody: true },
  { name: 'eliminar-404', method: 'DELETE', path: '/api/recorridos/3', ignoreBody: true },
];

const VIAJE_NUEVO = {
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-02',
  choferId: 1,
  empresaId: 2,
  carga: 'Papa',
  puntoSalidaId: 1,
  puntoLlegadaId: 2,
  montoViaje: 100,
  combustible: 20,
  viaticos: 10,
  peajes: 5,
  pagoChofer: 50,
  tasa: 875.65,
  recorrido: 'Ruta Nova',
  gastos: [{ monto: 30, descripcion: 'Comida' }],
};

export const viajes: Politica[] = [
  { name: 'listar', method: 'GET', path: '/api/viajes' },
  { name: 'filtrar-empresa', method: 'GET', path: '/api/viajes?empresaId=2' },
  { name: 'filtrar-fechas', method: 'GET', path: '/api/viajes?desde=2026-10-01&hasta=2026-10-31' },
  { name: 'filtrar-empresa-fechas', method: 'GET', path: '/api/viajes?empresaId=2&desde=2026-10-01&hasta=2026-10-31' },
  { name: 'crear-con-gastos', method: 'POST', path: '/api/viajes', body: VIAJE_NUEVO },
  { name: 'gasto-sin-descripcion', method: 'POST', path: '/api/viajes', body: { ...VIAJE_NUEVO, fechaInicio: '2026-11-03', fechaFin: '2026-11-04', gastos: [{ monto: 30, descripcion: '  ' }] } },
  { name: 'chofer-inexistente', method: 'POST', path: '/api/viajes', body: { ...VIAJE_NUEVO, choferId: 9999, fechaInicio: '2026-11-03' } },
  { name: 'fecha-invalida', method: 'POST', path: '/api/viajes', body: { ...VIAJE_NUEVO, fechaInicio: '2026-11-05', fechaFin: '2026-11-04' } },
  { name: 'validacion-vacio', method: 'POST', path: '/api/viajes', body: {} },
  { name: 'actualizar-reemplaza-gastos', method: 'PUT', path: '/api/viajes/2', body: { ...VIAJE_NUEVO, fechaInicio: '2026-10-21', fechaFin: '2026-10-22', carga: 'Neveras', gastos: [{ monto: 45.5, descripcion: 'Peaje extra' }, { monto: 12.25, descripcion: 'Lavado' }] } },
  { name: 'recorrido-autocompletado', method: 'GET', path: '/api/recorridos' },
  { name: 'actualizar-404', method: 'PUT', path: '/api/viajes/9999', body: VIAJE_NUEVO },
  { name: 'eliminar-creado', method: 'DELETE', path: '/api/viajes/3', ignoreBody: true },
  { name: 'eliminar-uno', method: 'DELETE', path: '/api/viajes/1', ignoreBody: true },
  { name: 'eliminar-404', method: 'DELETE', path: '/api/viajes/3', ignoreBody: true },
  { name: 'listar-final', method: 'GET', path: '/api/viajes' },
];

export const tasa: Politica[] = [
  { name: 'vacia', method: 'GET', path: '/api/tasa' },
  { name: 'put-manual', method: 'PUT', path: '/api/tasa', body: { valor: 900 } },
  { name: 'vigente', method: 'GET', path: '/api/tasa' },
  { name: 'put-cero-invalido', method: 'PUT', path: '/api/tasa', body: { valor: 0 } },
  { name: 'put-sin-valor', method: 'PUT', path: '/api/tasa', body: {} },
  { name: 'vigente-final', method: 'GET', path: '/api/tasa' },
];