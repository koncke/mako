// =============================================================================
// editor-rico-reglas — lo que DECIDE el editor rico, sin navegador y con test
// =============================================================================
// Las cuentas de app/_ui/EditorRico.tsx que no necesitan un DOM: qué botones de la barra entran y
// cuáles van a «Más», y cuánto mide una imagen. Viven aparte para que un test las EJECUTE: adentro
// del componente sólo se las podría mirar como texto. Sin 'use client' y sin imports de React ni de
// TipTap: las importan el editor y tests/editor-rico-barra.test.ts.

import { ANCHO_IMAGEN_MIN, ANCHO_IMAGEN_PASO } from './HtmlSeguro';

// ── La barra en un solo renglón ──────────────────────────────────────────────
// Pedido de Martín (08/10/2026, item 4): «Intenta que las opciones en la barra de edición no se
// salten de línea... Que si tiene mucho zoom que haya un desplegable».

/** Una pieza de la barra, como se MIDE: su ancho (borde a borde, en px CSS) y si es un separador. */
export type PiezaBarra = { ancho: number; sep?: boolean };

/**
 * Medio píxel de gracia: con zoom los anchos son fraccionarios (AGENTS.md, «con zoom los anchos son
 * FRACCIONARIOS»), y una pieza que se pasa por 0,3 px no se ve cortada. Lo que no se tolera es al
 * revés: decir que entra algo que no entra deja un botón cortado a la mitad.
 */
const TOLERANCIA = 0.5;

/**
 * ¿Cuántas piezas de la barra entran, desde la primera, en `disponible` px? Si no entran todas, la
 * última que se ve deja lugar para el botón «Más» (`anchoMas`), que va al final con todo lo demás.
 *
 * ⚠️ ES FUNCIÓN DE LO QUE NO CAMBIA AL DECIDIR (AGENTS.md, «una medición que CAMBIA lo que mide no
 *    puede decidir»): los anchos salen de una REGLA escondida que dibuja todas las piezas siempre
 *    (nunca de la barra, donde las que van a «Más» no están), y `disponible` es el ancho de la
 *    barra, que lo pone su contenedor y no su contenido. Mover piezas a «Más» no cambia ninguno de
 *    los dos, así que no hay ida y vuelta.
 * ⚠️ UN SEPARADOR NO QUEDA COLGANDO al final de lo que se ve: si el corte cae justo después de uno,
 *    se corre una pieza más. (Los del principio y el final de «Más» los saca `recortarSeparadores`.)
 */
export function repartoDeBarra(
  piezas: readonly PiezaBarra[],
  disponible: number,
  gap: number,
  anchoMas: number,
): { visibles: number; mas: boolean } {
  const n = piezas.length;
  if (!(disponible > 0)) return { visibles: 0, mas: n > 0 };
  // Lo que ocupan las primeras k piezas, con el hueco ENTRE ellas (no antes de la primera).
  const ocupa = (k: number): number => {
    let s = 0;
    for (let i = 0; i < k; i++) s += piezas[i].ancho + (i > 0 ? gap : 0);
    return s;
  };
  if (ocupa(n) <= disponible + TOLERANCIA) return { visibles: n, mas: false };
  let k = n - 1;
  while (k > 0 && ocupa(k) + gap + anchoMas > disponible + TOLERANCIA) k--;
  while (k > 0 && piezas[k - 1].sep) k--;
  // Un grupo no se parte dejando UNA pieza sola a la vista: «Alinear a la izquierda» suelto, con sus
  // tres hermanas en «Más», se lee como un botón que no se sabe qué hace. Se va con ellas.
  if (k >= 1 && (k === 1 || piezas[k - 2].sep) && k < n && !piezas[k].sep) {
    k--;
    while (k > 0 && piezas[k - 1].sep) k--;
  }
  return { visibles: k, mas: true };
}

/**
 * Lo que va adentro de «Más»: sin separadores al principio ni al final, y sin dos seguidos. Un
 * renglón divisor que no separa nada se lee como que falta algo.
 */
export function recortarSeparadores<T extends { sep?: boolean }>(lista: readonly T[]): T[] {
  const out: T[] = [];
  for (const x of lista) {
    if (x.sep && (!out.length || out[out.length - 1].sep)) continue;
    out.push(x);
  }
  while (out.length && out[out.length - 1].sep) out.pop();
  return out;
}

// ── El ancho de una imagen ───────────────────────────────────────────────────
// Pedido de Martín (08/10/2026, item 10): «Si subo una imagen en la descripción se ve enorme, no
// tengo manera de editar el tamaño». Los anchos que valen, en app/_ui/HtmlSeguro.tsx.

/** Lo más ancha que entra una imagen NUEVA: una captura de 1.920 px no entra a ocupar todo el texto. */
export const ANCHO_IMAGEN_NUEVA = 60;

/** Un ancho en % llevado al más cercano de la lista (de 10 a 100, de a 5). */
export function anchoValido(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  const paso = Math.round(pct / ANCHO_IMAGEN_PASO) * ANCHO_IMAGEN_PASO;
  return Math.max(ANCHO_IMAGEN_MIN, Math.min(100, paso));
}

/**
 * El ancho de una imagen que se está arrastrando de la esquina: `px` es el ancho que pide el
 * mouse y `contenido` el ancho del texto. Salta de a 5 —lo que se guarda—, así lo que se ve
 * mientras se arrastra es lo que queda al soltar.
 */
export function anchoDeArrastre(px: number, contenido: number): number {
  if (!(contenido > 0)) return 100;
  return anchoValido((px / contenido) * 100);
}

/**
 * El ancho con que ENTRA una imagen recién subida: su tamaño natural si es chica (un ícono de 120 px
 * no se estira a media pantalla), y nunca más de `ANCHO_IMAGEN_NUEVA`. Si no se pudo medir, ese
 * mismo tope: el caso que se reportó es el de la imagen gigante, no el de la chica.
 */
export function anchoInicialDeImagen(natural: number | null | undefined, contenido: number | null | undefined): number {
  if (!(typeof natural === 'number' && natural > 0) || !(typeof contenido === 'number' && contenido > 0)) return ANCHO_IMAGEN_NUEVA;
  return Math.min(ANCHO_IMAGEN_NUEVA, anchoValido((natural / contenido) * 100));
}
