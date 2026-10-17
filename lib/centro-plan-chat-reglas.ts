// =============================================================================
// Las reglas de lo que un chat le pide al Plan por la PC (17/10/2026; el servidor: lib/centro-plan-chat.ts)
// =============================================================================
// ⚠️ SIN `server-only`: lo leen el servidor y los tests. La PC arma lo mismo en cartero.mjs → `plan`.

import { DESTINO_RE } from './operaciones-reglas';
import type { TareaPlanP } from './centro-plan-reglas';

/** Cuántas trae «tráeme las más prioritarias», como mucho. */
export const TOPE_PRIORIDADES = 20;
const TOPE_EVIDENCIA = 400;

export type PedidoDePlan =
  | { ok: true; op: 'prioridades'; sesion: string; n: number }
  | { ok: true; op: 'cerrar'; sesion: string; num: number; evidencia: string };

export type RespuestaPlanChat =
  | { ok: true; proyecto: string | null; tareas: Array<{ num: number | null; titulo: string; prioridad: string | null; deadline: string | null; avance: number }> }
  | { ok: true; cerrada: { num: number | null; titulo: string } }
  | { ok: false; error: string };

/** Lo que llegó de la PC, validado: SÓLO esas dos operaciones, una sesión de verdad y un número de tarea entero. */
export function sanearPedidoDePlan(x: unknown): PedidoDePlan | { ok: false; error: string } {
  if (!x || typeof x !== 'object') return { ok: false, error: 'Falta el pedido.' };
  const o = x as Record<string, unknown>;
  if (typeof o.sesion !== 'string' || !DESTINO_RE.test(o.sesion)) return { ok: false, error: 'Falta la sesión del chat (corre esto desde el chat).' };
  if (o.op === 'prioridades') {
    const n = Number.isInteger(o.n) && (o.n as number) > 0 ? Math.min(o.n as number, TOPE_PRIORIDADES) : 10;
    return { ok: true, op: 'prioridades', sesion: o.sesion, n };
  }
  if (o.op === 'cerrar') {
    const num = Number(String(o.num ?? '').replace(/^#/, ''));
    if (!Number.isInteger(num) || num < 1) return { ok: false, error: 'Di qué tarea cerrar por su número: plan cerrar #870.' };
    const evidencia = typeof o.evidencia === 'string' ? o.evidencia.replace(/\s+/g, ' ').trim().slice(0, TOPE_EVIDENCIA) : '';
    return { ok: true, op: 'cerrar', sesion: o.sesion, num, evidencia };
  }
  return { ok: false, error: 'Sólo «prioridades» o «cerrar #N».' };
}

/** La tarea a cerrar, buscada SÓLO entre las abiertas del proyecto del jefe. null = no está ahí. */
export const tareaDelPedido = (tareas: readonly TareaPlanP[], num: number): TareaPlanP | null => tareas.find((t) => t.num === num) ?? null;
