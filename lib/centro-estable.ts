// =============================================================================
// Lo que no cambió en un refresco, con la MISMA referencia (23/10/2026, un chat trabajando trababa el Ops Center)
// =============================================================================
// Medido en producción: un chat TRABAJANDO, con sus pasos en vivo y el refresco cada 2,5 s, trababa de 745 ms a 3,6 s en cada
// vuelta. Cada refresco traía arreglos nuevos aunque nada hubiera cambiado (la cola, los carteros, las decisiones, los pasos,
// las preguntas y tareas del chat abierto), y con ellos se rehacían TODOS los chats, el historial de cada uno y se volvía a
// dibujar la lista y el hilo enteros. El Cerebro: «que en cada refresco se redibuje sólo lo que cambió: el paso nuevo, la línea
// de estado. El hilo y la lista no, memorizados por uuid y con las líneas estables».
// Esto da la referencia de antes cuando el valor es el mismo: lo memorizado (useMemo, memo) no se vuelve a calcular ni dibujar.
// =============================================================================

import type { LineaChat } from './centro-chats';

/** `next` si cambió, `prev` (la MISMA referencia) si vale lo mismo. Por valor (JSON): para lo que llega de un refresco. */
export function mismoValor<T>(prev: T, next: T): T {
  if (prev === next) return prev;
  try {
    return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
  } catch {
    return next;
  }
}

/**
 * Una lista con identidad estable: cada elemento que vale lo mismo que el de antes con su misma clave ES el de antes; si
 * todos y en el mismo orden, la lista de antes. Lo nuevo o lo cambiado, lo nuevo.
 */
export function estabilizarLista<T>(prev: readonly T[] | undefined, next: readonly T[], clave: (x: T) => string): readonly T[] {
  if (!prev?.length) return next;
  const antes = new Map<string, T>();
  for (const x of prev) antes.set(clave(x), x);
  let igual = prev.length === next.length;
  const out = next.map((x, i) => {
    const viejo = antes.get(clave(x));
    const v = viejo === undefined ? x : mismoValor(viejo, x);
    if (v !== prev[i]) igual = false;
    return v;
  });
  return igual ? prev : out;
}

/** La clave de una línea de la conversación: su turno, su pedido, su trabajo o su pregunta. */
export function claveDeLinea(l: LineaChat): string {
  switch (l.tipo) {
    case 'turno': return `t:${l.turno.uuid}`;
    case 'pedido': return `p:${l.pedido.id}`;
    case 'derivado': return `d:${l.pedido.id}`;
    case 'trabajo': return `w:${l.trabajo.id}`;
    case 'respuesta': return `r:${l.decision.id}`;
    case 'pregunta': return `q:${l.pregunta.id}`;
    default: return `x:${(l as { instante: number }).instante}`;
  }
}

/** El minuto de un instante: lo que cambia en la lista («hace 3 min») y en lo que no está en camino. */
export const minutoDe = (t: number): number => Math.floor(t / 60_000) * 60_000;
