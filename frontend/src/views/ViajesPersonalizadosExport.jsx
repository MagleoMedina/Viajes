import { useEffect, useState } from 'react'
import { FiFileText, FiFile, FiCheck } from 'react-icons/fi'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import VistaPreviaPdf from '../components/VistaPreviaPdf.jsx'

/**
 * PDF de viajes personalizados: uno por título (obligatorio). El título es el
 * H1 del documento y no se muestra la columna VIATICOS.
 */
export default function ViajesPersonalizadosExport() {
  const [titulos, setTitulos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [tituloViajeId, setTituloViajeId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [vehiculoId, setVehiculoId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [color, setColor] = useState('#26324a')
  const [error, setError] = useState('')
  const [sinViajes, setSinViajes] = useState(false)
  const [faltaTitulo, setFaltaTitulo] = useState(false)
  const [pdfPrevia, setPdfPrevia] = useState('')

  useEffect(() => {
    api.get('/titulos-viaje').then(setTitulos).catch((e) => setError(e.message))
    api.get('/empresas').then(setEmpresas).catch(() => {})
    api.get('/vehiculos').then(setVehiculos).catch(() => {})
  }, [])

  async function descargar(tipo, extras = {}) {
    setError('')
    setSinViajes(false)
    if (!tituloViajeId) {
      setFaltaTitulo(true)
      return
    }
    try {
      const params = new URLSearchParams({ tituloViajeId })
      if (empresaId) params.set('empresaId', empresaId)
      if (vehiculoId) params.set('vehiculoId', vehiculoId)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const viajes = await api.get(`/viajes?${params.toString()}`)
      if (viajes.length === 0) {
        setSinViajes(true)
        return
      }
      if (extras.conMonto !== undefined) {
        params.set('conMonto', extras.conMonto ? 'true' : 'false')
      }
      if (extras.sinChofer) {
        params.set('sinChofer', 'true')
      }
      params.set('color', color)
      setPdfPrevia(`/export/personalizados/${tipo}?${params.toString()}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <p className="error">{error}</p>}

      <section className="tarjeta">
        <h2>Viajes personalizados</h2>
        <p className="ayuda">
          Elija un título: se exporta un PDF por título, con el título como encabezado y sin la
          columna de viáticos. Los filtros son opcionales.
        </p>
        <div className="campos-4">
          <label>
            Título
            <select
              value={tituloViajeId}
              onChange={(e) => setTituloViajeId(e.target.value)}
              required
            >
              <option value="">Seleccione...</option>
              {titulos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
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
          Color del título (PDF)
          <span className="control-color">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Color del título del PDF"
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
          Usa los mismos filtros de arriba. Escoja el formato: con la columna MONTO, sin ella, o
          sin montos ni chofer.
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

      {faltaTitulo && (
        <Modal titulo="Falta el título" onClose={() => setFaltaTitulo(false)}>
          <p>Seleccione un título de viaje personalizado antes de exportar.</p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setFaltaTitulo(false)}>
              <FiCheck aria-hidden="true" /> Aceptar
            </button>
          </div>
        </Modal>
      )}

      {sinViajes && (
        <Modal titulo="Sin viajes" onClose={() => setSinViajes(false)}>
          <p>No hay viajes personalizados con este título y estos filtros.</p>
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
          titulo="Vista previa · Viajes personalizados"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </>
  )
}
