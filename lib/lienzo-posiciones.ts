// =============================================================================
// lienzo-posiciones — dónde PUSO la persona cada tarjeta de un lienzo
// =============================================================================
// Módulo SIN `server-only` y PURO: lo usan los dos lienzos del producto (el de /mensajes,
// `app/agencia/FlujoAviso.tsx`, y el de /chatbot, `app/chatbot/FlujoLienzo.tsx`) y el server que
// las guarda (lib/secuencia-posiciones.ts). Con test (tests/lienzo-posiciones.test.ts).
//
// ── EL LAYOUT DERIVADO ES EL DEFAULT; LO GUARDADO, LA EXCEPCIÓN ───────────────────
// Pedido de Martín (09/10/2026, quinta tanda, punto 2): «tampoco se puede mover las tarjetas
// libremente por el lienzo». En /chatbot nunca se pudo: el layout se DERIVA del árbol
// (lib/flujo-conversacion.ts) y nadie lo guardaba. Desde acá, una tarjeta que la persona movió va
// donde la dejó, y TODO lo demás se sigue ubicando como siempre. Un flujo que nadie tocó se dibuja
// idéntico a antes: sin posiciones, `conPosiciones` devuelve el mismo grafo.
//
// ── RELATIVAS AL ANCLA (el CRON), NO ABSOLUTAS ────────────────────────────────────
// El árbol de /chatbot pasa por `aOrigen` (lib/lienzo-grafo.ts): una rama nueva que abre hacia
// ARRIBA corre el dibujo entero para que su esquina quede en el margen. Una posición absoluta
// guardada antes de esa rama quedaría corrida respecto de todo lo demás. Guardada como DESPLAZAMIENTO
// desde donde el árbol pone el ancla (la tarjeta CRON, `entrada`), viaja con el dibujo: si el CRON
// baja 120 px porque nació una rama arriba, la tarjeta movida baja con él.
//
// ⚠️ Y EL ANCLA DE REFERENCIA ES LA DERIVADA, no la movida: mover el CRON guarda su propio
// desplazamiento y no arrastra a las demás (mover una tarjeta mueve UNA tarjeta). Por eso
// `moverRelativo` recibe el grafo DERIVADO, nunca el que ya tiene las posiciones aplicadas.
//
// ⚠️ SIN NORMALIZAR DESPUÉS DE APLICARLAS. Volver a pasar el resultado por `aOrigen` haría que
// soltar una tarjeta más arriba que el CRON corra TODO el dibujo en pantalla (el desplazamiento
// cambia con lo que se acaba de soltar): se leería como que el lienzo salta solo. Lo que se suelta
// arriba o a la izquierda del margen queda en coordenadas negativas, que el lienzo dibuja igual
// (la capa no recorta). Es lo mismo que hace /mensajes desde siempre.

import { encerrar, type GrafoFlujo } from './lienzo-grafo';

export type Posiciones = Record<string, { x: number; y: number }>;

/** Lo más lejos que se guarda una tarjeta del ancla, en coordenadas del grafo. Un arrastre de
 *  verdad no llega ni a la décima parte; un número más grande es basura, no una decisión. */
export const LIMITE_POSICION = 20000;
/** Un id de tarjeta: `entrada`, `o3`, `n4f9k2a`, `paso-2`. Lo demás no es un id del lienzo. */
const ID_VALIDO = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * Las posiciones que ya no corresponden a ningún nodo. Se tiran al guardar: si no, borrar un paso
 * deja su coordenada para siempre y el próximo con el mismo id nace en el lugar del que se fue.
 * (Vivía en lib/flujo-aviso.ts; se mudó acá al servir a los dos lienzos, y aquél la re-exporta.)
 */
export function podarPosiciones(pos: Posiciones, ids: ReadonlyArray<string>): Posiciones {
  const vivos = new Set(ids);
  const out: Posiciones = {};
  for (const [k, v] of Object.entries(pos)) if (vivos.has(k)) out[k] = v;
  return out;
}

/**
 * Lo que entra de afuera (el body de un POST, una fila de la base), saneado: un objeto de
 * `id → { x, y }` con números finitos, redondeados y topeados, y como mucho `tope` entradas. Lo que
 * no tiene esa forma se descarta (no se «arregla»): una coordenada inventada pone una tarjeta en un
 * lugar que nadie eligió.
 */
export function sanearPosiciones(raw: unknown, tope = 200): Posiciones {
  const out: Posiciones = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= tope) break;
    if (!ID_VALIDO.test(k) || !v || typeof v !== 'object') continue;
    const x = Number((v as { x?: unknown }).x);
    const y = Number((v as { y?: unknown }).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const top = (c: number) => Math.max(-LIMITE_POSICION, Math.min(LIMITE_POSICION, Math.round(c)));
    out[k] = { x: top(x), y: top(y) };
    n++;
  }
  return out;
}

/** Dónde pone el layout derivado al ancla. Sin ancla (un grafo sin CRON), el origen del dibujo. */
function baseDe(derivado: Pick<GrafoFlujo, 'nodos'>, ancla: string): { x: number; y: number } {
  const a = derivado.nodos.find((n) => n.id === ancla);
  return a ? { x: a.x, y: a.y } : { x: 0, y: 0 };
}

/**
 * EL GRAFO CON LO QUE LA PERSONA MOVIÓ: cada tarjeta con posición guardada va al ancla DERIVADA más
 * su desplazamiento; las demás, donde las puso el árbol. Una posición de un id que no está se
 * ignora. Sin posiciones, el MISMO grafo (ni una copia: un flujo que nadie tocó no cambia nada).
 */
export function conPosiciones(derivado: GrafoFlujo, pos: Posiciones | null | undefined, ancla = 'entrada'): GrafoFlujo {
  if (!pos || !Object.keys(pos).length) return derivado;
  const base = baseDe(derivado, ancla);
  let alguna = false;
  const nodos = derivado.nodos.map((n) => {
    const p = pos[n.id];
    if (!p) return n;
    alguna = true;
    return { ...n, x: base.x + p.x, y: base.y + p.y };
  });
  if (!alguna) return derivado;
  return { ...derivado, nodos, ...encerrar(nodos) };
}

/**
 * SOLTAR UNA TARJETA: la posición nueva (en coordenadas del GRAFO, como la entrega el lienzo, ya
 * dividida por el zoom) pasa a ser un desplazamiento desde el ancla DERIVADA, y lo de las tarjetas
 * que ya no existen se poda. Devuelve el mapa entero a guardar.
 */
export function moverRelativo(
  derivado: Pick<GrafoFlujo, 'nodos'>, pos: Posiciones | null | undefined,
  id: string, x: number, y: number, ancla = 'entrada',
): Posiciones {
  const base = baseDe(derivado, ancla);
  const sig = sanearPosiciones({ ...(pos ?? {}), [id]: { x: x - base.x, y: y - base.y } }, Number.POSITIVE_INFINITY);
  return podarPosiciones(sig, derivado.nodos.map((n) => n.id));
}

/**
 * UNA TARJETA QUE TODAVÍA NO ESTÁ EN EL DIBUJO, PUESTA EN UN LUGAR (sexta tanda, punto 7: los pasos
 * sueltos que se crean con el click derecho «en cualquier momento y lugar del tablero», y la copia de
 * «Duplicar» al lado de la original). Es `moverRelativo` sin podar ESE id: la tarjeta nace en el mismo
 * cambio y el grafo derivado que se le pasa todavía no la tiene —podada, nacía abajo de todo, donde la
 * pone el árbol a una suelta—. Las demás se podan igual.
 */
export function fijarPosicion(
  derivado: Pick<GrafoFlujo, 'nodos'>, pos: Posiciones | null | undefined,
  id: string, x: number, y: number, ancla = 'entrada',
): Posiciones {
  const base = baseDe(derivado, ancla);
  const sig = sanearPosiciones({ ...(pos ?? {}), [id]: { x: x - base.x, y: y - base.y } }, Number.POSITIVE_INFINITY);
  return podarPosiciones(sig, [...derivado.nodos.map((n) => n.id), id]);
}
