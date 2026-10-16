import { useState } from 'react'
import RegistrarGastos from './RegistrarGastos.jsx'
import ModificarGastos from './ModificarGastos.jsx'
import ConsultarGastos from './ConsultarGastos.jsx'

const PESTANAS = [
  { id: 'registrar', label: 'Registrar' },
  { id: 'modificar', label: 'Modificar' },
  { id: 'consultar', label: 'Consultar' },
]

/** Sección «Gastos varios»: las 3 vistas existentes bajo un mismo juego de pestañas. */
export default function GastosVarios() {
  const [pestana, setPestana] = useState('registrar')

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Gastos varios</h1>
          <p className="sub">
            Registre el título del gasto y luego cada gasto con su monto en $ y Bs.
          </p>
        </div>
      </header>

      <nav className="pestanas" aria-label="Acciones de gastos varios">
        {PESTANAS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={pestana === id ? 'activa' : ''}
            onClick={() => setPestana(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {pestana === 'registrar' && <RegistrarGastos />}
      {pestana === 'modificar' && <ModificarGastos />}
      {pestana === 'consultar' && <ConsultarGastos />}
    </div>
  )
}
