import { useEffect, useState } from 'react'
import { FiEdit2, FiFileText, FiSearch, FiTrash2 } from 'react-icons/fi'
import { api, fecha, money } from '../api/client.js'
import { estacionarioPayload, estacionarioVacio, num, red2 } from '../api/gastos.js'
import Modal from './Modal.jsx'
import Confirmar from './Confirmar.jsx'
import VistaPreviaPdf from './VistaPreviaPdf.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'

/** Campos compartidos por el alta y la edición. */
function CamposEstacionario({ form, cambiar, vehiculos, disponible }) {
  return (
    <>
      <div className="campos-3">
        <label>
          Fecha
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => cambiar('fecha', e.target.value)}
            required
          />
        </label>
        <label>
          Vehículo
          <select
            value={form.vehiculoId}
            onChange={(e) => cambiar('vehiculoId', e.target.value)}
            required
          >
            <option value="">Seleccione…</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa}
              </option>
            ))}
          </select>
        </label>
        <label>
          Litros
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.litros}
            onChange={(e) => cambiar('litros', e.target.value)}
            required
          />
        </label>
      </div>
      <div className="campos-3">
        <label>
          N° referencia
          <input
            type="text"
            value={form.referencia}
            onChange={(e) => cambiar('referencia', e.target.value)}
            placeholder="0"
          />
        </label>
        <label>
          Motivo
          <input
            type="text"
            value={form.motivo}
            onChange={(e) => cambiar('motivo', e.target.value)}
            placeholder="Planta, mantenimiento, etc."
          />
        </label>
      </div>
      <p className="ayuda">
        Descuenta del stock global. Disponible actual:{' '}
        {disponible == null ? '—' : `${red2(Math.max(0, disponible))} L`}.
      </p>
    </>
  )
}

/**
 * Gasoil de vehículos estacionarios: consumos que no pertenecen a un viaje.
 * Descuenta litros del stock GLOBAL y no del resumen por vehículo.
 */
export default function GasoilEstacionario({ onStockCambio }) {
  const [vehiculos, setVehiculos] = useState([])
  const [registros, setRegistros] = useState([])
  const [stock, setStock] = useState(null)
  const [form, setForm] = useState(() => estacionarioVacio())
  const [editando, setEditando] = useState(null)
  const [formEdicion, setFormEdicion] = useState(() => estacionarioVacio())
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', vehiculoId: '' })
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [pdfPrevia, setPdfPrevia] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [formRef, enfocarFormulario] = useFocoFormulario()

  function cargarRegistros() {
    return api.get('/gasoil-estacionario').then(setRegistros)
  }

  function cargarStock() {
    return api.get('/gastos-gasoil/stock').then(setStock)
  }

  useEffect(() => {
    Promise.all([api.get('/vehiculos').then(setVehiculos), cargarRegistros(), cargarStock()]).catch(
      (e) => setError(e.message),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function cambiarEdicion(campo, valor) {
    setFormEdicion((f) => ({ ...f, [campo]: valor }))
  }

  function cambiarFiltro(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  /** Valida los litros contra el disponible (en edición se devuelven los actuales). */
  function validarLitros(formulario, litrosActuales = 0) {
    if (!formulario.vehiculoId) return 'Seleccione un vehículo.'
    const litros = num(formulario.litros)
    if (!(litros > 0)) return 'Los litros deben ser mayores a 0.'
    if (stock != null) {
      const disponible = red2(stock.disponible + litrosActuales)
      if (litros > disponible) {
        return `Los litros exceden el gasoil disponible (disponible: ${red2(
          Math.max(0, disponible),
        )} L).`
      }
    }
    return ''
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    const problema = validarLitros(form)
    if (problema) {
      setError(problema)
      return
    }
    try {
      await api.post('/gasoil-estacionario', estacionarioPayload(form))
      setAviso('Consumo estacionario registrado.')
      setForm(estacionarioVacio())
      await Promise.all([cargarRegistros(), cargarStock()])
      onStockCambio?.()
      enfocarFormulario()
    } catch (err) {
      setError(err.message)
    }
  }

  function editar(registro) {
    setEditando(registro)
    setFormEdicion({
      vehiculoId: String(registro.vehiculo?.id ?? ''),
      fecha: registro.fecha ?? '',
      litros: String(registro.litros ?? ''),
      referencia: registro.referencia ?? '',
      motivo: registro.motivo ?? '',
    })
    setError('')
  }

  function cerrarEdicion() {
    setEditando(null)
    setConfirmarGuardado(false)
    setError('')
  }

  function enviarEdicion(e) {
    e.preventDefault()
    setError('')
    const problema = validarLitros(formEdicion, num(editando.litros))
    if (problema) {
      setError(problema)
      return
    }
    setConfirmarGuardado(true)
  }

  async function guardarEdicion() {
    setConfirmarGuardado(false)
    setError('')
    try {
      await api.put(`/gasoil-estacionario/${editando.id}`, estacionarioPayload(formEdicion))
      setAviso('Consumo estacionario actualizado.')
      cerrarEdicion()
      await Promise.all([cargarRegistros(), cargarStock()])
      onStockCambio?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar() {
    const registro = porEliminar
    setPorEliminar(null)
    if (!registro) return
    setError('')
    setAviso('')
    try {
      await api.del(`/gasoil-estacionario/${registro.id}`)
      setAviso('Consumo estacionario eliminado.')
      await Promise.all([cargarRegistros(), cargarStock()])
      onStockCambio?.()
    } catch (err) {
      setError(err.message)
    }
  }

  function params() {
    const p = new URLSearchParams()
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    if (filtros.vehiculoId) p.set('vehiculoId', filtros.vehiculoId)
    return p
  }

  async function consultar(e) {
    e.preventDefault()
    setError('')
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta".')
      return
    }
    try {
      const consulta = params().toString()
      const filas = await api.get(`/gasoil-estacionario${consulta ? `?${consulta}` : ''}`)
      setVistaPrevia({
        filas,
        consulta,
        totalLitros: red2(filas.reduce((s, f) => s + num(f.litros), 0)),
      })
    } catch (err) {
      setError(err.message)
    }
  }

  function exportarPdf() {
    const consulta = vistaPrevia?.consulta
    setPdfPrevia(`/export/gasoil-estacionario${consulta ? `?${consulta}` : ''}`)
  }

  const ultimos = registros.slice(0, 10)
  const placaFiltrada = vehiculos.find((v) => String(v.id) === filtros.vehiculoId)?.placa

  return (
    <>
      <section className="tarjeta ancho-completo">
        <h2>Gasoil estacionario</h2>
        <p className="ayuda">
          Consumo de vehículos que no están en viaje. Descuenta del stock global, no del resumen
          por vehículo.
        </p>
        <form ref={formRef} onSubmit={guardar} className="form">
          <CamposEstacionario
            form={form}
            cambiar={cambiar}
            vehiculos={vehiculos}
            disponible={stock?.disponible}
          />
          <div className="acciones">
            <button type="submit" className="btn primario">
              Registrar consumo
            </button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}

        <h3 className="bloque-titulo">Últimos consumos estacionarios</h3>
        {ultimos.length === 0 ? (
          <p className="vacio">Sin consumos estacionarios todavía.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vehículo</th>
                  <th className="derecha">Litros</th>
                  <th>N° REF</th>
                  <th>Motivo</th>
                  <th className="centro">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((g) => (
                  <tr key={g.id}>
                    <td>{fecha(g.fecha)}</td>
                    <td>{g.vehiculo?.placa ?? '—'}</td>
                    <td className="derecha">{money(g.litros)}</td>
                    <td>{g.referencia}</td>
                    <td>{g.motivo || '—'}</td>
                    <td className="centro">
                      <button type="button" className="btn-pequeno" onClick={() => editar(g)}>
                        <FiEdit2 aria-hidden="true" /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn pequeno peligro"
                        onClick={() => setPorEliminar(g)}
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

      <section className="tarjeta ancho-completo">
        <h2>Consultar consumos estacionarios</h2>
        <form onSubmit={consultar} className="form">
          <div className="campos-3">
            <label>
              Desde
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => cambiarFiltro('desde', e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => cambiarFiltro('hasta', e.target.value)}
              />
            </label>
            <label>
              Vehículo
              <select
                value={filtros.vehiculoId}
                onChange={(e) => cambiarFiltro('vehiculoId', e.target.value)}
              >
                <option value="">Todos</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="acciones">
            <button type="submit" className="btn primario">
              <FiSearch aria-hidden="true" /> Consultar
            </button>
          </div>
        </form>
      </section>

      {editando && (
        <Modal titulo="Editar consumo estacionario" onClose={cerrarEdicion}>
          <form onSubmit={enviarEdicion} className="form">
            <CamposEstacionario
              form={formEdicion}
              cambiar={cambiarEdicion}
              vehiculos={vehiculos}
              disponible={stock == null ? null : red2(stock.disponible + num(editando.litros))}
            />
            <div className="acciones">
              <button type="submit" className="btn primario">
                Guardar cambios
              </button>
              <button type="button" className="btn" onClick={cerrarEdicion}>
                Cancelar
              </button>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
        </Modal>
      )}

      {confirmarGuardado && (
        <Confirmar
          titulo="Confirmar cambios"
          mensaje="¿Guardar los cambios de este consumo estacionario?"
          detalle={`${
            vehiculos.find((v) => String(v.id) === formEdicion.vehiculoId)?.placa ?? 'Sin vehículo'
          } · ${fecha(formEdicion.fecha)} · ${money(formEdicion.litros)} L`}
          etiqueta="Guardar"
          onConfirmar={guardarEdicion}
          onCancelar={() => setConfirmarGuardado(false)}
        />
      )}

      {porEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el consumo estacionario del ${fecha(porEliminar.fecha)}?`}
          detalle={`${porEliminar.vehiculo?.placa ?? 'Sin vehículo'} · ${money(
            porEliminar.litros,
          )} L`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}

      {vistaPrevia && (
        <Modal
          titulo="Vista previa de la consulta"
          onClose={() => setVistaPrevia(null)}
          ancho="amplio"
        >
          <p className="ayuda">
            {vistaPrevia.filas.length} registro{vistaPrevia.filas.length === 1 ? '' : 's'} ·{' '}
            {filtros.desde || filtros.hasta
              ? `${filtros.desde ? fecha(filtros.desde) : 'inicio'} al ${
                  filtros.hasta ? fecha(filtros.hasta) : 'hoy'
                }`
              : 'histórico general'}
            {placaFiltrada ? ` · ${placaFiltrada}` : ''}
          </p>

          {vistaPrevia.filas.length === 0 ? (
            <p className="vacio">Sin consumos estacionarios para este filtro.</p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Vehículo</th>
                    <th className="derecha">Litros</th>
                    <th>N° REF</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {vistaPrevia.filas.map((g) => (
                    <tr key={g.id}>
                      <td>{fecha(g.fecha)}</td>
                      <td>{g.vehiculo?.placa ?? '—'}</td>
                      <td className="derecha">{money(g.litros)}</td>
                      <td>{g.referencia}</td>
                      <td>{g.motivo || '—'}</td>
                    </tr>
                  ))}
                  <tr className="suma">
                    <td colSpan={2}>TOTAL LITROS</td>
                    <td className="derecha">{money(vistaPrevia.totalLitros)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="acciones">
            <button type="button" className="btn primario" onClick={exportarPdf}>
              <FiFileText aria-hidden="true" /> Exportar a PDF
            </button>
            <button type="button" className="btn" onClick={() => setVistaPrevia(null)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {pdfPrevia && (
        <VistaPreviaPdf
          ruta={pdfPrevia}
          titulo="Vista previa · Gasoil estacionario"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </>
  )
}
