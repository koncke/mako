'use client';

// =============================================================================
// El menú del teléfono se cierra al tocar una sección de la MISMA página (16/11/2026)
// =============================================================================
// «Recursos» lleva a dos secciones de la portada (Integraciones → /#integraciones, Preguntas frecuentes → /#preguntas) e
// «Industrias → Casos» a /#caso. Desde otra página eso es navegar y el menú se va con la página; ESTANDO en la portada el
// navegador sólo baja hasta la sección, y el <details> del menú —que nada más cierra su <summary>— quedaba abierto a pantalla
// completa, tapándola: se tocaba «Preguntas frecuentes» y no pasaba nada a la vista (medido con Playwright a 390, 16/11/2026).
// Acá, al tocar un link a una sección de esta misma página, el menú se cierra (y sus renglones desplegados, para la próxima vez);
// el navegador baja después, ya sin el `overflow:hidden` del menú abierto.
// Un componente y no un <script> suelto, por lo de ./Interactivos.tsx (React SÍ toma estas páginas). No agrega nodos: un <span>
// escondido para encontrar su <details>. Sin JavaScript, el menú queda como antes (abierto hasta tocar la ✕).
// =============================================================================

import { useEffect, useRef } from 'react';

/** ¿Este link lleva a una sección de la página que se está viendo (misma ruta y misma consulta, con `#`)? Puro: lo prueba el test. */
export function esSeccionDeEstaPagina(link: { origin: string; pathname: string; search: string; hash: string }, aqui: { origin: string; pathname: string; search: string }): boolean {
  return !!link.hash && link.hash !== '#' && link.origin === aqui.origin && link.pathname === aqui.pathname && link.search === aqui.search;
}

/** Va adentro del <details> del menú del teléfono (./Barra.tsx, `MenuMovil`). */
export function CerrarMenuMovil() {
  const marca = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const menu = marca.current?.closest('details');
    if (!menu) return;
    const alTocar = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(a instanceof HTMLAnchorElement) || !esSeccionDeEstaPagina(a, window.location)) return;
      menu.querySelectorAll('details[open]').forEach((d) => { (d as HTMLDetailsElement).open = false; });
      menu.open = false;
    };
    menu.addEventListener('click', alTocar);
    return () => menu.removeEventListener('click', alTocar);
  }, []);
  return <span ref={marca} hidden />;
}
