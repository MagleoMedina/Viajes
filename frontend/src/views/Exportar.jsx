import { useEffect, useState } from 'react'
import { api, urlDescarga } from '../api/client.js'
import Modal from '../components/Modal.jsx'

export default function Exportar() {
  const [empresas, setEmpresas] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [sinViajes, setSinViajes] = useState(false)

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  const params = new URLSearchParams()
  if (empresaId) params.set('empresaId', empresaId)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const sufijo = params.toString() ? `?${params.toString()}` : ''

  async function descargar(tipo) {
    setError('')
    setSinViajes(false)
    try {
      const viajes = await api.get(`/viajes${sufijo}`)
      if (viajes.length === 0) {
        setSinViajes(true)
        return
      }
      window.location.href = urlDescarga(`/export/${tipo}${sufijo}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Exportar</h1>
          <p className="sub">Descargue los viajes en Excel o en PDF.</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="tarjeta ancho-medio">
        <h2>Filtros</h2>
        <p className="ayuda">Todo vacío exporta el histórico completo.</p>
        <div className="campos-3">
          <label>
            Empresa
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">Todas las empresas</option>
              {empresas.map((em) => (
                <option key={em.id} value={em.id}>
                  {em.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>

        <div className="acciones">
          <button type="button" className="btn primario" onClick={() => descargar('xlsx')}>
            Exportar a Excel
          </button>
          <button type="button" className="btn" onClick={() => descargar('pdf')}>
            Exportar a PDF
          </button>
        </div>
      </section>

      {sinViajes && (
        <Modal titulo="Sin viajes" onClose={() => setSinViajes(false)}>
          <p>No hay viajes para esta empresa en este intervalo de fechas.</p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setSinViajes(false)}>
              Aceptar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
