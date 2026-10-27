// =============================================================================
// lectura-por-partes — leer una reunión larga por partes CON RELOJ, y retomar lo que faltó (puro, con test)
// =============================================================================
// 17/10/2026, pendientes del Plan. Dos cosas que se veían como una sola («una reunión larga no deja nada»):
//
//   1. **La extracción no miraba el reloj.** El cron, la ruta del modal y el webhook corren con `maxDuration = 300` y le
//      pasan su `hasta` a quien los llama, pero `extraerTareasDeTexto` (lib/plan-fathom.ts) no lo recibía: una junta de
//      3 h (8-9 partes de 20k, de a tres, 70-140 s cada ronda con Gemini cargado) pasaba los 300 s y Vercel mataba la
//      función ANTES de escribir el borrador. Ninguna tarea, ningún rastro, y la corrida siguiente volvía a empezar de
//      cero para morirse igual. Ahora cada ronda arranca sólo si le entra (`MIN_PARTE_MS`), cada llamada lleva el plazo
//      (`hastaMs` de `chatClaude`: si no llega, FALLA, no paga), y lo que no se leyó vuelve como parte sin leer.
//
//   2. **Una lectura a medias no se completaba nunca.** reunion-auto dejaba la reunión abierta «y el próximo cron
//      completa lo que falta», pero el cron la salteaba porque ya tenía borrador (`existePropuestaRef`). Y aunque la
//      hubiera releído, una junta de 3 h se vuelve a morir en el mismo lugar. Ahora queda una MARCA con las partes que
//      sí se leyeron (`MarcaParcial`, en `mako.reunion.parcial.<id>`) y la próxima lectura lee SÓLO las que faltan. Lo
//      nuevo va a un borrador APARTE (`refDelResto`): sumarlo al primero podía borrarlo el autoguardado del modal si la
//      persona lo tenía abierto (el modal guarda la lista entera cada 900 ms; docs/hallazgos-plan.md, «Tablero único»).
//
// Puro a propósito: el reloj, la espera y la lectura llegan por parámetro, y el test los maneja (tests/reunion-larga-reloj.test.ts).
// =============================================================================

import { mismaTarea } from './tareas-dedup';
import { claveDeReunion, esRefDeReunion, leerRef } from './grabadores/reunion';

/**
 * Lo que se deja libre al final del plazo para ESCRIBIR lo leído (el borrador, el cruce, el candado). Sin esto, la
 * última ronda puede terminar justo en el `hasta` y la escritura es lo que Vercel corta.
 */
export const MARGEN_ESCRITURA_MS = 25_000;

/**
 * Lo que tiene que quedar para arrancar una ronda. Medido el 17/10/2026: Gemini tarda de 70 a 140 s por parte con mucha
 * demanda (lib/plan-fathom.ts, `CONCURRENCIA`). Arrancar con menos es pagar cuota por una parte que el plazo corta.
 */
export const MIN_PARTE_MS = 120_000;

/** Una parte leída (o no). `sinTiempo` = ni se intentó: no entraba en el reloj. */
export type ParteLeida<T> = { i: number; salida: T; fallo: boolean; sinTiempo: boolean };

/**
 * Lee las partes `indices` de a `concurrencia`, con UN reintento por parte, y sin pasarse del `plazo` (epoch ms; sin
 * plazo, como antes). Devuelve una entrada por índice pedido, en el orden pedido.
 *
 * - Una ronda arranca sólo si quedan `minParteMs` antes del plazo; si no, sus partes y las de después vuelven
 *   `sinTiempo` (se leen en la próxima corrida, no se pierden).
 * - El reintento corre sólo si después de la espera sigue entrando una parte.
 * - `leer` recibe el plazo para pasárselo a la llamada (`hastaMs`): una parte que no termina a tiempo FALLA.
 */
export async function leerPorRondas<T>(p: {
  indices: readonly number[];
  concurrencia: number;
  leer: (i: number) => Promise<{ salida: T; fallo: boolean }>;
  vacia: () => T;
  plazo?: number;
  ahora?: () => number;
  dormir?: (ms: number) => Promise<void>;
  minParteMs?: number;
  /** La espera antes del reintento de la parte `i` (escalonada para no pegarle a la API todas juntas). */
  espera?: (i: number) => number;
}): Promise<Array<ParteLeida<T>>> {
  const ahora = p.ahora ?? Date.now;
  const dormir = p.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const min = p.minParteMs ?? MIN_PARTE_MS;
  const espera = p.espera ?? ((i: number) => 1200 + i * 400);
  const entra = (extra = 0) => p.plazo == null || ahora() + extra + min <= p.plazo;

  const unaConReintento = async (i: number): Promise<ParteLeida<T>> => {
    const primera = await p.leer(i).catch(() => ({ salida: p.vacia(), fallo: true }));
    if (!primera.fallo) return { i, salida: primera.salida, fallo: false, sinTiempo: false };
    const ms = espera(i);
    if (!entra(ms)) return { i, salida: primera.salida, fallo: true, sinTiempo: false };
    await dormir(ms);
    const otra = await p.leer(i).catch(() => ({ salida: p.vacia(), fallo: true }));
    return { i, salida: otra.salida, fallo: otra.fallo, sinTiempo: false };
  };

  const out: Array<ParteLeida<T>> = [];
  const paso = Math.max(1, p.concurrencia);
  for (let k = 0; k < p.indices.length; k += paso) {
    const ronda = p.indices.slice(k, k + paso);
    if (!entra()) {
      for (const i of p.indices.slice(k)) out.push({ i, salida: p.vacia(), fallo: true, sinTiempo: true });
      break;
    }
    out.push(...await Promise.all(ronda.map(unaConReintento)));
  }
  return out;
}

// ── La marca de una lectura a medias ─────────────────────────────────────────────────────────────

/** La setting de la marca (`app_settings`, por workspace). Vacía = no hay lectura a medias. */
export const KEY_PARCIAL = (recordingId: number): string => `mako.reunion.parcial.${recordingId}`;

/**
 * Lo que quedó de una lectura a medias: en cuántas partes se cortó la reunión, cuáles se leyeron enteras (aunque no
 * hayan dejado tareas: leída y vacía es leída) y qué borradores dejó cada vuelta (para no repetir sus tareas).
 * ⚠️ `partes` va porque los índices sólo valen para ESE troceado: si el transcript o `CHUNK_CHARS` cambian, la marca no
 * sirve y se lee entera otra vez (`saltearSi`).
 */
export type MarcaParcial = { partes: number; leidas: number[]; refs: string[]; ts: string };

export function leerMarca(raw: string | null | undefined): MarcaParcial | null {
  if (!raw || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<MarcaParcial>;
    const partes = Number(o.partes);
    if (!Number.isInteger(partes) || partes < 1) return null;
    const leidas = unirLeidas([], Array.isArray(o.leidas) ? o.leidas.map(Number) : []).filter((i) => i < partes);
    // Las refs de una reunión de CUALQUIER grabador («fathom:123», «loom:abc»; lib/grabadores/reunion.ts).
    const refs = Array.isArray(o.refs) ? o.refs.filter((r): r is string => typeof r === 'string' && esRefDeReunion(r)).slice(0, 20) : [];
    return { partes, leidas, refs, ts: String(o.ts ?? '') };
  } catch { return null; }
}

/** Las dos listas de partes leídas, juntas, sin repetir y en orden. */
export function unirLeidas(a: readonly number[], b: readonly number[]): number[] {
  return [...new Set([...a, ...b].filter((i) => Number.isInteger(i) && i >= 0))].sort((x, y) => x - y);
}

/** ¿Ya se leyó todo? */
export const lecturaCompleta = (partes: number, leidas: readonly number[]): boolean =>
  partes > 0 && unirLeidas([], leidas).filter((i) => i < partes).length >= partes;

/**
 * Las partes a saltear de un troceado de `partes`: las de la marca, sólo si la marca es de ESTE troceado. Con otro
 * número de partes, los índices hablan de otros pedazos del texto y se lee todo.
 */
export function saltearSi(marca: Pick<MarcaParcial, 'partes' | 'leidas'> | null | undefined, partes: number): Set<number> {
  if (!marca || marca.partes !== partes) return new Set();
  return new Set(marca.leidas.filter((i) => i < partes));
}

/**
 * La `ref` del borrador con lo que se leyó en una vuelta que COMPLETA a otra: la de la reunión más las partes que leyó
 * («fathom:123:partes-3-4»). Determinista a propósito: si la función se muere después de crear el borrador y antes de
 * actualizar la marca, la vuelta siguiente lee las mismas partes y `crearPropuesta` devuelve el que ya existe.
 */
export function refDelResto(reunion: number | string, leidas: readonly number[]): string {
  // Un número suelto es un recording_id de Fathom (lo de antes de los otros grabadores); si no, la ref de la reunión.
  const base = typeof reunion === 'number' ? `fathom:${reunion}` : reunion.split(':').slice(0, 2).join(':');
  return `${base}:partes-${unirLeidas([], leidas).map((i) => i + 1).join('-')}`;
}

/**
 * Lo que una vuelta que COMPLETA trae de nuevo: sin lo que ya propuso una vuelta anterior de la misma reunión. Las partes
 * se solapan 1.500 caracteres (lib/plan-fathom.ts, `CHUNK_SOLAPE`), así que la tarea dicha en el corte sale en las dos.
 * Mismo criterio que la fusión de la extracción (`mismaTarea`). Lo que ya está en el TABLERO lo marca el cruce aparte.
 */
export function sinLasYaPropuestas<T extends { titulo: string }>(nuevas: readonly T[], ya: ReadonlyArray<{ titulo: string }>): T[] {
  return nuevas.filter((t) => !ya.some((y) => mismaTarea(y.titulo, t.titulo)));
}

/**
 * La CLAVE de una reunión desde su `ref` (lib/grabadores/reunion.ts): «fathom:123» → 123, y la de un borrador que la
 * completa también; «loom:abc» → su clave negativa. Lo que no es de una reunión: undefined.
 */
export function recordingDeRef(ref: string | null | undefined): number | undefined {
  const r = leerRef(ref);
  if (!r) return undefined;
  const clave = claveDeReunion(r.grabador, r.id);
  return Number.isFinite(clave) ? clave : undefined;
}
