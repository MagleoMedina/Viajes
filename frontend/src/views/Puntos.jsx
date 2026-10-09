import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const VACIO = { nombre: '' }

export default function Puntos() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

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

  async function guardar(e) {
    e.preventDefault()
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
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(punto) {
    if (!window.confirm(`¿Eliminar el punto "${punto.nombre}"?`)) return
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
          <form onSubmit={guardar} className="form">
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
                {editandoId == null ? 'Registrar' : 'Guardar cambios'}
              </button>
              {editandoId != null && (
                <button type="button" className="btn" onClick={limpiar}>
                  Cancelar
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
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => eliminar(punto)}
                        >
                          Eliminar
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
    </div>
  )
}
