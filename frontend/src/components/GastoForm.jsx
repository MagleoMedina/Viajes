import { useRef } from 'react'
import { num, red2 } from '../api/gastos.js'

/** Los 9 campos de un gasto vario. El Monto Bs es la fuente: el Monto $
 * se calcula con la tasa del día (Bs ÷ tasa) salvo que se edite a mano.
 * `etiquetaCampo`/`placeholderCampo` renombran el campo Título
 * (ej.: "Tipo de impuesto" en la sección de impuestos).
 * `etiquetaNumero` renombra el campo N° (ej.: "Número de factura").
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
  etiquetaNumero = 'N°',
  placeholderNumero = 'N° de comprobante',
  formRef,
}) {
  /** Último monto editado ('bs' o 'usd'): decide qué campo recalcula la tasa. */
  const origen = useRef('bs')

  /** %DB = Monto Bs × 0.03: se recalcula junto con el Monto Bs. */
  function ponerMontoBs(valor) {
    cambiar('montoBs', valor)
    cambiar('porcentajeDb', valor === '' ? '' : String(red2(num(valor) * 0.03)))
  }

  /** Monto $ = Monto Bs ÷ tasa (tasa 0 o vacía -> sin monto). */
  function usdDesdeBs(bs, tasa) {
    const t = num(tasa)
    return bs === '' || !t ? '' : String(red2(num(bs) / t))
  }

  function setMontoBs(valor) {
    origen.current = 'bs'
    ponerMontoBs(valor)
    cambiar('montoUsd', usdDesdeBs(valor, form.tasa))
  }

  function setMontoUsd(valor) {
    origen.current = 'usd'
    cambiar('montoUsd', valor)
    const t = num(form.tasa)
    ponerMontoBs(valor === '' || !t ? '' : String(red2(num(valor) * t)))
  }

  function setTasa(valor) {
    cambiar('tasa', valor)
    if (origen.current === 'usd') {
      const t = num(valor)
      ponerMontoBs(
        form.montoUsd === '' || !t ? '' : String(red2(num(form.montoUsd) * t)),
      )
    } else {
      cambiar('montoUsd', usdDesdeBs(form.montoBs, valor))
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="form">
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
        {etiquetaNumero}
        <input
          type="text"
          value={form.numero}
          onChange={(e) => cambiar('numero', e.target.value)}
          placeholder={placeholderNumero}
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
        Monto Bs
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.montoBs}
          onChange={(e) => setMontoBs(e.target.value)}
          placeholder={placeholderMonto}
        />
      </label>
      <label>
        Tasa del día
        <input
          type="number"
          step="any"
          min="0"
          value={form.tasa}
          onChange={(e) => setTasa(e.target.value)}
          placeholder="0.000000"
        />
      </label>
      <label>
        Monto $
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.montoUsd}
          onChange={(e) => setMontoUsd(e.target.value)}
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
