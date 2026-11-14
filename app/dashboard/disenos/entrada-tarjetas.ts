// =============================================================================
// entradaDeTarjetas — la entrada de las hojas cuya referencia no traía la suya (14/11/2026)
// =============================================================================
// Martín, 14/11/2026, mirando el carrusel de tableros de la portada: «hay algunos que todavía no tienen animación». Cold Calling,
// Comercial, General y Operación aparecían de golpe: el INFORME de su referencia no traía la entrada de la página, y no se había
// inventado una (lo dice el encabezado de cada hoja). Ésta es la de sus hermanas que sí la tienen (Cobranza, la de Coffer; y
// Marketing, la de Kestrel): las tarjetas suben escalonadas, una vez, al montarse. Medido en la grabación de la portada: antes, 2 a
// 4 cuadros cambiaban en toda la entrada; las hojas con entrada, 15 a 30.
// Sin movimiento si la persona lo pidió (prefers-reduced-motion) o si el navegador no tiene Element.animate.
// =============================================================================

/** power3.out, la curva de Coffer (HojaCobranza). */
const P3O = 'cubic-bezier(.215,.61,.355,1)';

/** Hace subir, escalonadas, las tarjetas de `raiz` que cumplen `selector` (opacity 0, y 34, scale .985 · .85 s · .06 desde .1). */
export function entradaDeTarjetas(raiz: HTMLElement | null, selector: string): void {
  if (!raiz || typeof raiz.animate !== 'function') return;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  raiz.querySelectorAll<HTMLElement>(selector).forEach((n, i) =>
    n.animate([{ opacity: 0, transform: 'translateY(34px) scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 850, easing: P3O, delay: 100 + i * 60, fill: 'backwards' }));
}
