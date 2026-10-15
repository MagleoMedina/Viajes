import { FiCheck, FiTrash2, FiX } from 'react-icons/fi'
import Modal from './Modal.jsx'

/**
 * Modal de confirmación para guardar cambios o eliminar registros
 * (reemplaza a window.confirm, que no existe en la app empaquetada).
 *
 * - `peligro`: pinta el botón de confirmar en rojo (eliminaciones).
 * - `detalle`: línea secundaria con los datos del registro afectado.
 */
export default function Confirmar({
  titulo,
  mensaje,
  detalle,
  etiqueta = 'Confirmar',
  peligro = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal titulo={titulo} onClose={onCancelar}>
      <p>{mensaje}</p>
      {detalle && <p className="ayuda">{detalle}</p>}
      <div className="acciones">
        <button
          type="button"
          className={`btn primario${peligro ? ' peligro' : ''}`}
          onClick={onConfirmar}
        >
          {peligro ? <FiTrash2 aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
          {etiqueta}
        </button>
        <button type="button" className="btn" onClick={onCancelar}>
          <FiX aria-hidden="true" /> Cancelar
        </button>
      </div>
    </Modal>
  )
}
