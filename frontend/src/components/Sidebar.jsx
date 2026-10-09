import { useState } from 'react'

const SUBMENU = [
  { id: 'choferes', label: 'Choferes' },
  { id: 'vehiculos', label: 'Vehículos' },
  { id: 'puntos', label: 'Puntos' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'crear', label: 'Crear viajes' },
  { id: 'viajes', label: 'Viajes' },
  { id: 'exportar', label: 'Exportar' },
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
          <span>Viajes</span>
          <span className="flecha">{abierto ? '▾' : '▸'}</span>
        </button>

        {abierto && (
          <ul className="submenu">
            {SUBMENU.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nav-hijo${vista === item.id ? ' activo' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="nav-tasa" onClick={onTasa}>
          <span>Tasa</span>
          <span className="etiqueta">manual</span>
        </button>
      </nav>

      <footer className="sidebar-pie">Cabelum · {new Date().getFullYear()}</footer>
    </aside>
  )
}
