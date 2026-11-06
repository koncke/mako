// MaKo: lo que dice un `Alert` de Orbit, en texto plano, para el reporte de «Reportar a Soporte» (app/_ui/ReportarASoporte.tsx).
// El aviso de Orbit no es un `role="alert"` del DOM (Polar no lo pone), así que el botón no puede leer su texto solo: se le pasa
// armado (`error`). El título siempre; la descripción si se puede leer (un texto, o lo que hay adentro de sus elementos). Lo
// que pinta el propio botón no cuenta.
// Puro: lo ejecuta tests/admin-polar-arreglos.test.ts.

import { isValidElement, type ReactNode } from 'react'

/** El texto de un nodo de React, sin los elementos que `saltear` reconoce (el botón de soporte). */
export function textoDeNodo(n: ReactNode, saltear: (tipo: unknown) => boolean = () => false): string {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number' || typeof n === 'bigint') return String(n)
  if (Array.isArray(n)) return n.map((x) => textoDeNodo(x, saltear)).join('')
  if (isValidElement(n)) {
    if (saltear(n.type)) return ''
    return textoDeNodo((n.props as { children?: ReactNode }).children, saltear)
  }
  return ''
}

/** «Título: descripción», con los espacios juntados. Sin descripción legible, el título solo. */
export function textoDeAviso(title: string, description: ReactNode, saltear?: (tipo: unknown) => boolean): string {
  const d = textoDeNodo(description, saltear).replace(/\s+/g, ' ').trim()
  const t = title.replace(/\s+/g, ' ').trim()
  return d ? `${t}: ${d}` : t
}
