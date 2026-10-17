// =============================================================================
// Las reglas de lo que un chat le pide al Plan por la PC: SÓLO LEER (17/10/2026; el servidor: lib/centro-plan-chat.ts)
// =============================================================================
// ⚠️ SIN `server-only`: lo leen el servidor y los tests. La PC arma lo mismo en cartero.mjs → `plan`.
// ⚠️ UN CHAT NO CIERRA TAREAS DEL PLAN (la decisión del Cerebro después de dos revisiones adversariales, 17/10/2026): cerrar
//    leyendo texto libre (negaciones, «en producción», una respuesta que repite el «#870») no se arregla con regex. Martín
//    cierra desde el Centro («Marcar hecha»). Lo que queda es «tráeme las más prioritarias», de sólo lectura, atado al
//    PEDIDO firmado de Martín que lo originó: la sesión y el proyecto salen de esa fila de la cola (la escribe sólo su
//    sesión con segundo factor), no de lo que declara quien llama.

import type { TareaPlanP } from './centro-plan-reglas';

/** Cuántas trae «tráeme las más prioritarias», como mucho. */
export const TOPE_PRIORIDADES = 20;
/** Un pedido firmado vale para el Plan durante esto. */
export const VIGENCIA_PEDIDO_MS = 24 * 3_600_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PedidoDePlan = { ok: true; op: 'prioridades'; trabajo: string; n: number };

export type RespuestaPlanChat =
  | { ok: true; proyecto: string | null; tareas: Array<{ num: number | null; titulo: string; prioridad: string | null; deadline: string | null }> }
  | { ok: false; error: string };

/** Lo que llegó de la PC, validado: SÓLO «prioridades», con el pedido firmado que lo pidió. */
export function sanearPedidoDePlan(x: unknown): PedidoDePlan | { ok: false; error: string } {
  if (!x || typeof x !== 'object') return { ok: false, error: 'Falta el pedido.' };
  const o = x as Record<string, unknown>;
  if (o.op !== 'prioridades') return { ok: false, error: 'Sólo «prioridades»: un chat no cierra tareas (Martín las marca hechas en el Centro).' };
  if (typeof o.trabajo !== 'string' || !UUID_RE.test(o.trabajo)) return { ok: false, error: 'Falta el pedido firmado de Martín que lo pide (--trabajo <id>).' };
  const n = Number.isInteger(o.n) && (o.n as number) > 0 ? Math.min(o.n as number, TOPE_PRIORIDADES) : 10;
  return { ok: true, op: 'prioridades', trabajo: o.trabajo, n };
}

/** ¿Ese trabajo es un PEDIDO de Martín que le llegó a un chat hace poco? (No la respuesta a una pregunta del chat: ésa lleva
 *  la marca `[pregunta …]` y repite lo que el chat preguntó.) null = vale; si no, por qué no. */
export function pedidoAutoriza(w: { texto: string; estado: string; creado: string } | null, ahora: number): string | null {
  if (!w) return 'Ese pedido no existe.';
  if (/\[pregunta [^\]]+\]/.test(w.texto)) return 'Eso es la respuesta a una pregunta, no un pedido de Martín.';
  if (!['entregado', 'hecho', 'comprobado'].includes(w.estado)) return 'Ese pedido todavía no le llegó al chat.';
  const t = Date.parse(w.creado);
  if (!Number.isFinite(t) || ahora - t > VIGENCIA_PEDIDO_MS) return 'Ese pedido es de hace más de un día: que Martín lo pida otra vez.';
  return null;
}

/** El orden de «las más prioritarias»: alta, media, baja, futuro y sin prioridad; a igual prioridad, la que vence antes. */
const RANGO: Record<string, number> = { alta: 0, media: 1, baja: 2, futuro: 3 };
export const ordenarPorPrioridad = (ts: readonly TareaPlanP[]): TareaPlanP[] =>
  [...ts].sort((a, b) => (RANGO[a.prioridad ?? ''] ?? 4) - (RANGO[b.prioridad ?? ''] ?? 4)
    || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.titulo.localeCompare(b.titulo));
