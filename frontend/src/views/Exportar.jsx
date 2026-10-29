import { useEffect, useState } from 'react'
import { FiFileText, FiFile, FiCheck } from 'react-icons/fi'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import VistaPreviaPdf from '../components/VistaPreviaPdf.jsx'
import ViajesPersonalizadosExport from './ViajesPersonalizadosExport.jsx'
import VehiculosPrivadosExport from './VehiculosPrivadosExport.jsx'

export default function Exportar() {
  const [empresas, setEmpresas] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [vehiculoId, setVehiculoId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [color, setColor] = useState('#26324a')
  const [error, setError] = useState('')
  const [sinViajes, setSinViajes] = useState(false)
  const [pdfPrevia, setPdfPrevia] = useState('')

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
    // El vehículo es opcional: vacío lista todos los viajes.
    api.get('/vehiculos').then(setVehiculos).catch(() => {})
  }, [])

  const params = new URLSearchParams()
  if (empresaId) params.set('empresaId', empresaId)
  if (vehiculoId) params.set('vehiculoId', vehiculoId)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const sufijo = params.toString() ? `?${params.toString()}` : ''

  async function descargar(tipo, extras = {}) {
    setError('')
    setSinViajes(false)
    try {
      const viajes = await api.get(`/viajes${sufijo}`)
      if (viajes.length === 0) {
        setSinViajes(true)
        return
      }
      // El color solo aplica a los PDF.
      const params2 = new URLSearchParams(params)
      if (extras.conMonto !== undefined) {
        params2.set('conMonto', extras.conMonto ? 'true' : 'false')
      }
      if (extras.sinChofer) {
        params2.set('sinChofer', 'true')
      }
      params2.set('color', color)
      setPdfPrevia(`/export/${tipo}?${params2.toString()}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista ancha">
      <header className="vista-cab">
        <div>
          <h1>Exportar</h1>
          <p className="sub">Descargue los viajes en PDF.</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="disposicion-exportar">
        <section className="tarjeta">
          <h2>Filtros</h2>
          <p className="ayuda">
            Todo vacío exporta el histórico completo. Empresa y vehículo son opcionales: sin elegir
            ninguno se listan todos los viajes.
          </p>
          <div className="campos-4">
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
              Vehículo
              <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
                <option value="">Todos los vehículos</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca || v.modelo ? `${v.marca ?? ''} ${v.modelo ?? ''}`.trim() : 'Vehículo'}
                    {v.placa ? ` (${v.placa})` : ''}
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
              <input
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
          </div>

          <label className="campo-color">
            Color del título de la empresa (PDF)
            <span className="control-color">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Color del nombre de la empresa en el PDF"
              />
              <code>{color}</code>
            </span>
          </label>

          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => descargar('pdf')}>
              <FiFileText aria-hidden="true" /> Exportar a PDF
            </button>
          </div>

          <h3 className="subtitulo-bloque">Reporte histórico (PDF)</h3>
          <p className="ayuda">
            Usa los mismos filtros de arriba. Escoja el formato: con la columna MONTO y el total,
            sin ella, o sin montos ni chofer.
          </p>
          <div className="acciones">
            <button
              type="button"
              className="btn primario"
              onClick={() => descargar('reporte', { conMonto: true })}
            >
              <FiFileText aria-hidden="true" /> Reporte con montos
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => descargar('reporte', { conMonto: false })}
            >
              <FiFile aria-hidden="true" /> Reporte sin montos
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => descargar('reporte', { conMonto: false, sinChofer: true })}
            >
              <FiFile aria-hidden="true" /> Reporte sin monto y sin chofer
            </button>
          </div>
        </section>

        <ViajesPersonalizadosExport />
        <VehiculosPrivadosExport />
      </div>

      {sinViajes && (
        <Modal titulo="Sin viajes" onClose={() => setSinViajes(false)}>
          <p>No hay viajes para estos filtros (empresa, vehículo e intervalo de fechas).</p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setSinViajes(false)}>
              <FiCheck aria-hidden="true" /> Aceptar
            </button>
          </div>
        </Modal>
      )}

      {pdfPrevia && (
        <VistaPreviaPdf
          ruta={pdfPrevia}
          titulo="Vista previa · Exportar viajes"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </div>
  )
}
