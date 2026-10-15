import { Fragment, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Choferes from './views/Choferes.jsx'
import Vehiculos from './views/Vehiculos.jsx'
import Puntos from './views/Puntos.jsx'
import Empresas from './views/Empresas.jsx'
import CrearViaje from './views/CrearViaje.jsx'
import Viajes from './views/Viajes.jsx'
import Exportar from './views/Exportar.jsx'
import Tasa from './views/Tasa.jsx'
import Recorridos from './views/Recorridos.jsx'
import './App.css'

function App() {
  const [vista, setVista] = useState('choferes')
  const [tasaAbierta, setTasaAbierta] = useState(false)
  const [viajeEditando, setViajeEditando] = useState(null)
  // Cambia al terminar un pull de Turso: remonta la vista activa para que
  // vuelva a leer los datos del backend.
  const [recarga, setRecarga] = useState(0)

  function editarViaje(viaje) {
    setViajeEditando(viaje)
    setVista('crear')
  }

  function viajeListo() {
    setViajeEditando(null)
  }

  function navegar(id) {
    if (id !== 'crear') setViajeEditando(null)
    setVista(id)
  }

  return (
    <div className="app">
      <Sidebar
        vista={vista}
        onNavigate={navegar}
        onTasa={() => setTasaAbierta(true)}
        onPullCompletado={() => setRecarga((n) => n + 1)}
      />

      <main className="contenido">
        <header className="cabecera">
          <img className="cabecera-logo" src="/logo.svg" alt="Cabelum" />
        </header>

        <Fragment key={recarga}>
          {vista === 'choferes' && <Choferes />}
          {vista === 'vehiculos' && <Vehiculos />}
          {vista === 'puntos' && <Puntos />}
          {vista === 'empresas' && <Empresas />}
          {vista === 'crear' && (
            <CrearViaje key={viajeEditando?.id ?? 'nuevo'} viaje={viajeEditando} onGuardado={viajeListo} />
          )}
          {vista === 'viajes' && <Viajes onEditar={editarViaje} />}
          {vista === 'exportar' && <Exportar />}
          {vista === 'recorridos' && <Recorridos />}
        </Fragment>
      </main>

      {tasaAbierta && <Tasa onClose={() => setTasaAbierta(false)} />}
    </div>
  )
}

export default App
