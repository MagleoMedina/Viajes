import { useEffect, useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import { api, fecha, money } from '../api/client.js'
import { gastoVacio, gastoPayload, tituloExistente } from '../api/gastos.js'
import GastoForm from '../components/GastoForm.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'

/** Columna de dinero alineada a la derecha (igual que las tablas de viajes). */
const num = (v) => money(v)

export default function RegistrarGastos() {
  const [titulos, setTitulos] = useState([])
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [form, setForm] = useState(() => gastoVacio())
  const [tasaActual, setTasaActual] = useState('')
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [formRef, enfocarFormulario] = useFocoFormulario()
  const [tituloRef, enfocarTitulo] = useFocoFormulario()

  function cargarTitulos() {
    return api.get('/titulos-gasto').then(setTitulos)
  }

  function cargarRegistros() {
    return api.get('/gastos-varios').then(setRegistros)
  }

  useEffect(() => {
    cargarTitulos().catch((e) => setError(e.message))
    cargarRegistros().catch((e) => setError(e.message))
    api
      .get('/tasa')
      .then((t) => {
        if (t?.valor != null) {
          setTasaActual(t.valor)
          setForm((f) => (f.tasa ? f : { ...f, tasa: String(t.valor) }))
        }
      })
      .catch(() => {})
  }, [])

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function agregarTitulo(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/titulos-gasto', { nombre: nuevoTitulo })
      setAviso('Título de gasto registrado.')
      setNuevoTitulo('')
      await cargarTitulos()
      enfocarTitulo()
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    const titulo = tituloExistente(form.titulo, titulos)
    if (!titulo) {
      setError('Registre primero el título del gasto en la tarjeta "Nuevo título de gasto".')
      return
    }
    try {
      await api.post('/gastos-varios', gastoPayload(form, titulo.id))
      setAviso('Gasto registrado.')
      setForm(gastoVacio(tasaActual))
      await cargarRegistros()
      enfocarFormulario()
    } catch (err) {
      setError(err.message)
    }
  }

  const ultimos = registros.slice(0, 10)

  return (
      <div className="rejilla">
        <section className="tarjeta">
          <h2>Nuevo título de gasto</h2>
          <p className="ayuda">
            Antes de registrar un gasto debe existir su título (ej.: Alcaldía, Papelería).
          </p>
          <form ref={tituloRef} onSubmit={agregarTitulo} className="form linea">
            <input
              type="text"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              placeholder="Nombre del título"
              required
            />
            <button type="submit" className="btn primario">
              <FiPlus aria-hidden="true" /> Agregar
            </button>
          </form>

          {titulos.length === 0 ? (
            <p className="vacio">Sin títulos todavía.</p>
          ) : (
            <ul className="chips-lista">
              {titulos.map((t) => (
                <li key={t.id} className="chip">
                  {t.nombre}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta">
          <h2>Registrar gasto</h2>
          <GastoForm
            formRef={formRef}
            form={form}
            cambiar={cambiar}
            titulos={titulos}
            onSubmit={guardar}
            etiqueta="Registrar gasto"
            etiquetaNumero="Número de factura"
          />
          {error && <p className="error">{error}</p>}
          {aviso && <p className="ok">{aviso}</p>}
        </section>

        <section className="tarjeta ancho-completo">
          <h2>Últimos registros</h2>
          {ultimos.length === 0 ? (
            <p className="vacio">Sin gastos registrados todavía.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Título</th>
                    <th>N° factura</th>
                    <th>Motivo</th>
                    <th className="derecha">Monto $</th>
                    <th className="derecha">Monto Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos.map((g) => (
                    <tr key={g.id}>
                      <td>{fecha(g.fecha)}</td>
                      <td>{g.tituloGasto?.nombre}</td>
                      <td>{g.numero}</td>
                      <td>{g.motivo}</td>
                      <td className="derecha">{num(g.montoUsd)}</td>
                      <td className="derecha">{num(g.montoBs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
  )
}
