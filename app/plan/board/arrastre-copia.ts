'use client';

// =============================================================================
// arrastre-copia — la copia que sigue al cursor, y el empuje del scroll
// =============================================================================
// El molde del arrastre con mouse del tablero del PLAN. Vivía adentro de
// `BoardShell.tsx` y salió a su propio módulo el 05/10/2026, cuando el kanban de la
// ENTREGA (app/customer-success/KanbanEntrega.tsx) tuvo que arrastrar igual: «la
// animación de arrastrar tarjetas por el kanban, eso replicalo tal cual de como lo
// hacemos en PLAN» (Martín). Replicar escribiendo el segundo es cómo se queda viejo
// uno de los dos; acá se importa el mismo.
//
// Es GENÉRICO a propósito: no sabe de tareas, ni de proyectos, ni de clientes. Recibe
// un nodo y dos offsets.
//
// ─────────────────────────────────────────────────────────────────────────────
// LO QUE ESTÁ MEDIDO Y NO SE TOCA
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ LA FOTO LA PINTA EL SISTEMA OPERATIVO y no la gobierna ninguna regla CSS: en
// Windows, Chrome la dibuja translúcida y la ancla donde quiere. `setDragImage(nodo)`
// cambia QUÉ se fotografía, no CÓMO se pinta — por eso se le pasa una de 1×1 y la copia
// de verdad la montamos nosotros.
//
// ⚠️ LA COPIA SE MUEVE ESCRIBIENDO `transform` SOBRE UN REF, NUNCA CON `setState`: un
// `setState` por `dragover` redibuja el tablero sesenta veces por segundo, que es el bug
// que hizo que el arrastre se sintiera roto tres rondas seguidas. Y `transition: none`
// es obligatorio: con transición, la copia va atrás del cursor.
//
// ⚠️ EL LISTENER VA EN `document` Y EN CAPTURA. El `dragover` de las columnas no cubre
// los huecos entre ellas ni el fondo de la página, y ahí la copia se queda clavada. Se
// limpia en `dragend` Y en `drop`, los dos, o queda un nodo colgado por arrastre.
//
// ⚠️ EL AUTO-SCROLL VA ADENTRO DEL `dragover`. Medido el 23/09/2026: mientras Chrome
// corre su bucle nativo de arrastre no entrega frames de animación ni corre los timers —
// sobre `requestAnimationFrame`, 1,2 s en el borde movieron 0 px (y su único tick llegó
// DESPUÉS de soltar); con `setInterval`, 0 px y 112 px largados con el gesto terminado.
// Lo único que el navegador sigue entregando es `dragover`.

import { useCallback, useEffect, useRef } from 'react';

/**
 * LA FOTO QUE EL SISTEMA OPERATIVO PINTA DETRÁS DEL CURSOR, VACÍA.
 *
 * Está suelta —y no adentro del hook— porque la llama el `dragstart` de cada TARJETA y
 * el hook vive en el contenedor. Un segundo `try/catch` copiado es el que se queda sin
 * el `catch` la primera vez que alguien lo toca.
 */
export function fotoVaciaDeArrastre(dt: DataTransfer) {
  try {
    const vacio = document.createElement('canvas');
    vacio.width = 1; vacio.height = 1;
    dt.setDragImage(vacio, 0, 0);
  } catch { /* si no deja, queda la del navegador y se ve como antes */ }
}

/**
 * El contenedor que REALMENTE scrollea en vertical, o `null` para la ventana.
 *
 * Existe porque el tablero del PLAN también vive adentro de la ficha de un cliente,
 * donde el `Modal` de la casa pone `body { overflow: hidden }` y el que scrollea pasa a
 * ser `.mk-modal__cuerpo`.
 *
 * ⚠️ MIRA SÓLO `overflowY`. Un riel horizontal (`overflow-x: auto; overflow-y: hidden`)
 * NO es un scroller para esta función y devuelve `null` — el empuje horizontal lo hace
 * quien lo tenga, adentro de su propio `dragover`.
 */
export function scrollerDe(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;  // la página: se sigue usando `window`, igual que siempre
}

export function useArrastreCopia() {
  const scrollDir = useRef(0);
  /** Quién scrollea en ESTE arrastre. `null` = la ventana, que es el caso de `/plan`. */
  const scroller = useRef<HTMLElement | null>(null);
  const pararScroll = useCallback(() => { scrollDir.current = 0; }, []);
  const empujarScroll = useCallback((clientY: number) => {
    const BORDE = 110;
    const sc = scroller.current;
    // El borde se mide contra la caja del que scrollea, no contra el viewport: adentro de
    // un modal el tablero empieza 90 px más abajo y termina 90 px más arriba.
    const arriba = sc ? sc.getBoundingClientRect().top : 0;
    const abajo = sc ? sc.getBoundingClientRect().bottom : window.innerHeight;
    const dir = clientY < arriba + BORDE ? -1 : clientY > abajo - BORDE ? 1 : 0;
    scrollDir.current = dir;
    if (!dir) { pararScroll(); return; }
    if (sc) sc.scrollTop += dir * 18; else window.scrollBy(0, dir * 18);
  }, [pararScroll]);
  useEffect(() => () => pararScroll(), [pararScroll]);

  const copia = useRef<HTMLElement | null>(null);
  const soltarCopia = useCallback(() => { copia.current?.remove(); copia.current = null; }, []);
  useEffect(() => soltarCopia, [soltarCopia]);

  const montarCopia = useCallback((origen: HTMLElement, dx: number, dy: number) => {
    soltarCopia();
    // Quién scrollea se decide acá, en el `dragstart`, y vale para todo el gesto.
    scroller.current = scrollerDe(origen);
    const r = origen.getBoundingClientRect();
    const nodo = origen.cloneNode(true) as HTMLElement;
    const fondo = getComputedStyle(origen).backgroundColor;
    Object.assign(nodo.style, {
      position: 'fixed', top: '0', left: '0', margin: '0',
      width: `${r.width}px`, height: `${r.height}px`,
      // Opaca de verdad: si el fondo computado fuese transparente, la copia deja ver el
      // tablero por debajo y se ve igual de fantasmal que la del navegador.
      background: fondo && fondo !== 'rgba(0, 0, 0, 0)' ? fondo : 'var(--surface-2)',
      opacity: '1', pointerEvents: 'none', zIndex: '3000',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', transform: `translate3d(${r.left}px, ${r.top}px, 0) rotate(1.5deg)`,
      transition: 'none', cursor: 'grabbing',
    });
    document.body.appendChild(nodo);
    copia.current = nodo;
    const mover = (e: DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', mover, true); return; }
      copia.current.style.transform = `translate3d(${e.clientX - dx}px, ${e.clientY - dy}px, 0) rotate(1.5deg)`;
    };
    document.addEventListener('dragover', mover, true);
    // Se saca en `dragend` Y en `drop`, los dos, o queda un nodo colgado por arrastre.
    const fin = () => {
      document.removeEventListener('dragover', mover, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      soltarCopia();
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
  }, [soltarCopia]);

  return { empujarScroll, pararScroll, montarCopia, soltarCopia };
}
