// =============================================================================
// iconos — los íconos chicos de la comunidad (el set de la app no tiene pulgar, globo ni chinche)
// =============================================================================
// Vivían adentro de ./piezas.tsx ('use client', con el contexto, el menú y la pila de modales). Se
// mudaron acá el 16/10/2026 porque desde ese día los dibuja una SEGUNDA pantalla: la Comunidad del
// teléfono (app/m/comunidad). AGENTS.md, «MaKo Mobile (/m)»: lo que una pantalla de /m reusa de
// escritorio no vive en un módulo 'use client' (el teléfono se llevaba la comunidad entera de escritorio
// al paquete por un ícono). ./piezas.tsx lo re-exporta: lo que ya importaba `Ico` de ahí sigue igual.
//
// Sin 'use client' ni 'server-only': es un componente sin estado (se dibuja en el server y en el
// navegador). Un nombre que no está acá dibuja un SVG vacío: `NOMBRES_ICO` es la lista que los tests
// cruzan contra lo que cada pantalla pide.

import type { ReactNode } from 'react';

const TRAZOS: Record<string, ReactNode> = {
  like: (<path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10H7Zm0 0 4-7a2.2 2.2 0 0 1 2.6 2.7L12.8 9H18a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7" />),
  comentario: (<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16h0A1.5 1.5 0 0 1 4 14.5v-9Z" />),
  pin: (<><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" /><path d="M12 14v7" /></>),
  clip: (<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5L20 14" />),
  video: (<><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10.5 5-3v9l-5-3" /></>),
  encuesta: (<><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>),
  puntos: (<g fill="currentColor" stroke="none"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></g>),
  candado: (<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  archivo: (<><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /></>),
  x: (<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />),
  lapiz: (<><path d="M4 20l3.6-.9L18.2 8.5 15.5 5.8 4.9 16.4 4 20Z" /><path d="M14 7.3 16.7 10" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  // La segunda mitad: la campana, el calendario, la lupa, el reloj, el lugar y las flechas del mes.
  campana: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  campanaOff: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /><path d="M4 4l16 16" /></>),
  calendario: (<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4M16 3v4" /></>),
  lupa: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  reloj: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  lugar: (<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>),
  izq: (<path d="m14.5 6-6 6 6 6" />),
  der: (<path d="m9.5 6 6 6-6 6" />),
  repetir: (<><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3" /><path d="M20 13v2a3 3 0 0 1-3 3H5l3 3" /></>),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8h.01" /></>),
};

/** Los nombres que existen. Uno que no está dibuja un SVG vacío, sin error. */
export const NOMBRES_ICO: readonly string[] = Object.freeze(Object.keys(TRAZOS));

export function Ico({ n, size = 18 }: { n: keyof typeof TRAZOS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ flex: 'none' }}>
      {TRAZOS[n] ?? null}
    </svg>
  );
}
