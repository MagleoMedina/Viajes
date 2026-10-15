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
  FiChevronDown,
  FiChevronRight,
  FiRefreshCw,
  FiMenu,
} from 'react-icons/fi'
import { api } from '../api/client.js'
import Modal from './Modal.jsx'

const SUBMENU = [
  { id: 'choferes', label: 'Choferes', Icono: FiUsers },
  { id: 'vehiculos', label: 'Vehículos', Icono: FiTruck },
  { id: 'puntos', label: 'Puntos', Icono: FiMapPin },
  { id: 'empresas', label: 'Empresas', Icono: FiBriefcase },
  { id: 'crear', label: 'Crear viajes', Icono: FiPlusCircle },
  { id: 'viajes', label: 'Viajes', Icono: FiList },
  { id: 'exportar', label: 'Reporte detallado', Icono: FiDownload },
  { id: 'recorridos', label: 'Recorridos', Icono: FiNavigation },
]

/** "2026-10-13T15:04:00.000Z" -> "13/10/2026 11:04" (hora local). */
function fechaLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Sidebar({ vista, onNavigate, onTasa, onPullCompletado }) {
  const [abierto, setAbierto] = useState(true)
  const [colapsado, setColapsado] = useState(() => {
    try {
      return localStorage.getItem('sidebar-colapsado') === '1'
    } catch {
      return false
    }
  })
  const [sync, setSync] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [errorSync, setErrorSync] = useState('')
  const [claveAbierta, setClaveAbierta] = useState(false)
  const [clave, setClave] = useState('')
  const [errorClave, setErrorClave] = useState('')
  const [servidor, setServidor] = useState(null)
  const [copiada, setCopiada] = useState(false)

  function alternarColapsado() {
    setColapsado((c) => {
      const nuevo = !c
      try {
        localStorage.setItem('sidebar-colapsado', nuevo ? '1' : '0')
      } catch {
        /* sin almacenamiento disponible */
      }
      return nuevo
    })
  }

  function cargarEstado() {
    api.get('/sync').then(setSync).catch((e) => setErrorSync(e.message))
  }

  useEffect(cargarEstado, [])

  // IP + puerto del backend (para entrar desde otro equipo al servidor).
  useEffect(() => {
    api.get('/sistema').then(setServidor).catch(() => setServidor(null))
  }, [])

  const dirServidor = servidor ? `${servidor.ip}:${servidor.puerto}` : ''

  function copiarDireccion() {
    if (!dirServidor) return
    navigator.clipboard
      ?.writeText(dirServidor)
      .then(() => {
        setCopiada(true)
        setTimeout(() => setCopiada(false), 1500)
      })
      .catch(() => {})
  }

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

  function abrirClave() {
    setClave('')
    setErrorClave('')
    setClaveAbierta(true)
  }

  function cerrarClave() {
    setClaveAbierta(false)
    setClave('')
    setErrorClave('')
  }

  async function manejarPullTurso(e) {
    e.preventDefault()
    if (clave !== '30696510') {
      setErrorClave('Clave incorrecta')
      return
    }
    cerrarClave()
    setErrorSync('')
    setSincronizando(true)
    try {
      const res = await api.post('/sync/pull', { password: clave })
      if (res.exito) {
        setSync({
          fecha: new Date().toISOString(),
          exito: true,
          mensaje: res.mensaje,
        })
        onPullCompletado?.()
      } else {
        setErrorSync(res.mensaje)
      }
    } catch {
      setErrorSync('Error al conectar con el backend')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <aside className={`sidebar${colapsado ? ' colapsado' : ''}`}>
      <div className="sidebar-topbar">
        <button
          type="button"
          className="hamburguesa"
          onClick={alternarColapsado}
          aria-label={colapsado ? 'Expandir menú' : 'Retraer menú'}
          title={colapsado ? 'Expandir menú' : 'Retraer menú'}
          aria-expanded={!colapsado}
        >
          <FiMenu aria-hidden="true" />
        </button>
        <span className="txt">Menú</span>
      </div>

      <nav className="nav">
        <button
          type="button"
          className="nav-padre"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          title="Viajes"
        >
          <span className="nav-padre-eti">
            <FiTruck aria-hidden="true" />
            <span className="txt">Viajes</span>
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
                  title={label}
                >
                  <Icono aria-hidden="true" />
                  <span className="txt">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="nav-tasa" onClick={onTasa} title="Tasa">
          <span className="nav-padre-eti">
            <FiDollarSign aria-hidden="true" />
            <span className="txt">Tasa</span>
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
            title="Sincronizar ahora"
          >
            <span className="nav-padre-eti">
              <FiRefreshCw className={sincronizando ? 'girando' : ''} aria-hidden="true" />
              <span className="txt">{sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}</span>
            </span>
          </button>
          <button
            type="button"
            className="nav-tasa btn-sync pull-btn"
            onClick={abrirClave}
            disabled={sincronizando}
            title="Pull Turso"
          >
            <span className="nav-padre-eti">
              <FiDownload className={sincronizando ? 'girando' : ''} aria-hidden="true" />
              <span className="txt">{sincronizando ? 'Extrayendo…' : 'Pull Turso'}</span>
            </span>
          </button>
        </section>
      </nav>

      <footer className="sidebar-pie">
        <span>SpeedGroup · {new Date().getFullYear()}</span>
        {dirServidor && (
          <button
            type="button"
            className="dir-servidor"
            onClick={copiarDireccion}
            title="Copiar la dirección del servidor"
          >
            {copiada ? 'Dirección copiada' : dirServidor}
          </button>
        )}
      </footer>

      {claveAbierta && (
        <Modal titulo="Clave de seguridad" onClose={cerrarClave}>
          <form className="form" onSubmit={manejarPullTurso}>
            <p className="ayuda">Clave para extraer los datos de Turso.</p>
            <label>
              Clave
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                autoFocus
                required
              />
            </label>
            {errorClave && <p className="error">{errorClave}</p>}
            <div className="acciones">
              <button type="submit" className="btn primario">
                <FiDownload aria-hidden="true" /> Extraer datos
              </button>
              <button type="button" className="btn" onClick={cerrarClave}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  )
}
