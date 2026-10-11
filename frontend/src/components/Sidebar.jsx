import { useState } from 'react'
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
} from 'react-icons/fi'

const SUBMENU = [
  { id: 'choferes', label: 'Choferes', Icono: FiUsers },
  { id: 'vehiculos', label: 'Vehículos', Icono: FiTruck },
  { id: 'puntos', label: 'Puntos', Icono: FiMapPin },
  { id: 'empresas', label: 'Empresas', Icono: FiBriefcase },
  { id: 'crear', label: 'Crear viajes', Icono: FiPlusCircle },
  { id: 'viajes', label: 'Viajes', Icono: FiList },
  { id: 'exportar', label: 'Exportar', Icono: FiDownload },
  { id: 'recorridos', label: 'Recorridos', Icono: FiNavigation },
]

export default function Sidebar({ vista, onNavigate, onTasa }) {
  const [abierto, setAbierto] = useState(true)

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
      </nav>

      <footer className="sidebar-pie">SpeedGroup · {new Date().getFullYear()}</footer>
    </aside>
  )
}
