'use client'

// El `useTheme` de next-themes que usan los gráficos de Polar, contra el modo de MaKo: el oscuro es `data-tema="oscuro"`
// en <html> y lo elige la persona en la barra de MaKo (ModoDelUsuario). Se re-lee cuando el atributo cambia.

import { useEffect, useState } from 'react'

const leer = (): 'dark' | 'light' =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'dark' : 'light'

export function useTheme(): { resolvedTheme: 'dark' | 'light'; theme: 'dark' | 'light' } {
  const [t, setT] = useState<'dark' | 'light'>('light')
  useEffect(() => {
    setT(leer())
    const obs = new MutationObserver(() => setT(leer()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    return () => obs.disconnect()
  }, [])
  return { resolvedTheme: t, theme: t }
}
