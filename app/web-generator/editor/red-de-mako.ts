'use client';

// =============================================================================
// red-de-mako — la animación de la red de MaKo adentro del editor
// =============================================================================
// Martín (26/10/2026): «La animación que creo que es un SVG de MaKo no aparece, de la sección "¿Qué es MaKo... y por qué
// tu VSL Funnel lo necesita?"». No es un SVG: es un `<canvas data-animacion="mako-red">` que en la página publicada
// dibuja SCRIPT_DISENO (lib/editor-landing/html-editable.ts) con `window.MakoAnim` (/vsl-assets/mako-anim.js). Adentro
// del editor la sección es un iframe SIN scripts (nodos/HtmlEditableVista.tsx) y el canvas quedaba en blanco.
//
// ⚠️ PINTAR EN EL CANVAS DEL IFRAME NO SE VE (medido el 26/10/2026, en producción y en Chrome sin ventana): un iframe
// sin scripts no presenta lo que se le dibuja desde afuera, aunque el canvas tenga el dibujo (sus píxeles están, la
// pantalla no los muestra). Por eso la red va como el video: un canvas de ESTA página encima del lugar del canvas del
// diseño (HtmlEditableVista, `redes`), y se pinta ése. Sólo mientras se ve, y quieto con «reducir movimiento».
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
 * Anima la red en los canvas que devuelve `lienzos` (los de ESTA página, encima de cada canvas de la red del diseño; se
 * piden en cada cuadro porque React los vuelve a dibujar). Devuelve cómo pararla.
 */
export function animarRedDeMako(lienzos: () => HTMLCanvasElement[]): () => void {
  let vivo = true;
  let raf = 0;
  void cargar().then((anim) => {
    if (!anim || !vivo) return;
    let quieto = false;
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* sin matchMedia: se anima */ }
    const t0 = performance.now();
    const pintar = (ahora: number) => {
      if (!vivo) return;
      for (const cv of lienzos()) {
        const r = cv.getBoundingClientRect();
        // Fuera de la pantalla, no se pinta (la vuelta sigue, por si vuelve a verse).
        if (r.bottom < 0 || r.top > window.innerHeight || r.width < 2 || r.height < 2) continue;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = Math.round(r.width * dpr);
        const H = Math.round(r.height * dpr);
        if (cv.width !== W) cv.width = W;
        if (cv.height !== H) cv.height = H;
        const ctx = cv.getContext('2d');
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, r.width, r.height);
        try { anim.draw(ctx, quieto ? QUIETO_MS : (ahora - t0) % VUELTA_MS, r.width, r.height); } catch { /* un cuadro que falla no corta la vuelta */ }
      }
      raf = requestAnimationFrame(pintar);
    };
    raf = requestAnimationFrame(pintar);
  });
  return () => { vivo = false; cancelAnimationFrame(raf); };
}
