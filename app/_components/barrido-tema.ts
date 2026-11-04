// =============================================================================
// barrido-tema — el cambio de claro a oscuro: un círculo que se abre desde el botón que se tocó
// =============================================================================
// Martín, 31/10/2026: la misma animación de claro/oscuro en toda la app. Copiada de Code and Chill con sus valores,
// grabada en vivo (docs/diseno/oscuro-y-movimiento-medido.md): 450 ms con cubic-bezier(.65, 0, .35, 1), y el radio llega a
// la esquina MÁS LEJANA para que nunca quede un borde sin pintar.
//
// ⚠️ SIN LAS DOS REGLAS DE app/globals.css (`::view-transition-old/new(root)`) NO SE VE: el fundido que el navegador trae
//    por defecto tapa el barrido.
// ⚠️ Quien pidió menos movimiento, o un navegador sin la API: el cambio instantáneo, no una versión degradada.
// =============================================================================

type ConTransicion = Document & { startViewTransition?: (cambiar: () => void) => { ready: Promise<void> } };

export const DURACION_BARRIDO = 450;
export const CURVA_BARRIDO = 'cubic-bezier(.65, 0, .35, 1)';

export function conBarrido(boton: HTMLElement | null, cambiar: () => void): void {
  const doc = document as ConTransicion;
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cambiar();
    return;
  }
  const r = boton?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth - 40;
  const y = r ? r.top + r.height / 2 : 40;
  const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  doc.startViewTransition(cambiar).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
      { duration: DURACION_BARRIDO, easing: CURVA_BARRIDO, pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => { /* El navegador la saltó (otra transición, la pestaña oculta): el tema ya cambió igual. */ });
}
