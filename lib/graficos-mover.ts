// =============================================================================
// graficos-mover — mover una tarjeta de una hoja (o cambiarle el ancho) como si se la arrastrara en la pantalla
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, pieza 2.6): «Mover una tarjeta o cambiarle el
// tamaño» no se podía desde el chat. Lo pide `mover_componente_dashboard` (lib/api-mako/areas/dashboard.def.ts).
//
// ⚠️ LA MISMA GRILLA QUE LA PANTALLA. El editor (app/dashboard/EditorInforme.tsx) usa react-grid-layout con
//    `verticalCompactor`: al soltar una tarjeta, la librería empuja hacia abajo a las que choca y sube lo que quedó
//    con aire arriba. Esto llama a SUS funciones (`moveElement` y el compactador, de `react-grid-layout/core`, que no
//    trae React) en vez de reescribir el acomodo: si no, el chat dejaría una hoja que la pantalla reacomoda sola al
//    abrirla (y el primer «Editar» la guardaría distinta).
//   · El mínimo de cada tarjeta es el de la grilla (`minimoDeComponente`, lib/graficos-catalogo.ts).
//   · Se trabaja sobre lo GUARDADO: una sección plegada ocupa su lugar, como en el informe.
//   · Una tarjeta que cambia de altura de la hoja puede cambiar de sección (las secciones van por posición): es lo
//     mismo que pasa al arrastrarla.
// =============================================================================

import { cloneLayout, moveElement, verticalCompactor, type Layout } from 'react-grid-layout/core';
import { COLS, minimoDeComponente, type Componente } from '@/lib/graficos-catalogo';

/** Los anchos que se piden en palabras, en columnas de la grilla de 12. */
export const ANCHOS = { completo: 12, dos_tercios: 8, mitad: 6, tercio: 4, cuarto: 3 } as const;
export type Ancho = keyof typeof ANCHOS;

/** Adónde va: arriba o abajo de todo, o con respecto a otra tarjeta. */
export const LUGARES = ['arriba', 'abajo', 'antes_de', 'despues_de', 'al_lado_de'] as const;
export type Lugar = (typeof LUGARES)[number];
export const lugarConReferencia = (l: Lugar): boolean => l === 'antes_de' || l === 'despues_de' || l === 'al_lado_de';

export type Movida = { lugar?: Lugar; referencia?: string; ancho?: Ancho };
export type Movido = { ok: true; componentes: Componente[] } | { ok: false; error: string; yaEstaba?: true };

const enRango = (x: number, w: number) => Math.max(0, Math.min(x, COLS - w));

/** Las tarjetas de la hoja con la movida aplicada, acomodadas como las acomoda la grilla de la pantalla. */
export function moverComponente(componentes: readonly Componente[], id: string, m: Movida): Movido {
  const yo = componentes.find((c) => c.id === id);
  if (!yo) return { ok: false, error: 'Ese componente ya no está en la hoja.' };
  if (!m.lugar && !m.ancho) return { ok: false, error: 'Falta adónde va o qué ancho tiene.' };
  const ref = m.lugar && lugarConReferencia(m.lugar) ? componentes.find((c) => c.id === m.referencia) : undefined;
  if (m.lugar && lugarConReferencia(m.lugar)) {
    if (!ref) return { ok: false, error: 'Falta la tarjeta con respecto a la cual va.' };
    if (ref.id === yo.id) return { ok: false, error: 'Una tarjeta no puede ir con respecto a sí misma.' };
  }
  const min = minimoDeComponente(yo);
  const w = m.ancho ? Math.max(min.w, ANCHOS[m.ancho]) : yo.w;
  const otras = componentes.filter((c) => c.id !== yo.id);
  const fondo = otras.reduce((mx, c) => Math.max(mx, c.y + c.h), 0);
  let x = enRango(yo.x, w), y = yo.y;
  switch (m.lugar) {
    case 'arriba': x = 0; y = 0; break;
    case 'abajo': x = 0; y = fondo; break;
    case 'antes_de': x = enRango(ref!.x, w); y = ref!.y; break;
    case 'despues_de': x = enRango(ref!.x, w); y = ref!.y + ref!.h; break;
    case 'al_lado_de': {
      if (ref!.x + ref!.w + w <= COLS) x = ref!.x + ref!.w;
      else if (ref!.x - w >= 0) x = ref!.x - w;
      else return { ok: false, error: `No entran las dos en la misma fila: juntas ocupan ${ref!.w + w} de ${COLS} columnas. Achica una (por ejemplo, a la mitad).` };
      y = ref!.y;
      break;
    }
    default: break;
  }
  const layout: Layout = cloneLayout(componentes.map((c) => {
    const mn = minimoDeComponente(c);
    return { i: c.id, x: c.x, y: c.y, w: c.id === yo.id ? w : c.w, h: c.h, minW: mn.w, minH: mn.h };
  }));
  const item = layout.find((it) => it.i === yo.id)!;
  // Achicar o agrandar primero, en su lugar (como el tirador de la pantalla), y después moverla: así lo que choca se
  // corre con el ancho nuevo.
  const movido = moveElement(layout, item, x, y, true, false, 'vertical', COLS);
  const final = verticalCompactor.compact(movido, COLS);
  const lugar = new Map(final.map((it) => [it.i, it] as const));
  const salida = componentes.map((c) => {
    const it = lugar.get(c.id);
    return it ? ({ ...c, x: it.x, y: it.y, w: it.w, h: it.h } as Componente) : c;
  });
  if (salida.every((c, i) => c.x === componentes[i].x && c.y === componentes[i].y && c.w === componentes[i].w && c.h === componentes[i].h)) {
    return { ok: false, error: 'Esa tarjeta ya está así.', yaEstaba: true };
  }
  return { ok: true, componentes: salida };
}
