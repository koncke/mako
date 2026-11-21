// =============================================================================
// LA BARRA DE AVANCE DEL VIDEO: CLIC, ARRASTRE Y TECLADO (21/11/2026, el inventario de botones, tanda E)
// =============================================================================
// Era un `div` con `onClick`: se saltaba sólo con un clic, sin arrastrar ni con el teclado (no recibía el foco). Ahora es un slider: se
// arrastra (pointer capture) y con el foco, las flechas mueven ±5 s, Inicio va al principio y Fin al final. La usan el reproductor del
// chat (VideoDelMomento) y la barra del video del motor (BarraDelVideo). Las cuentas, puras: tests/inventario-tanda-e.test.ts.
// =============================================================================
import type { KeyboardEvent, PointerEvent } from 'react';

/** Cuánto mueve una flecha. */
export const SALTO_TECLA = 5;

/** El segundo que corresponde a un punto de la barra (arrastrar afuera no se pasa). */
export function segundoEnLaPista(x: number, caja: { left: number; width: number }, dur: number): number {
  if (!dur || caja.width <= 0) return 0;
  return Math.min(dur, Math.max(0, ((x - caja.left) / caja.width) * dur));
}

/** El segundo después de una tecla, o null si esa tecla no mueve la barra. */
export function segundoConTecla(tecla: string, t: number, dur: number): number | null {
  if (tecla === 'ArrowRight' || tecla === 'ArrowUp') return Math.min(dur, t + SALTO_TECLA);
  if (tecla === 'ArrowLeft' || tecla === 'ArrowDown') return Math.max(0, t - SALTO_TECLA);
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return dur;
  return null;
}

const mmss = (s: number) => { const t = Math.max(0, Math.round(s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/** Las props de la barra (`<div className="mk-vmom__pista" {...propsDePista(…)}>`): sin hooks, para el reproductor que sea. */
export function propsDePista(o: { video: () => HTMLVideoElement | null; dur: number; t: number }) {
  const ir = (x: number, el: HTMLElement) => {
    const v = o.video();
    if (!v || !o.dur) return;
    v.currentTime = segundoEnLaPista(x, el.getBoundingClientRect(), o.dur);
  };
  return {
    role: 'slider', tabIndex: 0,
    'aria-label': 'Avance del video', 'aria-valuemin': 0, 'aria-valuemax': Math.round(o.dur), 'aria-valuenow': Math.round(o.t),
    'aria-valuetext': `${mmss(o.t)} de ${mmss(o.dur)}`,
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); ir(e.clientX, e.currentTarget); },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture?.(e.pointerId)) ir(e.clientX, e.currentTarget); },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const v = o.video();
      if (!v || !o.dur) return;
      const s = segundoConTecla(e.key, v.currentTime, o.dur);
      if (s == null) return;
      e.preventDefault();
      v.currentTime = s;
    },
  } as const;
}
