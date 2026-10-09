import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'

export default function Recorridos({ onClose }) {
  const [lista, setLista] = useState([])
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api.get('/recorridos').then(setLista).catch((e) => setError(e.message))
  }, [])

  async function agregar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/recorridos', { nombre })
      setNombre('')
      setLista(await api.get('/recorridos'))
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
      setLista(await api.get('/recorridos'))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal titulo="Recorridos" onClose={onClose}>
      <form onSubmit={agregar} className="form">
        <label>
          Nuevo recorrido
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Cabelum - Ferrominera"
            autoFocus
          />
        </label>
        <div className="acciones">
          <button type="submit" className="btn primario" disabled={!nombre.trim()}>
            Agregar
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}
      </form>

      {lista.length === 0 ? (
        <p className="ayuda">Todavía no hay recorridos guardados.</p>
      ) : (
        <ul className="lista-recorridos">
          {lista.map((r) => (
            <li key={r.id}>
              <span>{r.nombre}</span>
              <button type="button" className="btn peligro" onClick={() => eliminar(r)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
