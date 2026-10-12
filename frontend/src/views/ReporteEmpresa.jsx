import { useEffect, useState } from 'react'
import { FiFileText } from 'react-icons/fi'
import { api, urlDescarga } from '../api/client.js'

export default function ReporteEmpresa() {
  const [empresas, setEmpresas] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  function descargar() {
    setError('')
    const params = new URLSearchParams({ empresaId })
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    window.location.href = urlDescarga(`/export/reporte?${params.toString()}`)
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Reporte por empresa</h1>
          <p className="sub">Genere el reporte de viajes de una empresa en PDF.</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="tarjeta ancho-medio">
        <h2>Datos del reporte</h2>
        <p className="ayuda">Sin fechas se usa el histórico general.</p>
        <div className="campos-3">
          <label>
            Empresa
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">Seleccione una empresa</option>
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
          <button type="button" className="btn primario" onClick={descargar} disabled={!empresaId}>
            <FiFileText aria-hidden="true" /> Generar reporte PDF
          </button>
        </div>
      </section>
    </div>
  )
}
