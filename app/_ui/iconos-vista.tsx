// =============================================================================
// Los íconos de «cómo quiero ver esto»: tarjetas, tabla, kanban
// =============================================================================
// Viven acá y no en la pantalla que los estrenó porque los usan DOS tableros —el
// de Customer Success y el del CRM— y van a ser tres. Un ícono copiado es un
// ícono que diverge: alcanza con que alguien ajuste el ancho de una barra en uno
// de los dos para que el toggle del CRM y el de Customer Success dejen de ser «el
// mismo control» y pasen a ser dos parecidos.
//
// Son SÓLO los dibujos y sus rótulos. El estilo del botón lo pone cada barra, que
// es lo correcto: el CRM tiene su segmento con `--ink` y Customer Success su
// `.bc-toggle`, y unificar eso sería una decisión de diseño que nadie tomó.
//
// ⚠️ El rótulo NO es decorativo. Un ícono sin texto necesita su `title` y su
// `aria-label`: ahí sí va una frase, porque no ocupa un píxel.

import type { ReactNode } from 'react';

export type VistaIcono = 'tarjetas' | 'tabla' | 'kanban';

export const ICONO_VISTA: Record<VistaIcono, { titulo: string; icono: ReactNode }> = {
  tarjetas: {
    titulo: 'Ver en tarjetas',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  tabla: {
    titulo: 'Ver en tabla',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
  kanban: {
    // Los CUATRO cubos, los mismos del Plan (`app/plan/board/BoardShell.tsx:2378`).
    // Pedido de Martín (05/10): «el ícono de kanban debería ser como en el plan, que
    // son cubos. Y el placeholder debería ser "Ven en Kanban"» — con «Ver», que es el
    // molde de los otros dos rótulos de este mismo catálogo.
    //
    // ⚠️ ES EL MISMO DIBUJO QUE `tarjetas`, Y NO ES UN DESCUIDO. Un toggle de DOS
    // vistas —el Plan, el CRM y Customer Success (kanban + tabla)— no tiene una vista
    // «tarjetas» de la que distinguirse: ahí el tablero ES las tarjetas y el cubo es lo
    // que la persona reconoce. /admin ofrece tarjetas + tabla, sin kanban. Si algún día
    // una pantalla ofrece kanban Y tarjetas a la vez, ESA necesita otro dibujo para uno
    // de los dos: por eso las dos entradas conviven y no son una.
    // (Customer Success dejó de tener su propia copia de estos íconos el 05/10/2026.)
    titulo: 'Ver en Kanban',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
};
