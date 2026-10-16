import { num, red2 } from '../api/gastos.js'

/** Los 9 campos de un gasto vario. Monto Bs se recalcula solo
 * (Monto $ × tasa del día) salvo que se edite a mano.
 * `etiquetaCampo`/`placeholderCampo` renombran el campo Título
 * (ej.: "Tipo de impuesto" en la sección de impuestos).
 */
export default function GastoForm({
  form,
  cambiar,
  titulos,
  onSubmit,
  etiqueta,
  onCancelar,
  etiquetaCampo = 'Título',
  placeholderCampo = 'Escriba o elija un título',
  datalistId = 'titulos-gasto-datalist',
  placeholderMonto = '0.00',
}) {
  /** %DB = Monto Bs × 0.3: se recalcula con cada cambio del Monto Bs. */
  function setMontoBs(valor) {
    cambiar('montoBs', valor)
    cambiar('porcentajeDb', valor === '' ? '' : String(red2(num(valor) * 0.03)))
  }

  function setMonto(valor) {
    cambiar('montoUsd', valor)
    setMontoBs(valor === '' ? '' : String(red2(num(valor) * num(form.tasa))))
  }

  function setTasa(valor) {
    cambiar('tasa', valor)
    setMontoBs(
      valor === '' || form.montoUsd === ''
        ? form.montoBs
        : String(red2(num(form.montoUsd) * num(valor))),
    )
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <div className="campos-3">
        <label>
          {etiquetaCampo}
        <input
          type="text"
          list={datalistId}
          value={form.titulo}
          onChange={(e) => cambiar('titulo', e.target.value)}
          placeholder={placeholderCampo}
          required
        />
        <datalist id={datalistId}>
          {titulos.map((t) => (
            <option key={t.id} value={t.nombre} />
          ))}
        </datalist>
      </label>
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
        N°
        <input
          type="text"
          value={form.numero}
          onChange={(e) => cambiar('numero', e.target.value)}
          placeholder="N° de comprobante"
        />
      </label>
      <label>
        Motivo
        <input
          type="text"
          value={form.motivo}
          onChange={(e) => cambiar('motivo', e.target.value)}
          placeholder="Motivo del gasto"
          required
        />
      </label>
      <label>
        Monto $
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.montoUsd}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={placeholderMonto}
        />
      </label>
      <label>
        Tasa del día
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.tasa}
          onChange={(e) => setTasa(e.target.value)}
          placeholder="0.00"
        />
      </label>
      <label>
        Monto Bs
        <input
          type="number"
          step="0.01"
          value={form.montoBs}
          onChange={(e) => setMontoBs(e.target.value)}
          placeholder="Se calcula solo"
        />
      </label>
      <label>
        %DB
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.porcentajeDb}
          onChange={(e) => cambiar('porcentajeDb', e.target.value)}
          placeholder="0.00"
        />
      </label>
      <label>
        N° REF
        <input
          type="text"
          value={form.referencia}
          onChange={(e) => cambiar('referencia', e.target.value)}
          placeholder="Referencia"
        />
      </label>
      </div>

      <div className="acciones">
        <button type="submit" className="btn primario">
          {etiqueta}
        </button>
        {onCancelar && (
          <button type="button" className="btn" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
