import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'

export default function Tasa({ onClose }) {
  const [actual, setActual] = useState(null)
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const [modalOk, setModalOk] = useState(false)

  useEffect(() => {
    cargarActual().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarActual() {
    const t = await api.get('/tasa')
    if (t?.valor != null) {
      setActual(t)
      setValor(String(t.valor))
    }
  }

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

  async function refrescar() {
    setError('')
    setAviso('')
    setRefrescando(true)
    try {
      const tasa = await api.post('/tasa/refrescar')
      setActual(tasa)
      setValor(String(tasa.valor))
      setModalOk(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefrescando(false)
    }
  }

  return (
    <>
      <Modal titulo="Tasa del día" onClose={onClose}>
        <form onSubmit={guardar} className="form">
          <p className="ayuda">
            {actual
              ? `Tasa vigente: ${Number(actual.valor).toLocaleString('es-VE')} (registrada ${actual.fecha ?? ''}${actual.origen ? ` · ${actual.origen}` : ''})`
              : 'Todavía no se ha registrado ninguna tasa.'}
          </p>
          <p className="ayuda">
            Se actualiza sola a las 9:05 y a las 13:05 de cada día con GoCambio (BCV).
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
            <button type="button" className="btn" onClick={refrescar} disabled={refrescando}>
              {refrescando ? 'Refrescando…' : 'Refrescar ahora'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {aviso && <p className="ok">{aviso}</p>}
        </form>
      </Modal>

      {modalOk && (
        <Modal titulo="Tasa actualizada" onClose={() => setModalOk(false)}>
          <p className="ok">
            Tasa actualizada: Bs {Number(actual?.valor ?? 0).toLocaleString('es-VE')} por dólar.
          </p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setModalOk(false)}>
              Aceptar
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
