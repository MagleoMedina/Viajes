import { useEffect, useState } from 'react'
import { FiPlus, FiSave, FiEdit2, FiTrash2, FiX } from 'react-icons/fi'
import { api } from '../api/client.js'
import Confirmar from '../components/Confirmar.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'

const VACIO = { nombre: '' }

export default function Puntos() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [formRef, enfocarFormulario] = useFocoFormulario()

  function cargar() {
    return api.get('/puntos').then(setLista)
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  function editar(punto) {
    setEditandoId(punto.id)
    setForm({ nombre: punto.nombre })
    setError('')
    setAviso('')
  }

  function limpiar() {
    setEditandoId(null)
    setForm(VACIO)
    setError('')
  }

  function enviar(e) {
    e.preventDefault()
    setConfirmarGuardado(true)
  }

  async function guardar() {
    setConfirmarGuardado(false)
    setError('')
    setAviso('')
    try {
      if (editandoId == null) {
        await api.post('/puntos', form)
        setAviso('Punto registrado.')
      } else {
        await api.put(`/puntos/${editandoId}`, form)
        setAviso('Punto actualizado.')
      }
      limpiar()
      await cargar()
      enfocarFormulario()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar() {
    const punto = porEliminar
    setPorEliminar(null)
    if (!punto) return
    setError('')
    setAviso('')
    try {
      await api.del(`/puntos/${punto.id}`)
      setAviso('Punto eliminado.')
      if (editandoId === punto.id) limpiar()
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Puntos</h1>
          <p className="sub">Puntos de salida y de llegada. Alimentan el formulario de viajes.</p>
        </div>
        <span className="contador">{lista.length} registrados</span>
      </header>

      <div className="rejilla">
        <section className="tarjeta">
          <h2>{editandoId == null ? 'Nuevo punto' : 'Editar punto'}</h2>
          <form ref={formRef} onSubmit={enviar} className="form">
            <label>
              Nombre
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ nombre: e.target.value })}
                placeholder="Ferrominera, Cabelum, Puerto Ordaz..."
                required
              />
            </label>

            <div className="acciones">
              <button type="submit" className="btn primario">
                {editandoId == null ? (
                  <FiPlus aria-hidden="true" />
                ) : (
                  <FiSave aria-hidden="true" />
                )}
                {editandoId == null ? 'Registrar' : 'Guardar cambios'}
              </button>
              {editandoId != null && (
                <button type="button" className="btn" onClick={limpiar}>
                  <FiX aria-hidden="true" /> Cancelar
                </button>
              )}
            </div>
          </form>
          {error && <p className="error">{error}</p>}
          {aviso && <p className="ok">{aviso}</p>}
        </section>

        <section className="tarjeta">
          <h2>Listado</h2>
          {lista.length === 0 ? (
            <p className="vacio">Sin puntos todavía. Registre el primero.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Punto</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((punto) => (
                    <tr key={punto.id}>
                      <td>{punto.nombre}</td>
                      <td className="centro">
                        <button type="button" className="btn pequeno" onClick={() => editar(punto)}>
                          <FiEdit2 aria-hidden="true" /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => setPorEliminar(punto)}
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
      </div>

      {confirmarGuardado && (
        <Confirmar
          titulo={editandoId == null ? 'Confirmar registro' : 'Confirmar cambios'}
          mensaje={
            editandoId == null ? '¿Registrar este punto?' : '¿Guardar los cambios de este punto?'
          }
          detalle={form.nombre}
          etiqueta={editandoId == null ? 'Registrar' : 'Guardar'}
          onConfirmar={guardar}
          onCancelar={() => setConfirmarGuardado(false)}
        />
      )}

      {porEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el punto "${porEliminar.nombre}"?`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </div>
  )
}
