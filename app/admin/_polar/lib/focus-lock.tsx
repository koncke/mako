'use client'

// El reemplazo de `react-focus-lock` (que usan el Modal y el InlineModal de Orbit) con lo mismo que Polar le pide: el foco
// queda adentro mientras está abierto (Tab y Shift+Tab dan la vuelta) y vuelve a donde estaba al cerrar. `whiteList`
// deja pasar lo que Polar deja pasar (los iframes de Stripe). MaKo no tiene ese paquete y no vale una dependencia para esto.

import * as React from 'react'

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function FocusLock({ children, whiteList }: { children: React.ReactNode; whiteList?: (el: HTMLElement) => boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    const raiz = ref.current
    const primero = raiz?.querySelector<HTMLElement>(ENFOCABLES)
    if (raiz && !raiz.contains(document.activeElement)) primero?.focus()
    const alTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !raiz) return
      const activo = document.activeElement as HTMLElement | null
      if (activo && whiteList && !whiteList(activo)) return
      const todos = [...raiz.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((x) => x.offsetParent !== null)
      if (!todos.length) return
      const i = todos.indexOf(activo as HTMLElement)
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); todos[todos.length - 1].focus() }
      else if (!e.shiftKey && i === todos.length - 1) { e.preventDefault(); todos[0].focus() }
    }
    document.addEventListener('keydown', alTab, true)
    return () => { document.removeEventListener('keydown', alTab, true); antes?.focus?.() }
  }, [whiteList])
  return <div ref={ref}>{children}</div>
}
