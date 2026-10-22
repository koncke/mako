'use client';

// =============================================================================
// La columna del Kanban por TANDAS: se dibujan 60 tarjetas y, al llegar al fondo, 60 más (22/10/2026)
// =============================================================================
// El sábado Mauricio abre «Sprint 3 días» con 1.050 leads en «Lead entrante» para mover 50 por día. El tablero dibujaba
// TODAS las tarjetas de una vez: medido con el arnés (tests/_crm-tablero-medir.mjs), 1.050 con foto y «Datos pendientes»
// tardaban 2,2 s en pintar y 3,6 s de tareas largas, y en el Chrome de Martín la pestaña de 300 quedó minutos sin
// responder. Ahora cada columna dibuja una tanda y suma otra cuando el final asoma (un IntersectionObserver sobre el carril,
// con margen) o con «Ver N más». Lo que NO cambia, porque no mira lo dibujado sino la lista entera (`cards`): el conteo de
// la columna, la casilla que tilda a todos, mover a los tildados y el orden al soltar.
// =============================================================================

import { useEffect, useRef } from 'react';
import { rotuloVerMas } from './columna-por-tandas';

export function FinDeColumna({ quedan, onVerMas }: { quedan: number; onVerMas: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pedir = useRef(onVerMas);
  useEffect(() => { pedir.current = onVerMas; }, [onVerMas]);
  // Al asomar (400 px antes del fondo del carril), la tanda siguiente. Si todavía no llena el carril, el observador vuelve
  // a avisar con la próxima, hasta que llena o no quedan.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) pedir.current(); },
      { root: el.closest('[data-carril]'), rootMargin: '0px 0px 400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [quedan]);
  return (
    <div ref={ref} data-fin-columna style={{ flex: 'none', display: 'flex', justifyContent: 'center', padding: '2px 0 6px' }}>
      <button type="button" data-nodrag onClick={onVerMas}
        style={{ border: 'none', background: 'transparent', padding: '6px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>
        {rotuloVerMas(quedan)}
      </button>
    </div>
  );
}
