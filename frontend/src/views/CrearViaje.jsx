import { useEffect, useState } from 'react'
import { FiPlus, FiX, FiSave, FiCheck } from 'react-icons/fi'
import { api, hoy, money, fecha } from '../api/client.js'
import { red2 } from '../api/gastos.js'
import ChipsInput from '../components/ChipsInput.jsx'
import Modal from '../components/Modal.jsx'

const VACIO = {
  fechaInicio: hoy(),
  fechaFin: hoy(),
  choferId: '',
  empresaId: '',
  carga: '',
  puntoSalidaId: '',
  puntoLlegadaId: '',
  vehiculoId: '',
  montoViaje: '',
  combustible: '',
  refCombustible: '',
  viaticos: '',
  refViaticos: '',
  peajes: '',
  refPeajes: '',
  pagoChofer: '',
  refPagoChofer: '',
  litros: '',
  gastos: [],
  tasa: '',
  recorrido: '',
}

function aTexto(valor) {
  return valor == null || valor === '' ? '' : String(valor)
}

/**
 * Une el registro ya elegido cuando la lista ya no lo trae: un registro
 * oculto (eliminacion logica) sigue siendo valido para los viajes historicos.
 */
function conElegido(lista, elegido) {
  if (!elegido || lista.some((x) => x.id === elegido.id)) return lista
  return [...lista, elegido]
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
    vehiculoId: aTexto(viaje.vehiculo?.id),
    montoViaje: aTexto(viaje.montoViaje),
    combustible: aTexto(viaje.combustible),
    refCombustible: aTexto(viaje.refCombustible),
    viaticos: aTexto(viaje.viaticos),
    refViaticos: aTexto(viaje.refViaticos),
    peajes: aTexto(viaje.peajes),
    refPeajes: aTexto(viaje.refPeajes),
    pagoChofer: aTexto(viaje.pagoChofer),
    refPagoChofer: aTexto(viaje.refPagoChofer),
    litros: aTexto(viaje.litros),
    gastos: (viaje.gastos || []).map((g) => ({
      monto: aTexto(g.monto),
      descripcion: g.descripcion ?? '',
    })),
    tasa: aTexto(viaje.tasa),
    recorrido: aTexto(viaje.recorrido),
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
  const [vehiculos, setVehiculos] = useState([])
  const [recorridos, setRecorridos] = useState([])
  const [finManual, setFinManual] = useState(() => Boolean(viaje && viaje.fechaFin !== viaje.fechaInicio))
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardado, setGuardado] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [stock, setStock] = useState(null)
  const [stockTick, setStockTick] = useState(0)

  function cargar() {
    return Promise.all([
      api.get('/choferes'),
      api.get('/empresas'),
      api.get('/puntos'),
      api.get('/vehiculos'),
      api.get('/tasa'),
      api.get('/recorridos'),
    ])
      .then(([c, e, p, vh, t, r]) => {
        setChoferes(conElegido(c, viaje?.chofer))
        setEmpresas(conElegido(e, viaje?.empresa))
        setPuntos(conElegido(conElegido(p, viaje?.puntoSalida), viaje?.puntoLlegada))
        setVehiculos(conElegido(vh, viaje?.vehiculo))
        setRecorridos(r)
        if (t?.valor != null) {
          setForm((f) => (f.tasa ? f : { ...f, tasa: String(t.valor) }))
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  // Stock de gasoil del vehículo elegido. Al editar, el viaje actual excluye
  // sus propios litros para mostrar lo realmente disponible. Se refresca al
  // montar, al cambiar de vehículo, tras guardar y al recuperar el foco.
  useEffect(() => {
    if (!form.vehiculoId) {
      setStock(null)
      return undefined
    }
    let vivo = true
    function traer() {
      const q = new URLSearchParams({ vehiculoId: String(form.vehiculoId) })
      if (viaje?.id) q.set('excluirViajeId', String(viaje.id))
      api
        .get(`/gastos-gasoil/stock?${q}`)
        .then((s) => {
          if (vivo) setStock(s)
        })
        .catch(() => {
          if (vivo) setStock(null)
        })
    }
    const alFocar = () => {
      if (document.visibilityState === 'visible') traer()
    }
    traer()
    window.addEventListener('focus', alFocar)
    document.addEventListener('visibilitychange', alFocar)
    return () => {
      vivo = false
      window.removeEventListener('focus', alFocar)
      document.removeEventListener('visibilitychange', alFocar)
    }
  }, [form.vehiculoId, viaje?.id, stockTick])

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function cambiarInicio(valor) {
    setForm((f) => ({ ...f, fechaInicio: valor, fechaFin: finManual ? f.fechaFin : valor }))
  }

  const gastosBs =
    numero(form.combustible) + numero(form.viaticos) + numero(form.peajes) + numero(form.pagoChofer)
  const gastosVarios = (form.gastos || []).reduce((suma, g) => suma + numero(g.monto), 0)
  const tasa = numero(form.tasa)
  // El monto del viaje se digita en $ y se multiplica por la tasa para obtener Bs.
  const montoBs = numero(form.montoViaje) * tasa
  // Total = (monto del viaje $ x tasa) - gastos (combustible, viáticos, peajes,
  // pago a chofer y gastos varios).
  const totalBs = montoBs - (gastosBs + gastosVarios)
  const totalUsd = tasa > 0 ? totalBs / tasa : 0

  const choferElegido = choferes.find((c) => String(c.id) === form.choferId)
  const empresaElegida = empresas.find((e) => String(e.id) === form.empresaId)

  function agregarGasto() {
    setForm((f) => ({ ...f, gastos: [...(f.gastos || []), { monto: '', descripcion: '' }] }))
  }

  function quitarGasto(indice) {
    setForm((f) => ({ ...f, gastos: f.gastos.filter((_, i) => i !== indice) }))
  }

  function editarGasto(indice, campo, valor) {
    setForm((f) => ({
      ...f,
      gastos: f.gastos.map((g, i) => (i === indice ? { ...g, [campo]: valor } : g)),
    }))
  }

  function limpiarFormulario() {
    setForm((f) => ({ ...VACIO, gastos: [], tasa: f.tasa }))
    setFinManual(false)
    setError('')
    setAviso('')
  }

  function enviar(e) {
    e.preventDefault()
    if (form.vehiculoId && stock && numero(form.litros) > stock.disponible) {
      setError(
        `Litros exceden el gasoil disponible (${red2(Math.max(0, stock.disponible))} L). ` +
          'Registre la compra en el módulo de gasoil o reduzca los litros.',
      )
      return
    }
    setConfirmar(true)
  }

  /**
   * Si el usuario escribio un recorrido que no existe, lo crea en el backend y
   * lo agrega a la lista de sugerencias.
   */
  async function guardarRecorridoSiNuevo() {
    const nombre = form.recorrido.trim()
    if (!nombre) return
    const yaExiste = recorridos.some((r) => r.nombre.toLowerCase() === nombre.toLowerCase())
    if (yaExiste) return
    try {
      const nuevo = await api.post('/recorridos', { nombre })
      setRecorridos((lista) =>
        [...lista, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      )
    } catch {
      // Puede que ya exista en el backend: recargar la lista de sugerencias.
      try {
        setRecorridos(await api.get('/recorridos'))
      } catch {
        /* se conserva el texto escrito en el viaje */
      }
    }
  }

  async function guardar() {
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
      vehiculoId: form.vehiculoId ? Number(form.vehiculoId) : null,
      montoViaje: numero(form.montoViaje),
      combustible: numero(form.combustible),
      refCombustible: form.refCombustible.trim(),
      viaticos: numero(form.viaticos),
      refViaticos: form.refViaticos.trim(),
      peajes: numero(form.peajes),
      refPeajes: form.refPeajes.trim(),
      pagoChofer: numero(form.pagoChofer),
      refPagoChofer: form.refPagoChofer.trim(),
      litros: numero(form.litros),
      gastos: (form.gastos || [])
        .filter((g) => numero(g.monto) > 0 || g.descripcion.trim())
        .map((g) => ({ monto: numero(g.monto), descripcion: g.descripcion.trim() })),
      tasa: tasa,
      recorrido: form.recorrido.trim(),
    }
    try {
      if (viaje) {
        await api.put(`/viajes/${viaje.id}`, payload)
        setAviso('Viaje actualizado.')
        setGuardado('Viaje actualizado')
      } else {
        await api.post('/viajes', payload)
        limpiarFormulario()
        setGuardado('Viaje guardado')
      }
      setStockTick((t) => t + 1)
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

      <form onSubmit={enviar} className="form viaje">
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
            <label>
              Vehículo
              <select value={form.vehiculoId} onChange={(e) => set('vehiculoId', e.target.value)}>
                <option value="">Sin vehículo</option>
                {vehiculos.map((vh) => (
                  <option key={vh.id} value={vh.id}>
                    {[vh.marca, vh.modelo].filter(Boolean).join(' ')} · {vh.placa}
                  </option>
                ))}
              </select>
            </label>
            <label className="ancho-completo">
              Recorrido
              <input
                list="lista-recorridos"
                value={form.recorrido}
                onChange={(e) => set('recorrido', e.target.value)}
                onBlur={guardarRecorridoSiNuevo}
                placeholder="Escriba o elija un recorrido"
                autoComplete="off"
              />
              <datalist id="lista-recorridos">
                {recorridos.map((r) => (
                  <option key={r.id} value={r.nombre} />
                ))}
              </datalist>
            </label>
          </div>
        </section>

        <div className="viaje-rejilla">
          <section className="tarjeta">
            <h2>Montos</h2>
            {stock && (
              <p className="ayuda stock-gasoil">
                Gasoil disponible: <strong>{red2(Math.max(0, stock.disponible))} L</strong>
                {` · Comprado ${red2(stock.comprado)} L · Usado ${red2(stock.usado)} L`}
              </p>
            )}
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
                Ref. combustible
                <input
                  type="text"
                  maxLength="100"
                  value={form.refCombustible}
                  onChange={(e) => set('refCombustible', e.target.value)}
                  placeholder="Nro. transacción"
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
                Ref. viáticos
                <input
                  type="text"
                  maxLength="100"
                  value={form.refViaticos}
                  onChange={(e) => set('refViaticos', e.target.value)}
                  placeholder="Nro. transacción"
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
                Ref. peajes
                <input
                  type="text"
                  maxLength="100"
                  value={form.refPeajes}
                  onChange={(e) => set('refPeajes', e.target.value)}
                  placeholder="Nro. transacción"
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
                Ref. pago a choferes
                <input
                  type="text"
                  maxLength="100"
                  value={form.refPagoChofer}
                  onChange={(e) => set('refPagoChofer', e.target.value)}
                  placeholder="Nro. transacción"
                />
              </label>
              <label>
                Litros
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.litros}
                  onChange={(e) => set('litros', e.target.value)}
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

            <div className="gastos-varios">
              <div className="gastos-cab">
                <h3>Gastos varios (Bs)</h3>
                <button type="button" className="btn pequeno" onClick={agregarGasto}>
                  <FiPlus aria-hidden="true" /> Agregar gasto
                </button>
              </div>
              {(form.gastos || []).length === 0 ? (
                <p className="ayuda">Sin gastos varios. El monto y la descripción se agregan uno por uno.</p>
              ) : (
                <ul className="gastos-lista">
                  {(form.gastos || []).map((g, i) => (
                    <li key={i} className="gastos-fila">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Monto (Bs)"
                        value={g.monto}
                        onChange={(e) => editarGasto(i, 'monto', e.target.value)}
                        required
                      />
                      <input
                        type="text"
                        maxLength="200"
                        placeholder="Descripción del gasto"
                        value={g.descripcion}
                        onChange={(e) => editarGasto(i, 'descripcion', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="btn pequeno peligro"
                        onClick={() => quitarGasto(i)}
                        aria-label="Quitar gasto"
                      >
                        <FiX aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {(form.gastos || []).length > 0 && (
                <p className="gastos-total">Suma de gastos varios: Bs {money(gastosVarios)}</p>
              )}
            </div>
          </section>

          <section className="tarjeta resumen">
            <h2>Resumen</h2>
            <p className="ayuda">Total = (monto del viaje $ × tasa) − todos los gastos.</p>
            <div className="fila-total">
              <span>Monto del viaje × tasa</span>
              <strong>{money(montoBs)} Bs</strong>
            </div>
            <div className="fila-total">
              <span>Combustible + Viáticos + Peajes + Pago a choferes (se resta)</span>
              <strong>− {money(gastosBs)} Bs</strong>
            </div>
            <div className="fila-total">
              <span>Gastos varios (se restan)</span>
              <strong>− {money(gastosVarios)} Bs</strong>
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
                <FiSave aria-hidden="true" />
                {viaje ? 'Guardar cambios' : 'Registrar viaje'}
              </button>
              <button type="button" className="btn" onClick={cancelar}>
                <FiX aria-hidden="true" /> Limpiar
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            {aviso && <p className="ok">{aviso}</p>}
          </section>
        </div>
      </form>

      {confirmar && (
        <Modal
          titulo={viaje ? 'Confirmar cambios' : 'Confirmar registro'}
          onClose={() => setConfirmar(false)}
        >
          <p>{viaje ? '¿Guardar los cambios de este viaje?' : '¿Registrar este viaje?'}</p>
          <p className="ayuda">
            {fecha(form.fechaInicio)} al {fecha(form.fechaFin)}
            {empresaElegida ? ` · ${empresaElegida.nombre}` : ''}
            {choferElegido ? ` · ${choferElegido.nombre} ${choferElegido.apellido}` : ''}
            {` · Total Bs ${money(totalBs)}`}
          </p>
          <div className="acciones">
            <button
              type="button"
              className="btn primario"
              onClick={() => {
                setConfirmar(false)
                guardar()
              }}
            >
              <FiCheck aria-hidden="true" /> Confirmar
            </button>
            <button type="button" className="btn" onClick={() => setConfirmar(false)}>
              <FiX aria-hidden="true" /> Cancelar
            </button>
          </div>
        </Modal>
      )}

      {guardado && (
        <Modal titulo={guardado} onClose={() => setGuardado('')}>
          <p className="ok">
            {viaje
              ? 'Los cambios del viaje se guardaron correctamente.'
              : 'El viaje se registró correctamente.'}
          </p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setGuardado('')}>
              <FiCheck aria-hidden="true" /> Aceptar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
