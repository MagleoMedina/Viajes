const BASE = '/api'

async function pedir(path, opciones = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  })

  if (!res.ok) {
    let mensaje = `Error ${res.status}`
    try {
      const cuerpo = await res.json()
      if (cuerpo?.message) mensaje = cuerpo.message
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(mensaje)
  }

  if (res.status === 204) return null
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

export const api = {
  get: (path) => pedir(path),
  post: (path, body) => pedir(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => pedir(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => pedir(path, { method: 'DELETE' }),
}

/** Nombre de archivo que sugiere el backend en Content-Disposition. */
function nombreDeCabecera(cabecera) {
  if (!cabecera) return 'documento.pdf'
  const utf8 = cabecera.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      /* cabecera mal codificada: sigue con filename */
    }
  }
  const simple = cabecera.match(/filename="?([^";]+)"?/i)
  return simple ? simple[1] : 'documento.pdf'
}

/**
 * Genera un PDF sin descargarlo, para previsualizarlo antes.
 * Devuelve el blob y el nombre sugerido; el botón Descargar reutiliza el blob
 * para no pedir el documento dos veces.
 */
export async function prepararPdf(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) {
    let mensaje = `Error ${res.status}`
    try {
      const cuerpo = await res.json()
      if (cuerpo?.message) mensaje = cuerpo.message
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(mensaje)
  }
  return {
    blob: await res.blob(),
    nombre: nombreDeCabecera(res.headers.get('content-disposition')),
  }
}

/** 1234.5 -> "1.234,50" */
export function money(valor) {
  const n = Number(valor) || 0
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function hoy() {
  return new Date().toISOString().slice(0, 10)
}

/** "2026-10-11" -> "11/10/2026". Entrada ISO, salida día/mes/año. */
export function fecha(valor) {
  if (!valor) return ''
  const [a, m, d] = String(valor).slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : valor
}
