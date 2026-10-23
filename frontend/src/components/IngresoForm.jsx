/**
 * Los campos de un ingreso. El monto en divisas y el monto final en Bs
 * son independientes: cada uno se digita a mano. El IVA es informativo y la
 * factura es obligatoria y única.
 */
export default function IngresoForm({
  form,
  cambiar,
  empresas,
  onSubmit,
  etiqueta,
  onCancelar,
  formRef,
}) {
  return (
    <form ref={formRef} onSubmit={onSubmit} className="form">
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
          Empresa
          <select
            value={form.empresaId}
            onChange={(e) => cambiar('empresaId', e.target.value)}
            required
          >
            <option value="">Elija una empresa</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Condiciones de pago
          <input
            type="text"
            value={form.condicionesPago}
            onChange={(e) => cambiar('condicionesPago', e.target.value)}
            placeholder="Contado, crédito 30 días…"
          />
        </label>
        <label>
          FACTURA No.
          <input
            type="number"
            step="1"
            min="1"
            value={form.facturaNum}
            onChange={(e) => cambiar('facturaNum', e.target.value)}
            placeholder="0001"
            required
          />
        </label>
        <label>
          Descripción
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            placeholder="Detalle del ingreso"
            required
          />
        </label>
        <label>
          Cantidad
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.cantidad}
            onChange={(e) => cambiar('cantidad', e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          Tasa
          <input
            type="number"
            step="any"
            min="0"
            value={form.tasa}
            onChange={(e) => cambiar('tasa', e.target.value)}
            placeholder="0.000000"
          />
        </label>
        <label>
          Monto recibido en divisas ($)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.montoDivisa}
            onChange={(e) => cambiar('montoDivisa', e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          Monto final Bs
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.montoBs}
            onChange={(e) => cambiar('montoBs', e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          IVA (informativo)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.iva}
            onChange={(e) => cambiar('iva', e.target.value)}
            placeholder="0.00"
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
