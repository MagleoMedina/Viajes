import { num, red2 } from '../api/gastos.js'

/**
 * Los 9 campos de un gasto de gasoil.
 * Monto $ = Litros × Precio $/L y Monto Bs = Monto $ × tasa, ambos
 * automáticos y editables a mano.
 */
export default function GastoGasoilForm({
  form,
  cambiar,
  vehiculos,
  onSubmit,
  etiqueta,
  onCancelar,
}) {
  const datalistId = 'vehiculos-gasoil-datalist'

  function setLitros(valor) {
    cambiar('litros', valor)
    if (valor !== '' && form.precioLitro !== '') {
      const monto = String(red2(num(valor) * num(form.precioLitro)))
      cambiar('montoUsd', monto)
      if (form.tasa !== '') cambiar('montoBs', String(red2(num(monto) * num(form.tasa))))
    }
  }

  function setPrecio(valor) {
    cambiar('precioLitro', valor)
    if (valor !== '' && form.litros !== '') {
      const monto = String(red2(num(form.litros) * num(valor)))
      cambiar('montoUsd', monto)
      if (form.tasa !== '') cambiar('montoBs', String(red2(num(monto) * num(form.tasa))))
    }
  }

  function setMonto(valor) {
    cambiar('montoUsd', valor)
    cambiar(
      'montoBs',
      valor === '' || form.tasa === ''
        ? form.montoBs
        : String(red2(num(valor) * num(form.tasa))),
    )
  }

  function setTasa(valor) {
    cambiar('tasa', valor)
    cambiar(
      'montoBs',
      valor === '' || form.montoUsd === ''
        ? form.montoBs
        : String(red2(num(form.montoUsd) * num(valor))),
    )
  }

  return (
    <form onSubmit={onSubmit} className="form">
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
          Monto $
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.montoUsd}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Se calcula solo"
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
            onChange={(e) => cambiar('montoBs', e.target.value)}
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
