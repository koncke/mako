// =============================================================================
// dropdown-varios — las tres decisiones de un desplegable que elige VARIOS
// =============================================================================
// Viven acá y no adentro de Dropdown.tsx porque ése lleva `'use client'` y estas son
// las tres partes que se pueden equivocar sin que nada se vea roto:
//
//   · qué dice el BOTÓN con dos, tres o diez marcados;
//   · si el renglón que se toca se puede APAGAR (el mínimo);
//   · cómo queda el conjunto después de tocar uno.
//
// Las tres son funciones puras y tienen test que las EJECUTA
// (tests/dropdown-varios.test.ts). Y el que elige y el que guarda llaman a la MISMA
// `alternarValor`: con una regla del mínimo en el menú y otra en la pantalla que
// guarda, la primera vez que difieran se guarda un conjunto que el menú no deja ver.
// =============================================================================

/**
 * Lo que dice el botón del desplegable. `null` = no hay nada marcado (va el placeholder).
 *
 * ⚠️ DICE CUÁLES, no «2 seleccionados»: un número obliga a abrir el menú para saber qué
 * se eligió, que es justo lo que el botón de un desplegable existe para ahorrar. Con tres
 * o más no entran todos en un renglón, así que van los dos primeros y cuántos más.
 */
export function rotuloDeVarios(labels: string[]): string | null {
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} y ${labels.length - 2} más`;
}

/**
 * ¿Se puede APAGAR este valor sin bajar del mínimo?
 *
 * Prender siempre se puede. Lo que se cuida es apagar el último: «tiene que quedar al
 * menos uno» tiene que ser una propiedad del CONTROL, no una validación al guardar —un
 * desplegable que deja vaciarse y después dice «no podés» miente durante un click.
 */
export function puedeApagar(valores: string[], v: string, minimo = 0): boolean {
  if (!valores.includes(v)) return true;
  return valores.length > minimo;
}

/**
 * El conjunto después de tocar `v`: lo prende si estaba apagado, lo apaga si estaba
 * prendido — salvo que apagarlo baje del mínimo, y entonces queda IGUAL.
 *
 * Conserva el ORDEN de lo que ya estaba y agrega al final: el primero es el que el botón
 * nombra primero, y que se reordene solo al tocar otro se lee como que la elección cambió.
 */
export function alternarValor(valores: string[], v: string, minimo = 0): string[] {
  if (!valores.includes(v)) return [...valores, v];
  if (!puedeApagar(valores, v, minimo)) return valores;
  return valores.filter((x) => x !== v);
}
