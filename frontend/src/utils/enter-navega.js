import { useCallback, useRef } from 'react'

/**
 * Navegación con Enter: al pulsar Enter en un campo el foco pasa al siguiente
 * campo del formulario (igual que Tab). Ctrl+Enter envía el formulario.
 * Respeta los eventos ya manejados (event.defaultPrevented), por ejemplo
 * ChipsInput, que usa Enter para crear un chip.
 */

export const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tipos de input que no reciben Enter como campo de captura. */
const SIN_ENTER = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file',
])

/** Tipos de input cuyo texto se puede seleccionar al enfocar (como Tab). */
const CON_TEXTO = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
])

function visible(el) {
  if (!el || !el.getClientRects().length) return false
  return getComputedStyle(el).visibility !== 'hidden'
}

function tipoDe(input) {
  return (input.getAttribute('type') || 'text').toLowerCase()
}

function seleccionarTexto(el) {
  if (!el || el.tagName !== 'INPUT' || !CON_TEXTO.has(tipoDe(el))) return
  try {
    el.select()
  } catch {
    // Algunos navegadores no permiten select() en ciertos tipos.
  }
}

/** Siguiente campo enfocable después de `actual`, en orden del DOM. */
export function siguienteFoco(actual) {
  if (!actual?.closest) return null
  const ambito = actual.closest('form') || actual.closest('.tarjeta') || document
  const lista = [...ambito.querySelectorAll(FOCALIZABLES)].filter(visible)
  const i = lista.indexOf(actual)
  if (i === -1) return lista[0] ?? null
  return lista[i + 1] ?? null
}

/** Enfoca el primer campo de `raiz` y selecciona su texto. */
export function enfocarPrimerCampo(raiz) {
  if (!raiz?.querySelectorAll) return false
  const lista = [...raiz.querySelectorAll(FOCALIZABLES)].filter(visible)
  const primero = lista.find((el) => !el.disabled && el.tabIndex >= 0)
  if (!primero) return false
  primero.focus()
  seleccionarTexto(primero)
  return true
}

/** Igual que `enfocarPrimerCampo`, pero después de que React pinte el cambio. */
export function programarFoco(raiz) {
  setTimeout(() => enfocarPrimerCampo(raiz), 0)
}

/** Manejador único de keydown para toda la app. */
export function manejaEnter(evento) {
  if (evento.key !== 'Enter') return
  if (evento.defaultPrevented) return
  if (evento.isComposing) return

  const destino = evento.target
  if (!destino?.tagName) return
  if (destino.tagName !== 'INPUT' && destino.tagName !== 'SELECT') return
  if (destino.tagName === 'INPUT' && SIN_ENTER.has(tipoDe(destino))) return
  if (destino.dataset?.enter === 'nativo') return
  if (destino.isContentEditable) return

  const formulario = destino.closest('form')

  if (evento.ctrlKey) {
    if (!formulario) return
    evento.preventDefault()
    if (typeof formulario.requestSubmit === 'function') {
      formulario.requestSubmit()
    } else {
      const boton = formulario.querySelector(
        'button[type="submit"], button:not([type])'
      )
      boton?.click()
    }
    return
  }

  if (evento.altKey || evento.metaKey) return

  const siguiente = siguienteFoco(destino)
  if (!siguiente) return
  evento.preventDefault()
  siguiente.focus()
  seleccionarTexto(siguiente)
}

/** Instala el manejador global. Devuelve la función para quitarlo. */
export function instalarEnterNavega() {
  document.addEventListener('keydown', manejaEnter)
  return () => document.removeEventListener('keydown', manejaEnter)
}

/**
 * Ref para el formulario y función para devolver el foco a su primer campo
 * después de guardar. Uso:
 *   const [formRef, enfocarFormulario] = useFocoFormulario()
 *   <form ref={formRef} …>
 *   // tras guardar: enfocarFormulario()
 */
export function useFocoFormulario() {
  const formRef = useRef(null)
  const enfocar = useCallback(() => programarFoco(formRef.current), [])
  return [formRef, enfocar]
}
