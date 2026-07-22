// =============================================================================
// plan-propuesta — el BORRADOR que MaKo deja para revisar en la app (mig 0094)
// =============================================================================
// MaKo por WhatsApp arma un borrador (tareas + notas/preguntas) en vez de hacer el
// ida-y-vuelta frágil por chat. El dueño abre /plan/revisar/<id>, edita/responde y
// confirma → recién ahí se CREAN las tareas (agregarTareasPlanOwner + el Perro) y la
// propuesta queda 'aplicada'. El board del /plan es de la AGENCIA → siempre OWNER_WS.

import 'server-only';
import { getTenantDb, runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { agregarTareasPlanOwner, priorizarNuevasOwner } from '@/lib/plan-board';
import type { Prio, Fuente, FuenteTipo } from '@/app/plan/board/types';

type Row = Record<string, unknown>;
const enWs = <T,>(fn: () => Promise<T>): Promise<T> => runWithWorkspace(OWNER_WS, fn);
const genId = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const PRIOS: Prio[] = ['alta', 'media', 'baja', 'futuro'];

export type PropuestaTarea = { titulo: string; proyecto?: string; deadline?: string; detalle?: string; prioridad?: Prio };
export type Propuesta = { id: string; estado: 'pendiente' | 'aplicada' | 'descartada'; resumen: string; origen?: string; tareas: PropuestaTarea[]; notas: string[]; createdAt: string };

function limpiarTarea(t: unknown): PropuestaTarea | null {
  if (!t || typeof t !== 'object') return null;
  const o = t as Record<string, unknown>;
  const titulo = str(o.titulo).trim().slice(0, 200);
  if (!titulo) return null;
  const prioridad = PRIOS.includes(o.prioridad as Prio) ? (o.prioridad as Prio) : undefined;
  return {
    titulo,
    proyecto: o.proyecto ? str(o.proyecto).trim().slice(0, 120) : undefined,
    deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : undefined,
    detalle: o.detalle ? str(o.detalle).slice(0, 600) : undefined,
    prioridad,
  };
}

/** Crea el borrador. Devuelve el id (para armar el link /plan/revisar/<id>). */
export async function crearPropuesta(draft: { tareas: PropuestaTarea[]; notas: string[]; resumen?: string; origen?: string }): Promise<string> {
  return enWs(async () => {
    const db = await getTenantDb();
    const tareas = draft.tareas.map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    const notas = asArr<unknown>(draft.notas).map((n) => str(n).trim()).filter(Boolean).slice(0, 6);
    const id = genId('prop');
    const { error } = await db.from('plan_propuestas').insert({
      id, estado: 'pendiente', origen: draft.origen ?? 'whatsapp', resumen: (draft.resumen ?? '').slice(0, 300),
      tareas, notas,
    });
    if (error) throw new Error(`crearPropuesta: ${error.message}`);
    return id;
  });
}

export async function getPropuesta(id: string): Promise<Propuesta | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    const r = data as Row;
    return {
      id: str(r.id), estado: (str(r.estado, 'pendiente') as Propuesta['estado']),
      resumen: str(r.resumen), origen: r.origen ? str(r.origen) : undefined,
      tareas: asArr<unknown>(r.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t),
      notas: asArr<unknown>(r.notas).map(String), createdAt: str(r.created_at),
    };
  });
}

/** Aplica el borrador: crea las tareas (con el Perro) y marca 'aplicada'. `tareasEditadas`
 *  = lo que el dueño dejó en la pantalla de revisión (pisa lo original). Idempotente por
 *  estado: si ya se aplicó/descartó, no re-crea. */
export async function aplicarPropuesta(id: string, tareasEditadas?: PropuestaTarea[]): Promise<{ ok: boolean; ids: string[]; error?: string } | null> {
  return enWs(async () => {
    const db = await getTenantDb();
    const prop = await getPropuesta(id);
    if (!prop) return null;
    if (prop.estado !== 'pendiente') return { ok: false, ids: [], error: `La propuesta ya fue ${prop.estado}.` };
    const fuenteTipo = (['whatsapp', 'fathom', 'mako', 'archivo', 'claude-code'].includes(prop.origen ?? '') ? prop.origen : 'whatsapp') as FuenteTipo;
    const base = (tareasEditadas ?? prop.tareas).map(limpiarTarea).filter((t): t is PropuestaTarea => !!t);
    if (!base.length) return { ok: false, ids: [], error: 'No hay tareas para crear.' };
    const { ids, proyectoIds } = await agregarTareasPlanOwner(
      base.map((t) => ({ titulo: t.titulo, prioridad: t.prioridad, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle })),
      { tipo: fuenteTipo } as Fuente,
    );
    await priorizarNuevasOwner(ids, proyectoIds).catch((e) => { console.error('[plan-propuesta] priorizar:', e instanceof Error ? e.message : String(e)); return null; });
    await db.from('plan_propuestas').update({ estado: 'aplicada', applied_at: new Date().toISOString() }).eq('id', id);
    return { ok: true, ids };
  });
}

export async function descartarPropuesta(id: string): Promise<boolean> {
  return enWs(async () => {
    const db = await getTenantDb();
    const { error } = await db.from('plan_propuestas').update({ estado: 'descartada' }).eq('id', id).eq('estado', 'pendiente');
    return !error;
  });
}
