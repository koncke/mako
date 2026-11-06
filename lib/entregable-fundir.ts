// =============================================================================
// entregable-fundir — lo que guarda el paso Entregable del onboarding, fundido sobre la lista guardada (puro, 6/11/2026)
// =============================================================================
// Sin server-only: lo prueba tests/lead-magnets.test.ts. Lo escribe app/api/onboarding/entregable/route.ts por la puerta de
// la lista (`cambiarEntregables`, lib/entregable.ts).
// =============================================================================

import type { Entregable } from './entregable';

/**
 * Lo que guarda el paso Entregable del onboarding, fundido sobre lo guardado (puro, con test):
 *   · cada tarjeta que manda conserva lo que esa pantalla no edita (el enlace, la pieza, la página) y sólo cambia sus textos;
 *   · el ORDEN es el guardado («Ponerlo primero» decide qué link mandan las automatizaciones): las nuevas van al final;
 *   · lo que no manda y tiene una pieza armada en la tab se queda (se quita desde la tab); lo demás que no manda, se borró ahí;
 *   · vaciar el NOMBRE de una tarjeta guardada no la deja sin nombre: conserva el que tenía. Una lista sin nombre no se ve en
 *     ninguna pantalla (`getEntregables` la filtra), así que quedaba guardada, invisible y sin forma de quitarla; y si era la
 *     primera, las automatizaciones pasaban a mandar el link de otra sin que nadie lo viera (revisión del 6/11/2026);
 *   · una tarjeta nueva sin nombre no se guarda.
 */
export function fundirDelOnboarding(guardada: Entregable[], entrantes: Array<Pick<Entregable, 'id' | 'nombre' | 'tipo' | 'queEs' | 'fomo'>>): Entregable[] {
  const porId = new Map(entrantes.map((e) => [e.id, e]));
  const fuera: Entregable[] = [];
  for (const e of guardada) {
    const n = porId.get(e.id);
    if (n) fuera.push({ ...e, nombre: n.nombre.trim() ? n.nombre : e.nombre, tipo: n.tipo, queEs: n.queEs, fomo: n.fomo });
    else if (e.pieza) fuera.push(e);
  }
  const ya = new Set(guardada.map((e) => e.id));
  for (const n of entrantes) if (!ya.has(n.id)) fuera.push({ id: n.id, nombre: n.nombre, tipo: n.tipo, queEs: n.queEs, fomo: n.fomo });
  return fuera.filter((g) => g.nombre.trim() || g.pieza);
}
