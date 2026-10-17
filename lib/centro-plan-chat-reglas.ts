// =============================================================================
// Las reglas de lo que un chat le pide al Plan por la PC (17/10/2026; el servidor: lib/centro-plan-chat.ts)
// =============================================================================
// ⚠️ SIN `server-only`: lo leen el servidor y los tests. La PC arma lo mismo en cartero.mjs → `plan`.
// ⚠️ LA REVISIÓN DEL CEREBRO (17/10/2026) tiró la primera versión: la `sesion` la declara quien llama, y el token del cartero
//    es uno para toda la PC, así que un chat podía hablar por otro jefe. Desde la segunda, todo pedido trae el TRABAJO
//    FIRMADO de Martín que lo originó (`trabajo`): tiene que ser para ESA sesión, haberle llegado (entregado), ser de hace
//    menos de un día y, para cerrar, nombrar la tarea por su número. Así lo que pasa es lo que Martín pidió firmado.

import { DESTINO_RE } from './operaciones-reglas';
import type { TareaPlanP } from './centro-plan-reglas';

/** Cuántas trae «tráeme las más prioritarias», como mucho. */
export const TOPE_PRIORIDADES = 20;
const TOPE_EVIDENCIA = 400;
/** Un pedido firmado vale para el Plan durante esto: «ciérrala» de ayer no cierra hoy. */
export const VIGENCIA_PEDIDO_MS = 24 * 3_600_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PedidoDePlan =
  | { ok: true; op: 'prioridades'; sesion: string; trabajo: string; n: number }
  | { ok: true; op: 'cerrar'; sesion: string; trabajo: string; num: number; evidencia: string };

export type RespuestaPlanChat =
  | { ok: true; proyecto: string | null; tareas: Array<{ num: number | null; titulo: string; prioridad: string | null; deadline: string | null }> }
  | { ok: true; cerrada: { num: number | null } }
  | { ok: false; error: string };

/** Lo que llegó de la PC, validado: SÓLO esas dos operaciones, una sesión de verdad, el trabajo firmado que lo pidió y un
 *  número de tarea entero. */
export function sanearPedidoDePlan(x: unknown): PedidoDePlan | { ok: false; error: string } {
  if (!x || typeof x !== 'object') return { ok: false, error: 'Falta el pedido.' };
  const o = x as Record<string, unknown>;
  if (typeof o.sesion !== 'string' || !DESTINO_RE.test(o.sesion)) return { ok: false, error: 'Falta la sesión del chat (corre esto desde el chat).' };
  if (typeof o.trabajo !== 'string' || !UUID_RE.test(o.trabajo)) return { ok: false, error: 'Falta el trabajo firmado de Martín que lo pide (--trabajo <id>).' };
  if (o.op === 'prioridades') {
    const n = Number.isInteger(o.n) && (o.n as number) > 0 ? Math.min(o.n as number, TOPE_PRIORIDADES) : 10;
    return { ok: true, op: 'prioridades', sesion: o.sesion, trabajo: o.trabajo, n };
  }
  if (o.op === 'cerrar') {
    const num = Number(String(o.num ?? '').replace(/^#/, ''));
    if (!Number.isInteger(num) || num < 1) return { ok: false, error: 'Di qué tarea cerrar por su número: plan cerrar #870.' };
    const evidencia = typeof o.evidencia === 'string' ? o.evidencia.replace(/\s+/g, ' ').trim().slice(0, TOPE_EVIDENCIA) : '';
    return { ok: true, op: 'cerrar', sesion: o.sesion, trabajo: o.trabajo, num, evidencia };
  }
  return { ok: false, error: 'Sólo «prioridades» o «cerrar #N».' };
}

/** ¿El trabajo firmado autoriza ESTE pedido? Para esa sesión, entregado, de hace menos de un día y —para cerrar— nombrando la
 *  tarea por su número («#870»). null = vale; si no, por qué no. */
export function trabajoAutoriza(
  w: { destino: string; texto: string; estado: string; creado: string } | null, p: PedidoDePlan, ahora: number,
): string | null {
  if (!w) return 'Ese trabajo no existe.';
  if (w.destino !== p.sesion) return 'Ese trabajo no es de este chat.';
  if (!['entregado', 'hecho', 'comprobado'].includes(w.estado)) return 'Ese trabajo todavía no le llegó a este chat.';
  const t = Date.parse(w.creado);
  if (!Number.isFinite(t) || ahora - t > VIGENCIA_PEDIDO_MS) return 'Ese pedido es de hace más de un día: que Martín lo pida otra vez.';
  if (p.op === 'cerrar' && !new RegExp(`(?:^|[^\\w&/])#${p.num}(?!\\d)`).test(w.texto)) return `Martín no nombró la #${p.num} en ese pedido.`;
  return null;
}

/** El orden de «las más prioritarias»: alta, media, baja, futuro y sin prioridad; a igual prioridad, la que vence antes. */
const RANGO: Record<string, number> = { alta: 0, media: 1, baja: 2, futuro: 3 };
export const ordenarPorPrioridad = (ts: readonly TareaPlanP[]): TareaPlanP[] =>
  [...ts].sort((a, b) => (RANGO[a.prioridad ?? ''] ?? 4) - (RANGO[b.prioridad ?? ''] ?? 4)
    || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.titulo.localeCompare(b.titulo));

/** La tarea a cerrar, buscada SÓLO entre las abiertas del proyecto del jefe. null = no está ahí. */
export const tareaDelPedido = (tareas: readonly TareaPlanP[], num: number): TareaPlanP | null => tareas.find((t) => t.num === num) ?? null;
