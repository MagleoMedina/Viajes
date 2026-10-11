import { FiX } from 'react-icons/fi'

export default function Modal({ titulo, onClose, children }) {
  function fondo(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={fondo} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cab">
          <h3>{titulo}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <FiX aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
