/** Utilidades del módulo de gastos varios (compartidas por las vistas). */

/** Estado vacío del formulario de gasto (la fecha arranca en hoy). */
export function gastoVacio(tasa = '') {
  return {
    titulo: '',
    fecha: hoyISO(),
    numero: '',
    motivo: '',
    montoUsd: '',
    tasa: String(tasa),
    montoBs: '',
    porcentajeDb: '',
    referencia: '',
  }
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export const num = (v) => Number(String(v).replace(',', '.')) || 0
export const red2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100

/** Convierte el formulario a payload numérico para la API. */
export function gastoPayload(form, tituloGastoId) {
  return {
    tituloGastoId,
    fecha: form.fecha,
    numero: form.numero.trim() || '0',
    motivo: form.motivo.trim(),
    montoUsd: num(form.montoUsd),
    montoBs: form.montoBs === '' ? 0 : num(form.montoBs),
    tasa: num(form.tasa),
    porcentajeDb: num(form.porcentajeDb),
    referencia: form.referencia.trim() || '0',
  }
}

/** Título escrito que ya existe en la BD (ignore-case, con acentos). */
export function tituloExistente(titulo, titulos) {
  const objetivo = titulo.trim().toLocaleLowerCase('es')
  if (!objetivo) return null
  return titulos.find((t) => t.nombre.toLocaleLowerCase('es') === objetivo) ?? null
}

/** Alias semántico para el catálogo de tipos de impuesto. */
export const tipoImpuestoExistente = tituloExistente

/** Payload numérico para POST/PUT de gastos de impuestos. */
export function impuestoPayload(form, tituloImpuestoId) {
  return {
    tituloImpuestoId,
    fecha: form.fecha,
    numero: form.numero.trim() || '0',
    motivo: form.motivo.trim(),
    montoUsd: num(form.montoUsd),
    montoBs: form.montoBs === '' ? 0 : num(form.montoBs),
    tasa: num(form.tasa),
    porcentajeDb: num(form.porcentajeDb),
    referencia: form.referencia.trim() || '0',
  }
}

/** Estado vacío del formulario de gasoil (la fecha arranca en hoy). */
export function gasoilVacio(tasa = '') {
  return {
    vehiculo: '',
    fecha: hoyISO(),
    estacion: '',
    litros: '',
    precioLitro: '',
    montoUsd: '',
    tasa: String(tasa),
    montoBs: '',
    referencia: '',
  }
}

/** Payload numérico para POST/PUT de gastos de gasoil. */
export function gasoilPayload(form, vehiculoId) {
  return {
    vehiculoId,
    fecha: form.fecha,
    estacion: form.estacion.trim(),
    litros: num(form.litros),
    precioLitro: num(form.precioLitro),
    montoUsd: form.montoUsd === '' ? 0 : num(form.montoUsd),
    montoBs: form.montoBs === '' ? 0 : num(form.montoBs),
    tasa: num(form.tasa),
    referencia: form.referencia.trim() || '0',
  }
}

/** Placa escrita que ya existe en la BD (ignore-case: placa se guarda en mayúsculas). */
export function vehiculoExistente(placa, vehiculos) {
  const objetivo = placa.trim().toLocaleLowerCase('es')
  if (!objetivo) return null
  return vehiculos.find((v) => (v.placa ?? '').toLocaleLowerCase('es') === objetivo) ?? null
}

/**
 * Agrupa gastos por `claveDe` (orden alfabético) y suma montos $ y Bs,
 * con las filas ordenadas por fecha. Mismo criterio que el PDF del backend.
 */
export function agruparGastos(gastos, claveDe) {
  const mapa = new Map()
  for (const g of gastos) {
    const clave = (claveDe(g) ?? '').trim() || 'SIN TÍTULO'
    if (!mapa.has(clave)) {
      mapa.set(clave, { clave, filas: [], sumaUsd: 0, sumaBs: 0 })
    }
    const b = mapa.get(clave)
    b.filas.push(g)
    b.sumaUsd += Number(g.montoUsd) || 0
    b.sumaBs += Number(g.montoBs) || 0
  }
  const bloques = [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave, 'es'))
  for (const b of bloques) {
    b.sumaUsd = red2(b.sumaUsd)
    b.sumaBs = red2(b.sumaBs)
    b.filas.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)))
  }
  return bloques
}
