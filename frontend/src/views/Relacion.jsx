import { useState } from 'react'
import { FiFileText, FiCheck, FiTrendingUp, FiTrendingDown, FiActivity } from 'react-icons/fi'
import { api, money } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import VistaPreviaPdf from '../components/VistaPreviaPdf.jsx'

/** Los 3 reportes: mismo endpoint, distinto tipo. */
const REPORTES = [
  {
    tipo: 'ingresos',
    titulo: 'Reporte ingreso',
    descripcion: 'Suma de los ingresos registrados ($ y Bs) agrupada por empresa.',
    Icono: FiTrendingUp,
  },
  {
    tipo: 'gastos',
    titulo: 'Reporte gastos',
    descripcion:
      'Gastos varios, impuestos, gasoil, combustible, pago a choferes, peajes y viáticos por tipo.',
    Icono: FiTrendingDown,
  },
  {
    tipo: 'general',
    titulo: 'Reporte general',
    descripcion: 'Ingresos totales menos egresos totales en el intervalo.',
    Icono: FiActivity,
  },
]

const ENCABEZADOS = {
  ingresos: 'Empresa',
  gastos: 'Concepto',
  general: 'Relación',
}

export default function Relacion() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState('')
  const [sinRegistros, setSinRegistros] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [pdfPrevia, setPdfPrevia] = useState('')

  async function generar(tipo) {
    setError('')
    setSinRegistros(false)
    if (!desde || !hasta) {
      setError('Indique la fecha de inicio y la fecha de fin.')
      return
    }
    if (hasta < desde) {
      setError('La fecha de fin no puede ser anterior a la de inicio.')
      return
    }

    setCargando(tipo)
    try {
      const params = new URLSearchParams({ desde, hasta })
      const datos = await api.get(`/relacion/${tipo}?${params.toString()}`)
      if (!datos.cantidad || datos.cantidad === 0) {
        setResultado(null)
        setSinRegistros(true)
        return
      }
      setResultado(datos)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando('')
    }
  }

  function descargarPdf() {
    if (!resultado) return
    const params = new URLSearchParams({ desde, hasta })
    setPdfPrevia(`/export/relacion/${resultado.tipo}?${params.toString()}`)
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Relación</h1>
          <p className="sub">Ingresos, gastos y relación general en PDF.</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="tarjeta ancho-medio">
        <h2>Rango de fechas</h2>
        <p className="ayuda">Ambas fechas son obligatorias para generar cualquier reporte.</p>
        <div className="campos-3">
          <label>
            Fecha inicio
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </label>
          <label>
            Fecha fin
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
              required
            />
          </label>
        </div>
      </section>

      <div className="relacion-tarjetas">
        {REPORTES.map(({ tipo, titulo, descripcion, Icono }) => (
          <section className="tarjeta" key={tipo}>
            <h2>
              <Icono aria-hidden="true" /> {titulo}
            </h2>
            <p className="ayuda">{descripcion}</p>
            <div className="acciones">
              <button
                type="button"
                className="btn primario"
                onClick={() => generar(tipo)}
                disabled={cargando === tipo}
              >
                <FiFileText aria-hidden="true" />
                {cargando === tipo ? 'Generando…' : 'Generar reporte'}
              </button>
            </div>
          </section>
        ))}
      </div>

      {resultado && (
        <section className="tarjeta ancho-completo">
          <h2>
            {REPORTES.find((r) => r.tipo === resultado.tipo)?.titulo} ·{' '}
            {ENCABEZADOS[resultado.tipo]}
          </h2>
          <p className="ayuda">
            Tasa usada: {money(resultado.tasa)} · Registros: {resultado.cantidad}
          </p>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{ENCABEZADOS[resultado.tipo]}</th>
                  <th className="derecha">Monto $</th>
                  <th className="derecha">Monto Bs</th>
                  <th className="derecha">Tasa</th>
                </tr>
              </thead>
              <tbody>
                {resultado.filas.map((f, i) => (
                  <tr key={`${f.etiqueta}-${i}`}>
                    <td>{f.etiqueta}</td>
                    <td className="derecha">{money(f.montoUsd)}</td>
                    <td className="derecha">{money(f.montoBs)}</td>
                    <td className="derecha">{money(resultado.tasa)}</td>
                  </tr>
                ))}
                {resultado.tipo !== 'general' && (
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="derecha">
                      <strong>{money(resultado.totalUsd)}</strong>
                    </td>
                    <td className="derecha">
                      <strong>{money(resultado.totalBs)}</strong>
                    </td>
                    <td className="derecha" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={descargarPdf}>
              <FiFileText aria-hidden="true" /> Descargar PDF
            </button>
          </div>
        </section>
      )}

      {sinRegistros && (
        <Modal titulo="Sin registros" onClose={() => setSinRegistros(false)}>
          <p>No hay registros para estas fechas.</p>
          <div className="acciones">
            <button type="button" className="btn primario" onClick={() => setSinRegistros(false)}>
              <FiCheck aria-hidden="true" /> Aceptar
            </button>
          </div>
        </Modal>
      )}

      {pdfPrevia && (
        <VistaPreviaPdf
          ruta={pdfPrevia}
          titulo="Vista previa · Reporte de relación"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </div>
  )
}
