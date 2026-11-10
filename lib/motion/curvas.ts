// =============================================================================
// motion/curvas — las curvas de aceleración del motor de motion graphics
// =============================================================================
// Las mismas valen para el lienzo (el Video Editor, la miniatura) y para el CSS de la landing: el lienzo las evalúa con
// `aplicarCurva` y el CSS las escribe tal cual con `cssDeCurva`. Si una cambia, cambia acá para los dos.
//
// Los valores salen de las skills de iart-ai (MIT, Copyright (c) 2026 iart.ai, github.com/iart-ai/motion-skills),
// motion-design-skills/animation-principles/references/easing-curves.md y kinetic-typography:
//   · `salida` es el easeOutExpo que kinetic-typography recomienda para entrar («feels premium»);
//   · `quinta` (quintOut) es la entrada del tono corporativo; `estandar` (0.4, 0, 0.2, 1), la del premium;
//   · `cubica` (cubicOut) es la de un número que se asienta (data-animation: «settling on a number»);
//   · `cuarta` (quartOut) es la de las barras que crecen;
//   · `suave` (cubicInOut) es la de lo que se mueve en pantalla;
//   · `rebote` (backOut) se pasa y vuelve: sólo en los tonos enérgico y juguetón, nunca en un número;
//   · `sale` (quartIn) y `acelera` (0.4, 0, 1, 1) son para irse: una salida acelera, una entrada frena.
//
// El evaluador es el de WebKit (UnitBezier): Newton y, si no converge, bisección. Con eso el cuadro que dibuja el
// lienzo en el tiempo t es el mismo que el navegador pinta para `cubic-bezier(...)` en ese tiempo.
// =============================================================================

export const CURVAS = {
  salida: [0.16, 1, 0.3, 1],
  quinta: [0.22, 1, 0.36, 1],
  estandar: [0.4, 0, 0.2, 1],
  cubica: [0.33, 1, 0.68, 1],
  cuarta: [0.25, 1, 0.5, 1],
  suave: [0.65, 0, 0.35, 1],
  rebote: [0.34, 1.56, 0.64, 1],
  sale: [0.5, 0, 0.75, 0],
  acelera: [0.4, 0, 1, 1],
  lineal: [0, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type Curva = keyof typeof CURVAS;

/** `cubic-bezier(x1, y1, x2, y2)` para el CSS: el mismo número que evalúa el lienzo. */
export function cssDeCurva(c: Curva): string {
  const [a, b, d, e] = CURVAS[c];
  return `cubic-bezier(${a}, ${b}, ${d}, ${e})`;
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const resolverT = (xx: number): number => {
    let t = xx;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - xx;
      if (Math.abs(err) < 1e-7) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = xx;
    for (let i = 0; i < 50; i++) {
      const v = x(t);
      if (Math.abs(v - xx) < 1e-7) return t;
      if (xx > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (p: number) => y(resolverT(p));
}

const EVAL = Object.fromEntries(
  (Object.keys(CURVAS) as Curva[]).map((k) => {
    const [a, b, c, d] = CURVAS[k];
    return [k, k === 'lineal' ? (p: number) => p : bezier(a, b, c, d)];
  }),
) as Record<Curva, (p: number) => number>;

/**
 * El avance con la curva, para un avance lineal p en [0, 1]. Fuera de [0, 1] se pega al borde (un `interpolate` sin
 * tope extrapola y deja la opacidad en 1,3: la trampa que la skill de Remotion nombra).
 */
export function aplicarCurva(c: Curva, p: number): number {
  if (!(p > 0)) return 0;
  if (p >= 1) return 1;
  return EVAL[c](p);
}
