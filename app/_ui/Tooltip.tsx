'use client';

// =============================================================================
// Tooltip — explica un ícono o una métrica, sin ocupar lugar
// =============================================================================
// Va en un portal con position:fixed, así no lo recorta ningún contenedor con
// overflow (el mismo problema que ya resolvió el Dropdown).
//
// REGLA: el tooltip NUNCA lleva información que no esté en otro lado. En un
// teléfono no hay hover, así que todo lo que solo viva acá desaparece. Sirve
// para la definición de un KPI, el nombre de un ícono, la fecha completa de un
// «hace 3 días» — nunca para una instrucción necesaria.

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ children, text, side = 'top' }: {
  children: ReactNode;
  text: ReactNode;
  side?: 'top' | 'bottom';
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);

  const abrir = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Se clampea al viewport: pegado al borde derecho, un tooltip ancho se salía
    // de la pantalla y quedaba ilegible.
    const left = Math.min(Math.max(10, r.left + r.width / 2), window.innerWidth - 10);
    setPos({ top: side === 'top' ? r.top - 8 : r.bottom + 8, left });
  };

  return (
    <>
      <span ref={ref} onMouseEnter={abrir} onMouseLeave={() => setPos(null)} onFocus={abrir} onBlur={() => setPos(null)}
        style={{ display: 'inline-flex', alignItems: 'center' }}>
        {children}
      </span>
      {pos && createPortal(
        <span role="tooltip" className="mk-tooltip"
          style={{ top: pos.top, left: pos.left, transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})` }}>
          {text}
        </span>,
        document.body,
      )}
    </>
  );
}
