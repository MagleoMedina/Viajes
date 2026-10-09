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

export function urlDescarga(path) {
  return BASE + path
}

/** 1234.5 -> "1.234,50" */
export function money(valor) {
  const n = Number(valor) || 0
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function hoy() {
  return new Date().toISOString().slice(0, 10)
}
