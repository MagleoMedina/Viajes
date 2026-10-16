import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { red2 } from '../api/gastos.js'

/**
 * Ventanita de gasoil: stock GLOBAL (todos los vehículos), litros comprados
 * menos litros usados en viajes. Se recalcula al montar, al cambiar `tick`
 * (tras un alta/edición/borrado) y al recuperar el foco de la ventana.
 */
export default function StockGasoilPanel({ tick = 0 }) {
  const [stock, setStock] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  function cargar() {
    setCargando(true)
    return api
      .get('/gastos-gasoil/stock')
      .then((s) => {
        setStock(s)
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
      <h2>Gasoil disponible (total)</h2>
      <p className="ayuda">
        Litros comprados menos litros usados en viajes, sumando todos los vehículos. Se actualiza
        al registrar gasoil o viajes.
      </p>
      {error && (
        <p className="error">
          {error}{' '}
          <button type="button" className="btn pequeno" onClick={cargar}>
            Reintentar
          </button>
        </p>
      )}
      {cargando && !stock ? (
        <p className="vacio">Cargando stock…</p>
      ) : stock ? (
        <div className="stock-gasoil-cifras">
          <div className="stock-cifra principal">
            <span className="etiqueta">Disponible</span>
            <strong>{red2(Math.max(0, stock.disponible))} L</strong>
          </div>
          <div className="stock-cifra">
            <span className="etiqueta">Comprado</span>
            <strong>{red2(stock.comprado)} L</strong>
          </div>
          <div className="stock-cifra">
            <span className="etiqueta">Usado en viajes</span>
            <strong>{red2(stock.usado)} L</strong>
          </div>
        </div>
      ) : (
        <p className="vacio">Sin datos de stock.</p>
      )}
    </section>
  )
}
