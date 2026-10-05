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
    // Tres columnas de alto distinto: el ícono dice que lo que se agrupa son ETAPAS.
    titulo: 'Ver en etapas',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="5" height="18" rx="1.5" /><rect x="10" y="3" width="5" height="12" rx="1.5" /><rect x="17" y="3" width="4" height="8" rx="1.5" />
      </svg>
    ),
  },
};
