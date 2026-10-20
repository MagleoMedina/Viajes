import { useEffect, useState } from 'react'
import { FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi'
import { api, fecha, money, urlDescarga } from '../api/client.js'
import { agruparGastos, gasoilPayload, gasoilVacio, vehiculoExistente } from '../api/gastos.js'
import GastoGasoilForm from '../components/GastoGasoilForm.jsx'
import StockGasoilPanel from '../components/StockGasoilPanel.jsx'
import Modal from '../components/Modal.jsx'
import Confirmar from '../components/Confirmar.jsx'

const PESTANAS = [
  { id: 'registrar', label: 'Registrar' },
  { id: 'modificar', label: 'Modificar' },
  { id: 'consultar', label: 'Consultar' },
]

/* ------------------------------------------------------------------ Registrar */

function GasRegistrar({ onStockCambio }) {
  const [vehiculos, setVehiculos] = useState([])
  const [form, setForm] = useState(() => gasoilVacio())
  const [tasaActual, setTasaActual] = useState('')
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargarVehiculos() {
    return api.get('/vehiculos').then(setVehiculos)
  }

  function cargarRegistros() {
    return api.get('/gastos-gasoil').then(setRegistros)
  }

  useEffect(() => {
    cargarVehiculos().catch((e) => setError(e.message))
    cargarRegistros().catch((e) => setError(e.message))
    api
      .get('/tasa')
      .then((t) => {
        if (t?.valor != null) {
          setTasaActual(t.valor)
          setForm((f) => (f.tasa ? f : { ...f, tasa: String(t.valor) }))
        }
      })
      .catch(() => {})
  }, [])

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    const vehiculo = vehiculoExistente(form.vehiculo, vehiculos)
    if (form.vehiculo.trim() && !vehiculo) {
      setError('La placa escrita no existe. Corríjala o deje el vehículo vacío.')
      return
    }
    try {
      await api.post('/gastos-gasoil', gasoilPayload(form, vehiculo ? vehiculo.id : undefined))
      setAviso('Gasto de gasoil registrado.')
      setForm(gasoilVacio(tasaActual))
      await cargarRegistros()
      onStockCambio?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const ultimos = registros.slice(0, 10)

  return (
    <div className="rejilla">
      <section className="tarjeta">
        <h2>Registrar gasto de gasoil</h2>
        <p className="ayuda">
          La placa es opcional; si la escribe debe existir en Vehículos. Monto $ = Litros × Precio $/L.
        </p>
        <GastoGasoilForm
          form={form}
          cambiar={cambiar}
          vehiculos={vehiculos}
          onSubmit={guardar}
          etiqueta="Registrar gasto"
        />
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}
      </section>

      <section className="tarjeta ancho-completo">
        <h2>Últimos registros</h2>
        {ultimos.length === 0 ? (
          <p className="vacio">Sin gastos de gasoil todavía.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vehículo</th>
                  <th>Estación</th>
                  <th className="derecha">Litros</th>
                  <th className="derecha">Monto $</th>
                  <th className="derecha">Monto Bs</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((g) => (
                  <tr key={g.id}>
                    <td>{fecha(g.fecha)}</td>
                    <td>{g.vehiculo?.placa ?? '—'}</td>
                    <td>{g.estacion}</td>
                    <td className="derecha">{money(g.litros)}</td>
                    <td className="derecha">{money(g.montoUsd)}</td>
                    <td className="derecha">{money(g.montoBs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ Modificar */

function GasModificar({ onStockCambio }) {
  const [vehiculos, setVehiculos] = useState([])
  const [registros, setRegistros] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', vehiculoId: '' })
  const [gastoEditando, setGastoEditando] = useState(null)
  const [form, setForm] = useState(() => gasoilVacio())
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargarVehiculos() {
    return api.get('/vehiculos').then(setVehiculos)
  }

  function cargarRegistros(f = filtros) {
    const params = new URLSearchParams()
    if (f.desde) params.set('desde', f.desde)
    if (f.hasta) params.set('hasta', f.hasta)
    if (f.vehiculoId) params.set('vehiculoId', f.vehiculoId)
    const qs = params.toString()
    return api.get(`/gastos-gasoil${qs ? `?${qs}` : ''}`).then(setRegistros)
  }

  useEffect(() => {
    cargarVehiculos().catch((e) => setError(e.message))
    cargarRegistros().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cambiarFiltro(campo, valor) {
    const siguiente = { ...filtros, [campo]: valor }
    setFiltros(siguiente)
    cargarRegistros(siguiente).catch((e) => setError(e.message))
  }

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(gasto) {
    setGastoEditando(gasto)
    setForm({
      vehiculo: gasto.vehiculo?.placa ?? '',
      fecha: gasto.fecha,
      estacion: gasto.estacion ?? '',
      litros: String(gasto.litros ?? ''),
      precioLitro: String(gasto.precioLitro ?? ''),
      montoUsd: String(gasto.montoUsd ?? ''),
      tasa: String(gasto.tasa ?? ''),
      montoBs: String(gasto.montoBs ?? ''),
      referencia: gasto.referencia ?? '',
    })
    setError('')
  }

  function cerrarEdicion() {
    setGastoEditando(null)
    setConfirmarGuardado(false)
    setError('')
  }

  function enviarEdicion(e) {
    e.preventDefault()
    const vehiculo = vehiculoExistente(form.vehiculo, vehiculos)
    if (form.vehiculo.trim() && !vehiculo) {
      setError('La placa escrita no existe: regístrela en Vehículos o déjela vacía.')
      return
    }
    setConfirmarGuardado(true)
  }

  async function guardarEdicion() {
    setConfirmarGuardado(false)
    setError('')
    try {
      await api.put(
        `/gastos-gasoil/${gastoEditando.id}`,
        gasoilPayload(form, vehiculoExistente(form.vehiculo, vehiculos)?.id ?? null),
      )
      setAviso('Gasto actualizado.')
      cerrarEdicion()
      await cargarRegistros()
      onStockCambio?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar() {
    const g = porEliminar
    setPorEliminar(null)
    if (!g) return
    setError('')
    setAviso('')
    try {
      await api.del(`/gastos-gasoil/${g.id}`)
      setAviso('Gasto eliminado.')
      await cargarRegistros()
      onStockCambio?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta ancho-completo">
          <h2>Registros</h2>
          <div className="campos-3">
            <label>
              Desde
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => cambiarFiltro('desde', e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => cambiarFiltro('hasta', e.target.value)}
              />
            </label>
            <label>
              Vehículo
              <select
                value={filtros.vehiculoId}
                onChange={(e) => cambiarFiltro('vehiculoId', e.target.value)}
              >
                <option value="">Todos</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {registros.length === 0 ? (
            <p className="vacio">
              <FiSearch aria-hidden="true" /> Sin gastos para este filtro.
            </p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Vehículo</th>
                    <th>Estación</th>
                    <th className="derecha">Litros</th>
                    <th className="derecha">Precio $/L</th>
                    <th className="derecha">Monto $</th>
                    <th className="derecha">Monto Bs</th>
                    <th className="derecha">Tasa</th>
                    <th>N° REF</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((g) => (
                    <tr key={g.id}>
                      <td>{fecha(g.fecha)}</td>
                      <td>{g.vehiculo?.placa ?? '—'}</td>
                      <td>{g.estacion}</td>
                      <td className="derecha">{money(g.litros)}</td>
                      <td className="derecha">{money(g.precioLitro)}</td>
                      <td className="derecha">{money(g.montoUsd)}</td>
                      <td className="derecha">{money(g.montoBs)}</td>
                      <td className="derecha">{money(g.tasa)}</td>
                      <td>{g.referencia}</td>
                      <td className="centro">
                        <button type="button" className="btn-pequeno" onClick={() => editar(g)}>
                          <FiEdit2 aria-hidden="true" /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => setPorEliminar(g)}
                        >
                          <FiTrash2 aria-hidden="true" /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && <p className="error ancho-completo">{error}</p>}
        {aviso && <p className="ok ancho-completo">{aviso}</p>}
      </div>

      {gastoEditando && (
        <Modal titulo="Editar gasto de gasoil" onClose={cerrarEdicion}>
          <GastoGasoilForm
            form={form}
            cambiar={cambiar}
            vehiculos={vehiculos}
            onSubmit={enviarEdicion}
            etiqueta="Guardar cambios"
            onCancelar={cerrarEdicion}
          />
          {error && <p className="error">{error}</p>}
        </Modal>
      )}

      {confirmarGuardado && (
        <Confirmar
          titulo="Confirmar cambios"
          mensaje="¿Guardar los cambios de este gasto?"
          detalle={`${form.vehiculo || 'Sin vehículo'} · ${fecha(form.fecha)} · $ ${money(form.montoUsd)}`}
          etiqueta="Guardar"
          onConfirmar={guardarEdicion}
          onCancelar={() => setConfirmarGuardado(false)}
        />
      )}

      {porEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el gasto de gasoil del ${fecha(porEliminar.fecha)}?`}
          detalle={`${porEliminar.vehiculo?.placa ?? 'Sin vehículo'} · ${porEliminar.estacion || 'sin estación'} · $ ${money(porEliminar.montoUsd)}`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Consultar */

function GasConsultar() {
  const [vehiculos, setVehiculos] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', vehiculoId: '' })
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/vehiculos').then(setVehiculos).catch((e) => setError(e.message))
  }, [])

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function params() {
    const p = new URLSearchParams()
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    if (filtros.vehiculoId) p.set('vehiculoId', filtros.vehiculoId)
    return p
  }

  async function consultar(e) {
    e.preventDefault()
    setError('')
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta".')
      return
    }
    try {
      const gastos = await api.get(`/gastos-gasoil?${params().toString()}`)
      const bloques = agruparGastos(gastos, (g) => g.vehiculo?.placa || 'SIN VEHÍCULO')
      setVistaPrevia({
        bloques,
        cantidad: gastos.length,
        totalUsd: bloques.reduce((s, b) => s + b.sumaUsd, 0),
        totalBs: bloques.reduce((s, b) => s + b.sumaBs, 0),
      })
    } catch (err) {
      setError(err.message)
    }
  }

  function exportarPdf() {
    window.location.href = urlDescarga(`/export/gastos-gasoil?${params().toString()}`)
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta">
          <h2>Filtros</h2>
          <form onSubmit={consultar} className="form">
            <div className="campos-3">
              <label>
                Desde
                <input
                  type="date"
                  value={filtros.desde}
                  onChange={(e) => cambiar('desde', e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filtros.hasta}
                  onChange={(e) => cambiar('hasta', e.target.value)}
                />
              </label>
              <label>
                Vehículo
                <select
                  value={filtros.vehiculoId}
                  onChange={(e) => cambiar('vehiculoId', e.target.value)}
                >
                  <option value="">Todos</option>
                  {vehiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="acciones">
              <button type="submit" className="btn primario">
                <FiSearch aria-hidden="true" /> Consultar
              </button>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
        </section>
      </div>

      {vistaPrevia && (
        <Modal
          titulo="Vista previa de la consulta"
          onClose={() => setVistaPrevia(null)}
          ancho="amplio"
        >
          <p className="ayuda">
            {vistaPrevia.cantidad} registro{vistaPrevia.cantidad === 1 ? '' : 's'} ·{' '}
            {filtros.desde || filtros.hasta
              ? `${filtros.desde ? fecha(filtros.desde) : 'inicio'} al ${
                  filtros.hasta ? fecha(filtros.hasta) : 'hoy'
                }`
              : 'histórico general'}
            {filtros.vehiculoId
              ? ` · ${
                  vehiculos.find((v) => String(v.id) === filtros.vehiculoId)?.placa ?? ''
                }`
              : ''}
          </p>

          {vistaPrevia.bloques.length === 0 ? (
            <p className="vacio">Sin gastos en este intervalo.</p>
          ) : (
            <>
              {vistaPrevia.bloques.map((b) => (
                <div key={b.clave}>
                  <h3 className="bloque-titulo">{b.clave}</h3>
                  <div className="tabla-envoltura">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Estación</th>
                          <th className="derecha">Litros</th>
                          <th className="derecha">Precio $/L</th>
                          <th className="derecha">Monto $</th>
                          <th className="derecha">Monto Bs</th>
                          <th>N° REF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.filas.map((g) => (
                          <tr key={g.id}>
                            <td>{fecha(g.fecha)}</td>
                            <td>{g.estacion}</td>
                            <td className="derecha">{money(g.litros)}</td>
                            <td className="derecha">{money(g.precioLitro)}</td>
                            <td className="derecha">{money(g.montoUsd)}</td>
                            <td className="derecha">{money(g.montoBs)}</td>
                            <td>{g.referencia}</td>
                          </tr>
                        ))}
                        <tr className="suma">
                          <td colSpan={4}>SUBTOTAL {b.clave.toLocaleUpperCase('es')}</td>
                          <td className="derecha">{money(b.sumaUsd)}</td>
                          <td className="derecha">{money(b.sumaBs)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <p className="resumen-total">
                <span>TOTAL GENERAL $ {money(vistaPrevia.totalUsd)}</span>
                <span>Bs {money(vistaPrevia.totalBs)}</span>
              </p>
            </>
          )}

          <div className="acciones">
            <button type="button" className="btn primario" onClick={exportarPdf}>
              Exportar a PDF
            </button>
            <button type="button" className="btn" onClick={() => setVistaPrevia(null)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Sección */

/** Sección «Gasoil» con pestañas Registrar / Modificar / Consultar. */
export default function GastosGasoil() {
  const [pestana, setPestana] = useState('registrar')
  // Cambia tras cada alta/edición/borrado para refrescar la ventanita de stock.
  const [stockTick, setStockTick] = useState(0)

  function refrescarStock() {
    setStockTick((t) => t + 1)
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Gastos de gasoil</h1>
          <p className="sub">
            Registre cada carga por vehículo, con litros, precio por litro y montos en $ y Bs.
          </p>
        </div>
      </header>

      <nav className="pestanas" aria-label="Acciones de gastos de gasoil">
        {PESTANAS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={pestana === id ? 'activa' : ''}
            onClick={() => setPestana(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <StockGasoilPanel tick={stockTick} />

      {pestana === 'registrar' && <GasRegistrar onStockCambio={refrescarStock} />}
      {pestana === 'modificar' && <GasModificar onStockCambio={refrescarStock} />}
      {pestana === 'consultar' && <GasConsultar />}
    </div>
  )
}
