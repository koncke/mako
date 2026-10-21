'use client';

// =============================================================================
// EntradaMobile — la entrada de MaKo al abrir la app en el teléfono (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 2): «Que esa misma animación sea la que sale al iniciar la app en Mobile». Es la MISMA
// entrada del onboarding (app/onboarding/EntradaMako.tsx, con la estrella del Ops Center), no una copia.
//
// Dos decisiones, por criterio:
//   · UNA VEZ POR SESIÓN del navegador (sessionStorage): es la pantalla de arranque, no un peaje en cada pestaña. Sin
//     storage (navegación privada estricta) se muestra igual: lo peor es verla de más.
//   · TERMINA SOLA a los 2,4 s: acá es carga, no una conversación que espera. Tocarla la adelanta (EntradaMako empieza
//     con un toque en cualquier lado). En el onboarding, en cambio, espera el clic (Martín, 18/10, 14:00).
// ⚠️ La sesión ya vista NO depende de hidratar (revisión del Cerebro, 20/10): la capa viene en el HTML del server, y el
//    script de antes del primer pintado (./entrada.ts, en el layout) marca <html> para que el CSS la oculte desde el primer
//    cuadro. Acá sólo se desmonta. Sin JS, el CSS la esconde a los 6 s (app/m/m.css, `.m-entrada`).
// Sin `[data-mako-foto]` en /m, EntradaMako no vuela: se funde y avisa `onFin`.
// tests/movil-entrada.test.ts.
// =============================================================================

import { useEffect, useState } from 'react';
import { EntradaMako } from '@/app/onboarding/EntradaMako';
import { ATTR_ENTRADA_VISTA, CLAVE_ENTRADA_MOVIL } from './entrada';

export { CLAVE_ENTRADA_MOVIL } from './entrada';
const MS_ENTRADA_MOVIL = 2400;

export function EntradaMobile() {
  const [mostrar, setMostrar] = useState(true);
  useEffect(() => {
    // Ya vista: el script de antes de pintar la marcó y el CSS ni la dibujó; queda desmontarla.
    let vista = document.documentElement.hasAttribute(ATTR_ENTRADA_VISTA);
    try {
      vista = vista || sessionStorage.getItem(CLAVE_ENTRADA_MOVIL) === '1';
      sessionStorage.setItem(CLAVE_ENTRADA_MOVIL, '1');
    } catch { /* sin storage: se muestra igual */ }
    const t = window.setTimeout(() => setMostrar(false), vista ? 0 : MS_ENTRADA_MOVIL);
    return () => window.clearTimeout(t);
  }, []);
  if (!mostrar) return null;
  return <div className="m-entrada"><EntradaMako onFin={() => setMostrar(false)} /></div>;
}
