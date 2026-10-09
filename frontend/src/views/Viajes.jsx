import { useEffect, useState } from 'react'
import { api, money } from '../api/client.js'

export default function Viajes({ onEditar }) {
  const [lista, setLista] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [empresaId, setEmpresaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar() {
    const params = new URLSearchParams()
    if (empresaId) params.set('empresaId', empresaId)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const sufijo = params.toString() ? `?${params.toString()}` : ''
    return api.get(`/viajes${sufijo}`).then(setLista)
  }

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, desde, hasta])

  async function eliminar(viaje) {
    if (!window.confirm(`¿Eliminar el viaje del ${viaje.fechaInicio} al chofer ${viaje.chofer.nombre}?`))
      return
    setError('')
    setAviso('')
    try {
      await api.del(`/viajes/${viaje.id}`)
      setAviso('Viaje eliminado.')
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const totalBs = lista.reduce((suma, v) => suma + (Number(v.totalBs) || 0), 0)
  const totalUsd = lista.reduce((suma, v) => suma + (Number(v.totalUsd) || 0), 0)

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Viajes</h1>
          <p className="sub">Viajes registrados, ordenados del más reciente al más antiguo.</p>
        </div>
        <div className="totales">
          <span className="contador">{lista.length} viajes</span>
          <span className="contador acento">{money(totalBs)} Bs</span>
          <span className="contador acento">$ {money(totalUsd)}</span>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {aviso && <p className="ok">{aviso}</p>}

      <section className="tarjeta">
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
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEmpresaId('')
              setDesde('')
              setHasta('')
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {lista.length === 0 ? (
        <p className="vacio">
          Sin viajes que mostrar. Ajuste los filtros o vaya a <strong>Crear viajes</strong>.
        </p>
      ) : (
        <section className="tarjeta">
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Empresa</th>
                  <th>Chofer</th>
                  <th>Carga</th>
                  <th>Salida</th>
                  <th>Llegada</th>
                  <th className="derecha">Total BS</th>
                  <th className="derecha">Tasa</th>
                  <th className="derecha">Total $</th>
                  <th className="centro">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((viaje) => (
                  <tr key={viaje.id}>
                    <td>{viaje.fechaInicio}</td>
                    <td>{viaje.fechaFin}</td>
                    <td>{viaje.empresa?.nombre || 'Sin empresa'}</td>
                    <td>
                      {viaje.chofer.nombre} {viaje.chofer.apellido}
                    </td>
                    <td>{viaje.carga}</td>
                    <td>{viaje.puntoSalida?.nombre || '—'}</td>
                    <td>{viaje.puntoLlegada?.nombre || '—'}</td>
                    <td className="derecha">{money(viaje.totalBs)}</td>
                    <td className="derecha">{money(viaje.tasa)}</td>
                    <td className="derecha">{money(viaje.totalUsd)}</td>
                    <td className="centro">
                      <button type="button" className="btn pequeno" onClick={() => onEditar(viaje)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn pequeno peligro"
                        onClick={() => eliminar(viaje)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
