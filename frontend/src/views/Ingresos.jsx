import { useEffect, useState } from 'react'
import { FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi'
import { api, fecha, money } from '../api/client.js'
import { ingresoPayload, ingresoVacio, tasaTexto } from '../api/ingresos.js'
import IngresoForm from '../components/IngresoForm.jsx'
import Modal from '../components/Modal.jsx'
import Confirmar from '../components/Confirmar.jsx'
import VistaPreviaPdf from '../components/VistaPreviaPdf.jsx'
import { useFocoFormulario } from '../utils/enter-navega.js'

const PESTANAS = [
  { id: 'registrar', label: 'Registrar' },
  { id: 'modificar', label: 'Modificar' },
  { id: 'consultar', label: 'Consultar' },
  { id: 'pdf', label: 'PDF' },
]

/** Filtros comunes de las pestañas Modificar y Consultar. */
function filtrosVacios() {
  return { desde: '', hasta: '', empresaId: '' }
}

function paramsDe(filtros) {
  const p = new URLSearchParams()
  if (filtros.desde) p.set('desde', filtros.desde)
  if (filtros.hasta) p.set('hasta', filtros.hasta)
  if (filtros.empresaId) p.set('empresaId', filtros.empresaId)
  return p
}

/** Agrupa por empresa y suma el monto en divisas ($) y en Bs. */
function agruparPorEmpresa(ingresos) {
  const mapa = new Map()
  for (const i of ingresos) {
    const clave = (i.empresa?.nombre ?? '').trim() || 'SIN EMPRESA'
    if (!mapa.has(clave)) {
      mapa.set(clave, { clave, filas: [], sumaUsd: 0, sumaBs: 0 })
    }
    const b = mapa.get(clave)
    b.filas.push(i)
    b.sumaUsd += Number(i.montoDivisa) || 0
    b.sumaBs += Number(i.montoBs) || 0
  }
  const bloques = [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave, 'es'))
  for (const b of bloques) {
    b.sumaUsd = Math.round((b.sumaUsd + Number.EPSILON) * 100) / 100
    b.sumaBs = Math.round((b.sumaBs + Number.EPSILON) * 100) / 100
    b.filas.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)))
  }
  return bloques
}

/* ------------------------------------------------------------------ Registrar */

function IngRegistrar() {
  const [empresas, setEmpresas] = useState([])
  const [form, setForm] = useState(() => ingresoVacio())
  const [tasaActual, setTasaActual] = useState('')
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [formRef, enfocarFormulario] = useFocoFormulario()

  function cargarEmpresas() {
    return api.get('/empresas').then(setEmpresas)
  }

  function cargarRegistros() {
    return api.get('/ingresos').then(setRegistros)
  }

  useEffect(() => {
    cargarEmpresas().catch((e) => setError(e.message))
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

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    try {
      await api.post('/ingresos', ingresoPayload(form))
      setAviso('Ingreso registrado.')
      setForm(ingresoVacio(tasaActual))
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
        <h2>Registrar ingreso</h2>
        <p className="ayuda">
          El monto recibido en divisas y el monto final en Bs se registran por separado. La factura es
          obligatoria y única; el IVA es informativo y no entra en los totales.
        </p>
        <IngresoForm
          formRef={formRef}
          form={form}
          cambiar={cambiar}
          empresas={empresas}
          onSubmit={guardar}
          etiqueta="Registrar ingreso"
        />
        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok">{aviso}</p>}
      </section>

      <section className="tarjeta ancho-completo">
        <h2>Últimos registros</h2>
        {ultimos.length === 0 ? (
          <p className="vacio">Sin ingresos todavía.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="derecha">FACTURA No.</th>
                  <th>Empresa</th>
                  <th>Condiciones de pago</th>
                  <th>Descripción</th>
                  <th className="derecha">Cantidad</th>
                  <th className="derecha">Tasa</th>
                  <th className="derecha">IVA</th>
                  <th className="derecha">Monto $</th>
                  <th className="derecha">Monto Bs</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((i) => (
                  <tr key={i.id}>
                    <td>{fecha(i.fecha)}</td>
                    <td className="derecha">{i.facturaNum ?? '—'}</td>
                    <td>{i.empresa?.nombre ?? '—'}</td>
                    <td>{i.condicionesPago || '—'}</td>
                    <td>{i.descripcion}</td>
                    <td className="derecha">{money(i.cantidad)}</td>
                    <td className="derecha">{tasaTexto(i.tasa)}</td>
                    <td className="derecha">{money(i.iva)}</td>
                    <td className="derecha">{money(i.montoDivisa)}</td>
                    <td className="derecha">{money(i.montoBs)}</td>
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

/* ------------------------------------------------------------------ Modificar */

function IngModificar() {
  const [empresas, setEmpresas] = useState([])
  const [registros, setRegistros] = useState([])
  const [filtros, setFiltros] = useState(filtrosVacios)
  const [ingresoEditando, setIngresoEditando] = useState(null)
  const [form, setForm] = useState(() => ingresoVacio())
  const [confirmarGuardado, setConfirmarGuardado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function cargarEmpresas() {
    return api.get('/empresas').then(setEmpresas)
  }

  function cargarRegistros(f = filtros) {
    const qs = paramsDe(f).toString()
    return api.get(`/ingresos${qs ? `?${qs}` : ''}`).then(setRegistros)
  }

  useEffect(() => {
    cargarEmpresas().catch((e) => setError(e.message))
    cargarRegistros().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cambiarFiltro(campo, valor) {
    const siguiente = { ...filtros, [campo]: valor }
    setFiltros(siguiente)
    cargarRegistros(siguiente).catch((e) => setError(e.message))
  }

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function editar(ingreso) {
    setIngresoEditando(ingreso)
    setForm({
      fecha: ingreso.fecha,
      empresaId: String(ingreso.empresa?.id ?? ''),
      condicionesPago: ingreso.condicionesPago ?? '',
      descripcion: ingreso.descripcion ?? '',
      cantidad: String(ingreso.cantidad ?? ''),
      tasa: String(ingreso.tasa ?? ''),
      facturaNum: ingreso.facturaNum == null ? '' : String(ingreso.facturaNum),
      iva: String(ingreso.iva ?? ''),
      montoDivisa: String(ingreso.montoDivisa ?? ''),
      montoBs: String(ingreso.montoBs ?? ''),
    })
    setError('')
  }

  function cerrarEdicion() {
    setIngresoEditando(null)
    setConfirmarGuardado(false)
    setError('')
  }

  function enviarEdicion(e) {
    e.preventDefault()
    setConfirmarGuardado(true)
  }

  async function guardarEdicion() {
    setConfirmarGuardado(false)
    setError('')
    try {
      await api.put(`/ingresos/${ingresoEditando.id}`, ingresoPayload(form))
      setAviso('Ingreso actualizado.')
      cerrarEdicion()
      await cargarRegistros()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar() {
    const i = porEliminar
    setPorEliminar(null)
    if (!i) return
    setError('')
    setAviso('')
    try {
      await api.del(`/ingresos/${i.id}`)
      setAviso('Ingreso eliminado.')
      await cargarRegistros()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta ancho-completo">
          <h2>Registros</h2>
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
              Empresa
              <select
                value={filtros.empresaId}
                onChange={(e) => cambiarFiltro('empresaId', e.target.value)}
              >
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {registros.length === 0 ? (
            <p className="vacio">
              <FiSearch aria-hidden="true" /> Sin ingresos para este filtro.
            </p>
          ) : (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="derecha">FACTURA No.</th>
                    <th>Empresa</th>
                    <th>Condiciones de pago</th>
                    <th>Descripción</th>
                    <th className="derecha">Cantidad</th>
                    <th className="derecha">Tasa</th>
                    <th className="derecha">IVA</th>
                    <th className="derecha">Monto $</th>
                    <th className="derecha">Monto Bs</th>
                    <th className="centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((i) => (
                    <tr key={i.id}>
                      <td>{fecha(i.fecha)}</td>
                      <td className="derecha">{i.facturaNum ?? '—'}</td>
                      <td>{i.empresa?.nombre ?? '—'}</td>
                      <td>{i.condicionesPago || '—'}</td>
                      <td>{i.descripcion}</td>
                      <td className="derecha">{money(i.cantidad)}</td>
                      <td className="derecha">{tasaTexto(i.tasa)}</td>
                      <td className="derecha">{money(i.iva)}</td>
                      <td className="derecha">{money(i.montoDivisa)}</td>
                      <td className="derecha">{money(i.montoBs)}</td>
                      <td className="centro">
                        <button type="button" className="btn-pequeno" onClick={() => editar(i)}>
                          <FiEdit2 aria-hidden="true" /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn pequeno peligro"
                          onClick={() => setPorEliminar(i)}
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

        {error && <p className="error ancho-completo">{error}</p>}
        {aviso && <p className="ok ancho-completo">{aviso}</p>}
      </div>

      {ingresoEditando && (
        <Modal titulo="Editar ingreso" onClose={cerrarEdicion}>
          <IngresoForm
            form={form}
            cambiar={cambiar}
            empresas={empresas}
            onSubmit={enviarEdicion}
            etiqueta="Guardar cambios"
            onCancelar={cerrarEdicion}
          />
          {error && <p className="error">{error}</p>}
        </Modal>
      )}

      {confirmarGuardado && (
        <Confirmar
          titulo="Confirmar cambios"
          mensaje="¿Guardar los cambios de este ingreso?"
          detalle={`${form.descripcion || 'Sin descripción'} · ${fecha(form.fecha)} · $ ${money(
            form.montoDivisa,
          )}`}
          etiqueta="Guardar"
          onConfirmar={guardarEdicion}
          onCancelar={() => setConfirmarGuardado(false)}
        />
      )}

      {porEliminar && (
        <Confirmar
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar el ingreso del ${fecha(porEliminar.fecha)}?`}
          detalle={`${porEliminar.empresa?.nombre ?? 'Sin empresa'} · $ ${money(
            porEliminar.montoDivisa,
          )}`}
          etiqueta="Eliminar"
          peligro
          onConfirmar={eliminar}
          onCancelar={() => setPorEliminar(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Consultar */

function IngConsultar() {
  const [empresas, setEmpresas] = useState([])
  const [filtros, setFiltros] = useState(filtrosVacios)
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [pdfPrevia, setPdfPrevia] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  async function consultar(e) {
    e.preventDefault()
    setError('')
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta".')
      return
    }
    try {
      const ingresos = await api.get(`/ingresos?${paramsDe(filtros).toString()}`)
      const bloques = agruparPorEmpresa(ingresos)
      setVistaPrevia({
        bloques,
        cantidad: ingresos.length,
        totalUsd: bloques.reduce((s, b) => s + b.sumaUsd, 0),
        totalBs: bloques.reduce((s, b) => s + b.sumaBs, 0),
      })
    } catch (err) {
      setError(err.message)
    }
  }

  function exportarPdf() {
    setPdfPrevia(`/export/ingresos?${paramsDe(filtros).toString()}`)
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta">
          <h2>Filtros</h2>
          <form onSubmit={consultar} className="form">
            <div className="campos-3">
              <label>
                Desde
                <input
                  type="date"
                  value={filtros.desde}
                  onChange={(e) => cambiar('desde', e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filtros.hasta}
                  onChange={(e) => cambiar('hasta', e.target.value)}
                />
              </label>
              <label>
                Empresa
                <select
                  value={filtros.empresaId}
                  onChange={(e) => cambiar('empresaId', e.target.value)}
                >
                  <option value="">Todas</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
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
          {error && <p className="error">{error}</p>}
        </section>
      </div>

      {vistaPrevia && (
        <Modal
          titulo="Vista previa de la consulta"
          onClose={() => setVistaPrevia(null)}
          ancho="amplio"
        >
          <p className="ayuda">
            {vistaPrevia.cantidad} registro{vistaPrevia.cantidad === 1 ? '' : 's'} ·{' '}
            {filtros.desde || filtros.hasta
              ? `${filtros.desde ? fecha(filtros.desde) : 'inicio'} al ${
                  filtros.hasta ? fecha(filtros.hasta) : 'hoy'
                }`
              : 'histórico general'}
            {filtros.empresaId
              ? ` · ${empresas.find((e) => String(e.id) === filtros.empresaId)?.nombre ?? ''}`
              : ''}
          </p>

          {vistaPrevia.bloques.length === 0 ? (
            <p className="vacio">Sin ingresos en este intervalo.</p>
          ) : (
            <>
              {vistaPrevia.bloques.map((b) => (
                <div key={b.clave}>
                  <h3 className="bloque-titulo">{b.clave}</h3>
                  <div className="tabla-envoltura">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th className="derecha">FACTURA No.</th>
                          <th>Condiciones de pago</th>
                          <th>Descripción</th>
                          <th className="derecha">Cantidad</th>
                          <th className="derecha">Tasa</th>
                          <th className="derecha">IVA</th>
                          <th className="derecha">Monto $</th>
                          <th className="derecha">Monto Bs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.filas.map((i) => (
                          <tr key={i.id}>
                            <td>{fecha(i.fecha)}</td>
                            <td className="derecha">{i.facturaNum ?? '—'}</td>
                            <td>{i.condicionesPago || '—'}</td>
                            <td>{i.descripcion}</td>
                            <td className="derecha">{money(i.cantidad)}</td>
                            <td className="derecha">{tasaTexto(i.tasa)}</td>
                            <td className="derecha">{money(i.iva)}</td>
                            <td className="derecha">{money(i.montoDivisa)}</td>
                            <td className="derecha">{money(i.montoBs)}</td>
                          </tr>
                        ))}
                        <tr className="suma">
                          <td colSpan={7}>SUBTOTAL {b.clave.toLocaleUpperCase('es')}</td>
                          <td className="derecha">{money(b.sumaUsd)}</td>
                          <td className="derecha">{money(b.sumaBs)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <p className="resumen-total">
                <span>TOTAL GENERAL $ {money(vistaPrevia.totalUsd)}</span>
                <span>Bs {money(vistaPrevia.totalBs)}</span>
              </p>
            </>
          )}

          <div className="acciones">
            <button type="button" className="btn primario" onClick={exportarPdf}>
              Exportar a PDF
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
          titulo="Vista previa · PDF de ingresos"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ PDF */

/** PDF con los filtros de la pestaña; se previsualiza antes de descargar. */
function IngPdf() {
  const [empresas, setEmpresas] = useState([])
  const [filtros, setFiltros] = useState(filtrosVacios)
  const [pdfPrevia, setPdfPrevia] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/empresas').then(setEmpresas).catch((e) => setError(e.message))
  }, [])

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function exportar(e) {
    e.preventDefault()
    setError('')
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError('La fecha "Desde" no puede ser posterior a la fecha "Hasta".')
      return
    }
    setPdfPrevia(`/export/ingresos?${paramsDe(filtros).toString()}`)
  }

  return (
    <>
      <div className="rejilla">
        <section className="tarjeta">
          <h2>PDF de ingresos</h2>
          <p className="ayuda">
            Un bloque por empresa con subtotales y total general. Sin filtros exporta el histórico.
          </p>
          <form onSubmit={exportar} className="form">
            <div className="campos-3">
              <label>
                Desde
                <input
                  type="date"
                  value={filtros.desde}
                  onChange={(e) => cambiar('desde', e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filtros.hasta}
                  onChange={(e) => cambiar('hasta', e.target.value)}
                />
              </label>
              <label>
                Empresa
                <select
                  value={filtros.empresaId}
                  onChange={(e) => cambiar('empresaId', e.target.value)}
                >
                  <option value="">Todas</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="acciones">
              <button type="submit" className="btn primario">
                Exportar a PDF
              </button>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
        </section>
      </div>

      {pdfPrevia && (
        <VistaPreviaPdf
          ruta={pdfPrevia}
          titulo="Vista previa · PDF de ingresos"
          onClose={() => setPdfPrevia('')}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ Sección */

/** Sección «Ingresos» con pestañas Registrar / Modificar / Consultar / PDF. */
export default function Ingresos() {
  const [pestana, setPestana] = useState('registrar')

  return (
    <div className="vista">
      <header className="vista-cab">
        <div>
          <h1>Ingresos</h1>
          <p className="sub">
            Registre los cobros por empresa con su factura, IVA, tasa y montos. Los ingresos
            alimentan el Reporte ingreso de Relación.
          </p>
        </div>
      </header>

      <nav className="pestanas" aria-label="Acciones de ingresos">
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

      {pestana === 'registrar' && <IngRegistrar />}
      {pestana === 'modificar' && <IngModificar />}
      {pestana === 'consultar' && <IngConsultar />}
      {pestana === 'pdf' && <IngPdf />}
    </div>
  )
}
