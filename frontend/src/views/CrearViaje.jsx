import { useEffect, useState } from 'react'
import { api, hoy, money } from '../api/client.js'
import ChipsInput from '../components/ChipsInput.jsx'

const VACIO = {
  fechaInicio: hoy(),
  fechaFin: hoy(),
  choferId: '',
  empresaId: '',
  carga: '',
  puntoSalidaId: '',
  puntoLlegadaId: '',
  montoViaje: '',
  combustible: '',
  viaticos: '',
  peajes: '',
  pagoChofer: '',
  tasa: '',
}

function aTexto(valor) {
  return valor == null || valor === '' ? '' : String(valor)
}

/** Estado inicial a partir del viaje en edición. El padre remonta con `key`. */
function desdeViaje(viaje) {
  return {
    fechaInicio: viaje.fechaInicio,
    fechaFin: viaje.fechaFin,
    choferId: aTexto(viaje.chofer?.id),
    empresaId: aTexto(viaje.empresa?.id),
    carga: viaje.carga,
    puntoSalidaId: aTexto(viaje.puntoSalida?.id),
    puntoLlegadaId: aTexto(viaje.puntoLlegada?.id),
    montoViaje: aTexto(viaje.montoViaje),
    combustible: aTexto(viaje.combustible),
    viaticos: aTexto(viaje.viaticos),
    peajes: aTexto(viaje.peajes),
    pagoChofer: aTexto(viaje.pagoChofer),
    tasa: aTexto(viaje.tasa),
  }
}

function numero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export default function CrearViaje({ viaje, onGuardado }) {
  const [form, setForm] = useState(() => (viaje ? desdeViaje(viaje) : { ...VACIO }))
  const [choferes, setChoferes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [puntos, setPuntos] = useState([])
  const [finManual, setFinManual] = useState(() => Boolean(viaje && viaje.fechaFin !== viaje.fechaInicio))
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar() {
    return Promise.all([api.get('/choferes'), api.get('/empresas'), api.get('/puntos'), api.get('/tasa')])
      .then(([c, e, p, t]) => {
        setChoferes(c)
        setEmpresas(e)
        setPuntos(p)
        if (t?.valor != null) {
          setForm((f) => (f.tasa ? f : { ...f, tasa: String(t.valor) }))
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function cambiarInicio(valor) {
    setForm((f) => ({ ...f, fechaInicio: valor, fechaFin: finManual ? f.fechaFin : valor }))
  }

  const gastosBs =
    numero(form.combustible) + numero(form.viaticos) + numero(form.peajes) + numero(form.pagoChofer)
  const tasa = numero(form.tasa)
  // El monto del viaje se digita en $ y se multiplica por la tasa para obtener Bs.
  const montoBs = numero(form.montoViaje) * tasa
  const totalBs = montoBs + gastosBs
  const totalUsd = tasa > 0 ? totalBs / tasa : 0

  function limpiarFormulario() {
    setForm((f) => ({ ...VACIO, tasa: f.tasa }))
    setFinManual(false)
    setError('')
    setAviso('')
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    const payload = {
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      choferId: Number(form.choferId),
      empresaId: Number(form.empresaId),
      carga: form.carga,
      puntoSalidaId: form.puntoSalidaId ? Number(form.puntoSalidaId) : null,
      puntoLlegadaId: form.puntoLlegadaId ? Number(form.puntoLlegadaId) : null,
      montoViaje: numero(form.montoViaje),
      combustible: numero(form.combustible),
      viaticos: numero(form.viaticos),
      peajes: numero(form.peajes),
      pagoChofer: numero(form.pagoChofer),
      tasa: tasa,
    }
    try {
      if (viaje) {
        await api.put(`/viajes/${viaje.id}`, payload)
        setAviso('Viaje actualizado.')
      } else {
        await api.post('/viajes', payload)
        setAviso('Viaje registrado.')
        limpiarFormulario()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function cancelar() {
    if (viaje) {
      onGuardado?.()
      return
    }
    limpiarFormulario()
  }

  if (!cargando && (choferes.length === 0 || empresas.length === 0)) {
    let falta = ''
    if (choferes.length === 0 && empresas.length === 0) falta = 'choferes y empresas'
    else if (choferes.length === 0) falta = 'choferes'
    else falta = 'empresas'
    return (
      <div className="vista">
        <header className="vista-cab">
          <div>
            <h1>Crear viajes</h1>
            <p className="sub">Registro de viajes.</p>
          </div>
        </header>
        {error && <p className="error">{error}</p>}
        <p className="vacio">
          Necesita registrar {falta} antes de crear viajes. Use los módulos de la barra lateral.
        </p>
      </div>
    )
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>{viaje ? 'Editar viaje' : 'Crear viajes'}</h1>
          <p className="sub">Complete los datos. Totales calculados automáticamente.</p>
        </div>
      </header>

      <form onSubmit={guardar} className="form viaje">
        <section className="tarjeta">
          <h2>Ruta</h2>
          <div className="campos-4">
            <label>
              Fecha de inicio
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => cambiarInicio(e.target.value)}
                required
              />
            </label>
            <label>
              Fecha de finalización
              <input
                type="date"
                value={form.fechaFin}
                min={form.fechaInicio}
                onChange={(e) => {
                  setFinManual(true)
                  set('fechaFin', e.target.value)
                }}
                required
              />
            </label>
            <label>
              Chofer
              <select
                value={form.choferId}
                onChange={(e) => set('choferId', e.target.value)}
                required
              >
                <option value="">Seleccione...</option>
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido} · {c.cedula}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Empresa
              <select
                value={form.empresaId}
                onChange={(e) => set('empresaId', e.target.value)}
                required
              >
                <option value="">Seleccione...</option>
                {empresas.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Punto de salida
              <select
                value={form.puntoSalidaId}
                onChange={(e) => set('puntoSalidaId', e.target.value)}
              >
                <option value="">Sin punto</option>
                {puntos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Punto de llegada
              <select
                value={form.puntoLlegadaId}
                onChange={(e) => set('puntoLlegadaId', e.target.value)}
              >
                <option value="">Sin punto</option>
                {puntos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="ancho-completo">
              Carga
              <ChipsInput
                value={form.carga}
                onChange={(v) => set('carga', v)}
                placeholder="Hortalizas, neveras, Mani"
              />
            </label>
          </div>
        </section>

        <div className="viaje-rejilla">
          <section className="tarjeta">
            <h2>Montos</h2>
            <div className="campos-3">
              <label>
                Monto del viaje ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.montoViaje}
                  onChange={(e) => set('montoViaje', e.target.value)}
                />
              </label>
              <label>
                Combustible (Bs)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.combustible}
                  onChange={(e) => set('combustible', e.target.value)}
                />
              </label>
              <label>
                Viáticos (Bs)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.viaticos}
                  onChange={(e) => set('viaticos', e.target.value)}
                />
              </label>
              <label>
                Peajes (Bs)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.peajes}
                  onChange={(e) => set('peajes', e.target.value)}
                />
              </label>
              <label>
                Pago a choferes (Bs)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pagoChofer}
                  onChange={(e) => set('pagoChofer', e.target.value)}
                />
              </label>
              <label>
                Tasa del día
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tasa}
                  onChange={(e) => set('tasa', e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="tarjeta resumen">
            <h2>Resumen</h2>
            <div className="fila-total">
              <span>Monto del viaje × tasa</span>
              <strong>{money(montoBs)} Bs</strong>
            </div>
            <div className="fila-total">
              <span>Combustible + Viáticos + Peajes + Pago a choferes</span>
              <strong>{money(gastosBs)} Bs</strong>
            </div>
            <div className="fila-total">
              <span>Tasa del día</span>
              <strong>{money(tasa)}</strong>
            </div>
            <div className="fila-total grande">
              <span>Total en BS</span>
              <strong>Bs {money(totalBs)}</strong>
            </div>
            <div className="fila-total grande">
              <span>Total en $</span>
              <strong>$ {money(totalUsd)}</strong>
            </div>
            <div className="acciones">
              <button type="submit" className="btn primario">
                {viaje ? 'Guardar cambios' : 'Registrar viaje'}
              </button>
              <button type="button" className="btn" onClick={cancelar}>
                Limpiar
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            {aviso && <p className="ok">{aviso}</p>}
          </section>
        </div>
      </form>
    </div>
  )
}
