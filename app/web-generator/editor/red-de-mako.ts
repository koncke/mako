'use client';

// =============================================================================
// red-de-mako — la animación de la red de MaKo adentro del editor
// =============================================================================
// Martín (26/10/2026): «La animación que creo que es un SVG de MaKo no aparece, de la sección "¿Qué es MaKo... y por qué
// tu VSL Funnel lo necesita?"». No es un SVG: es un `<canvas data-animacion="mako-red">` que en la página publicada
// dibuja SCRIPT_DISENO (lib/editor-landing/html-editable.ts) con `window.MakoAnim` (/vsl-assets/mako-anim.js). Adentro
// del editor la sección es un iframe SIN scripts (nodos/HtmlEditableVista.tsx) y el canvas quedaba en blanco.
//
// El iframe es del mismo origen: esta ventana carga el mismo dibujante y pinta en SU canvas. Sólo mientras se ve (no
// gasta cuadros en una sección que está fuera de la pantalla), y quieto con «reducir movimiento», como la publicada.
// El canvas queda con `width`/`height` del dibujo: la vista los saca antes de guardar (no son del diseño).
// =============================================================================

type Dibujante = { draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void };

const SRC = '/vsl-assets/mako-anim.js';
/** La vuelta de la animación (DURATION de mako-anim.js): `draw` recibe un tiempo en [0, 9000). */
const VUELTA_MS = 9000;
/** El cuadro que se dibuja quieto (el de SCRIPT_DISENO con «reducir movimiento»). */
const QUIETO_MS = 7000;

let cargando: Promise<Dibujante | null> | null = null;
const dibujante = (): Dibujante | null => ((window as unknown as { MakoAnim?: Dibujante }).MakoAnim ?? null);

/** Carga /vsl-assets/mako-anim.js en esta ventana (una vez). */
function cargar(): Promise<Dibujante | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const ya = dibujante();
  if (ya) return Promise.resolve(ya);
  return (cargando ??= new Promise((listo) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => listo(dibujante());
    s.onerror = () => { cargando = null; listo(null); };
    document.head.appendChild(s);
  }));
}

/**
 * Anima los canvas de la red que hay en `doc` (el documento del iframe del diseño), con `marco` (el iframe) para saber
 * si se ven. Devuelve cómo pararla (el documento se rearma o la vista se va).
 */
export function animarRedDeMako(doc: Document, marco: HTMLElement): () => void {
  const lienzos = Array.from(doc.querySelectorAll<HTMLCanvasElement>('canvas[data-animacion="mako-red"]'));
  if (!lienzos.length) return () => {};
  let vivo = true;
  let raf = 0;
  void cargar().then((anim) => {
    if (!anim || !vivo) return;
    let quieto = false;
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* sin matchMedia: se anima */ }
    const t0 = performance.now();
    const pintar = (ahora: number) => {
      if (!vivo) return;
      const m = marco.getBoundingClientRect();
      for (const cv of lienzos) {
        if (!cv.isConnected) continue;
        const r = cv.getBoundingClientRect();
        // Fuera de la pantalla, no se pinta (la vuelta sigue, por si vuelve a verse).
        if (m.top + r.bottom < 0 || m.top + r.top > window.innerHeight) continue;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, r.width);
        const h = Math.max(1, r.height);
        const W = Math.round(w * dpr);
        const H = Math.round(h * dpr);
        if (cv.width !== W) cv.width = W;
        if (cv.height !== H) cv.height = H;
        const ctx = cv.getContext('2d');
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        try { anim.draw(ctx, quieto ? QUIETO_MS : (ahora - t0) % VUELTA_MS, w, h); } catch { /* un cuadro que falla no corta la vuelta */ }
      }
      if (lienzos.some((c) => c.isConnected)) raf = requestAnimationFrame(pintar);
    };
    raf = requestAnimationFrame(pintar);
  });
  return () => { vivo = false; cancelAnimationFrame(raf); };
}
