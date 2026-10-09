import { useState } from 'react'
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
  const [recorridosAbiertos, setRecorridosAbiertos] = useState(false)
  const [viajeEditando, setViajeEditando] = useState(null)

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
        onRecorridos={() => setRecorridosAbiertos(true)}
      />

      <main className="contenido">
        <header className="cabecera">
          <img className="cabecera-logo" src="/logo.jpg" alt="Cabelum" />
          <small className="cabecera-sub">Gestión de rutas</small>
        </header>

        {vista === 'choferes' && <Choferes />}
        {vista === 'vehiculos' && <Vehiculos />}
        {vista === 'puntos' && <Puntos />}
        {vista === 'empresas' && <Empresas />}
        {vista === 'crear' && (
          <CrearViaje key={viajeEditando?.id ?? 'nuevo'} viaje={viajeEditando} onGuardado={viajeListo} />
        )}
        {vista === 'viajes' && <Viajes onEditar={editarViaje} />}
        {vista === 'exportar' && <Exportar />}
      </main>

      {tasaAbierta && <Tasa onClose={() => setTasaAbierta(false)} />}
      {recorridosAbiertos && <Recorridos onClose={() => setRecorridosAbiertos(false)} />}
    </div>
  )
}

export default App
