import { useState } from 'react'

/**
 * Campo de carga multi-tipo: separar con coma ("Hortalizas, neveras, Mani").
 * Cada valor se vuelve un chip. El valor guardado es el string con comas.
 */
export default function ChipsInput({ value, onChange, placeholder }) {
  const [texto, setTexto] = useState('')
  const chips = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  function agregar(bruto) {
    const partes = String(bruto)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (partes.length === 0) return

    const nuevos = [...chips]
    for (const parte of partes) {
      if (!nuevos.some((c) => c.toLowerCase() === parte.toLowerCase())) nuevos.push(parte)
    }
    onChange(nuevos.join(', '))
    setTexto('')
  }

  function tecla(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      agregar(texto)
      return
    }
    if (e.key === 'Backspace' && texto === '' && chips.length > 0) {
      onChange(chips.slice(0, -1).join(', '))
    }
  }

  return (
    <div className="chips">
      <div className="chips-lista">
        {chips.map((chip) => (
          <span key={chip} className="chip">
            {chip}
            <button
              type="button"
              aria-label={`Quitar ${chip}`}
              onClick={() => onChange(chips.filter((c) => c !== chip).join(', '))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={texto}
          placeholder={chips.length === 0 ? placeholder : ''}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={tecla}
          onBlur={() => agregar(texto)}
        />
      </div>
      <small className="ayuda">Separe cada tipo de carga con coma.</small>
    </div>
  )
}
