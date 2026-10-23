import { useEffect, useState } from 'react'
import { FiEdit2, FiSave, FiSearch, FiTrash2, FiX } from 'react-icons/fi'
import { api, fecha, money } from '../api/client.js'
import { gastoVacio, gastoPayload, tituloExistente } from '../api/gastos.js'
import Modal from '../components/Modal.jsx'
import Confirmar from '../components/Confirmar.jsx'
import GastoForm from '../components/GastoForm.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'

export default function ModificarGastos() {
  const [titulos, setTitulos] = useState([])
  const [registros, setRegistros] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', tituloId: '' })

  // Alta/edición de títulos (rename en la propia fila de la tabla).
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [editandoTitulo, setEditandoTitulo] = useState(null) // { id, nombre }

  // Edición de un registro (modal con el mismo formulario del alta).
  const [gastoEditando, setGastoEditando] = useState(null)
  const [form, setForm] = useState(() => gastoVacio())
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)

  const [porEliminarGasto, setPorEliminarGasto] = useState(null)
  const [porEliminarTitulo, setPorEliminarTitulo] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [tituloRef, enfocarTitulo] = useFocoFormulario()

  function cargarTitulos() {
    return api.get('/titulos-gasto').then(setTitulos)
  }

  function cargarRegistros(f = filtros) {
    const params = new URLSearchParams()
    if (f.desde) params.set('desde', f.desde)
    if (f.hasta) params.set('hasta', f.hasta)
    if (f.tituloId) params.set('tituloId', f.tituloId)
    const qs = params.toString()
    return api.get(`/gastos-varios${qs ? `?${qs}` : ''}`).then(setRegistros)
  }

  useEffect(() => {
    cargarTitulos().catch((e) => setError(e.message))
    cargarRegistros().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cambiarFiltro(campo, valor) {
    const siguiente = { ...filtros, [campo]: valor }
    setFiltros(siguiente)
    cargarRegistros(siguiente).catch((e) => setError(e.message))
  }

  /* ------------------------------ títulos ------------------------------ */

  async function agregarTitulo(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/titulos-gasto', { nombre: nuevoTitulo })
      setAviso('Título de gasto registrado.')
      setNuevoTitulo('')
      await cargarTitulos()
      enfocarTitulo()
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardarTitulo() {
    setError('')
    setAviso('')
    try {
      await api.put(`/titulos-gasto/${editandoTitulo.id}`, { nombre: editandoTitulo.nombre })
      setEditandoTitulo(null)
      setAviso('Título actualizado.')
      await Promise.all([cargarTitulos(), cargarRegistros()])
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminarTitulo() {
    const t = porEliminarTitulo
    setPorEliminarTitulo(null)
    if (!t) return
    setError('')
    setAviso('')
    try {
      await api.del(`/titulos-gasto/${t.id}`)
      setAviso('Título eliminado.')
      await Promise.all([cargarTitulos(), cargarRegistros()])
    } catch (err) {
      setError(err.message)
    }
  }

  /* ------------------------------ registros ---------------------------- */

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(gasto) {
    setGastoEditando(gasto)
    setForm({
      titulo: gasto.tituloGasto?.nombre ?? '',
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
    const titulo = tituloExistente(form.titulo, titulos)
    if (!titulo) {
      setError('El título escrito no existe: regístrelo en la tarjeta de títulos.')
      return
    }
    setConfirmarGuardado(true)
  }

  async function guardarEdicion() {
    setConfirmarGuardado(false)
    setError('')
    try {
      await api.put(
        `/gastos-varios/${gastoEditando.id}`,
        gastoPayload(form, tituloExistente(form.titulo, titulos).id),
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
      await api.del(`/gastos-varios/${g.id}`)
      setAviso('Gasto eliminado.')
      await cargarRegistros()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta ancho-completo">
          <h2>Títulos de gasto</h2>
          <form ref={tituloRef} onSubmit={agregarTitulo} className="form linea">
            <input
              type="text"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              placeholder="Nombre del título"
              required
            />
            <button type="submit" className="btn primario">
              <FiSave aria-hidden="true" /> Agregar
            </button>
          </form>

          {titulos.length === 0 ? (
            <p className="vacio">Sin títulos todavía.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla limitada">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {titulos.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {editandoTitulo?.id === t.id ? (
                          <input
                            type="text"
                            value={editandoTitulo.nombre}
                            onChange={(e) =>
                              setEditandoTitulo({ ...editandoTitulo, nombre: e.target.value })
                            }
                            autoFocus
                          />
                        ) : (
                          t.nombre
                        )}
                      </td>
                      <td className="centro">
                        {editandoTitulo?.id === t.id ? (
                          <>
                            <button type="button" className="btn-pequeno" onClick={guardarTitulo}>
                              <FiSave aria-hidden="true" /> Guardar
                            </button>
                            <button
                              type="button"
                              className="btn pequeno"
                              onClick={() => setEditandoTitulo(null)}
                            >
                              <FiX aria-hidden="true" /> Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-pequeno"
                              onClick={() => setEditandoTitulo({ id: t.id, nombre: t.nombre })}
                            >
                              <FiEdit2 aria-hidden="true" /> Editar
                            </button>
                            <button
                              type="button"
                              className="btn pequeno peligro"
                              onClick={() => setPorEliminarTitulo(t)}
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
              Título
              <select
                value={filtros.tituloId}
                onChange={(e) => cambiarFiltro('tituloId', e.target.value)}
              >
                <option value="">Todos</option>
                {titulos.map((t) => (
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
              <table className="tabla compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="texto">Título</th>
                    <th>N° factura</th>
                    <th className="texto">Motivo</th>
                    <th className="derecha">Monto $</th>
                    <th className="derecha">Monto Bs</th>
                    <th className="derecha">Tasa</th>
                    <th className="derecha">%DB</th>
                    <th className="texto">N° REF</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((g) => (
                    <tr key={g.id}>
                      <td>{fecha(g.fecha)}</td>
                      <td className="texto">{g.tituloGasto?.nombre}</td>
                      <td>{g.numero}</td>
                      <td className="texto">{g.motivo}</td>
                      <td className="derecha">{money(g.montoUsd)}</td>
                      <td className="derecha">{money(g.montoBs)}</td>
                      <td className="derecha">{money(g.tasa)}</td>
                      <td className="derecha">{money(g.porcentajeDb)}</td>
                      <td className="texto">{g.referencia}</td>
                      <td className="centro">
                        <button
                          type="button"
                          className="btn-pequeno"
                          onClick={() => editar(g)}
                        >
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
        <Modal titulo="Editar gasto" onClose={cerrarEdicion}>
          <GastoForm
            form={form}
            cambiar={cambiar}
            titulos={titulos}
            onSubmit={enviarEdicion}
            etiqueta="Guardar cambios"
            etiquetaNumero="Número de factura"
            onCancelar={cerrarEdicion}
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
          detalle={`${porEliminarGasto.tituloGasto?.nombre} · $ ${money(porEliminarGasto.montoUsd)} · Bs ${money(porEliminarGasto.montoBs)}`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminarGasto}
          onCancelar={() => setPorEliminarGasto(null)}
        />
      )}

      {porEliminarTitulo && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el título "${porEliminarTitulo.nombre}"?`}
          detalle="Solo se puede eliminar si ningún gasto lo usa."
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminarTitulo}
          onCancelar={() => setPorEliminarTitulo(null)}
        />
      )}
    </>
  )
}
