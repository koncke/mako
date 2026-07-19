import 'server-only';

// =============================================================================
// plan-ops — cola de OPERACIONES sobre el board del super-admin (localStorage)
// =============================================================================
// La bandeja (plan-inbox) solo CREA tareas. Para que Claude Code (o MaKo) pueda hacer
// TODO — completar, editar, reasignar, repriorizar, borrar tareas EXISTENTES — sin
// poder tocar el localStorage del dueño, dejamos las operaciones acá (una setting JSON
// en OWNER_WS). PlanBoard las aplica al abrir (dedup por opId con su 'seen'), matcheando
// la tarea por su #num visible, y deja rastro en el historial (actor 'code'). Como la
// bandeja: NO se vacía server-side (cada device la aplica una vez) y caduca por TTL.
// =============================================================================

import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace, OWNER_WS } from '@/lib/workspace';

const KEY_OPS = 'mako.plan.ops';
const CAP = 300;
const TTL_MS = 30 * 24 * 60 * 60_000;

export type PlanOpTipo = 'completar' | 'reabrir' | 'editar' | 'proyecto' | 'prioridad' | 'borrar';
export type PlanOpCampos = { titulo?: string; detalle?: string; deadline?: string; prioridad?: string; proyecto?: string; score?: number };
export type PlanOp = {
  opId: string;      // id estable (dedup por device)
  op: PlanOpTipo;
  num: number;       // #num visible de la tarea objetivo
  campos?: PlanOpCampos;
  etiqueta?: string; // de dónde salió (para el historial: "editó · desde Claude Code · <chat>")
  ts: number;
};

const TIPOS: PlanOpTipo[] = ['completar', 'reabrir', 'editar', 'proyecto', 'prioridad', 'borrar'];

function parse(raw: string | null): PlanOp[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    return a
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && TIPOS.includes(x.op as PlanOpTipo) && Number.isFinite(Number(x.num)))
      .map((x) => ({
        opId: String(x.opId ?? ''),
        op: x.op as PlanOpTipo,
        num: Number(x.num),
        campos: (x.campos && typeof x.campos === 'object') ? (x.campos as PlanOpCampos) : undefined,
        etiqueta: typeof x.etiqueta === 'string' ? x.etiqueta.slice(0, 160) : undefined,
        ts: Number(x.ts) || 0,
      }))
      .filter((o) => o.opId);
  } catch { return []; }
}

/** Encola operaciones para el board del dueño. Devuelve los opId. */
export async function agregarOps(items: Array<Omit<PlanOp, 'opId' | 'ts'>>): Promise<string[]> {
  return runWithWorkspace(OWNER_WS, async () => {
    const prev = parse(await getSetting(KEY_OPS));
    const now = Date.now();
    const nuevos: PlanOp[] = items
      .filter((it) => TIPOS.includes(it.op) && Number.isFinite(Number(it.num)))
      .map((it, i) => ({ opId: `op${now}-${i}`, ts: now, op: it.op, num: Number(it.num), campos: it.campos, etiqueta: it.etiqueta?.slice(0, 160) }));
    const next = [...prev, ...nuevos].slice(-CAP);
    await setSetting(KEY_OPS, JSON.stringify(next));
    return nuevos.map((o) => o.opId);
  });
}

/** Lee la cola (para PlanBoard). NO la vacía; poda lo más viejo que el TTL. */
export async function leerOps(): Promise<PlanOp[]> {
  return runWithWorkspace(OWNER_WS, async () => {
    const todos = parse(await getSetting(KEY_OPS));
    const min = Date.now() - TTL_MS;
    const vigentes = todos.filter((o) => o.ts >= min);
    if (vigentes.length !== todos.length) await setSetting(KEY_OPS, JSON.stringify(vigentes)).catch(() => {});
    return vigentes;
  });
}
