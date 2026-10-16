import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { red2 } from '../api/gastos.js'

/**
 * Ventanita de stock de gasoil por vehículo: litros comprados menos litros
 * usados en viajes. Se recalcula al montar, al cambiar `tick` (tras un
 * alta/edición/borrado) y al recuperar el foco de la ventana.
 */
export default function StockGasoilPanel({ tick = 0 }) {
  const [lista, setLista] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  function cargar() {
    setCargando(true)
    return api
      .get('/gastos-gasoil/stock')
      .then((s) => {
        setLista(Array.isArray(s) ? s : [])
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    const alFocar = () => {
      if (document.visibilityState === 'visible') cargar()
    }
    window.addEventListener('focus', alFocar)
    document.addEventListener('visibilitychange', alFocar)
    return () => {
      window.removeEventListener('focus', alFocar)
      document.removeEventListener('visibilitychange', alFocar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  return (
    <section className="tarjeta ancho-completo stock-gasoil-panel">
      <h2>Gasoil disponible</h2>
      <p className="ayuda">
        Litros comprados menos litros usados en viajes, por vehículo. Se actualiza al registrar
        gasoil o viajes.
      </p>
      {error && (
        <p className="error">
          {error}{' '}
          <button type="button" className="btn pequeno" onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}
      {cargando && !lista ? (
        <p className="vacio">Cargando stock…</p>
      ) : !lista || lista.length === 0 ? (
        <p className="vacio">
          {error ? 'Sin datos de stock.' : 'Registre vehículos para ver su stock de gasoil.'}
        </p>
      ) : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th className="derecha">Comprado</th>
                <th className="derecha">Usado en viajes</th>
                <th className="derecha">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.vehiculoId}>
                  <td>{s.placa}</td>
                  <td className="derecha">{red2(s.comprado)} L</td>
                  <td className="derecha">{red2(s.usado)} L</td>
                  <td className="derecha stock-disponible">{red2(Math.max(0, s.disponible))} L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
