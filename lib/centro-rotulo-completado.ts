// =============================================================================
// QUÉ SE COMPLETÓ: el rótulo de la tarjeta de un «Completado», «Tab · Función» (10/11/2026; puro, con test)
// =============================================================================
// Martín, 10/11/2026: «las tarjetas de completado… que yo rápidamente pueda identificar qué se completó. Es decir, qué funcionalidad se
// completó, qué feature, qué tab». La tarjeta (Avance.tsx en el hilo, BloqueCompletado.tsx arriba de la caja) arrancaba siempre con la
// misma palabra, «Completado», y lo que se terminó había que leerlo en el texto. Ahora ese mismo rótulo dice «Image · Portadas de
// carruseles» o «Dashboard · Velocidad de llamada»; el ✓ verde de al lado sigue diciendo que está completado.
//
// DE DÓNDE SALE, sin inventar nada:
//   · la TAB, de la tab del chat (lib/centro-chats.ts → tabDeChat: su nombre, su bitácora o una tab nombrada en su título);
//   · la FUNCIÓN, en este orden: el sub-chat del nombre («Image › Portadas de carruseles»); el título del chat cuando no es la tab (un
//     chat de tarea: «Borrar la co-edición del editor de imágenes»); y si el chat ES la tab, lo que dijo al empezar ESE trabajo, su
//     «Voy a trabajar en…» (la regla de AGENTS.md: todo trabajo arranca así, y de ahí sale la tarea del Plan).
// Sin ninguno de los dos, null: la tarjeta dice «Completado», como antes.
// ⚠️ Vive aparte de lib/centro-chats.ts porque lib/centro-plan-auto-reglas.ts (el «Voy a trabajar en…») ya importa de ahí.
// ⚠️ SIN `server-only`: lo usan la computadora y el teléfono.

import { completadosDelChat, partesDelNombre, tabDeChat, type LineaChat, type TabDelIndice } from './centro-chats';
import { esVoyATrabajar, tituloDeVoy } from './centro-plan-auto-reglas';
import type { TurnoChat } from './operaciones-reglas';

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** El «Voy a trabajar en…» del trabajo que cierra este «Completado»: el último del chat antes de él y después del «Completado» de antes. */
export function voyDelCompletado(lineas: readonly LineaChat[], ya: Pick<TurnoChat, 'at'>): string | null {
  const hasta = Date.parse(ya.at);
  let desde = -Infinity;
  for (const x of completadosDelChat(lineas)) if (x.instante < hasta && x.instante > desde) desde = x.instante;
  let voy: string | null = null;
  for (const l of lineas) {
    if (l.tipo !== 'turno' || l.turno.rol !== 'el' || !(l.instante > desde && l.instante < hasta) || !esVoyATrabajar(l.turno.texto)) continue;
    voy = tituloDeVoy(l.turno.texto) ?? voy;
  }
  return voy;
}

/** «Tab · Función» de un «Completado», o null (la tarjeta dice «Completado»). */
export function rotuloDelCompletado(
  chat: { titulo: string; area?: string },
  indice: readonly TabDelIndice[] | undefined,
  lineas: readonly LineaChat[],
  ya: Pick<TurnoChat, 'at'>,
): string | null {
  const t = tabDeChat(chat, indice);
  const { sub } = partesDelNombre(chat.titulo);
  const tab = t?.tab ?? null;
  const esLaTab = !sub && (t?.jefe ?? !!tab);
  const funcion = sub ?? (!esLaTab && normal(chat.titulo) !== normal(tab ?? '') ? chat.titulo.trim() : null) ?? voyDelCompletado(lineas, ya);
  const f = funcion && tab && normal(funcion) === normal(tab) ? null : funcion;
  if (tab && f) return `${tab} · ${f}`;
  return f ?? tab;
}
