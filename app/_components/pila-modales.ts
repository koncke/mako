'use client';

// =============================================================================
// pila-modales — un modal sobre otro: el de abajo se va, y al volver está igual
// =============================================================================
// LA REGLA (una sola, para toda la app): cuando se abre un modal sobre otro, el de
// abajo DESAPARECE de la pantalla. Al cerrar el de arriba, el de abajo vuelve — con
// el scroll exactamente donde estaba. Y encadenado: si abriste cuatro, cerrás cuatro
// veces y vas volviendo uno por uno.
//
// Qué NO hace, a propósito: no desmonta el de abajo. Desmontarlo pierde lo que había
// adentro —la revisión de una reunión con 30 tareas destildadas a mano, media
// búsqueda escrita, un formulario a medio llenar—, y eso es peor que el problema que
// resuelve. Se esconde con `display:none`, que saca el nodo del layout pero conserva
// su estado de React y su scrollTop.
//
// Por qué un store de módulo y no un contexto de React: estos modales se montan en
// árboles distintos (algunos con portal, otros no) y no siempre comparten un provider.
// Un store suelto con suscripción funciona desde cualquier lado y no obliga a envolver
// nada. Como la pila es una sola por pestaña, no hay riesgo de dos instancias.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

let pila: string[] = [];
const suscriptores = new Set<() => void>();
const avisar = () => { for (const f of suscriptores) f(); };

/** El id del modal que está arriba de todo (null si no hay ninguno abierto). */
export const modalDeArriba = (): string | null => (pila.length ? pila[pila.length - 1] : null);
/** Cuántos hay abiertos. Útil para bloquear el scroll del body una sola vez. */
export const profundidadModales = (): number => pila.length;

let n = 0;
const nuevoId = () => `m${++n}`;

/** Base del z-index. Cada nivel suma 2 para dejar lugar al backdrop de cada uno. */
const Z_BASE = 130;

export type CapaModal = {
  /** false = hay otro modal adelante. Pintá el tuyo con `display:none`, NO lo desmontes. */
  visible: boolean;
  /** el z-index que le toca a este nivel. */
  z: number;
  /** poné este ref en el contenedor que scrollea (el cuerpo del modal). */
  refScroll: (el: HTMLElement | null) => void;
  /** true si es el único abierto (para decidir si bloquear el scroll del body). */
  esElPrimero: boolean;
};

/**
 * Registra este modal en la pila mientras `abierto` sea true.
 *
 * Uso:
 *   const capa = useCapaModal(true);
 *   <div style={{ display: capa.visible ? 'flex' : 'none', zIndex: capa.z }}>
 *     <div ref={capa.refScroll} style={{ overflowY: 'auto' }}>…</div>
 *   </div>
 */
export function useCapaModal(abierto: boolean): CapaModal {
  const idRef = useRef<string>('');
  if (!idRef.current) idRef.current = nuevoId();
  const id = idRef.current;

  const [, forzar] = useState(0);
  const scrollEl = useRef<HTMLElement | null>(null);
  const scrollGuardado = useRef(0);
  const estabaVisible = useRef(true);

  useEffect(() => {
    const f = () => forzar((x) => x + 1);
    suscriptores.add(f);
    return () => { suscriptores.delete(f); };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    pila = [...pila.filter((x) => x !== id), id];
    avisar();
    return () => { pila = pila.filter((x) => x !== id); avisar(); };
  }, [abierto, id]);

  const idx = pila.indexOf(id);
  const visible = idx >= 0 && idx === pila.length - 1;

  // El scroll se guarda JUSTO ANTES de esconderse y se devuelve al volver. Hacerlo en
  // un layout effect (no en un effect normal) evita el parpadeo de un frame arriba de
  // todo antes de saltar a donde estabas.
  useEffect(() => {
    if (!estabaVisible.current && visible) {
      const el = scrollEl.current;
      if (el) {
        // Doble rAF: cuando el nodo vuelve de display:none todavía no tiene altura, y
        // asignar scrollTop en ese momento no hace nada.
        requestAnimationFrame(() => requestAnimationFrame(() => { if (scrollEl.current) scrollEl.current.scrollTop = scrollGuardado.current; }));
      }
    }
    if (estabaVisible.current && !visible && scrollEl.current) {
      scrollGuardado.current = scrollEl.current.scrollTop;
    }
    estabaVisible.current = visible;
  }, [visible]);

  const refScroll = useCallback((el: HTMLElement | null) => { scrollEl.current = el; }, []);

  return { visible, z: Z_BASE + Math.max(0, idx) * 2, refScroll, esElPrimero: idx === 0 };
}
