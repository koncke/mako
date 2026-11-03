'use client';

// =============================================================================
// AparicionDeTab — la pantalla aparece al abrir una tab, en toda la app
// =============================================================================
// Martín, 31/10/2026: animación de aparición al abrir TODAS las tabs. Esto es decisión nuestra y no una copia: medido en
// Merrin, cambiar de pestaña no anima nada (docs/diseno/oscuro-y-movimiento-medido.md). De Corbel sale la curva.
//
// Sobre el `<main>` que ya está, sin envolverlo: un envoltorio con `key` por ruta volvería a montar la pantalla, y sólo
// OPACIDAD porque un `transform` en el `<main>` cambia a qué se ancla lo que adentro va `position: fixed`.
// No corre al cargar la página: lo que el server ya pintó se apagaría para volver a aparecer.
// =============================================================================

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export const DURACION_APARICION = 280;
export const CURVA_APARICION = 'cubic-bezier(.2, .8, .2, 1)';

export function AparicionDeTab() {
  const ruta = usePathname();
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelector('main')?.animate({ opacity: [0, 1] }, { duration: DURACION_APARICION, easing: CURVA_APARICION });
  }, [ruta]);
  return null;
}
