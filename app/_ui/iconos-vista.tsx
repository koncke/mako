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
// ⚠️ El rótulo NO es decorativo. Un ícono sin texto necesita su tooltip y su
// `aria-label`. Y es el NOMBRE de la vista, corto: «Kanban», «Lista» (Martín, 21/10/2026:
// «el placeholder del "tablero" debe ser "kanban"... Esto en todos lados»). Lo dibuja
// el segmento compartido, ./SelectorVista.tsx.

import type { ReactNode } from 'react';

export type VistaIcono = 'tarjetas' | 'tabla' | 'kanban' | 'avance' | 'miembros' | 'grande' | 'compacta';

export const ICONO_VISTA: Record<VistaIcono, { titulo: string; icono: ReactNode }> = {
  tarjetas: {
    titulo: 'Tarjetas',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  tabla: {
    titulo: 'Lista',
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
    // «Kanban» a secas desde el 21/10/2026 (era «Ver en Kanban», y en el CRM «Tablero»).
    titulo: 'Kanban',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  avance: {
    // El AVANCE de los clientes en el curso (item 4 del 07/10/2026: «Que esa tab esté en la ruta de
    // clientes»). Barras de progreso de largo distinto: lo que la vista dice es CUÁNTO avanzó cada
    // uno, y ni los cubos ni las tres líneas parejas de la tabla lo cuentan. Lo ofrece SÓLO
    // Customer Success (kanban · tabla · avance): /admin y el CRM no tienen curso.
    titulo: 'Avance',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="9" y2="18" />
      </svg>
    ),
  },
  miembros: {
    // El DIRECTORIO de la comunidad del programa (29/10/2026: la sub-tab Members pasó a ser una vista de Clients, «Son lo
    // mismo, no deberían ser dos tabs»). Dos personas: lo que la vista lista es GENTE (el equipo y los alumnos, con su
    // nivel y si están en línea), no las tarjetas de la entrega ni las filas de la tabla. Lo ofrece sólo Clients.
    titulo: 'Miembros',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18.5 14.9c1.7.8 2.7 2.5 3 5.1" />
      </svg>
    ),
  },
  // Los dos TAMAÑOS de la grilla del explorador de carruseles (4/11/2026, app/image-editor/carruseles): la misma pregunta
  // («¿cómo miro esto?») con otra respuesta, así que va en este catálogo y no en un botón propio. Dos piezas verticales =
  // grande (se lee la portada); nueve cuadritos = compacta (se ven muchas a la vez).
  grande: {
    titulo: 'Grande',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="8" height="18" rx="1.5" /><rect x="13" y="3" width="8" height="18" rx="1.5" />
      </svg>
    ),
  },
  compacta: {
    titulo: 'Compacta',
    icono: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="4.5" height="4.5" rx="1" /><rect x="9.75" y="3" width="4.5" height="4.5" rx="1" /><rect x="16.5" y="3" width="4.5" height="4.5" rx="1" />
        <rect x="3" y="9.75" width="4.5" height="4.5" rx="1" /><rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" /><rect x="16.5" y="9.75" width="4.5" height="4.5" rx="1" />
        <rect x="3" y="16.5" width="4.5" height="4.5" rx="1" /><rect x="9.75" y="16.5" width="4.5" height="4.5" rx="1" /><rect x="16.5" y="16.5" width="4.5" height="4.5" rx="1" />
      </svg>
    ),
  },
};
