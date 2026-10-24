// =============================================================================
// dropdown-reglas — cuándo lleva buscador un desplegable, y cómo se ven sus dos variantes (puro)
// =============================================================================
// Pedidos de Martín (09/10/2026, sexta tanda), textuales:
//   · general 11 y CONDITION 2: «Agrega la barra de busqueda en todos los desplegables... Al menos que
//     por defecto tenga muy pocas opciones. Esto para todos lados»;
//   · CONDITION 3: «Se tiene que diferenciar el desplegable principal del resto... Si el desplegable
//     principal, el de "Completó la clase" es igual al de abajo, confunde... Tiene que tener más
//     protagonismo el principal, hazlo más ancho o algo... Esto para todos lados»;
//   · CONDITION 4: «siempre que puedas usa ese diseño tipo placeholder» (el «+ Nuevo disparador» de
//     ManyChat: grande, con borde punteado y el texto centrado).
//
// Viven acá y no adentro de Dropdown.tsx porque ése lleva 'use client' y estas son las decisiones que
// se pueden equivocar sin que nada se vea roto: el umbral (un desplegable de 9 opciones sin buscador
// no da error, obliga a scrollear) y los números de las variantes (un «principal» que mide lo mismo
// que el de al lado no es principal). Las EJECUTA tests/dropdown-reglas.test.ts.
// =============================================================================

import type { CSSProperties } from 'react';

/**
 * Pasadas estas opciones el desplegable abre con buscador, solo. Era 8 hasta el 09/10/2026: ocho
 * renglones de 38 px ya llenan un menú de 340 y el noveno se esconde abajo, así que con ocho ya hace
 * falta. Con siete o menos se ven todas de una mirada y el buscador sería un campo para nada («al
 * menos que por defecto tenga muy pocas opciones»).
 */
export const UMBRAL_BUSCADOR = 7;

/**
 * ¿Lleva buscador? `search` explícito manda (true lo fuerza, false lo apaga: un selector de cuatro
 * unidades no lo necesita aunque crezca); sin él, el umbral sobre TODAS las opciones —las de adentro de
 * cada sección también, porque buscar aplana el árbol—.
 */
export function conBuscador(totalOpciones: number, search?: boolean): boolean {
  return search ?? totalOpciones > UMBRAL_BUSCADOR;
}

/**
 * Las DOS COLUMNAS de una sección (`dosColumnas` en DropdownGroup). Pedido de Martín del 03/07/2026 para el desplegable de
 * etapa de la ficha: «dividido en 2 secciones lado a lado (pipeline | nutrición agrupada) para evitar scroll».
 *
 * Las opciones se parten en TRAMOS donde una trae `lineaArriba` (las bandas del tablero). El primero va a la izquierda (el
 * recorrido), el segundo a la derecha (nutrición), y los que siguen (las salidas) a la columna MÁS CORTA, con su línea. Con
 * todo lo que no es el recorrido a la derecha, el funnel por defecto quedaba 5 | 13 y scrolleaba; así queda 8 | 9 (medido
 * el 24/10/2026). Lo que trae `alPie` (una acción, «Quitar de este funnel») va debajo de las dos, a todo el ancho. Sin ninguna
 * línea no hay qué partir: todo queda a la izquierda y la derecha vacía (el menú se ve como siempre).
 */
export function columnasDeSeccion<T extends { lineaArriba?: boolean; alPie?: boolean }>(options: readonly T[]): { izquierda: T[]; derecha: T[]; pie: T[] } {
  const pie = options.filter((o) => o.alPie);
  const tramos: T[][] = [];
  for (const [i, o] of options.filter((x) => !x.alPie).entries()) {
    if (i === 0 || o.lineaArriba) tramos.push([o]);
    else tramos[tramos.length - 1].push(o);
  }
  const izquierda: T[] = tramos[0] ?? [];
  // La primera de la derecha encabeza su columna: sin línea arriba (la separación ya la da la columna).
  const derecha: T[] = (tramos[1] ?? []).map((o, i) => (i === 0 ? { ...o, lineaArriba: false } : o));
  for (const t of tramos.slice(2)) (izquierda.length <= derecha.length ? izquierda : derecha).push(...t);
  return { izquierda, derecha, pie };
}

/**
 * Las dos caras que un desplegable puede tener además de la de siempre:
 *   · `principal`: el que MANDA en un editor (qué acción, qué condición, qué operación). Más alto, más
 *     ancho (llena el renglón si no se le da un ancho), con la letra más grande y en negrita, y el borde
 *     un poco más grueso: se distingue de los de abajo sin tener que leerlos;
 *   · `placeholder`: el que AGREGA algo («＋ Otra etiqueta», «＋ Dato del lead»): borde punteado, fondo
 *     transparente, texto centrado y apagado, sin flecha, y se enciende al pasar el cursor. Es el molde
 *     de «+ Nuevo disparador» de ManyChat y de «＋ Nueva tarea» del Plan.
 */
export type VarianteDropdown = 'principal' | 'placeholder';

/** El alto del principal: más que el campo grande de la casa (48, app/_components/Lienzo.tsx). */
export const ALTO_PRINCIPAL = 56;
export const ALTO_PLACEHOLDER = 48;

/** La cara del BOTÓN de cada variante. Va entre el estilo de siempre y el `buttonStyle` de quien llama. */
export function estiloDeVariante(v: VarianteDropdown | undefined, encima = false): CSSProperties {
  if (v === 'principal') {
    return {
      minHeight: ALTO_PRINCIPAL, padding: '13px 16px', borderRadius: 13,
      fontSize: 17, fontWeight: 700, border: '1.5px solid var(--border-strong)',
    };
  }
  if (v === 'placeholder') {
    return {
      minHeight: ALTO_PLACEHOLDER, padding: '11px 14px', borderRadius: 12, justifyContent: 'center',
      fontSize: 15, fontWeight: 600, background: 'transparent',
      border: `1.5px dashed ${encima ? 'var(--primary)' : 'var(--border-strong)'}`,
      color: encima ? 'var(--primary)' : 'var(--dim)',
      transition: 'border-color .12s, color .12s',
    };
  }
  return {};
}

/** El ancho por defecto del botón: el principal y el placeholder llenan el renglón; los demás, lo suyo. */
export const anchoPorDefecto = (v: VarianteDropdown | undefined): number | string | undefined =>
  (v === 'principal' || v === 'placeholder' ? '100%' : undefined);
