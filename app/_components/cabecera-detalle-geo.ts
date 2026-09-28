// =============================================================================
// La geometría de la cabecera de un detalle: dónde cruza la marca
// =============================================================================
// Dos números, y están ACOPLADOS: la marca se monta a caballo del borde de abajo de
// la portada (mitad sobre la imagen, mitad sobre la fila) y la fila tiene que dejarle
// su lugar a la izquierda. Si uno se calcula y el otro se escribe a mano, la marca se
// superpone al título o queda flotando.
//
// ⚠️ ESTABAN CABLEADOS, con la cuenta explicada en un comentario: `top:97px` («124
// menos 27») y `paddingLeft:86` («20 + 54 + 12»). Eso funciona hasta que alguien toca
// el alto de la banda y mueve uno solo — y el síntoma es un título escrito encima de
// la marca, que se ve como un layout roto y no como un número viejo.
//
// ⚠️ VIVE EN SU PROPIO MÓDULO, sin `server-only` y sin importar nada, por la razón de
// siempre: una regla que ningún test puede importar es una regla sin red. El
// componente que la usa es `'use client'` y arrastra React, `Marca` y la hoja entera.

export type GeometriaCabecera = {
  /** El `top` de la marca: queda partida al medio por el borde de la portada. */
  cruce: number;
  /** El `padding-left` de la fila del título: el hueco que la marca ocupa. */
  sangria: number;
};

/** A la izquierda de la marca, y entre la marca y el texto. Los dos, del molde original. */
const MARGEN_IZQ = 20;
const AIRE = 12;

/**
 * Dónde cae la marca y cuánto sangra la fila, para una banda de `alto` y una marca de
 * lado `tam`.
 *
 * Con los números del tablero (124 y 54) devuelve exactamente los que estaban escritos
 * a mano: `cruce: 97` y `sangria: 86`. Ése es el punto — no cambia nada hoy, y hace que
 * mañana no haya nada que acordarse de mover.
 */
export function geometriaCabecera(alto: number, tam: number): GeometriaCabecera {
  return {
    cruce: alto - Math.round(tam / 2),
    sangria: MARGEN_IZQ + tam + AIRE,
  };
}
