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
// Sin `[data-mako-foto]` en /m, EntradaMako no vuela: se funde y avisa `onFin`.
// tests/movil-entrada.test.ts.
// =============================================================================

import { useEffect, useState } from 'react';
import { EntradaMako } from '@/app/onboarding/EntradaMako';

export const CLAVE_ENTRADA_MOVIL = 'mako.entrada-movil';
const MS_ENTRADA_MOVIL = 2400;

export function EntradaMobile() {
  const [mostrar, setMostrar] = useState(true);
  useEffect(() => {
    let vista = false;
    try {
      vista = sessionStorage.getItem(CLAVE_ENTRADA_MOVIL) === '1';
      sessionStorage.setItem(CLAVE_ENTRADA_MOVIL, '1');
    } catch { /* sin storage: se muestra igual */ }
    const t = window.setTimeout(() => setMostrar(false), vista ? 0 : MS_ENTRADA_MOVIL);
    return () => window.clearTimeout(t);
  }, []);
  if (!mostrar) return null;
  return <EntradaMako onFin={() => setMostrar(false)} />;
}
