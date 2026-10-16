import { useEffect, useState } from 'react'
import { FiFileText, FiSearch } from 'react-icons/fi'
import { api, fecha, money, urlDescarga } from '../api/client.js'
import Modal from '../components/Modal.jsx'

const red2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100

/** Agrupa por título y suma montos $ y Bs (mismo criterio que el PDF del backend). */
function agrupar(gastos) {
  const mapa = new Map()
  for (const g of gastos) {
    const nombre = (g.tituloGasto?.nombre ?? '').trim() || 'SIN TÍTULO'
    if (!mapa.has(nombre)) {
      mapa.set(nombre, { titulo: nombre, filas: [], sumaUsd: 0, sumaBs: 0 })
    }
    const b = mapa.get(nombre)
    b.filas.push(g)
    b.sumaUsd += Number(g.montoUsd) || 0
    b.sumaBs += Number(g.montoBs) || 0
  }
  const bloques = [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
  for (const b of bloques) {
    b.sumaUsd = red2(b.sumaUsd)
    b.sumaBs = red2(b.sumaBs)
    b.filas.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)))
  }
  return bloques
}

export default function ConsultarGastos() {
  const [titulos, setTitulos] = useState([])
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', tituloId: '' })
  const [vistaPrevia, setVistaPrevia] = useState(null) // { bloques, cantidad, totalUsd, totalBs }
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/titulos-gasto').then(setTitulos).catch((e) => setError(e.message))
  }, [])

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  async function consultar(e) {
    e.preventDefault()
    setError('')
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta".')
      return
    }
    const params = new URLSearchParams()
    if (filtros.desde) params.set('desde', filtros.desde)
    if (filtros.hasta) params.set('hasta', filtros.hasta)
    if (filtros.tituloId) params.set('tituloId', filtros.tituloId)
    try {
      const gastos = await api.get(`/gastos-varios?${params.toString()}`)
      const bloques = agrupar(gastos)
      setVistaPrevia({
        bloques,
        cantidad: gastos.length,
        totalUsd: red2(bloques.reduce((s, b) => s + b.sumaUsd, 0)),
        totalBs: red2(bloques.reduce((s, b) => s + b.sumaBs, 0)),
      })
    } catch (err) {
      setError(err.message)
    }
  }

  function exportarPdf() {
    const params = new URLSearchParams()
    if (filtros.desde) params.set('desde', filtros.desde)
    if (filtros.hasta) params.set('hasta', filtros.hasta)
    if (filtros.tituloId) params.set('tituloId', filtros.tituloId)
    window.location.href = urlDescarga(`/export/gastos-varios?${params.toString()}`)
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta">
          <h2>Filtros</h2>
          <form onSubmit={consultar} className="form">
            <div className="campos-3">
              <label>
                Desde
                <input
                  type="date"
                  value={filtros.desde}
                  onChange={(e) => cambiar('desde', e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filtros.hasta}
                  onChange={(e) => cambiar('hasta', e.target.value)}
                />
              </label>
              <label>
                Título
                <select
                  value={filtros.tituloId}
                  onChange={(e) => cambiar('tituloId', e.target.value)}
                >
                  <option value="">Todos</option>
                  {titulos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="acciones">
              <button type="submit" className="btn primario">
                <FiSearch aria-hidden="true" /> Consultar
              </button>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
        </section>
      </div>

      {vistaPrevia && (
        <Modal titulo="Vista previa de la consulta" onClose={() => setVistaPrevia(null)}>
          <p className="ayuda">
            {vistaPrevia.cantidad} registro{vistaPrevia.cantidad === 1 ? '' : 's'} ·{' '}
            {filtros.desde || filtros.hasta
              ? `${filtros.desde ? fecha(filtros.desde) : 'inicio'} al ${
                  filtros.hasta ? fecha(filtros.hasta) : 'hoy'
                }`
              : 'histórico general'}
            {filtros.tituloId
              ? ` · ${titulos.find((t) => String(t.id) === filtros.tituloId)?.nombre ?? ''}`
              : ''}
          </p>

          {vistaPrevia.bloques.length === 0 ? (
            <p className="vacio">Sin gastos en este intervalo.</p>
          ) : (
            <>
              {vistaPrevia.bloques.map((b) => (
                <div key={b.titulo}>
                  <h3 className="bloque-titulo">{b.titulo}</h3>
                  <div className="tabla-envoltura">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>N°</th>
                          <th>Motivo</th>
                          <th className="derecha">Monto $</th>
                          <th className="derecha">Monto Bs</th>
                          <th>N° REF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.filas.map((g) => (
                          <tr key={g.id}>
                            <td>{fecha(g.fecha)}</td>
                            <td>{g.numero}</td>
                            <td>{g.motivo}</td>
                            <td className="derecha">{money(g.montoUsd)}</td>
                            <td className="derecha">{money(g.montoBs)}</td>
                            <td>{g.referencia}</td>
                          </tr>
                        ))}
                        <tr className="suma">
                          <td colSpan={3}>SUBTOTAL {b.titulo.toLocaleUpperCase('es')}</td>
                          <td className="derecha">{money(b.sumaUsd)}</td>
                          <td className="derecha">{money(b.sumaBs)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <p className="resumen-total">
                <span>
                  TOTAL GENERAL $ {money(vistaPrevia.totalUsd)}
                </span>
                <span>Bs {money(vistaPrevia.totalBs)}</span>
              </p>
            </>
          )}

          <div className="acciones">
            <button type="button" className="btn primario" onClick={exportarPdf}>
              <FiFileText aria-hidden="true" /> Exportar a PDF
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setVistaPrevia(null)}
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
