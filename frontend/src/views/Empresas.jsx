import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const VACIO = { nombre: '' }

export default function Empresas() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar() {
    return api.get('/empresas').then(setLista)
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  function editar(empresa) {
    setEditandoId(empresa.id)
    setForm({ nombre: empresa.nombre })
    setError('')
    setAviso('')
  }

  function limpiar() {
    setEditandoId(null)
    setForm(VACIO)
    setError('')
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      if (editandoId == null) {
        await api.post('/empresas', form)
        setAviso('Empresa registrada.')
      } else {
        await api.put(`/empresas/${editandoId}`, form)
        setAviso('Empresa actualizada.')
      }
      limpiar()
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(empresa) {
    if (!window.confirm(`¿Eliminar la empresa ${empresa.nombre}?`)) return
    setError('')
    setAviso('')
    try {
      await api.del(`/empresas/${empresa.id}`)
      setAviso('Empresa eliminada.')
      if (editandoId === empresa.id) limpiar()
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Empresas</h1>
          <p className="sub">Empresas a las que se les presta el servicio de transporte.</p>
        </div>
        <span className="contador">{lista.length} registradas</span>
      </header>

      <div className="rejilla">
        <section className="tarjeta">
          <h2>{editandoId == null ? 'Nueva empresa' : 'Editar empresa'}</h2>
          <form onSubmit={guardar} className="form">
            <label>
              Nombre
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                required
              />
            </label>

            <div className="acciones">
              <button type="submit" className="btn primario">
                {editandoId == null ? 'Registrar' : 'Guardar cambios'}
              </button>
              {editandoId != null && (
                <button type="button" className="btn" onClick={limpiar}>
                  Cancelar
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
            <p className="vacio">Sin empresas todavía. Registre la primera.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((empresa) => (
                    <tr key={empresa.id}>
                      <td>{empresa.nombre}</td>
                      <td className="centro">
                        <button type="button" className="btn pequeno" onClick={() => editar(empresa)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => eliminar(empresa)}
                        >
                          Eliminar
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
    </div>
  )
}