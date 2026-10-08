// =============================================================================
// dropdown-lugar — hacia dónde abre el menú de un desplegable, y cuánto alto le queda (puro)
// =============================================================================
// Pedido de Martín (08/10/2026, item 7 del curso tipo Skool), con la captura del selector del tipo
// de campo de una tarea cortado abajo: «Revisa que el desplegable de las opciones del tipo de
// pregunta se corta a la mitad... Si no hay espacio debería abrirse para arriba».
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: el menú YA se daba vuelta (`Dropdown.tsx`), con una regla
//    de un número: «arriba si abajo quedan menos de 300 px y arriba hay más». El menú de una lista
//    mide hasta 340 px (más con el buscador, que aparece pasadas las 8 opciones: los 17 tipos de campo
//    lo traen), así que con 300 a 345 px libres abajo abría para abajo y se cortaba; y con menos de 300
//    abajo pero el botón en la mitad de una ventana baja («arriba» apenas más chico), también. La regla
//    no miraba lo único que decide: CUÁNTO MIDE el menú. Y el alto máximo era fijo, así que aun del
//    lado bueno podía pasarse de la ventana.
//
// La regla de acá: abajo si ENTRA abajo; si no, arriba si entra arriba; si no entra en ninguno, del
// lado con más lugar — y en los tres casos el menú se topa al lugar que tiene (`espacio`), así que
// nunca se sale de la ventana. El alto es el MEDIDO (el contenido entero, `scrollHeight`), que no
// depende del lado: decidir con algo que cambia al decidir es un ping-pong (AGENTS.md, «una medición
// que CAMBIA lo que mide no puede decidir»).
//
// Sin 'use client' y sin React: lo EJECUTA tests/dropdown-lugar.test.ts.

/** La separación entre el botón y el menú (la que ya usaba `Dropdown`). */
export const SEPARACION_MENU = 6;
/** Lo que el menú deja libre contra el borde de la ventana. */
export const MARGEN_MENU = 12;
/**
 * El relleno y el borde de la caja del menú (6 + 6 de `padding`, 1 + 1 de borde en `Dropdown`). El alto
 * máximo es del CONTENIDO (`box-sizing: content-box`): para que la caja entera entre en `espacio`, al
 * contenido le toca eso menos esto. Medido en el banco: sin restarlo, un menú topado a 342 medía 354 y
 * tocaba el borde de la ventana.
 */
export const CAJA_MENU = 14;

export type LugarMenu = { arriba: boolean; espacio: number };

/**
 * Hacia dónde abre el menú y cuánto alto tiene ahí, desde la caja del botón (`top`/`bottom`, en
 * coordenadas de la ventana) y el alto de la ventana.
 *
 * `alto` = lo que mide el menú entero. `null` = todavía no se midió (el primer cuadro, antes de que el
 * menú exista): ahí se usa la regla de siempre, y el efecto que mide lo vuelve a ubicar antes de pintar.
 */
export function lugarDelMenu(p: { top: number; bottom: number; ventana: number; alto: number | null }): LugarMenu {
  const abajo = p.ventana - p.bottom - SEPARACION_MENU - MARGEN_MENU;
  const arriba = p.top - SEPARACION_MENU - MARGEN_MENU;
  let haciaArriba: boolean;
  if (p.alto == null || !Number.isFinite(p.alto)) {
    const libre = p.ventana - p.bottom;
    haciaArriba = libre < 300 && p.top > libre;
  } else if (p.alto <= abajo) {
    haciaArriba = false;
  } else if (p.alto <= arriba) {
    haciaArriba = true;
  } else {
    haciaArriba = arriba > abajo;
  }
  return { arriba: haciaArriba, espacio: Math.max(0, Math.floor(haciaArriba ? arriba : abajo)) };
}

/**
 * El alto máximo del menú: su tope de diseño, pero nunca más que el lugar que tiene (`espacio`), y
 * nunca menos que un piso que deje ver unas opciones (con menos lugar que eso, scrollea adentro).
 */
export function altoMaximoDelMenu(tope: number, espacio: number | undefined, piso = 120): number {
  if (espacio == null || !Number.isFinite(espacio)) return tope;
  return Math.max(Math.min(piso, tope), Math.min(tope, espacio));
}
