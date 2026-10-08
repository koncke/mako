// =============================================================================
// orden — dónde cae lo que se ARRASTRA en un curso, y cómo queda la lista (puro)
// =============================================================================
// Pedido de Martín (07/10/2026, item 7): «Debería poder agarrar una tarjeta y arrastrarla para
// cambiar la posición... Tanto de módulos como clases... Copia la animación de arrastre de tarjetas
// que tenemos en varios lugares, como el PLAN, copia esa animación tal cual, con todo».
//
// El GESTO (la copia que sigue al cursor, el hueco, el auto-scroll) vive en ./arrastre-curso.ts y
// sale del molde del Plan (app/plan/board/arrastre-copia.ts). Acá queda lo que DECIDE —en qué lugar
// cae, cómo queda la lista, antes de quién—, sin DOM y sin React, para que tenga test
// (tests/curso-editor.test.ts). Es la regla de la casa: la condición que se puede equivocar va en un
// módulo que se pueda importar sin montar nada.
//
// ⚠️ EL ORIGEN SIGUE EN SU LUGAR MIENTRAS DURA EL GESTO (AGENTS.md, «al nodo ORIGEN de un arrastre no
// se le toca el tamaño»): las medidas y el índice crudo se cuentan sobre una lista que TODAVÍA lo
// contiene. Soltarlo más abajo de donde estaba corre una posición (`ordenAlSoltar`), igual que la
// grilla de proyectos del Plan (`iYo` en BoardShell.tsx).

/** Una tarjeta medida, en coordenadas del CONTENIDO que scrollea (sobreviven al auto-scroll). */
export type RectTarjeta = { id: string; x: number; y1: number; y2: number };

/**
 * Dónde caería en una GRILLA, en ORDEN DE LECTURA (el molde de `indiceEn` de la grilla de proyectos
 * del Plan): una tarjeta va «antes» si está en una fila de más arriba, o en la misma fila y más a la
 * izquierda de su centro. Con sólo la Y, en una grilla de cuatro columnas las cuatro empatarían.
 */
export function indiceEnGrilla(rects: readonly RectTarjeta[], px: number, py: number): number {
  for (let i = 0; i < rects.length; i++) if (py < rects[i].y1 || (py <= rects[i].y2 && px < rects[i].x)) return i;
  return rects.length;
}

/** Dónde caería en una LISTA vertical (la barra de los módulos): antes del primer punto medio que pasa. */
export function indiceEnLista(medios: readonly number[], py: number): number {
  for (let i = 0; i < medios.length; i++) if (py < medios[i]) return i;
  return medios.length;
}

/**
 * La lista con `id` llevado al hueco `crudo` (contado sobre la lista que todavía lo tiene). `null` =
 * soltar ahí NO cambia nada (el hueco de al lado de sí mismo): no se escribe ni se avisa nada.
 */
export function ordenAlSoltar<T>(lista: readonly T[], id: T, crudo: number): T[] | null {
  const i = lista.indexOf(id);
  if (i < 0) return null;
  const sin = lista.filter((x) => x !== id);
  const donde = Math.max(0, Math.min(crudo > i ? crudo - 1 : crudo, sin.length));
  const nueva = [...sin.slice(0, donde), id, ...sin.slice(donde)];
  return nueva.every((x, k) => x === lista[k]) ? null : nueva;
}

/**
 * Antes de QUIÉN quedó `id` en la lista nueva: el que le sigue, o `null` = al final. Es lo que viaja
 * al server (`moverClaseAAction`) y no un número: «antes de la clase 12» es lo mismo en la base y en
 * la pantalla aunque otra pestaña haya agregado una clase en el medio; «el tercero» no.
 */
export function antesDeEn<T>(lista: readonly T[], id: T): T | null {
  const i = lista.indexOf(id);
  return i >= 0 && i < lista.length - 1 ? lista[i + 1] : null;
}

/**
 * La lista con `id` movido a ANTES de `antes` (`null` = al final). La pantalla la usa para mover en el
 * acto, antes de que el server confirme; si el server contesta otro orden, manda el del server.
 */
export function conMovidoAntesDe<T>(lista: readonly T[], id: T, antes: T | null): T[] {
  const sin = lista.filter((x) => x !== id);
  const i = antes == null ? -1 : sin.indexOf(antes);
  return i < 0 ? [...sin, id] : [...sin.slice(0, i), id, ...sin.slice(i)];
}
