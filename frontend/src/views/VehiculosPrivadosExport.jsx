import { useEffect, useState } from 'react'
import { FiFileText, FiFile, FiCheck } from 'react-icons/fi'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import VistaPreviaPdf from '../components/VistaPreviaPdf.jsx'

/**
 * Reportes de vehículos privados: se filtran por los vehículos cuya MARCA
 * contiene «PRIVADO». La lista se consulta en cada exportación para incluir
 * los vehículos recién registrados.
 */
export default function VehiculosPrivadosExport() {
  const [empresas, setEmpresas] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [color, setColor] = useState('#26324a')
  const [error, setError] = useState('')
  const [sinVehiculos, setSinVehiculos] = useState(false)
  const [pdfPrevia, setPdfPrevia] = useState('')

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  async function descargar(extras = {}) {
    setError('')
    setSinVehiculos(false)
    try {
      // Siempre se consulta la lista: así entran los vehículos nuevos.
      const vehiculos = await api.get('/vehiculos')
      const privados = vehiculos.filter((v) =>
        String(v.marca ?? '').toUpperCase().includes('PRIVADO'),
      )
      if (privados.length === 0) {
        setSinVehiculos(true)
        return
      }
      const params = new URLSearchParams()
      if (empresaId) params.set('empresaId', empresaId)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      if (extras.conMonto !== undefined) {
        params.set('conMonto', extras.conMonto ? 'true' : 'false')
      }
      if (extras.sinChofer) {
        params.set('sinChofer', 'true')
      }
      params.set('color', color)
      setPdfPrevia(`/export/privados/reporte?${params.toString()}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <p className="error">{error}</p>}

      <section className="tarjeta">
        <h2>Vehículos privados</h2>
        <p className="ayuda">
          Incluye los viajes de vehículos cuya marca contiene «PRIVADO». Los filtros son
          opcionales.
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
          <button
            type="button"
            className="btn primario"
            onClick={() => descargar({ conMonto: true })}
          >
            <FiFileText aria-hidden="true" /> Reporte con montos
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => descargar({ conMonto: false })}
          >
            <FiFile aria-hidden="true" /> Reporte sin montos
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => descargar({ conMonto: false, sinChofer: true })}
          >
            <FiFile aria-hidden="true" /> Reporte sin monto y sin chofer
          </button>
        </div>
      </section>

      {sinVehiculos && (
        <Modal titulo="Sin vehículos privados" onClose={() => setSinVehiculos(false)}>
          <p>
            No hay vehículos cuya marca contenga «PRIVADO». Regístrelos en el módulo Vehículos.
          </p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setSinVehiculos(false)}>
              <FiCheck aria-hidden="true" /> Aceptar
            </button>
          </div>
        </Modal>
      )}

      {pdfPrevia && (
        <VistaPreviaPdf
          ruta={pdfPrevia}
          titulo="Vista previa · Vehículos privados"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </>
  )
}
