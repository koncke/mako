// =============================================================================
// aviso-grilla — ¿un aviso de la grilla que llega SIN un gesto es el acomodo de lo que se le dio AHORA?
// =============================================================================
// 10/11/2026, probado en producción (ws 3, hoja Closing): dos Ctrl+Z seguidos perdían el segundo. La tarjeta
// quedaba con el tamaño del paso de en medio, la pila de deshacer vacía y el informe distinto de la grilla.
//
// LA CAUSA (react-grid-layout 2.2.4, chunk de GridLayout): al cambiarle el `layout`, la grilla lo copia a su estado en
// un efecto y AVISA (`onLayoutChange`) en otro efecto, con lo que tiene en su estado. Si el segundo Ctrl+Z llega entre
// los dos, la grilla avisa la posición del PRIMER deshacer cuando el informe ya está en la del segundo, y el editor
// (`alMoverGrilla`) la escribía encima: el segundo deshacer se perdía sin un error.
//
// LA REGLA: fuera de un gesto (arrastrar o agrandar), lo único que la grilla puede avisar por su cuenta es que ACOMODÓ lo
// que se le dio (lo corrió para que entre en las 12 columnas y lo subió para que no queden huecos: al montar, al agregar o
// al borrar una tarjeta). Un aviso que no es ese acomodo es de un estado anterior y no se escribe. Lo del gesto lo escribe
// su final (`onDragStop` / `onResizeStop`, que traen la grilla final antes que su propio aviso).
//
// Puro (sin React): lo usa app/dashboard/EditorInforme.tsx y lo fija tests/dashboard-aviso-grilla.test.ts.

import { cloneLayout, correctBounds, verticalCompactor } from 'react-grid-layout/core';
import type { Layout } from 'react-grid-layout';

/** Lo que la grilla hace SOLA con un layout: lo mete en las columnas y lo sube (`synchronizeLayoutWithChildren`). */
export function acomodoDe(dado: Layout, cols: number): Layout {
  return verticalCompactor.compact(correctBounds(cloneLayout(dado), { cols }), cols);
}

/** Las mismas cajas (id, x, y, w, h), en cualquier orden. */
export function mismasCajas(a: Layout, b: Layout): boolean {
  if (a.length !== b.length) return false;
  const porId = new Map(b.map((it) => [it.i, it] as const));
  return a.every((it) => {
    const o = porId.get(it.i);
    return !!o && o.x === it.x && o.y === it.y && o.w === it.w && o.h === it.h;
  });
}

/** ¿Este aviso, que llegó sin un gesto, es el acomodo de lo que se le dio ahora? Si no, es de un estado anterior. */
export const esAcomodoDe = (aviso: Layout, dado: Layout, cols: number): boolean => mismasCajas(aviso, acomodoDe(dado, cols));
