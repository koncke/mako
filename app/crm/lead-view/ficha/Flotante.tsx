'use client';

// =============================================================================
// ficha/Flotante — el menú anclado de la edición de la ficha (el mismo molde que el del Dashboard)
// =============================================================================
// Es una copia corta de `Flotante` (app/dashboard/Galeria.tsx): importar aquel arrastra la galería entera
// de gráficos al pop-up de la ficha. Va por portal al body, anotado en la pila de modales: el Escape lo
// cierra a ÉL y no a la ficha, y un clic afuera lo cierra (AGENTS.md, popovers anclados).
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';

export function Flotante({ ancla, onCerrar, ancho, etiqueta, children }: {
  ancla: HTMLElement;
  onCerrar: () => void;
  ancho: number;
  /** El nombre del menú para un lector de pantalla. */
  etiqueta: string;
  children: ReactNode;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; alto: number } | null>(null);
  const cerrar = useRef(onCerrar);
  useLayoutEffect(() => { cerrar.current = onCerrar; });
  useLayoutEffect(() => {
    const ubicar = () => {
      if (!ancla.isConnected) { cerrar.current(); return; }
      const r = ancla.getBoundingClientRect();
      const alto = ref.current?.offsetHeight ?? 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(ancho, vw - 16);
      const left = Math.min(Math.max(8, r.left), vw - w - 8);
      const abajo = r.bottom + 6;
      const libre = vh - abajo - 8;
      const top = alto > libre && r.top - alto - 6 > 8 ? r.top - alto - 6 : abajo;
      setPos({ left, top, alto: Math.max(160, top === abajo ? libre : r.top - 14) });
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ancla, ancho]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla.contains(t)) return;
      cerrar.current();
    };
    // ⚠️ `stopImmediatePropagation`: el Escape de la ficha escucha en captura, y sin esto cerrar el menú
    //    cerraría también el pop-up entero.
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && esArriba()) { e.stopImmediatePropagation(); e.preventDefault(); cerrar.current(); } };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, esArriba]);
  return createPortal(
    // El clic no sube al fondo del pop-up de la ficha (que lo cierra): los eventos de React siguen el árbol, no el DOM.
    <div ref={ref} role="dialog" aria-label={etiqueta} className="fb-flotante" onClick={(e) => e.stopPropagation()}
      style={{ zIndex: capa.z, left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(ancho, typeof window === 'undefined' ? ancho : window.innerWidth - 16), maxHeight: pos?.alto ?? 400, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}
