// =============================================================================
// Cuánto empujar una columna del tablero mientras se arrastra encima
// =============================================================================
// ⚠️ VIVE ACÁ Y NO EN `CrmBoard.tsx` PARA QUE SE PUEDA TESTEAR. Ese archivo es
// `'use client'` y arrastra módulos con `server-only`: importarlo desde un test
// revienta con «This module cannot be imported from a Client Component module».
// Es la regla de la casa — la condición que se puede equivocar va en un módulo
// sin `server-only`, o termina siendo lo único sin red.
//
// ⚠️ Y NO SE USA `empujarScroll` DEL HOOK COMPARTIDO (app/plan/board/arrastre-copia),
// aunque exista y haga esto mismo. Ese resuelve su scroller UNA sola vez, en el
// `dragstart`, con la tarjeta de ORIGEN. En /plan está bien porque ahí scrollea la
// ventana; en el CRM cada columna scrollea por dentro (`maxHeight: 68vh` +
// `overflowY: auto`), así que empujaría la columna de la que SALIÓ la tarjeta y no
// la que está bajo el cursor: movería la de atrás mientras mirás la de adelante.
//
// ⚠️ Y SE LLAMA DESDE EL `dragover`, nunca desde un `requestAnimationFrame` ni un
// timer: durante un arrastre nativo Chrome los CONGELA, y lo único que sigue
// entregando es `dragover`. Está medido en esta casa: con rAF, 0 px en 1,2 s sobre
// el borde, y el único tick llegaba DESPUÉS de soltar.

/** Los píxeles del borde donde el arrastre empieza a empujar. */
const BORDE = 90;
/** Cuánto se desplaza por evento. Sale del `dragover`, que llega seguido. */
const PASO = 26;

/**
 * Devuelve los píxeles a desplazar: negativo sube, positivo baja, 0 no toca nada.
 *
 * La caja es la del CARRIL que scrollea (el hijo con `overflowY`), no la de la
 * columna: la columna topea en 68vh y el que desborda es el carril de adentro.
 */
export function empujeDeColumna(
  caja: { top: number; bottom: number },
  clientY: number,
  borde: number = BORDE,
  paso: number = PASO,
): number {
  // ⚠️ FUERA DE LA CAJA NO SE EMPUJA. La primera versión preguntaba sólo por los
  // bordes, así que un cursor POR ENCIMA de la columna (clientY menor que su `top`)
  // devolvía el empuje hacia arriba: la columna se desplazaba sola con el cursor
  // lejos. Hoy no se nota porque `dragover` sólo llega cuando el cursor está encima,
  // pero una función que decide tiene que ser correcta sin depender de quién la
  // llama — si mañana la llama el riel o el tablero entero, el bug aparece ahí.
  if (clientY < caja.top || clientY > caja.bottom) return 0;
  // El borde de arriba se pregunta primero: en una columna más baja que dos bordes
  // los dos rangos se pisan, y eso es una decisión tomada y no un empate.
  if (clientY < caja.top + borde) return -paso;
  if (clientY > caja.bottom - borde) return paso;
  return 0;
}
