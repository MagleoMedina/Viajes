import { useEffect, useState } from 'react'
import { FiPlus, FiSave, FiEdit2, FiTrash2, FiSearch, FiX } from 'react-icons/fi'
import { api, fecha, money } from '../api/client.js'
import {
  agruparGastos,
  gastoVacio,
  impuestoPayload,
  tipoImpuestoExistente,
} from '../api/gastos.js'
import GastoForm from '../components/GastoForm.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'
import Modal from '../components/Modal.jsx'
import Confirmar from '../components/Confirmar.jsx'
import VistaPreviaPdf from '../components/VistaPreviaPdf.jsx'

const PESTANAS = [
  { id: 'registrar', label: 'Registrar' },
  { id: 'modificar', label: 'Modificar' },
  { id: 'consultar', label: 'Consultar' },
]

/** Campos: el campo "Título" de GastoForm se llama "Tipo de impuesto" aquí. */
const CAMPO = {
  etiquetaCampo: 'Tipo de impuesto',
  placeholderCampo: 'Escriba o elija el tipo',
  datalistId: 'titulos-impuesto-datalist',
}

/* ------------------------------------------------------------------ Registrar */

function ImpRegistrar() {
  const [tipos, setTipos] = useState([])
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [form, setForm] = useState(() => gastoVacio())
  const [tasaActual, setTasaActual] = useState('')
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [formRef, enfocarFormulario] = useFocoFormulario()
  const [tipoRef, enfocarTipo] = useFocoFormulario()

  function cargarTipos() {
    return api.get('/titulos-impuesto').then(setTipos)
  }

  function cargarRegistros() {
    return api.get('/gastos-impuestos').then(setRegistros)
  }

  useEffect(() => {
    cargarTipos().catch((e) => setError(e.message))
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

  async function agregarTipo(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/titulos-impuesto', { nombre: nuevoTipo })
      setAviso('Tipo de impuesto registrado.')
      setNuevoTipo('')
      await cargarTipos()
      enfocarTipo()
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    const tipo = tipoImpuestoExistente(form.titulo, tipos)
    if (!tipo) {
      setError('Registre primero el tipo de impuesto en la tarjeta "Nuevo tipo de impuesto".')
      return
    }
    try {
      await api.post('/gastos-impuestos', impuestoPayload(form, tipo.id))
      setAviso('Gasto de impuesto registrado.')
      setForm(gastoVacio(tasaActual))
      await cargarRegistros()
      enfocarFormulario()
    } catch (err) {
      setError(err.message)
    }
  }

  const ultimos = registros.slice(0, 10)

  return (
    <div className="rejilla">
      <section className="tarjeta">
        <h2>Nuevo tipo de impuesto</h2>
        <p className="ayuda">
          Antes de registrar un gasto debe existir su tipo (ej.: IVSS, Alcaldía, SENIAT).
        </p>
        <form ref={tipoRef} onSubmit={agregarTipo} className="form linea">
          <input
            type="text"
            value={nuevoTipo}
            onChange={(e) => setNuevoTipo(e.target.value)}
            placeholder="Nombre del tipo"
            required
          />
          <button type="submit" className="btn primario">
            <FiPlus aria-hidden="true" /> Agregar
          </button>
        </form>

        {tipos.length === 0 ? (
          <p className="vacio">Sin tipos todavía.</p>
        ) : (
          <ul className="chips-lista">
            {tipos.map((t) => (
              <li key={t.id} className="chip">
                {t.nombre}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta">
        <h2>Registrar gasto de impuesto</h2>
        <GastoForm
          formRef={formRef}
          form={form}
          cambiar={cambiar}
          titulos={tipos}
          onSubmit={guardar}
          etiqueta="Registrar gasto"
          {...CAMPO}
        />
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}
      </section>

      <section className="tarjeta ancho-completo">
        <h2>Últimos registros</h2>
        {ultimos.length === 0 ? (
          <p className="vacio">Sin gastos registrados todavía.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>N°</th>
                  <th>Motivo</th>
                  <th className="derecha">Monto $</th>
                  <th className="derecha">Monto Bs</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((g) => (
                  <tr key={g.id}>
                    <td>{fecha(g.fecha)}</td>
                    <td>{g.tituloImpuesto?.nombre}</td>
                    <td>{g.numero}</td>
                    <td>{g.motivo}</td>
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

function ImpModificar() {
  const [tipos, setTipos] = useState([])
  const [registros, setRegistros] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', tituloId: '' })
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [editandoTipo, setEditandoTipo] = useState(null)
  const [gastoEditando, setGastoEditando] = useState(null)
  const [form, setForm] = useState(() => gastoVacio())
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)
  const [porEliminarGasto, setPorEliminarGasto] = useState(null)
  const [porEliminarTipo, setPorEliminarTipo] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargarTipos() {
    return api.get('/titulos-impuesto').then(setTipos)
  }

  function cargarRegistros(f = filtros) {
    const params = new URLSearchParams()
    if (f.desde) params.set('desde', f.desde)
    if (f.hasta) params.set('hasta', f.hasta)
    if (f.tituloId) params.set('tituloId', f.tituloId)
    const qs = params.toString()
    return api.get(`/gastos-impuestos${qs ? `?${qs}` : ''}`).then(setRegistros)
  }

  useEffect(() => {
    cargarTipos().catch((e) => setError(e.message))
    cargarRegistros().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cambiarFiltro(campo, valor) {
    const siguiente = { ...filtros, [campo]: valor }
    setFiltros(siguiente)
    cargarRegistros(siguiente).catch((e) => setError(e.message))
  }

  async function agregarTipo(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/titulos-impuesto', { nombre: nuevoTipo })
      setAviso('Tipo de impuesto registrado.')
      setNuevoTipo('')
      await cargarTipos()
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardarTipo() {
    setError('')
    setAviso('')
    try {
      await api.put(`/titulos-impuesto/${editandoTipo.id}`, { nombre: editandoTipo.nombre })
      setEditandoTipo(null)
      setAviso('Tipo de impuesto actualizado.')
      await Promise.all([cargarTipos(), cargarRegistros()])
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminarTipo() {
    const t = porEliminarTipo
    setPorEliminarTipo(null)
    if (!t) return
    setError('')
    setAviso('')
    try {
      await api.del(`/titulos-impuesto/${t.id}`)
      setAviso('Tipo de impuesto eliminado.')
      await Promise.all([cargarTipos(), cargarRegistros()])
    } catch (err) {
      setError(err.message)
    }
  }

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(gasto) {
    setGastoEditando(gasto)
    setForm({
      titulo: gasto.tituloImpuesto?.nombre ?? '',
      fecha: gasto.fecha,
      numero: gasto.numero ?? '',
      motivo: gasto.motivo ?? '',
      montoUsd: String(gasto.montoUsd ?? ''),
      tasa: String(gasto.tasa ?? ''),
      montoBs: String(gasto.montoBs ?? ''),
      porcentajeDb: String(gasto.porcentajeDb ?? ''),
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
    const tipo = tipoImpuestoExistente(form.titulo, tipos)
    if (!tipo) {
      setError('El tipo escrito no existe: regístrelo en la tarjeta de tipos.')
      return
    }
    setConfirmarGuardado(true)
  }

  async function guardarEdicion() {
    setConfirmarGuardado(false)
    setError('')
    try {
      await api.put(
        `/gastos-impuestos/${gastoEditando.id}`,
        impuestoPayload(form, tipoImpuestoExistente(form.titulo, tipos).id),
      )
      setAviso('Gasto actualizado.')
      cerrarEdicion()
      await cargarRegistros()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminarGasto() {
    const g = porEliminarGasto
    setPorEliminarGasto(null)
    if (!g) return
    setError('')
    setAviso('')
    try {
      await api.del(`/gastos-impuestos/${g.id}`)
      setAviso('Gasto eliminado.')
      await cargarRegistros()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta">
          <h2>Tipos de impuesto</h2>
          <form onSubmit={agregarTipo} className="form linea">
            <input
              type="text"
              value={nuevoTipo}
              onChange={(e) => setNuevoTipo(e.target.value)}
              placeholder="Nombre del tipo"
              required
            />
            <button type="submit" className="btn primario">
              <FiSave aria-hidden="true" /> Agregar
            </button>
          </form>

          {tipos.length === 0 ? (
            <p className="vacio">Sin tipos todavía.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {editandoTipo?.id === t.id ? (
                          <input
                            type="text"
                            value={editandoTipo.nombre}
                            onChange={(e) =>
                              setEditandoTipo({ ...editandoTipo, nombre: e.target.value })
                            }
                            autoFocus
                          />
                        ) : (
                          t.nombre
                        )}
                      </td>
                      <td className="centro">
                        {editandoTipo?.id === t.id ? (
                          <>
                            <button type="button" className="btn-pequeno" onClick={guardarTipo}>
                              <FiSave aria-hidden="true" /> Guardar
                            </button>
                            <button
                              type="button"
                              className="btn pequeno"
                              onClick={() => setEditandoTipo(null)}
                            >
                              <FiX aria-hidden="true" /> Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-pequeno"
                              onClick={() => setEditandoTipo({ id: t.id, nombre: t.nombre })}
                            >
                              <FiEdit2 aria-hidden="true" /> Editar
                            </button>
                            <button
                              type="button"
                              className="btn pequeno peligro"
                              onClick={() => setPorEliminarTipo(t)}
                            >
                              <FiTrash2 aria-hidden="true" /> Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
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
              Tipo
              <select
                value={filtros.tituloId}
                onChange={(e) => cambiarFiltro('tituloId', e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
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
                    <th>Tipo</th>
                    <th>N°</th>
                    <th>Motivo</th>
                    <th className="derecha">Monto $</th>
                    <th className="derecha">Monto Bs</th>
                    <th className="derecha">Tasa</th>
                    <th className="derecha">%DB</th>
                    <th>N° REF</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((g) => (
                    <tr key={g.id}>
                      <td>{fecha(g.fecha)}</td>
                      <td>{g.tituloImpuesto?.nombre}</td>
                      <td>{g.numero}</td>
                      <td>{g.motivo}</td>
                      <td className="derecha">{money(g.montoUsd)}</td>
                      <td className="derecha">{money(g.montoBs)}</td>
                      <td className="derecha">{money(g.tasa)}</td>
                      <td className="derecha">{money(g.porcentajeDb)}</td>
                      <td>{g.referencia}</td>
                      <td className="centro">
                        <button type="button" className="btn-pequeno" onClick={() => editar(g)}>
                          <FiEdit2 aria-hidden="true" /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => setPorEliminarGasto(g)}
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
        <Modal titulo="Editar gasto de impuesto" onClose={cerrarEdicion}>
          <GastoForm
            form={form}
            cambiar={cambiar}
            titulos={tipos}
            onSubmit={enviarEdicion}
            etiqueta="Guardar cambios"
            onCancelar={cerrarEdicion}
            {...CAMPO}
          />
          {error && <p className="error">{error}</p>}
        </Modal>
      )}

      {confirmarGuardado && (
        <Confirmar
          titulo="Confirmar cambios"
          mensaje="¿Guardar los cambios de este gasto?"
          detalle={`${form.titulo} · ${fecha(form.fecha)} · $ ${money(form.montoUsd)}`}
          etiqueta="Guardar"
          onConfirmar={guardarEdicion}
          onCancelar={() => setConfirmarGuardado(false)}
        />
      )}

      {porEliminarGasto && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el gasto del ${fecha(porEliminarGasto.fecha)} "${porEliminarGasto.motivo}"?`}
          detalle={`${porEliminarGasto.tituloImpuesto?.nombre} · $ ${money(porEliminarGasto.montoUsd)} · Bs ${money(porEliminarGasto.montoBs)}`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminarGasto}
          onCancelar={() => setPorEliminarGasto(null)}
        />
      )}

      {porEliminarTipo && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el tipo "${porEliminarTipo.nombre}"?`}
          detalle="Solo se puede eliminar si ningún gasto lo usa."
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminarTipo}
          onCancelar={() => setPorEliminarTipo(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Consultar */

function ImpConsultar() {
  const [tipos, setTipos] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', tituloId: '' })
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [pdfPrevia, setPdfPrevia] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/titulos-impuesto').then(setTipos).catch((e) => setError(e.message))
  }, [])

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function params() {
    const p = new URLSearchParams()
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    if (filtros.tituloId) p.set('tituloId', filtros.tituloId)
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
      const gastos = await api.get(`/gastos-impuestos?${params().toString()}`)
      const bloques = agruparGastos(gastos, (g) => g.tituloImpuesto?.nombre)
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
    setPdfPrevia(`/export/gastos-impuestos?${params().toString()}`)
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
                Tipo
                <select
                  value={filtros.tituloId}
                  onChange={(e) => cambiar('tituloId', e.target.value)}
                >
                  <option value="">Todos</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
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
            {filtros.tituloId
              ? ` · ${tipos.find((t) => String(t.id) === filtros.tituloId)?.nombre ?? ''}`
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
                          <th>N°</th>
                          <th>Motivo</th>
                          <th className="derecha">Monto $</th>
                          <th className="derecha">Monto Bs</th>
                          <th>N° REF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.filas.map((g) => (
                          <tr key={g.id}>
                            <td>{fecha(g.fecha)}</td>
                            <td>{g.numero}</td>
                            <td>{g.motivo}</td>
                            <td className="derecha">{money(g.montoUsd)}</td>
                            <td className="derecha">{money(g.montoBs)}</td>
                            <td>{g.referencia}</td>
                          </tr>
                        ))}
                        <tr className="suma">
                          <td colSpan={3}>SUBTOTAL {b.clave.toLocaleUpperCase('es')}</td>
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

      {pdfPrevia && (
        <VistaPreviaPdf
          ruta={pdfPrevia}
          titulo="Vista previa · Gastos de impuestos"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Sección */

/** Sección «Gastos de impuestos» con pestañas Registrar / Modificar / Consultar. */
export default function GastosImpuestos() {
  const [pestana, setPestana] = useState('registrar')

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Gastos de impuestos</h1>
          <p className="sub">
            Registre el tipo de impuesto y luego cada gasto con su monto en $ y Bs.
          </p>
        </div>
      </header>

      <nav className="pestanas" aria-label="Acciones de gastos de impuestos">
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

      {pestana === 'registrar' && <ImpRegistrar />}
      {pestana === 'modificar' && <ImpModificar />}
      {pestana === 'consultar' && <ImpConsultar />}
    </div>
  )
}
