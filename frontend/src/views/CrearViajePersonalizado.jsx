import { useEffect, useState } from 'react'
import { FiPlus, FiSave, FiEdit2, FiTrash2, FiX, FiRefreshCw } from 'react-icons/fi'
import { api, fecha, money } from '../api/client.js'
import Confirmar from '../components/Confirmar.jsx'
import CrearViaje from './CrearViaje.jsx'

const VACIO_TITULO = { nombre: '' }

/**
 * Viajes personalizados: primero se registra el título (CRUD con eliminación
 * lógica) y con él se crean viajes iguales a los normales pero sin viáticos.
 * Los viajes personalizados no aparecen en el listado general ni en los
 * reportes normales: solo aquí y en su propio PDF.
 */
export default function CrearViajePersonalizado() {
  const [titulos, setTitulos] = useState([])
  const [formTitulo, setFormTitulo] = useState(VACIO_TITULO)
  const [editandoTituloId, setEditandoTituloId] = useState(null)
  const [tituloSelId, setTituloSelId] = useState('')
  const [viajes, setViajes] = useState([])
  const [viajeEditando, setViajeEditando] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmarTitulo, setConfirmarTitulo] = useState(false)
  const [tituloPorEliminar, setTituloPorEliminar] = useState(null)
  const [viajePorEliminar, setViajePorEliminar] = useState(null)

  function cargarTitulos() {
    return api.get('/titulos-viaje').then((lista) => {
      setTitulos(lista)
      setTituloSelId((actual) =>
        actual && lista.some((t) => String(t.id) === actual) ? actual : lista[0]?.id ? String(lista[0].id) : '',
      )
      return lista
    })
  }

  function cargarViajes(tituloId) {
    // Sin título no hay nada que pedir: el estado queda como está (vacío al
    // montar). setState solo ocurre dentro de .then, nunca sincrónico.
    if (!tituloId) return Promise.resolve()
    return api.get(`/viajes?tituloViajeId=${tituloId}`).then(setViajes)
  }

  useEffect(() => {
    cargarTitulos().catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    cargarViajes(tituloSelId).catch((e) => setError(e.message))
  }, [tituloSelId])

  function editarTitulo(titulo) {
    setEditandoTituloId(titulo.id)
    setFormTitulo({ nombre: titulo.nombre })
    setError('')
    setAviso('')
  }

  function limpiarTitulo() {
    setEditandoTituloId(null)
    setFormTitulo(VACIO_TITULO)
    setError('')
  }

  function enviarTitulo(e) {
    e.preventDefault()
    setConfirmarTitulo(true)
  }

  async function guardarTitulo() {
    setConfirmarTitulo(false)
    setError('')
    setAviso('')
    try {
      if (editandoTituloId == null) {
        await api.post('/titulos-viaje', formTitulo)
        setAviso('Título registrado.')
      } else {
        await api.put(`/titulos-viaje/${editandoTituloId}`, formTitulo)
        setAviso('Título actualizado.')
      }
      limpiarTitulo()
      await cargarTitulos()
    } catch (err) {
      setError(err.message)
    }
  }

  /** Soft delete: el título se oculta; los viajes históricos lo conservan. */
  async function eliminarTitulo() {
    const titulo = tituloPorEliminar
    setTituloPorEliminar(null)
    if (!titulo) return
    setError('')
    setAviso('')
    try {
      await api.del(`/titulos-viaje/${titulo.id}`)
      setAviso('Título eliminado. Los viajes registrados se conservan.')
      if (editandoTituloId === titulo.id) limpiarTitulo()
      await cargarTitulos()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminarViaje() {
    const viaje = viajePorEliminar
    setViajePorEliminar(null)
    if (!viaje) return
    setError('')
    setAviso('')
    try {
      await api.del(`/viajes/${viaje.id}`)
      setAviso('Viaje eliminado.')
      if (viajeEditando?.id === viaje.id) setViajeEditando(null)
      await cargarViajes(tituloSelId)
    } catch (err) {
      setError(err.message)
    }
  }

  const tituloSel = titulos.find((t) => String(t.id) === tituloSelId)

  return (
    <div className="vista ancha">
      <header className="vista-cab">
        <div>
          <h1>Crear viajes personalizados</h1>
          <p className="sub">
            Registre el título del viaje y luego cada viaje con ese título. No lleva viáticos.
          </p>
        </div>
      </header>

      <section className="tarjeta">
        <h2>Registrar título</h2>
        <div className="rejilla">
          <div>
            <form onSubmit={enviarTitulo} className="form">
              <label>
                Nombre del título
                <input
                  type="text"
                  maxLength="100"
                  value={formTitulo.nombre}
                  onChange={(e) => setFormTitulo({ nombre: e.target.value })}
                  placeholder="Obra Puerto Ordaz, Encargo Cabelum..."
                  required
                />
              </label>
              <div className="acciones">
                <button type="submit" className="btn primario">
                  {editandoTituloId == null ? (
                    <FiPlus aria-hidden="true" />
                  ) : (
                    <FiSave aria-hidden="true" />
                  )}
                  {editandoTituloId == null ? 'Registrar' : 'Guardar cambios'}
                </button>
                {editandoTituloId != null && (
                  <button type="button" className="btn" onClick={limpiarTitulo}>
                    <FiX aria-hidden="true" /> Cancelar
                  </button>
                )}
              </div>
            </form>
            {error && <p className="error">{error}</p>}
            {aviso && <p className="ok">{aviso}</p>}
          </div>

          <div>
            <h3>Títulos registrados</h3>
            {titulos.length === 0 ? (
              <p className="vacio">Sin títulos todavía. Registre el primero.</p>
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th className="centro">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulos.map((titulo) => (
                      <tr key={titulo.id}>
                        <td>{titulo.nombre}</td>
                        <td className="centro">
                          <button
                            type="button"
                            className="btn pequeno"
                            onClick={() => editarTitulo(titulo)}
                          >
                            <FiEdit2 aria-hidden="true" /> Editar
                          </button>
                          <button
                            type="button"
                            className="btn pequeno peligro"
                            onClick={() => setTituloPorEliminar(titulo)}
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
          </div>
        </div>
      </section>

      {titulos.length === 0 ? (
        <p className="vacio">
          Necesita registrar un título antes de crear viajes personalizados.
        </p>
      ) : viajeEditando ? (
        <CrearViaje
          key={viajeEditando.id}
          viaje={viajeEditando}
          personalizado
          onGuardado={() => {
            setViajeEditando(null)
            cargarViajes(tituloSelId).catch((e) => setError(e.message))
          }}
        />
      ) : (
        <CrearViaje key={`nuevo-${tituloSelId}`} personalizado />
      )}

      <section className="tarjeta">
        <h2>
          Viajes registrados
          {tituloSel ? ` · ${tituloSel.nombre}` : ''}
        </h2>
        <div className="acciones">
          <label>
            Título
            <select value={tituloSelId} onChange={(e) => setTituloSelId(e.target.value)}>
              {titulos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn pequeno"
            onClick={() => cargarViajes(tituloSelId).catch((e) => setError(e.message))}
          >
            <FiRefreshCw aria-hidden="true" /> Actualizar
          </button>
        </div>
        {viajes.length === 0 ? (
          <p className="vacio">Sin viajes con este título.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla compacta">
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Chofer</th>
                  <th>Empresa</th>
                  <th>Vehículo</th>
                  <th className="derecha">Monto $</th>
                  <th className="centro">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {viajes.map((v) => (
                  <tr key={v.id}>
                    <td>{fecha(v.fechaInicio)}</td>
                    <td>{fecha(v.fechaFin)}</td>
                    <td>
                      {v.chofer?.nombre ?? ''} {v.chofer?.apellido ?? ''}
                    </td>
                    <td>{v.empresa?.nombre ?? ''}</td>
                    <td>
                      {v.vehiculo
                        ? `${[v.vehiculo.marca, v.vehiculo.modelo].filter(Boolean).join(' ')} (${
                            v.vehiculo.placa ?? ''
                          })`
                        : '—'}
                    </td>
                    <td className="derecha">{money(v.montoViaje)}</td>
                    <td className="centro">
                      <button
                        type="button"
                        className="btn pequeno"
                        onClick={() => {
                          setViajeEditando(v)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        <FiEdit2 aria-hidden="true" /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn pequeno peligro"
                        onClick={() => setViajePorEliminar(v)}
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

      {confirmarTitulo && (
        <Confirmar
          titulo={editandoTituloId == null ? 'Confirmar registro' : 'Confirmar cambios'}
          mensaje={
            editandoTituloId == null
              ? '¿Registrar este título de viaje?'
              : '¿Guardar los cambios de este título?'
          }
          detalle={formTitulo.nombre}
          etiqueta={editandoTituloId == null ? 'Registrar' : 'Guardar'}
          onConfirmar={guardarTitulo}
          onCancelar={() => setConfirmarTitulo(false)}
        />
      )}

      {tituloPorEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el título "${tituloPorEliminar.nombre}"?`}
          detalle="Los viajes ya registrados con este título se conservan."
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminarTitulo}
          onCancelar={() => setTituloPorEliminar(null)}
        />
      )}

      {viajePorEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el viaje del ${fecha(viajePorEliminar.fechaInicio)}?`}
          detalle={viajePorEliminar.empresa?.nombre ?? ''}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminarViaje}
          onCancelar={() => setViajePorEliminar(null)}
        />
      )}
    </div>
  )
}
