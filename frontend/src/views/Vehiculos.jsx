import { useEffect, useState } from 'react'
import { FiPlus, FiSave, FiEdit2, FiTrash2, FiX } from 'react-icons/fi'
import { api } from '../api/client.js'
import Confirmar from '../components/Confirmar.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'

const VACIO = { marca: '', modelo: '', tipo: '', placa: '' }

export default function Vehiculos() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [formRef, enfocarFormulario] = useFocoFormulario()

  function cargar() {
    return api.get('/vehiculos').then(setLista)
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(vehiculo) {
    setEditandoId(vehiculo.id)
    setForm({
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      tipo: vehiculo.tipo,
      placa: vehiculo.placa,
    })
    setError('')
    setAviso('')
  }

  function limpiar() {
    setEditandoId(null)
    setForm(VACIO)
    setError('')
  }

  function enviar(e) {
    e.preventDefault()
    setConfirmarGuardado(true)
  }

  async function guardar() {
    setConfirmarGuardado(false)
    setError('')
    setAviso('')
    try {
      if (editandoId == null) {
        await api.post('/vehiculos', form)
        setAviso('Vehículo registrado.')
      } else {
        await api.put(`/vehiculos/${editandoId}`, form)
        setAviso('Vehículo actualizado.')
      }
      limpiar()
      await cargar()
      enfocarFormulario()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar() {
    const vehiculo = porEliminar
    setPorEliminar(null)
    if (!vehiculo) return
    setError('')
    setAviso('')
    try {
      await api.del(`/vehiculos/${vehiculo.id}`)
      setAviso('Vehículo eliminado.')
      if (editandoId === vehiculo.id) limpiar()
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Vehículos</h1>
          <p className="sub">Marca, modelo, tipo y placa de cada unidad.</p>
        </div>
        <span className="contador">{lista.length} registrados</span>
      </header>

      <div className="rejilla">
        <section className="tarjeta">
          <h2>{editandoId == null ? 'Nuevo vehículo' : 'Editar vehículo'}</h2>
          <form ref={formRef} onSubmit={enviar} className="form">
            <label>
              Marca
              <input type="text" value={form.marca} onChange={(e) => set('marca', e.target.value)} required />
            </label>
            <label>
              Modelo
              <input type="text" value={form.modelo} onChange={(e) => set('modelo', e.target.value)} required />
            </label>
            <label>
              Tipo
              <input
                type="text"
                value={form.tipo}
                onChange={(e) => set('tipo', e.target.value)}
                placeholder="Camión, Furgón, Gándola..."
                required
              />
            </label>
            <label>
              Placa
              <input
                type="text"
                value={form.placa}
                onChange={(e) => set('placa', e.target.value)}
                placeholder="AB-123"
                required
              />
            </label>

            <div className="acciones">
              <button type="submit" className="btn primario">
                {editandoId == null ? (
                  <FiPlus aria-hidden="true" />
                ) : (
                  <FiSave aria-hidden="true" />
                )}
                {editandoId == null ? 'Registrar' : 'Guardar cambios'}
              </button>
              {editandoId != null && (
                <button type="button" className="btn" onClick={limpiar}>
                  <FiX aria-hidden="true" /> Cancelar
                </button>
              )}
            </div>
          </form>
          {error && <p className="error">{error}</p>}
          {aviso && <p className="ok">{aviso}</p>}
        </section>

        <section className="tarjeta">
          <h2>Listado</h2>
          {lista.length === 0 ? (
            <p className="vacio">Sin vehículos todavía. Registre el primero.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Placa</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((vehiculo) => (
                    <tr key={vehiculo.id}>
                      <td>{vehiculo.marca}</td>
                      <td>{vehiculo.modelo}</td>
                      <td>{vehiculo.tipo}</td>
                      <td>{vehiculo.placa}</td>
                      <td className="centro">
                        <button type="button" className="btn-pequeno"  onClick={() => editar(vehiculo)}>
                          <FiEdit2 aria-hidden="true" /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => setPorEliminar(vehiculo)}
                        >
                          <FiTrash2 aria-hidden="true" /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {confirmarGuardado && (
        <Confirmar
          titulo={editandoId == null ? 'Confirmar registro' : 'Confirmar cambios'}
          mensaje={
            editandoId == null
              ? '¿Registrar este vehículo?'
              : '¿Guardar los cambios de este vehículo?'
          }
          detalle={`${form.marca} ${form.modelo} · ${form.placa}`}
          etiqueta={editandoId == null ? 'Registrar' : 'Guardar'}
          onConfirmar={guardar}
          onCancelar={() => setConfirmarGuardado(false)}
        />
      )}

      {porEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el vehículo ${porEliminar.marca} ${porEliminar.modelo} (${porEliminar.placa})?`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </div>
  )
}
