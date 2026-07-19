import 'server-only';

// =============================================================================
// plan-inbox — bandeja de tareas para el board del super-admin (localStorage)
// =============================================================================
// El board de la agencia (/plan/agencia) vive en el localStorage del navegador: el
// servidor NO puede escribirle (bloqueo #177). Para que "MaKo por WhatsApp" pueda
// igual agregarle tareas al dueño, las deja en esta BANDEJA (una setting JSON en
// OWNER_WS). PlanBoard la lee al abrir y las mergea al localStorage (como el
// MERGE_VERSION), y ahí las vacía. Para los CLIENTES no hace falta: sus tareas van
// derecho a la base (lib/todo), que TodoBoard ya lee.
// =============================================================================

import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace, OWNER_WS } from '@/lib/workspace';

const KEY_INBOX = 'mako.plan.inbox';
const CAP = 200;                       // tope de items, por las dudas
const TTL_MS = 30 * 24 * 60 * 60_000;  // los items viejos se caen (la bandeja NO se
                                       // vacía al leer: cada browser del dueño la mergea
                                       // una vez con su propio 'seen', así llega a todos)

export type PlanPrioridad = 'alta' | 'media' | 'baja' | 'futuro';

/** Una tarea que MaKo dejó para el board del dueño. `proyecto` = nombre (se resuelve
 *  o se crea en el cliente al mergear). `refId` = id estable para el deep-link. */
export type TareaInbox = {
  refId: string;
  titulo: string;
  prioridad: PlanPrioridad;
  proyecto?: string;    // nombre del proyecto/categoría, o vacío
  deadline?: string;    // YYYY-MM-DD
  detalle?: string;
  ts: number;           // cuándo la dejó MaKo (para ordenar/limpiar)
};

const PRIOS: PlanPrioridad[] = ['alta', 'media', 'baja', 'futuro'];
const prioOk = (p: unknown): PlanPrioridad => (PRIOS.includes(p as PlanPrioridad) ? (p as PlanPrioridad) : 'media');

function parse(raw: string | null): TareaInbox[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    return a
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof x.titulo === 'string')
      .map((x) => ({
        refId: String(x.refId ?? ''),
        titulo: String(x.titulo).slice(0, 200),
        prioridad: prioOk(x.prioridad),
        proyecto: x.proyecto ? String(x.proyecto).slice(0, 120) : undefined,
        deadline: typeof x.deadline === 'string' ? x.deadline : undefined,
        detalle: typeof x.detalle === 'string' ? x.detalle.slice(0, 600) : undefined,
        ts: Number(x.ts) || 0,
      }))
      .filter((t) => t.refId && t.titulo.trim());
  } catch { return []; }
}

/** Agrega tareas a la bandeja del dueño. Devuelve los refId (para armar los links). */
export async function agregarABandeja(items: Array<Omit<TareaInbox, 'refId' | 'ts'>>): Promise<string[]> {
  return runWithWorkspace(OWNER_WS, async () => {
    const prev = parse(await getSetting(KEY_INBOX));
    const now = Date.now();
    const nuevos: TareaInbox[] = items
      .filter((it) => (it.titulo || '').trim())
      .map((it, i) => ({ refId: `wa${now}-${i}`, ts: now, titulo: it.titulo.trim(), prioridad: prioOk(it.prioridad), proyecto: it.proyecto?.trim() || undefined, deadline: it.deadline || undefined, detalle: it.detalle?.trim() || undefined }));
    const next = [...prev, ...nuevos].slice(-CAP);
    await setSetting(KEY_INBOX, JSON.stringify(next));
    return nuevos.map((t) => t.refId);
  });
}

/** Lee la bandeja del dueño (para PlanBoard). NO la vacía: cada browser la mergea una
 *  vez con su propio 'seen'. Descarta lo más viejo que el TTL (limpieza best-effort). */
export async function leerBandeja(): Promise<TareaInbox[]> {
  return runWithWorkspace(OWNER_WS, async () => {
    const todos = parse(await getSetting(KEY_INBOX));
    const min = Date.now() - TTL_MS;
    const vigentes = todos.filter((t) => t.ts >= min);
    // Si caducó alguno, reescribimos la bandeja podada (best-effort, no bloquea la lectura).
    if (vigentes.length !== todos.length) await setSetting(KEY_INBOX, JSON.stringify(vigentes)).catch(() => {});
    return vigentes;
  });
}
