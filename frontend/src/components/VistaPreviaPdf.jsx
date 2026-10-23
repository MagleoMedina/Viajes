import { useEffect, useState } from 'react'
import { FiDownload, FiX } from 'react-icons/fi'
import { prepararPdf } from '../api/client.js'
import Modal from './Modal.jsx'

/**
 * Previsualiza un PDF antes de descargarlo.
 * Pide el documento una sola vez: el botón Descargar guarda ese mismo blob.
 */
export default function VistaPreviaPdf({ ruta, titulo = 'Vista previa del PDF', onClose }) {
  const [estado, setEstado] = useState('cargando')
  const [error, setError] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [url, setUrl] = useState('')

  useEffect(() => {
    let vivo = true
    let objectUrl = ''
    prepararPdf(ruta)
      .then((datos) => {
        if (!vivo) return
        objectUrl = URL.createObjectURL(datos.blob)
        setArchivo(datos)
        setUrl(objectUrl)
        setEstado('listo')
      })
      .catch((e) => {
        if (!vivo) return
        setError(e.message)
        setEstado('error')
      })
    return () => {
      vivo = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [ruta])

  function descargar() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = archivo?.nombre || 'documento.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Modal titulo={titulo} onClose={onClose} ancho="amplio">
      {estado === 'cargando' && <p className="vacio">Generando PDF…</p>}
      {estado === 'error' && <p className="error">{error}</p>}
      {estado === 'listo' && (
        <iframe className="pdf-vista" src={url} title={titulo}>
          Si el visor no carga, use el botón Descargar.
        </iframe>
      )}

      <div className="acciones pdf-pie">
        <button
          type="button"
          className="btn primario"
          onClick={descargar}
          disabled={estado !== 'listo'}
        >
          <FiDownload aria-hidden="true" /> Descargar
        </button>
        <button type="button" className="btn" onClick={onClose}>
          <FiX aria-hidden="true" /> Cerrar
        </button>
      </div>
    </Modal>
  )
}
