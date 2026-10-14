import { useEffect, useState } from 'react'
import {
  FiUsers,
  FiTruck,
  FiMapPin,
  FiBriefcase,
  FiPlusCircle,
  FiList,
  FiDownload,
  FiNavigation,
  FiDollarSign,
  FiFileText,
  FiChevronDown,
  FiChevronRight,
  FiRefreshCw,
} from 'react-icons/fi'
import { api } from '../api/client.js'

const SUBMENU = [
  { id: 'choferes', label: 'Choferes', Icono: FiUsers },
  { id: 'vehiculos', label: 'Vehículos', Icono: FiTruck },
  { id: 'puntos', label: 'Puntos', Icono: FiMapPin },
  { id: 'empresas', label: 'Empresas', Icono: FiBriefcase },
  { id: 'crear', label: 'Crear viajes', Icono: FiPlusCircle },
  { id: 'viajes', label: 'Viajes', Icono: FiList },
  { id: 'exportar', label: 'Reporte detallado', Icono: FiDownload },
  { id: 'reporte', label: 'Reporte general', Icono: FiFileText },
  { id: 'recorridos', label: 'Recorridos', Icono: FiNavigation },
]

/** "2026-10-13T15:04:00.000Z" -> "13/10/2026 11:04" (hora local). */
function fechaLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Sidebar({ vista, onNavigate, onTasa }) {
  const [abierto, setAbierto] = useState(true)
  const [sync, setSync] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [errorSync, setErrorSync] = useState('')

  function cargarEstado() {
    api.get('/sync').then(setSync).catch((e) => setErrorSync(e.message))
  }

  useEffect(cargarEstado, [])

  async function sincronizarAhora() {
    setSincronizando(true)
    setErrorSync('')
    try {
      const nuevo = await api.post('/sync')
      setSync(nuevo)
    } catch (e) {
      setErrorSync(e.message)
    } finally {
      setSincronizando(false)
    }
  }

  async function manejarPullTurso() {
    const pwd = prompt('Clave de seguridad para extraer datos de Turso:')
    if (pwd === null) return
    if (pwd !== '30696510') {
      setErrorSync('Clave incorrecta')
      return
    }
    setErrorSync('')
    setSincronizando(true)
    try {
      const res = await api.post('/sync/pull', { password: pwd })
      if (res.exito) {
        setSync({
          fecha: new Date().toISOString(),
          exito: true,
          mensaje: res.mensaje,
        })
      } else {
        setErrorSync(res.mensaje)
      }
    } catch (e) {
      setErrorSync('Error al conectar con el backend')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <aside className="sidebar">
      <nav className="nav">
        <button
          type="button"
          className="nav-padre"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
        >
          <span className="nav-padre-eti">
            <FiTruck aria-hidden="true" />
            <span>Viajes</span>
          </span>
          {abierto ? (
            <FiChevronDown className="flecha" aria-hidden="true" />
          ) : (
            <FiChevronRight className="flecha" aria-hidden="true" />
          )}
        </button>

        {abierto && (
          <ul className="submenu">
            {SUBMENU.map(({ id, label, Icono }) => (
              <li key={id}>
                <button
                  type="button"
                  className={`nav-hijo${vista === id ? ' activo' : ''}`}
                  onClick={() => onNavigate(id)}
                >
                  <Icono aria-hidden="true" />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="nav-tasa" onClick={onTasa}>
          <span className="nav-padre-eti">
            <FiDollarSign aria-hidden="true" />
            <span>Tasa</span>
          </span>
          <span className="etiqueta">manual</span>
        </button>

        <section className="sidebar-sync" aria-live="polite">
          <p className="etiqueta">Turso</p>
          {sync?.fecha ? (
            <p className={`estado-sync${sync.exito ? '' : ' fallo'}`}>
              {sync.exito ? 'Sincronizado' : 'Último intento falló'}:{' '}
              {fechaLocal(sync.fecha)}
            </p>
          ) : (
            <p className="estado-sync">Sin sincronizar aún</p>
          )}
          {errorSync && <p className="estado-sync fallo">{errorSync}</p>}
          <button
            type="button"
            className="nav-tasa btn-sync"
            onClick={sincronizarAhora}
            disabled={sincronizando}
          >
            <span className="nav-padre-eti">
              <FiRefreshCw className={sincronizando ? 'girando' : ''} aria-hidden="true" />
              <span>{sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}</span>
            </span>
          </button>
          <button
            type="button"
            className="nav-tasa btn-sync pull-btn"
            onClick={manejarPullTurso}
            disabled={sincronizando}
          >
            <span className="nav-padre-eti">
              <FiDownload className={sincronizando ? 'girando' : ''} aria-hidden="true" />
              <span>{sincronizando ? 'Extrayendo…' : 'Pull Turso'}</span>
            </span>
          </button>
        </section>
      </nav>

      <footer className="sidebar-pie">SpeedGroup · {new Date().getFullYear()}</footer>
    </aside>
  )
}
