import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'

export default function Modal({ titulo, onClose, children }) {
  function fondo(e) {
    if (e.target === e.currentTarget) onClose()
  }

  // Portal a <body>: un modal montado dentro de un contenedor posicionado (p.ej.
  // el sidebar, que es position: sticky y crea contexto de apilamiento) queda
  // pintado por debajo del contenido principal aunque lleve z-index alto.
  return createPortal(
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
    </div>,
    document.body,
  )
}
