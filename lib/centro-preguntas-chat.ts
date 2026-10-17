// =============================================================================
// Las preguntas de un chat de Claude Code, como FORMULARIO en su conversación (17/10/2026; puro, con test)
// =============================================================================
// Martín: «Ops Center me está preguntando algo y me pide que responda, en lugar de darme las opciones tipo multiple
// select». El caso real: un chat preguntó en TEXTO («¿Abro la ventana? Contestá "sí, ábrela"»). Desde ahora un chat
// pregunta con `cartero.mjs preguntar <archivo.json>` y la pregunta se dibuja en SU conversación como el formulario de
// AskUserQuestion de Claude Code: opciones con detalle, la recomendada primero, una o varias.
//
// EL CAMINO (decidido con criterio y avisado al chat Ticketera: un canal PROPIO del Centro, no admin_decisiones, que
// queda para los tickets de usuarios):
//   1. la PC escribe `preguntas/<uuid>.json` y la vuelta del Runner la sube (`preguntas`), como los cierres;
//   2. MaKo la guarda en app_settings, una clave por chat (lib/centro-preguntas-chat-db.ts), y dice cuáles entraron;
//   3. Martín elige en el formulario, y la respuesta vuelve FIRMADA por mandar.ts (el único camino a la PC): un trabajo
//      para esa sesión con `textoDeRespuesta`, que lleva el id de la pregunta;
//   4. recién con ese trabajo en la cola, una acción con `puedeOperar` la marca contestada, sólo si no lo estaba. Sin
//      trabajo firmado no se marca nada: lo que la PC recibe es lo firmado, no lo que diga la base.
//
// ⚠️ SE RECHAZA, NO SE RECORTA (AGENTS.md): una pregunta con un campo de más se descarta entera, y la PC la vuelve a subir
//    hasta que se corrija (la deja en su carpeta).
// ⚠️ SIN `server-only`: lo leen la PC (el mismo molde, en cartero.mjs), el servidor y las dos pantallas.

import { DESTINO_RE, UUID_RE } from './operaciones-reglas';

export const MAX_PREGUNTA = 300;
export const MAX_CONTEXTO = 600;
export const MAX_TITULO_OPCION = 80;
export const MAX_DETALLE_OPCION = 240;
export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 6;
export const MAX_OTRA = 1000;
/** Las que se guardan por chat: las más nuevas. */
export const PREGUNTAS_POR_CHAT = 20;
/** Las que entran en una vuelta del Runner. */
export const MAX_PREGUNTAS_VUELTA = 20;

export type OpcionPregunta = { titulo: string; detalle: string | null };
export type RespuestaPregunta = { elegidas: number[]; otra: string | null; at: string; trabajo: string };
export type PreguntaChat = {
  /** El uuid que le puso la PC: con él vuelve la respuesta. */
  id: string;
  /** La sesión que preguntó (`local_…` o `cli_…`). */
  local: string;
  pregunta: string;
  contexto: string | null;
  opciones: OpcionPregunta[];
  /** El índice de la recomendada (va primera en pantalla y marcada). */
  recomendada: number | null;
  /** true = se eligen varias. */
  varias: boolean;
  at: string;
  respuesta: RespuestaPregunta | null;
};

const ISO = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);
/** Un texto de un renglón (o varios, para el contexto), sin control ni espacios de más; null si no vino o se pasa. */
function texto(v: unknown, max: number, renglones = false): string | null | undefined {
  if (v == null) return null;
  if (typeof v !== 'string') return undefined;
  const t = (renglones ? v.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ') : v.replace(/\s+/g, ' ')).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  if (!t) return null;
  return t.length > max ? undefined : t;
}

/** Una pregunta como la escribe la PC (o como la guarda MaKo), validada. null = no vale: se descarta entera. */
export function sanearPregunta(x: unknown): PreguntaChat | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || !UUID_RE.test(o.id)) return null;
  if (typeof o.local !== 'string' || !DESTINO_RE.test(o.local)) return null;
  const pregunta = texto(o.pregunta, MAX_PREGUNTA);
  const contexto = texto(o.contexto, MAX_CONTEXTO, true);
  if (!pregunta || contexto === undefined) return null;
  if (!Array.isArray(o.opciones) || o.opciones.length < MIN_OPCIONES || o.opciones.length > MAX_OPCIONES) return null;
  const opciones: OpcionPregunta[] = [];
  for (const op of o.opciones) {
    if (!op || typeof op !== 'object') return null;
    const titulo = texto((op as Record<string, unknown>).titulo, MAX_TITULO_OPCION);
    const detalle = texto((op as Record<string, unknown>).detalle, MAX_DETALLE_OPCION);
    if (!titulo || detalle === undefined) return null;
    opciones.push({ titulo, detalle });
  }
  if (new Set(opciones.map((p) => p.titulo.toLowerCase())).size !== opciones.length) return null;
  const recomendada = o.recomendada == null ? null : Number.isInteger(o.recomendada) && (o.recomendada as number) >= 0 && (o.recomendada as number) < opciones.length ? (o.recomendada as number) : undefined;
  if (recomendada === undefined) return null;
  const at = ISO(o.at);
  if (!at) return null;
  const respuesta = o.respuesta == null ? null : sanearRespuesta(o.respuesta, opciones.length, o.varias === true);
  if (respuesta === undefined) return null;
  return { id: o.id, local: o.local, pregunta, contexto, opciones, recomendada, varias: o.varias === true, at, respuesta };
}

function sanearRespuesta(x: unknown, n: number, varias: boolean): RespuestaPregunta | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  const elegidas = Array.isArray(o.elegidas) ? o.elegidas : null;
  if (!elegidas || elegidas.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) return undefined;
  const unicas = [...new Set(elegidas as number[])].sort((a, b) => a - b);
  if (!varias && unicas.length > 1) return undefined;
  const otra = texto(o.otra, MAX_OTRA, true);
  if (otra === undefined || (!unicas.length && !otra)) return undefined;
  const at = ISO(o.at);
  if (!at || typeof o.trabajo !== 'string' || !UUID_RE.test(o.trabajo)) return undefined;
  return { elegidas: unicas, otra, at, trabajo: o.trabajo };
}

/** Lo que sube una vuelta: las que valen, sin repetir id, hasta el tope. */
export function sanearPreguntas(x: unknown): PreguntaChat[] {
  if (!Array.isArray(x)) return [];
  const vistas = new Set<string>();
  const out: PreguntaChat[] = [];
  for (const v of x.slice(0, MAX_PREGUNTAS_VUELTA)) {
    const p = sanearPregunta(v);
    if (!p || vistas.has(p.id)) continue;
    vistas.add(p.id);
    // Lo que sube la PC nunca viene contestado: la respuesta la pone MaKo, con el trabajo firmado.
    out.push({ ...p, respuesta: null });
  }
  return out;
}

/**
 * Las de un chat después de una vuelta: lo de antes más lo nuevo, sin pisar una ya contestada (la PC puede volver a subir
 * una que MaKo guardó si no se enteró de que entró), y las más nuevas hasta el tope.
 */
export function unirPreguntas(antes: readonly PreguntaChat[], nuevas: readonly PreguntaChat[]): PreguntaChat[] {
  const porId = new Map(antes.map((p) => [p.id, p]));
  for (const p of nuevas) if (!porId.has(p.id)) porId.set(p.id, p);
  return [...porId.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-PREGUNTAS_POR_CHAT);
}

/** Las opciones en el orden de la pantalla: la recomendada primero (como «(Recommended)» en Claude Code). Cada una con
 *  su índice ORIGINAL, que es el que viaja en la respuesta. */
export function opcionesEnOrden(p: Pick<PreguntaChat, 'opciones' | 'recomendada'>): Array<OpcionPregunta & { i: number; recomendada: boolean }> {
  const todas = p.opciones.map((o, i) => ({ ...o, i, recomendada: i === p.recomendada }));
  return [...todas.filter((o) => o.recomendada), ...todas.filter((o) => !o.recomendada)];
}

/** Lo que Martín eligió, validado contra la pregunta. */
export function eleccionValida(p: Pick<PreguntaChat, 'opciones' | 'varias'>, elegidas: readonly number[], otra: string): { ok: true; elegidas: number[]; otra: string | null } | { ok: false; error: string } {
  const unicas = [...new Set(elegidas)].filter((i) => Number.isInteger(i) && i >= 0 && i < p.opciones.length).sort((a, b) => a - b);
  const libre = otra.replace(/\s+/g, ' ').trim();
  if (libre.length > MAX_OTRA) return { ok: false, error: `Acórtala a ${MAX_OTRA} caracteres.` };
  if (!p.varias && unicas.length > 1) return { ok: false, error: 'Elige una sola.' };
  if (!unicas.length && !libre) return { ok: false, error: p.varias ? 'Elige al menos una.' : 'Elige una opción.' };
  return { ok: true, elegidas: unicas, otra: libre || null };
}

/** El marcador de la respuesta en el texto firmado: con él la PC sabe a qué pregunta contesta, y MaKo la marca. */
export const marcaDePregunta = (id: string) => `[pregunta ${id}]`;
const MARCA_RE = /\[pregunta ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/;
/** El id de la pregunta que contesta un trabajo, o null si no es una respuesta. */
export const preguntaDeTrabajo = (t: string | null | undefined): string | null => (t ? MARCA_RE.exec(t)?.[1] ?? null : null);

/** Lo que se le firma al chat: la pregunta, lo elegido por su número y su título, y lo escrito. */
export function textoDeRespuesta(p: Pick<PreguntaChat, 'id' | 'pregunta' | 'opciones'>, elegidas: readonly number[], otra: string | null): string {
  const lineas = elegidas.map((i) => `${i + 1}. ${p.opciones[i]?.titulo ?? ''}`);
  if (otra) lineas.push(`Otra: ${otra}`);
  return `Respuesta a tu pregunta «${p.pregunta}» ${marcaDePregunta(p.id)}:\n${lineas.join('\n')}`;
}

/** Lo que se ve de una respuesta en la conversación: los títulos elegidos y lo escrito, sin el marcador. */
export function resumenDeRespuesta(p: Pick<PreguntaChat, 'opciones'>, r: Pick<RespuestaPregunta, 'elegidas' | 'otra'>): string {
  return [...r.elegidas.map((i) => p.opciones[i]?.titulo).filter(Boolean), ...(r.otra ? [r.otra] : [])].join(' · ');
}
