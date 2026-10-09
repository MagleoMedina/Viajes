import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'

export default function Tasa({ onClose }) {
  const [actual, setActual] = useState(null)
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api
      .get('/tasa')
      .then((t) => {
        if (t?.valor != null) {
          setActual(t)
          setValor(String(t.valor))
        }
      })
      .catch((e) => setError(e.message))
  }, [])

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      const guardada = await api.put('/tasa', { valor: Number(valor) })
      setActual(guardada)
      setAviso('Tasa actualizada.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal titulo="Tasa del día" onClose={onClose}>
      <form onSubmit={guardar} className="form">
        <p className="ayuda">
          {actual
            ? `Tasa vigente: ${Number(actual.valor).toLocaleString('es-VE')} (registrada ${actual.fecha ?? ''})`
            : 'Todavía no se ha registrado ninguna tasa.'}
        </p>
        <label>
          Nueva tasa
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            required
            autoFocus
          />
        </label>
        <div className="acciones">
          <button type="submit" className="btn primario">
            Actualizar tasa
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}
      </form>
    </Modal>
  )
}
