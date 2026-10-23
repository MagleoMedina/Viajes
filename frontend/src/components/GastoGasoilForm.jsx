import { useRef } from 'react'
import { num, red2 } from '../api/gastos.js'

/**
 * Los 9 campos de un gasto de gasoil.
 * Litros × Precio $/L calcula el Monto $; el Monto Bs es la fuente
 * editable y el Monto $ se calcula con la tasa (Bs ÷ tasa).
 */
export default function GastoGasoilForm({
  form,
  cambiar,
  vehiculos,
  onSubmit,
  etiqueta,
  onCancelar,
  formRef,
}) {
  const datalistId = 'vehiculos-gasoil-datalist'
  /** Origen de los montos: 'auto' (litros × precio), 'bs' o 'usd'. */
  const origen = useRef('auto')

  function ponerMontoBs(valor, tasa = form.tasa) {
    const t = num(tasa)
    cambiar('montoBs', valor === '' || !t ? '' : String(red2(num(valor) * t)))
  }

  function usdDesdeBs(bs, tasa) {
    const t = num(tasa)
    return bs === '' || !t ? '' : String(red2(num(bs) / t))
  }

  function setLitros(valor) {
    cambiar('litros', valor)
    if (valor !== '' && form.precioLitro !== '') {
      origen.current = 'auto'
      const monto = String(red2(num(valor) * num(form.precioLitro)))
      cambiar('montoUsd', monto)
      cambiar(
        'montoBs',
        form.tasa === '' ? '' : String(red2(num(monto) * num(form.tasa))),
      )
    }
  }

  function setPrecio(valor) {
    cambiar('precioLitro', valor)
    if (valor !== '' && form.litros !== '') {
      origen.current = 'auto'
      const monto = String(red2(num(form.litros) * num(valor)))
      cambiar('montoUsd', monto)
      cambiar(
        'montoBs',
        form.tasa === '' ? '' : String(red2(num(monto) * num(form.tasa))),
      )
    }
  }

  function setMontoBs(valor) {
    origen.current = 'bs'
    ponerMontoBs(valor)
    cambiar('montoUsd', usdDesdeBs(valor, form.tasa))
  }

  function setMontoUsd(valor) {
    origen.current = 'usd'
    cambiar('montoUsd', valor)
    ponerMontoBs(valor)
  }

  function setTasa(valor) {
    cambiar('tasa', valor)
    if (origen.current === 'bs') {
      cambiar('montoUsd', usdDesdeBs(form.montoBs, valor))
    } else {
      ponerMontoBs(form.montoUsd, valor)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="form">
      <div className="campos-3">
        <label>
          Vehículo (opcional)
          <input
            type="text"
            list={datalistId}
            value={form.vehiculo}
            onChange={(e) => cambiar('vehiculo', e.target.value)}
            placeholder="Opcional: escriba o elija la placa"
          />
          <datalist id={datalistId}>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.placa}>
                {`${v.marca} ${v.modelo}`}
              </option>
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
          Estación / PDV
          <input
            type="text"
            value={form.estacion}
            onChange={(e) => cambiar('estacion', e.target.value)}
            placeholder="Estación de servicio"
          />
        </label>
        <label>
          Litros
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.litros}
            onChange={(e) => setLitros(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          Precio $/L
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.precioLitro}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0.00"
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
            placeholder="0.00"
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
