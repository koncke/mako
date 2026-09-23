'use client';

// =============================================================================
// arrastre-tactil — mover una tarjeta del Kanban CON EL DEDO
// =============================================================================
// El arrastre del tablero es HTML5 drag-and-drop, que en touch no dispara nunca: con el
// dedo no pasaba nada. Esto agrega un camino por POINTER EVENTS que corre SÓLO cuando el
// puntero no es un mouse, así que el desktop sigue exactamente igual — el riesgo entero
// del cambio queda del lado nuevo.
//
// Las cuatro trampas que este archivo esquiva, todas ya pagadas en este repo:
//
//  1. ⚠️ NADA DE `setPointerCapture`. Capturar en la tarjeta redirige TODOS los eventos
//     siguientes —incluido el `click`— al elemento que capturó, y la tarjeta tiene cuatro
//     clicks adentro que dependen de burbujear (abrir el detalle, el chip del proyecto, el
//     aviso de la fecha y «Completar»). Se romperían los cuatro, en silencio. Acá los
//     listeners viven en `window` y se arman sólo mientras dura el gesto.
//
//  2. ⚠️ NADA DE `touch-action: none` en la tarjeta. Es CSS: decide ANTES de que exista el
//     listener, así que apagaría el scroll de la página sobre cada tarjeta — y en el plan
//     el que scrollea es la PÁGINA, no la columna. Lo que frena el scroll una vez que el
//     gesto se armó es un `touchmove` con `{ passive: false }` registrado a mano: el
//     `onTouchMove` de React 19 se registra pasivo en la raíz y no puede `preventDefault`.
//
//  3. ⚠️ LONG-PRESS, NO UMBRAL. A ≤560px el tablero colapsa a UNA columna, así que el
//     scroll vertical es el único modo de llegar a la columna de destino: un arrastre que
//     se arme con mover el dedo se roba la navegación de la pantalla. Acá se arma
//     manteniendo 300 ms quieto; si el dedo se mueve más de 10 px antes, era un scroll.
//
//  4. ⚠️ EL CLICK FANTASMA. Después de un arrastre el navegador sintetiza un `click` sobre
//     donde empezó el toque — o sea, se soltaba la tarjeta, salía el pop-up, y detrás se
//     abría el detalle. `huboArrastre()` lo traga durante medio segundo.
//
// Y una decisión de producto que no se toca: soltar NO fija el número. La columna dice la
// BANDA y el número lo elige la persona en el pop-up (`MoverPrioridadModal`).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Prio } from './types';

/** Cuánto hay que mantener el dedo quieto para que esto deje de ser un scroll. */
const MS_ARMAR = 300;
/** Si se mueve más que esto antes de armarse, era un scroll (se compara al cuadrado). */
const PX_CANCELA2 = 10 * 10;
/** Franja de la ventana donde el arrastre empuja el scroll, y cuánto empuja por frame. */
const BORDE = 90;
const PASO = 14;

type Gesto = {
  id: string;
  x0: number;
  y0: number;
  armado: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  cols: Array<{ prio: Prio; top: number; bottom: number; left: number; right: number }>;
};

export type ArrastreTactil = {
  /** va en el `onPointerDown` de la tarjeta */
  alTocar: (e: React.PointerEvent, id: string) => void;
  /** el id que se está arrastrando ahora (para levantarla visualmente) */
  arrastrando: string | null;
  /** sobre qué columna está el dedo (para pintarla) */
  sobre: Prio | null;
  /** ¿el último gesto fue un arrastre? Sirve para tragarse el click fantasma. */
  huboArrastre: () => boolean;
};

/**
 * @param onSoltar  se llama SÓLO si la tarjeta terminó sobre una columna DISTINTA.
 * @param prioDe    en qué columna está hoy esa tarjeta (para no abrir el pop-up al soltarla
 *                  donde ya estaba: con el dedo, un gesto de 15 px que no llegó a ningún
 *                  lado pasa todo el tiempo).
 * @param activo    si el tablero no puede escribir la prioridad, no hay arrastre.
 */
export function useArrastreTactil(
  onSoltar: (id: string, destino: Prio) => void,
  prioDe: (id: string) => Prio | null,
  activo = true,
): ArrastreTactil {
  const gesto = useRef<Gesto | null>(null);
  const finArrastre = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  const scrollDir = useRef(0);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Prio | null>(null);

  const pararScroll = useCallback(() => {
    if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = null;
    scrollDir.current = 0;
  }, []);

  const limpiar = useCallback(() => {
    if (gesto.current?.timer) clearTimeout(gesto.current.timer);
    gesto.current = null;
    pararScroll();
    setArrastrando(null);
    setSobre(null);
  }, [pararScroll]);

  // Los listeners viven acá y no en la tarjeta: el gesto tiene que sobrevivir a que React
  // vuelva a dibujar la card (pasa en cuanto el tablero se actualiza) y a que el dedo se
  // salga de ella, que es justamente lo que un arrastre hace.
  useEffect(() => {
    if (!activo) return;

    // `passive: false` es el punto entero de registrarlo a mano: es lo único que puede
    // frenar el scroll de la página una vez que el gesto se armó.
    const alMoverTouch = (e: TouchEvent) => { if (gesto.current?.armado) e.preventDefault(); };

    const tick = () => {
      if (!scrollDir.current) { scrollRaf.current = null; return; }
      window.scrollBy(0, scrollDir.current * PASO);
      scrollRaf.current = requestAnimationFrame(tick);
    };

    const alMover = (e: PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (!g.armado) {
        // Todavía no es un arrastre: si el dedo se fue, era scroll.
        if (dx * dx + dy * dy > PX_CANCELA2) limpiar();
        return;
      }
      // Armado: qué columna hay debajo del dedo, con los rectángulos que se midieron al
      // armar (leer layout en cada movimiento es lo que hace que un arrastre se sienta
      // pegajoso).
      const col = g.cols.find((c) => e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom);
      setSobre(col ? col.prio : null);
      // Empujar la página cuando el dedo llega al borde. Sin esto, en un celular —donde las
      // cuatro columnas quedan una arriba de otra— la columna de destino está fuera de la
      // pantalla y no hay forma de llegar.
      const dir = e.clientY < BORDE ? -1 : e.clientY > window.innerHeight - BORDE ? 1 : 0;
      if (dir !== scrollDir.current) {
        scrollDir.current = dir;
        if (dir && scrollRaf.current == null) scrollRaf.current = requestAnimationFrame(tick);
      }
    };

    const alSoltar = (e: PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      if (g.armado) {
        // Medio segundo de gracia para tragarse el `click` que el navegador sintetiza
        // después de un arrastre táctil.
        finArrastre.current = performance.now();
        const col = g.cols.find((c) => e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom);
        const destino = col?.prio ?? null;
        const id = g.id;
        limpiar();
        // Soltarla donde ya estaba no es mover nada: no se abre ningún pop-up.
        if (destino && destino !== prioDe(id)) onSoltar(id, destino);
        return;
      }
      limpiar();
    };

    // `pointercancel` no es un detalle: lo manda el navegador cuando el scroll se gana el
    // gesto, cuando entra una llamada o con cualquier gesto del sistema. Sin manejarlo, la
    // columna queda pintada y el ref del arrastre armado para siempre.
    const alCancelar = () => limpiar();

    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', alCancelar);
    document.addEventListener('touchmove', alMoverTouch, { passive: false });
    return () => {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alCancelar);
      document.removeEventListener('touchmove', alMoverTouch);
      pararScroll();
    };
  }, [activo, limpiar, onSoltar, prioDe, pararScroll]);

  const alTocar = useCallback((e: React.PointerEvent, id: string) => {
    // El mouse sigue por HTML5 drag-and-drop, que ya funciona y ya está probado.
    if (!activo || e.pointerType === 'mouse') return;
    if (gesto.current?.timer) clearTimeout(gesto.current.timer);
    const x0 = e.clientX;
    const y0 = e.clientY;
    gesto.current = {
      id, x0, y0, armado: false, cols: [],
      timer: setTimeout(() => {
        const g = gesto.current;
        if (!g) return;
        // Recién acá se miden las columnas: en el pointerdown la página todavía se puede
        // haber movido, y durante el arrastre no se vuelve a leer layout.
        g.cols = [...document.querySelectorAll<HTMLElement>('[data-prio]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { prio: el.dataset.prio as Prio, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        });
        g.armado = true;
        setArrastrando(g.id);
        // Un golpecito háptico para que se entienda que la tarjeta se levantó. Si el
        // navegador no lo soporta, no pasa nada.
        try { navigator.vibrate?.(12); } catch { /* no todos lo tienen */ }
      }, MS_ARMAR),
    };
  }, [activo]);

  const huboArrastre = useCallback(() => performance.now() - finArrastre.current < 500, []);

  return { alTocar, arrastrando, sobre, huboArrastre };
}
