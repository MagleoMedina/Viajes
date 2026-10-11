import { useEffect, useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { api } from '../api/client.js'

export default function Recorridos() {
  const [lista, setLista] = useState([])
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar() {
    return api.get('/recorridos').then(setLista)
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  async function agregar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/recorridos', { nombre })
      setNombre('')
      await cargar()
      setAviso('Recorrido guardado.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar el recorrido "${r.nombre}"?`)) return
    setError('')
    setAviso('')
    try {
      await api.del(`/recorridos/${r.id}`)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Recorridos</h1>
          <p className="sub">Rutas recurrentes para reutilizar al registrar viajes.</p>
        </div>
        <span className="contador">{lista.length} registrados</span>
      </header>

      <div className="rejilla">
        <section className="tarjeta">
          <h2>Nuevo recorrido</h2>
          <form onSubmit={agregar} className="form">
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Cabelum - Ferrominera"
                required
              />
            </label>
            <div className="acciones">
              <button type="submit" className="btn primario" disabled={!nombre.trim()}>
                <FiPlus aria-hidden="true" /> Agregar
              </button>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
          {aviso && <p className="ok">{aviso}</p>}
        </section>

        <section className="tarjeta">
          <h2>Listado</h2>
          {lista.length === 0 ? (
            <p className="vacio">Todavía no hay recorridos guardados.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Recorrido</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td className="centro">
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => eliminar(r)}
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
    </div>
  )
}
