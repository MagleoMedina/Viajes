/** Utilidades del módulo de ingresos (compartidas por las vistas). */
import { num } from './gastos.js'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Estado vacío del formulario de ingreso (la fecha arranca en hoy). */
export function ingresoVacio(tasa = '') {
  return {
    fecha: hoyISO(),
    empresaId: '',
    condicionesPago: '',
    descripcion: '',
    cantidad: '',
    tasa: String(tasa),
    facturaNum: '',
    iva: '',
    montoDivisa: '',
    montoBs: '',
  }
}

/** La tasa admite hasta 6 decimales; se muestra sin relleno sobrante. */
export function tasaTexto(valor) {
  return Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

/** Convierte el formulario a payload numérico para la API. */
export function ingresoPayload(form) {
  return {
    empresaId: form.empresaId === '' ? undefined : Number(form.empresaId),
    fecha: form.fecha,
    condicionesPago: form.condicionesPago.trim(),
    descripcion: form.descripcion.trim(),
    cantidad: num(form.cantidad),
    tasa: num(form.tasa),
    // Vacío al modificar una fila histórica: el backend conserva lo guardado.
    facturaNum: form.facturaNum === '' ? undefined : Number(form.facturaNum),
    iva: num(form.iva),
    montoDivisa: num(form.montoDivisa),
    montoBs: num(form.montoBs),
  }
}
