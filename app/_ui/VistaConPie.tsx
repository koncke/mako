'use client';

// =============================================================================
// VistaConPie — una LISTA LARGA con sus ACCIONES ABAJO, adentro de un Modal (24/10/2026)
// =============================================================================
// El `pie` del Modal (app/_ui/Modal.tsx) es para botones que no dependen de lo que pasa adentro. Las vistas que eligen de
// una lista («Traer de otro funnel», «Traer de un grupo de WhatsApp») arman su pie con su propio estado —a qué etapa, con
// qué etiqueta, «Traer 221»— y por eso lo dibujan adentro del cuerpo. Ahí estaba el error, dos veces:
//   · 23/10, «Traer de otro funnel»: «se ven leads por detrás y debajo, y parece roto»;
//   · 24/10, «Traer de un grupo»: «los botones de abajo no pueden estar a la mitad y que abajo se sigan viendo leads».
// La causa fue la misma: el pie era `sticky` dentro del cuerpo del Modal, que es el que scrollea y tiene padding abajo, y
// las filas pasaban por esa franja. La segunda se había copiado de la primera ANTES de su arreglo.
//
// LA REGLA, en una sola pieza para que no quede una bien y otra mal: la vista mide el alto del cuerpo (`height: 100%`; el
// Modal tiene que tener `alto` fijo), la cabecera va arriba, la LISTA es la única que scrollea, y el pie es el último
// renglón, con fondo sólido. El `sticky` del pie queda de respaldo para un padre sin alto (el importador).

import type { CSSProperties, ReactNode } from 'react';

export function VistaConPie({ cabecera, children, pie, lista }: {
  /** Lo de arriba: los selectores, el buscador. No scrollea. */
  cabecera?: ReactNode;
  /** La lista: lo ÚNICO que scrollea. */
  children: ReactNode;
  /** Las acciones: el último renglón, siempre a la vista. */
  pie: ReactNode;
  /** Estilo extra de la caja de la lista (su borde, su radio). */
  lista?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, height: '100%' }}>
      {cabecera}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', ...lista }}>{children}</div>
      <div style={{ position: 'sticky', bottom: 0, zIndex: 2, flex: 'none', background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 0 0' }}>
        {pie}
      </div>
    </div>
  );
}
