import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const VACIO = { nombre: '', apellido: '', cedula: '' }

export default function Choferes() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargar() {
    return api.get('/choferes').then(setLista)
  }

  useEffect(() => {
    cargar().catch((e) => setError(e.message))
  }, [])

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(chofer) {
    setEditandoId(chofer.id)
    setForm({ nombre: chofer.nombre, apellido: chofer.apellido, cedula: chofer.cedula })
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
        await api.post('/choferes', form)
        setAviso('Chofer registrado.')
      } else {
        await api.put(`/choferes/${editandoId}`, form)
        setAviso('Chofer actualizado.')
      }
      limpiar()
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(chofer) {
    if (!window.confirm(`¿Eliminar al chofer ${chofer.nombre} ${chofer.apellido}?`)) return
    setError('')
    setAviso('')
    try {
      await api.del(`/choferes/${chofer.id}`)
      setAviso('Chofer eliminado.')
      if (editandoId === chofer.id) limpiar()
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Choferes</h1>
          <p className="sub">Registro, actualización y eliminación de choferes.</p>
        </div>
        <span className="contador">{lista.length} registrados</span>
      </header>

      <div className="rejilla">
        <section className="tarjeta">
          <h2>{editandoId == null ? 'Nuevo chofer' : 'Editar chofer'}</h2>
          <form onSubmit={guardar} className="form">
            <label>
              Nombre
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                required
              />
            </label>
            <label>
              Apellido
              <input
                type="text"
                value={form.apellido}
                onChange={(e) => set('apellido', e.target.value)}
                required
              />
            </label>
            <label>
              Cédula
              <input
                type="text"
                value={form.cedula}
                onChange={(e) => set('cedula', e.target.value)}
                placeholder="V-12345678"
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
            <p className="vacio">Sin choferes todavía. Registre el primero.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Apellido</th>
                    <th>Cédula</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((chofer) => (
                    <tr key={chofer.id}>
                      <td>{chofer.nombre}</td>
                      <td>{chofer.apellido}</td>
                      <td>{chofer.cedula}</td>
                      <td className="centro">
                        <button type="button" className="btn pequeno" onClick={() => editar(chofer)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => eliminar(chofer)}
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
